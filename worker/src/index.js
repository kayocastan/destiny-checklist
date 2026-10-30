/* Servidor do site DPI (Cloudflare Worker + banco D1).
   /defs  – nomes e dados resumidos de definições da Bungie, guardados para todos os visitantes.
   /sync  – favoritos, builds salvas, marcações e preferências de cada pessoa, ligados à conta Bungie.
   A chave da API da Bungie é pública (o site já a entrega ao navegador); o navegador a envia em X-API-Key. */
import { compact } from './compact.js';
const BUNGIE = 'https://www.bungie.net/Platform';
const TYPES = new Set(['DestinyInventoryItemDefinition', 'DestinyObjectiveDefinition', 'DestinyLocationDefinition', 'DestinyActivityDefinition', 'DestinyMilestoneDefinition', 'DestinyLoadoutNameDefinition', 'DestinyRecordDefinition', 'DestinyCollectibleDefinition', 'DestinyPresentationNodeDefinition', 'DestinyDestinationDefinition', 'DestinyEquipableItemSetDefinition', 'DestinyStatDefinition']);
const SET = 'DestinyEquipableItemSetDefinition';
const SYNC_KEYS = /^(favs|builds|opts|hide2|goals|marks-\d{1,25})$/;
const MAX_BATCH = 12;              // até 12 itens por pedido: mantém o tempo de CPU abaixo de 10 ms quando há muitas buscas novas na Bungie
const MAX_VALUE = 400_000;         // tamanho máximo de cada valor sincronizado

const cors = req => ({
  'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

// A chave da Bungie só vale para o endereço configurado no portal (Origin Header). Durante a troca de endereço
// do site, tenta o endereço de quem pediu e depois os conhecidos; o que funcionar fica lembrado.
const SITES = ['https://destinyparallel.vercel.app', 'https://destiny-checklist.vercel.app'];
let goodOrigin = null;
async function bungie(req, path, token) {
  const mine = req.headers.get('Origin'), tries = [...new Set([goodOrigin, mine, ...SITES].filter(Boolean))];
  let last;
  for (const origin of tries) {
    const headers = { 'X-API-Key': req.headers.get('X-API-Key') || '', Origin: origin };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(BUNGIE + path, { headers });
    const j = await r.json().catch(() => null);
    if (j?.ErrorCode === 2107) { last = j; continue; } // endereço não bate com a chave: tenta o próximo
    if (!j || j.ErrorCode !== 1) { const e = new Error(j?.Message || 'HTTP ' + r.status); e.code = j?.ErrorCode; throw e; }
    goodOrigin = origin;
    return j.Response;
  }
  const e = new Error(last?.Message || 'origin'); e.code = 2107; throw e;
}

async function defs(req, env) {
  const { t, lc, h } = await req.json().catch(() => ({}));
  if (!TYPES.has(t) || !['en', 'pt'].includes(lc) || !Array.isArray(h)) return json(req, { error: 'bad request' }, 400);
  const hashes = [...new Set(h.map(x => Number(x) >>> 0).filter(Boolean))].slice(0, t === SET ? 8 : MAX_BATCH); // conjunto = 1 + bônus (até ~5 buscas)
  const key = x => `${t}:${lc}:${x}`, out = {}, now = Date.now();
  if (hashes.length) {
    const rows = await env.DB.prepare(`SELECT k, v, t FROM defs WHERE k IN (${hashes.map(() => '?').join(',')})`).bind(...hashes.map(key)).all();
    for (const r of rows.results || []) out[r.k.slice(r.k.lastIndexOf(':') + 1)] = JSON.parse(r.v);
  }
  const miss = hashes.filter(x => !out[x]), fresh = [];
  await Promise.all(miss.map(async x => {
    try {
      const L = lc === 'pt' ? 'pt-br' : 'en', d = await bungie(req, `/Destiny2/Manifest/${t}/${x}/?lc=${L}`);
      // conjunto de armadura: já vem com os bônus resolvidos (nome, descrição, ícone e peças necessárias)
      if (t === SET) out[x] = { n: d.displayProperties?.name || '', perks: (await Promise.all((d.setPerks || []).map(p => bungie(req, `/Destiny2/Manifest/DestinySandboxPerkDefinition/${p.sandboxPerkHash}/?lc=${L}`).then(sp => ({ c: p.requiredSetCount, n: sp.displayProperties?.name || '', d: sp.displayProperties?.description || '', ic: sp.displayProperties?.icon || '' })).catch(() => null)))).filter(Boolean).sort((a, b) => a.c - b.c) };
      else out[x] = compact(t, d); fresh.push([key(x), JSON.stringify(out[x])]); }
    catch (e) { if (e.code === 2101 || e.code === 2102 || e.code === 2107) throw e; } // chave da API recusada: não adianta continuar
  }));
  if (fresh.length && !(await brake(env))) await env.DB.prepare(`INSERT OR REPLACE INTO defs (k, v, t) VALUES ${fresh.map(() => '(?, ?, ?)').join(',')}`).bind(...fresh.flatMap(([k, v]) => [k, v, now])).run().catch(() => {}); // sem gravar (limite do dia), ainda devolve os nomes
  return json(req, { d: out });
}

// quem está pedindo: confere o token da Bungie (guardado por 50 min pelo resumo do token, nunca o token em si)
async function who(req, env) {
  const auth = req.headers.get('Authorization') || '', token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const now = Date.now(), row = await env.DB.prepare('SELECT uid, exp FROM tok WHERE h = ?').bind(hash).first();
  if (row && row.exp > now) return row.uid;
  const m = await bungie(req, '/User/GetMembershipsForCurrentUser/', token).catch(() => null);
  const uid = m?.bungieNetUser?.membershipId; if (!uid) return null;
  // guardar o resumo do token é só economia; com o freio ligado ou o banco recusando gravações, segue sem guardar
  if (!(await brake(env))) await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO tok (h, uid, exp) VALUES (?, ?, ?)').bind(hash, String(uid), now + 50 * 60000), env.DB.prepare('DELETE FROM tok WHERE exp < ?').bind(now)]).catch(() => {});
  return String(uid);
}

async function sync(req, env) {
  const uid = await who(req, env);
  if (!uid) return json(req, { error: 'auth' }, 401);
  if (req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT k, v, t FROM kv WHERE uid = ?').bind(uid).all();
    const out = {}; for (const r of rows.results || []) out[r.k] = { v: JSON.parse(r.v), t: r.t };
    return json(req, { d: out });
  }
  if (await brake(env)) return json(req, { error: 'brake' }, 503); // freio: cada aparelho guarda as mudanças até o ciclo virar
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return json(req, { error: 'bad request' }, 400);
  const stm = [];
  for (const [k, x] of Object.entries(body).slice(0, 20)) {
    if (!SYNC_KEYS.test(k) || !x || typeof x.t !== 'number') continue;
    const v = JSON.stringify(x.v ?? null); if (v.length > MAX_VALUE) continue;
    // a versão mais nova vence (se outro aparelho gravou depois, a gravação antiga é ignorada)
    stm.push(env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t WHERE excluded.t > kv.t').bind(uid, k, v, Math.min(x.t, Date.now() + 60000)));
  }
  if (stm.length) await env.DB.batch(stm);
  return json(req, { ok: stm.length });
}

/* ---------- Freio de gastos (plano pago) ----------
   De hora em hora lê no Analytics quanto já foi usado no ciclo de cobrança (renova no dia BILL_DAY).
   Acima de 80% do incluído em qualquer item: para de gravar o dispensável (nomes novos, registro de login,
   sincronização). Acima de 95%: o servidor deixa de responder e o site usa a Bungie direto, até o ciclo virar. */
const INCL = { req: 10e6, write: 50e6, read: 25e9, cpu: 30e6 }; // cpu em ms de CPU por ciclo
function cycleStart(env, now = new Date()) {
  const day = +env.BILL_DAY || 1, d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(day, dim(d.getUTCFullYear(), d.getUTCMonth()))));
  if (s > now) { const y = d.getUTCMonth() ? d.getUTCFullYear() : d.getUTCFullYear() - 1, m = (d.getUTCMonth() + 11) % 12; s = new Date(Date.UTC(y, m, Math.min(day, dim(y, m)))); }
  return s;
}
async function monthUsage(env) {
  const s = cycleStart(env).toISOString().slice(0, 10), u = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const cf = await cfGraph(env, `query($a: String!, $s: Date!, $u: Date!) { viewer { accounts(filter: { accountTag: $a }) {
    w: workersInvocationsAdaptive(limit: 1000, filter: { date_geq: $s, date_leq: $u }) { sum { requests } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { date } }
    d: d1AnalyticsAdaptiveGroups(limit: 1000, filter: { date_geq: $s, date_leq: $u }) { sum { rowsRead rowsWritten } dimensions { date } }
  } } }`, { a: env.ACCOUNT_ID, s, u });
  if (cf.error) return { error: cf.error };
  const a = cf.viewer?.accounts?.[0] || {}, sum = (l, f) => (l || []).reduce((t, x) => t + (f(x) || 0), 0);
  // tempo de CPU: a Cloudflare só informa medianas por dia; estimativa conservadora = pedidos × (mediana + pior caso) / 2
  const cpu = (a.w || []).reduce((t, x) => t + (x.sum.requests || 0) * (((x.quantiles?.cpuTimeP50 || 0) + (x.quantiles?.cpuTimeP99 || 0)) / 2) / 1000, 0);
  const use = { since: s, req: sum(a.w, x => x.sum.requests), write: sum(a.d, x => x.sum.rowsWritten), read: sum(a.d, x => x.sum.rowsRead), cpu: Math.round(cpu) };
  const p = Math.max(use.req / INCL.req, use.write / INCL.write, use.read / INCL.read, use.cpu / INCL.cpu);
  return { ...use, pct: p, level: p >= .95 ? 2 : p >= .8 ? 1 : 0, at: Date.now() };
}
let BRAKE = { level: 0, t: 0 };
async function brake(env) {
  if (Date.now() - BRAKE.t < 300000) return BRAKE.level;
  try { const r = await env.DB.prepare("SELECT v FROM meta WHERE k = 'brake'").first(); BRAKE = { level: r ? JSON.parse(r.v).level || 0 : 0, t: Date.now() }; } catch { BRAKE.t = Date.now(); }
  return BRAKE.level;
}

/* Painel de uso (só para o dono do site): números do banco + Analytics da Cloudflare dos últimos 7 dias. */
async function cfGraph(env, query, variables) {
  if (!env.CF_TOKEN) return { error: 'sem token de Analytics' };
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + env.CF_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(() => null);
  if (!j || j.errors?.length) return { error: j?.errors?.[0]?.message || 'HTTP ' + r.status };
  return j.data;
}
// acesso único: o site manda um sinal por dia por navegador (id aleatório) ou por conta (logado); guarda só o resumo
const spDay = (t = Date.now()) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10); // dia no horário de Brasília
async function hit(req, env) {
  if (await brake(env)) return json(req, { ok: false }, 503);
  let b; try { b = await req.json(); } catch { return json(req, { error: 'bad' }, 400); }
  const v = String(b?.v || ''); if (!/^[am]:[\w-]{6,64}$/.test(v)) return json(req, { error: 'bad' }, 400);
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dpi|' + v)))].slice(0, 10).map(x => x.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT INTO visit (d, v, u) VALUES (?, ?, ?) ON CONFLICT(d, v) DO UPDATE SET u = MAX(u, excluded.u)').bind(spDay(), h, v[0] === 'm' ? 1 : 0).run().catch(() => {});
  return json(req, { ok: true });
}
async function visits(env) {
  const d0 = spDay(), dd = n => spDay(Date.now() - n * 864e5);
  const q = (sql, ...a) => env.DB.prepare(sql).bind(...a).first().catch(() => null);
  const [t, w, m, all, days] = await Promise.all([
    q('SELECT COUNT(*) n, SUM(u) l FROM visit WHERE d = ?', d0),
    q('SELECT COUNT(DISTINCT v) n FROM visit WHERE d >= ?', dd(6)),
    q('SELECT COUNT(DISTINCT v) n FROM visit WHERE d >= ?', dd(29)),
    q('SELECT COUNT(DISTINCT v) n, MIN(d) since FROM visit'),
    env.DB.prepare('SELECT d, COUNT(*) n, SUM(u) l FROM visit WHERE d >= ? GROUP BY d ORDER BY d').bind(dd(13)).all().then(r => r.results).catch(() => []),
  ]);
  return { today: t?.n || 0, todayLogged: t?.l || 0, d7: w?.n || 0, d30: m?.n || 0, total: all?.n || 0, since: all?.since || null, days };
}
async function stats(req, env) {
  const uid = await who(req, env);
  if (!uid) return json(req, { error: 'auth' }, 401);
  if (uid !== String(env.OWNER)) return json(req, { error: 'forbidden' }, 403);
  const now = Date.now(), day = 864e5;
  const [defs, users, act7, act1, kvSize, defsBy] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) n, SUM(LENGTH(v)) b FROM defs').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT uid) n FROM kv').first(),
    env.DB.prepare('SELECT COUNT(DISTINCT uid) n FROM kv WHERE t > ?').bind(now - 7 * day).first(),
    env.DB.prepare('SELECT COUNT(DISTINCT uid) n FROM kv WHERE t > ?').bind(now - day).first(),
    env.DB.prepare('SELECT SUM(LENGTH(v)) b, COUNT(*) n FROM kv').first(),
    env.DB.prepare("SELECT substr(k, 1, instr(k, ':') - 1) t, COUNT(*) n FROM defs GROUP BY 1 ORDER BY 2 DESC").all(),
  ]);
  const size = (await env.DB.prepare('SELECT 1').run()).meta?.size_after || null;
  const man = await env.DB.prepare("SELECT v FROM meta WHERE k = 'manifest'").first().catch(() => null);
  const since = new Date(now - 7 * day).toISOString().slice(0, 10), until = new Date(now + day).toISOString().slice(0, 10);
  const cf = await cfGraph(env, `query($a: String!, $s: Date!, $u: Date!, $w: String!) { viewer { accounts(filter: { accountTag: $a }) {
    workers: workersInvocationsAdaptive(limit: 100, filter: { date_geq: $s, date_leq: $u, scriptName: $w }) { sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { date } }
    d1: d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $s, date_leq: $u }) { sum { readQueries writeQueries rowsRead rowsWritten } dimensions { date } }
  } } }`, { a: env.ACCOUNT_ID, s: since, u: until, w: 'dni-api' });
  return json(req, {
    at: now,
    db: { size, defs: defs?.n || 0, defsBytes: defs?.b || 0, users: users?.n || 0, active7: act7?.n || 0, active1: act1?.n || 0, kvBytes: kvSize?.b || 0, kvRows: kvSize?.n || 0, byType: defsBy.results || [], manifest: man?.v ? JSON.parse(man.v) : null },
    visits: await visits(env),
    month: await monthUsage(env).catch(e => ({ error: String(e.message || e) })),
    brake: await env.DB.prepare("SELECT v FROM meta WHERE k = 'brake'").first().then(r => r ? JSON.parse(r.v) : null).catch(() => null),
    cf: cf.error ? { error: cf.error } : { workers: cf.viewer?.accounts?.[0]?.workers || [], d1: cf.viewer?.accounts?.[0]?.d1 || [] },
  });
}

export default {
  // de hora em hora: confere o uso do ciclo e liga/desliga o freio
  async scheduled(ev, env) {
    const m = await monthUsage(env); if (m.error) return;
    await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('brake', ?)").bind(JSON.stringify(m)).run().catch(() => {});
    if (new Date().getUTCHours() === 6) await env.DB.prepare('DELETE FROM visit WHERE d < ?').bind(spDay(Date.now() - 400 * 864e5)).run().catch(() => {}); // guarda ~13 meses
  },
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (path !== '/stats' && path !== '/whoami' && (await brake(env)) >= 2) return json(req, { error: 'brake' }, 503);
      if (path === '/defs' && req.method === 'POST') return await defs(req, env);
      if (path === '/sync' && (req.method === 'GET' || req.method === 'PUT')) return await sync(req, env);
      if (path === '/hit' && req.method === 'POST') return await hit(req, env);
      if (path === '/stats' && req.method === 'GET') return await stats(req, env);
      if (path === '/whoami' && req.method === 'GET') { const uid = await who(req, env); return json(req, { uid, owner: !!uid && uid === String(env.OWNER) }); }
      if (path === '/') return json(req, { ok: true, service: 'dni-api' });
      return json(req, { error: 'not found' }, 404);
    } catch (e) {
      return json(req, { error: String(e.message || e) }, 502);
    }
  },
};
