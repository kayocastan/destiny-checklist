/* Servidor do site DPI (Cloudflare Worker + banco D1).
   /defs  – nomes e dados resumidos de definições da Bungie, guardados para todos os visitantes.
   /sync  – favoritos, builds salvas, marcações e preferências de cada pessoa, ligados à conta Bungie.
   A chave da API da Bungie é pública (o site já a entrega ao navegador); o navegador a envia em X-API-Key. */
import { compact } from './compact.js';
const BUNGIE = 'https://www.bungie.net/Platform';
const TYPES = new Set(['DestinyInventoryItemDefinition', 'DestinyObjectiveDefinition', 'DestinyLocationDefinition', 'DestinyActivityDefinition', 'DestinyMilestoneDefinition', 'DestinyLoadoutNameDefinition', 'DestinyRecordDefinition', 'DestinyCollectibleDefinition', 'DestinyPresentationNodeDefinition', 'DestinyDestinationDefinition', 'DestinyEquipableItemSetDefinition', 'DestinyStatDefinition']);
const SET = 'DestinyEquipableItemSetDefinition';
const SYNC_KEYS = /^(favs|builds|opts|hide2|goals|wish|focus|tags|notes|evo|marks-\d{1,25})$/;
const MAX_BATCH = 12;              // até 12 itens por pedido: mantém o tempo de CPU abaixo de 10 ms quando há muitas buscas novas na Bungie
const MAX_VALUE = 400_000;         // tamanho máximo de cada valor sincronizado

const cors = req => ({
  'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

/* ---------- Build pública: /b/<código> ----------
   POST /pub (logado) guarda a foto da build e devolve o código; a mesma build da mesma pessoa reaproveita o código.
   GET /pub/<c> devolve a foto; /page/<c> é a página do site com as etiquetas de prévia (Discord, WhatsApp) já preenchidas. */
const PUB_MAX = 120_000, PUB_PER_USER = 5; // até 5 links fixos por conta; o 6º substitui o mais antigo (o site avisa)
const pubCode = () => { const a = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = crypto.getRandomValues(new Uint8Array(6)); return [...r].map(x => a[x % a.length]).join(''); };
async function pubPost(req, env) {
  const uid = await who(req, env); if (!uid) return json(req, { error: 'auth' }, 401);
  if (await brake(env)) return json(req, { error: 'brake' }, 503);
  const body = await req.json().catch(() => null); const sig = String(body?.sig || '').slice(0, 200);
  const v = JSON.stringify(body?.snap || null); if (!body?.snap || !sig || v.length > PUB_MAX) return json(req, { error: 'bad request' }, 400);
  const old = await env.DB.prepare('SELECT c FROM pub WHERE uid = ? AND sig = ?').bind(uid, sig).first();
  const cnt = async () => (await env.DB.prepare('SELECT COUNT(*) n FROM pub WHERE uid = ?').bind(uid).first())?.n || 0;
  if (old) { await env.DB.prepare('UPDATE pub SET v = ?, t = ? WHERE c = ?').bind(v, Date.now(), old.c).run(); return json(req, { c: old.c, n: await cnt(), max: PUB_PER_USER }); }
  let replaced = null;
  // passou do limite: sai o mais antigo (e o site diz qual foi); o excesso de antes do limite também sai
  while ((await cnt()) >= PUB_PER_USER) { const o = await env.DB.prepare('SELECT c, v FROM pub WHERE uid = ? ORDER BY t LIMIT 1').bind(uid).first(); if (!o) break; try { replaced = JSON.parse(o.v)?.og?.t || o.c; } catch { replaced = o.c; } await env.DB.prepare('DELETE FROM pub WHERE c = ?').bind(o.c).run(); await env.DB.prepare('DELETE FROM pubimg WHERE c = ?').bind(o.c).run().catch(() => {}); }
  for (let i = 0; i < 4; i++) { const c = pubCode(); const r = await env.DB.prepare('INSERT OR IGNORE INTO pub (c, v, uid, sig, t) VALUES (?, ?, ?, ?, ?)').bind(c, v, uid, sig, Date.now()).run(); if (r.meta?.changes) return json(req, { c, n: await cnt(), max: PUB_PER_USER, replaced }); }
  return json(req, { error: 'busy' }, 503);
}
async function pubGet(req, env, c) {
  if (!/^[A-Za-z0-9]{6}$/.test(c)) return json(req, { error: 'not found' }, 404);
  const r = await env.DB.prepare('SELECT v, t FROM pub WHERE c = ?').bind(c).first(); if (!r) return json(req, { error: 'not found' }, 404);
  return new Response(`{"snap":${r.v},"t":${r.t}}`, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...cors(req) } });
}
// imagem de prévia: só quem criou o link envia (até 450 KB, JPEG); qualquer um lê
async function pubImgPost(req, env, c) {
  const uid = await who(req, env); if (!uid) return json(req, { error: 'auth' }, 401);
  if (await brake(env)) return json(req, { error: 'brake' }, 503);
  const own = await env.DB.prepare('SELECT uid FROM pub WHERE c = ?').bind(c).first(); if (!own || own.uid !== uid) return json(req, { error: 'forbidden' }, 403);
  const buf = new Uint8Array(await req.arrayBuffer()); if (buf.length < 1000 || buf.length > 460_000 || buf[0] !== 0xFF || buf[1] !== 0xD8) return json(req, { error: 'bad image' }, 400);
  await env.DB.prepare('INSERT OR REPLACE INTO pubimg (c, img, t) VALUES (?, ?, ?)').bind(c, buf, Date.now()).run();
  return json(req, { ok: true });
}
async function pubImgGet(req, env, c) {
  c = c.replace(/\.jpg$/, ''); if (!/^[A-Za-z0-9]{6}$/.test(c)) return new Response('not found', { status: 404 });
  const r = await env.DB.prepare('SELECT img, t FROM pubimg WHERE c = ?').bind(c).first(); if (!r) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(r.img), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600', ...cors(req) } });
}
let INDEX = null;
const escH = x => String(x ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
// perfil público /g/<nome>-<código>: a página do site com título e descrição de prévia; não lê nem grava no banco
async function gPage(req, env, sl) {
  if (!INDEX || Date.now() - INDEX.t > 600000) { const h = await fetch(SITES[0] + '/index.html', { cf: { cacheTtl: 300 } }).then(r => r.text()); INDEX = { h, t: Date.now() }; }
  let name = ''; try { name = decodeURIComponent(sl).replace(/-(\d{4})$/, '#$1').slice(0, 40); } catch {}
  const title = name ? `${name.replace(/#\d+$/, '')} · Perfil no DPI` : 'Perfil · DPI', desc = 'Conclusões de incursões e masmorras, melhores tempos, títulos e a build atual, ao vivo da Bungie.';
  const tags = `<meta property="og:type" content="profile"><meta property="og:site_name" content="DPI · Destiny Parallel Interface"><meta property="og:title" content="${escH(title)}"><meta property="og:description" content="${escH(desc)}"><meta property="og:url" content="${SITES[0]}/g/${escH(sl)}"><meta name="theme-color" content="#6fd3ff">`;
  const h = INDEX.h.replace(/<meta (property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*/g, '').replace(/<title>[^<]*<\/title>/, `<title>${escH(title)}</title>`).replace(/(src|href)="(?!\/|https?:|#|data:|mailto:)/g, '$1="/').replace('</head>', tags + '</head>');
  return new Response(h, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
async function pubPage(req, env, c) {
  if (!INDEX || Date.now() - INDEX.t > 600000) { const h = await fetch(SITES[0] + '/index.html', { cf: { cacheTtl: 300 } }).then(r => r.text()); INDEX = { h, t: Date.now() }; }
  let meta = null; if (/^[A-Za-z0-9]{6}$/.test(c)) { const r = await env.DB.prepare('SELECT v FROM pub WHERE c = ?').bind(c).first().catch(() => null); try { meta = r ? JSON.parse(r.v)?.og : null; } catch {} }
  const hasImg = meta && await env.DB.prepare('SELECT t FROM pubimg WHERE c = ?').bind(c).first().catch(() => null);
  const title = meta?.t ? `${meta.t} · DPI` : 'Build · DPI', desc = meta?.d || 'Build de Destiny 2 compartilhada no DPI · Destiny Parallel Interface', img = hasImg ? `${SITES[0]}/bi/${c}.jpg?v=${hasImg.t}` : /^https:\/\/www\.bungie\.net\//.test(meta?.img || '') ? meta.img : '';
  const tags = `<meta property="og:type" content="website"><meta property="og:site_name" content="DPI · Destiny Parallel Interface"><meta property="og:title" content="${escH(title)}"><meta property="og:description" content="${escH(desc)}"><meta property="og:url" content="${SITES[0]}/b/${escH(c)}">${img ? `<meta property="og:image" content="${escH(img)}">${hasImg ? '<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escH(img)}">` : ''}<meta name="theme-color" content="#6fd3ff">`;
  // as etiquetas de prévia que o index já tem dão lugar às da build
  const h = INDEX.h.replace(/<meta (property="og:[^"]*"|name="twitter:[^"]*")[^>]*>\s*/g, '').replace(/<title>[^<]*<\/title>/, `<title>${escH(title)}</title>`).replace(/(src|href)="(?!\/|https?:|#|data:|mailto:)/g, '$1="/').replace('</head>', tags + '</head>'); // caminhos relativos do index passam a valer a partir da raiz
  return new Response(h, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
/* ---------- Sugestões (página /novidades): qualquer um envia; só o dono lê no /status ---------- */
async function sugPost(req, env) {
  if (await brake(env)) return json(req, { error: 'brake' }, 503);
  const b = await req.json().catch(() => null), txt = String(b?.txt || '').trim().slice(0, 2000), name = String(b?.name || '').trim().slice(0, 60);
  if (txt.length < 5) return json(req, { error: 'short' }, 400);
  // limite de 5 por dia por endereço, guardando só um resumo (endereço + dia), nunca o IP
  const ip = req.headers.get('CF-Connecting-IP') || '', day = new Date().toISOString().slice(0, 10);
  const ipd = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dpi-sug|' + day + '|' + ip)))].slice(0, 10).map(x => x.toString(16).padStart(2, '0')).join('');
  const n = await env.DB.prepare('SELECT COUNT(*) n FROM sug WHERE ipd = ?').bind(ipd).first(); if ((n?.n || 0) >= 5) return json(req, { error: 'limit' }, 429);
  const uid = await who(req, env).catch(() => null);
  await env.DB.prepare('INSERT INTO sug (t, txt, name, uid, ipd) VALUES (?, ?, ?, ?, ?)').bind(Date.now(), txt, name || null, uid, ipd).run();
  return json(req, { ok: true });
}
async function sugList(env) { const r = await env.DB.prepare('SELECT id, t, txt, name, uid, rd FROM sug ORDER BY id DESC LIMIT 100').all().catch(() => ({ results: [] })); return r.results || []; }
async function sugRead(req, env) {
  const uid = await who(req, env); if (uid !== String(env.OWNER)) return json(req, { error: 'forbidden' }, 403);
  const b = await req.json().catch(() => ({})); if (b?.del) await env.DB.prepare('DELETE FROM sug WHERE id = ?').bind(+b.del).run(); else await env.DB.prepare('UPDATE sug SET rd = 1 WHERE rd = 0').run();
  return json(req, { ok: true });
}

/* ---------- Clã: aviso dos admins e mapa de horários ----------
   GET /clan/notice?g=  (público)  ·  PUT /clan/notice?g=  (dono do site ou fundador/admin do clã)
   GET /clan/hours?g=   (público)  ·  POST /clan/hours?g= (logado e membro do clã; uma leitura por hora) */
async function clanRole(req, env, g) {
  const uid = await who(req, env); if (!uid) return { uid: null, role: 0 };
  if (uid === String(env.OWNER)) return { uid, role: 9 };
  const auth = (req.headers.get('Authorization') || '').slice(7);
  const r = await bungie(req, `/GroupV2/User/254/${uid}/0/1/`, auth).catch(() => null);
  const m = (r?.results || []).find(x => String(x.group?.groupId) === g);
  return { uid, role: m ? m.member?.memberType || 1 : 0 };
}
async function clanRoute(req, env, path, url) {
  const g = url.searchParams.get('g') || ''; if (!/^\d{1,20}$/.test(g)) return json(req, { error: 'bad request' }, 400);
  const k = path === '/clan/notice' ? 'notice' : 'hours', uidk = 'clan:' + g;
  const row = await env.DB.prepare('SELECT v FROM kv WHERE uid = ? AND k = ?').bind(uidk, k).first().catch(() => null);
  const cur = row ? JSON.parse(row.v) : null;
  if (req.method === 'GET') return json(req, { d: k === 'hours' && cur ? { s: cur.s, c: cur.c } : cur });
  if (await brake(env)) return json(req, { error: 'brake' }, 503);
  const body = await req.json().catch(() => ({})), { uid, role } = await clanRole(req, env, g);
  if (!uid) return json(req, { error: 'login' }, 401);
  const put = v => env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t').bind(uidk, k, JSON.stringify(v), Date.now()).run();
  if (k === 'notice') {
    if (req.method !== 'PUT') return json(req, { error: 'method' }, 405);
    if (role < 3) return json(req, { error: 'forbidden' }, 403);
    const text = String(body.text || '').trim().slice(0, 280);
    if (!text) { await env.DB.prepare('DELETE FROM kv WHERE uid = ? AND k = ?').bind(uidk, k).run(); return json(req, { ok: true }); }
    const until = Number(body.until) > Date.now() ? Math.min(Number(body.until), Date.now() + 90 * 864e5) : null;
    await put({ text, until, by: String(body.by || '').slice(0, 40), at: Date.now() }); return json(req, { ok: true });
  }
  if (req.method !== 'POST') return json(req, { error: 'method' }, 405);
  if (!role) return json(req, { error: 'forbidden' }, 403);
  const n = Math.max(0, Math.min(100, Math.round(Number(body.n) || 0))), hr = Math.floor(Date.now() / 3600e3), d = new Date();
  const v = cur || { s: Array(168).fill(0), c: Array(168).fill(0), h: 0 };
  const ua = !v.ua || Date.now() - v.ua > 3600e3; v.ua = Date.now();
  const key = req.headers.get('X-API-Key'); if (key && /^[a-f0-9]{32}$/i.test(key)) await env.DB.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('bkey', ?)").bind(key).run().catch(() => {});
  if (v.h === hr) { if (ua) await put(v); return json(req, { ok: true, dup: true }); } // já tem leitura desta hora
  const i = d.getUTCDay() * 24 + d.getUTCHours(); v.s[i] += n; v.c[i] += 1; v.h = hr;
  await put(v); return json(req, { ok: true });
}


// leitura automática de hora em hora: quantos de cada clã estão online no jogo (lista pública da Bungie).
// Só para clãs com alguém usando o site nos últimos 30 dias; até 40 clãs por rodada.
async function clanHoursCron(env) {
  const key = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'bkey'").first().catch(() => null))?.v; if (!key) return;
  const rows = (await env.DB.prepare("SELECT uid, v FROM kv WHERE k = 'hours' AND uid LIKE 'clan:%' LIMIT 200").all().catch(() => ({ results: [] }))).results || [];
  const now = Date.now(), hr = Math.floor(now / 3600e3), d = new Date(), i = d.getUTCDay() * 24 + d.getUTCHours(), fake = { headers: new Headers({ 'X-API-Key': key }) };
  let n = 0;
  for (const r of rows) {
    let v; try { v = JSON.parse(r.v); } catch { continue; }
    if (v.h === hr || !v.ua || now - v.ua > 30 * 864e5) continue;
    if (++n > 40) break;
    const g = r.uid.slice(5); if (!/^\d{1,20}$/.test(g)) continue;
    const m = await bungie(fake, `/GroupV2/${g}/Members/?currentpage=1`).catch(() => null); if (!m) continue;
    const on = (m.results || []).filter(x => x.isOnline).length;
    v.s[i] += on; v.c[i] += 1; v.h = hr;
    await env.DB.prepare('UPDATE kv SET v = ?, t = ? WHERE uid = ? AND k = ?').bind(JSON.stringify(v), now, r.uid, 'hours').run().catch(() => {});
  }
}

// Quem joga com quem (beta, só admins): a cada 15 min, para cada clã com uso do site nos últimos 30 dias,
// lê quem está online (lista pública do clã) e o esquadrão de cada um (componente público 1000 da Bungie).
// Grava por dia: leituras online / com alguém do clã (soc_on) e duplas no mesmo esquadrão (soc_pair). O último retrato fica em kv (clan:<g>, social).
async function socialCron(env) {
  const key = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'bkey'").first().catch(() => null))?.v; if (!key) return;
  const rows = (await env.DB.prepare("SELECT uid, v FROM kv WHERE k = 'hours' AND uid LIKE 'clan:%' LIMIT 200").all().catch(() => ({ results: [] }))).results || [];
  const now = Date.now(), d = spDay(now), fake = { headers: new Headers({ 'X-API-Key': key }) }; let n = 0;
  for (const r of rows) {
    let v; try { v = JSON.parse(r.v); } catch { continue; }
    if (!v.ua || now - v.ua > 30 * 864e5) continue; if (++n > 20) break;
    const g = r.uid.slice(5); if (!/^\d{1,20}$/.test(g)) continue;
    const m = await bungie(fake, `/GroupV2/${g}/Members/?currentpage=1`).catch(() => null); if (!m) continue;
    const mem = m.results || [], idOf = {}; for (const x of mem) { const u = x.destinyUserInfo || {}; if (u.membershipId) idOf[u.membershipId] = u.membershipId; }
    const online = mem.filter(x => x.isOnline && x.destinyUserInfo?.membershipId), seen = new Set(), parties = [], acts = {};
    for (const x of online) {
      const u = x.destinyUserInfo, me = u.membershipId; if (seen.has(me)) continue;
      const p = await bungie(fake, `/Destiny2/${u.membershipType}/Profile/${me}/?components=100,204,1000`).catch(() => null); if (!p) continue;
      const prim = p.profile?.data?.userInfo?.membershipId; if (prim) idOf[prim] = me;
      const ca = Object.values(p.characterActivities?.data || {}).sort((a, b) => Date.parse(b.dateActivityStarted || 0) - Date.parse(a.dateActivityStarted || 0))[0];
      const pm = (p.profileTransitoryData?.data?.partyMembers || []).map(q => idOf[q.membershipId]).filter(Boolean);
      const grp = [...new Set([me, ...pm])];
      grp.forEach(id => seen.add(id)); parties.push({ m: grp, a: ca?.currentActivityHash || 0, s: p.profileTransitoryData?.data?.currentActivity?.startTime || null });
    }
    const st = [], on = new Set();
    for (const P of parties) { const wc = P.m.length > 1 ? 1 : 0;
      for (const id of P.m) { if (on.has(id)) continue; on.add(id); st.push(env.DB.prepare('INSERT INTO soc_on (g, mid, d, n, wc) VALUES (?, ?, ?, 1, ?) ON CONFLICT(g, mid, d) DO UPDATE SET n = n + 1, wc = wc + excluded.wc').bind(g, id, d, wc)); }
      const ms = [...P.m].sort(); for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) st.push(env.DB.prepare('INSERT INTO soc_pair (g, a, b, d, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT(g, a, b, d) DO UPDATE SET n = n + 1').bind(g, ms[i], ms[j], d)); }
    const old = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'social'").bind(r.uid).first().catch(() => null); let f = now; try { f = JSON.parse(old.v).f || now; } catch {}
    st.push(env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t').bind(r.uid, 'social', JSON.stringify({ at: now, f, p: parties }), now));
    await env.DB.batch(st).catch(() => {});
  }
}
// leitura para a aba Administração (só dono do site, fundador e admins do clã)
async function socialRoute(req, env, url) {
  const g = url.searchParams.get('g') || ''; if (!/^\d{1,20}$/.test(g)) return json(req, { error: 'bad request' }, 400);
  const { uid, role } = await clanRole(req, env, g); if (!uid) return json(req, { error: 'login' }, 401); if (role < 3) return json(req, { error: 'forbidden' }, 403);
  const days = Math.min(400, Math.max(1, +url.searchParams.get('days') || 7)), since = spDay(Date.now() - (days - 1) * 864e5);
  const [on, pr, snap] = await Promise.all([
    env.DB.prepare('SELECT mid, SUM(n) n, SUM(wc) wc FROM soc_on WHERE g = ? AND d >= ? GROUP BY mid').bind(g, since).all(),
    env.DB.prepare('SELECT a, b, SUM(n) n FROM soc_pair WHERE g = ? AND d >= ? GROUP BY a, b').bind(g, since).all(),
    env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'social'").bind('clan:' + g).first()]);
  const first = await env.DB.prepare('SELECT MIN(d) d FROM soc_on WHERE g = ?').bind(g).first().catch(() => null);
  const bf = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'socbf'").bind('clan:' + g).first().catch(() => null);
  let lo = null; try { lo = JSON.parse(bf.v).lo || null; } catch {} if (bf && !lo) lo = first?.d || null;
  return json(req, { on: on.results || [], pairs: pr.results || [], now: snap ? JSON.parse(snap.v) : null, since: first?.d || null, bf: !!bf, lo });
}
// importação única da última semana (feita no navegador de um admin a partir do histórico de atividades da Bungie)
async function socialBackfill(req, env, url) {
  const g = url.searchParams.get('g') || ''; if (!/^\d{1,20}$/.test(g)) return json(req, { error: 'bad request' }, 400);
  if (await brake(env)) return json(req, { error: 'brake' }, 503);
  const { uid, role } = await clanRole(req, env, g); if (!uid) return json(req, { error: 'login' }, 401); if (role < 3) return json(req, { error: 'forbidden' }, 403);
  const prev = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'socbf'").bind('clan:' + g).first().catch(() => null);
  let lo = null; if (prev) { try { lo = JSON.parse(prev.v).lo || null; } catch {} if (!lo) lo = (await env.DB.prepare('SELECT MIN(d) d FROM soc_on WHERE g = ?').bind(g).first().catch(() => null))?.d || null; }
  const minD = spDay(Date.now() - 31 * 864e5), okD = d => d >= minD && (!lo || d < lo); // só dias ainda não importados, até ~30 dias atrás
  const b = await req.json().catch(() => ({})), on = Array.isArray(b.on) ? b.on.slice(0, 5000) : [], pairs = Array.isArray(b.pairs) ? b.pairs.slice(0, 5000) : [];
  const id = x => /^\d{1,25}$/.test(String(x)), day = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x)), num = x => Math.max(0, Math.min(96, Math.round(+x) || 0));
  const st = [];
  for (const [mid, d, n, wc] of on) if (id(mid) && day(d) && okD(d) && num(n)) st.push(env.DB.prepare('INSERT INTO soc_on (g, mid, d, n, wc) VALUES (?, ?, ?, ?, ?) ON CONFLICT(g, mid, d) DO UPDATE SET n = n + excluded.n, wc = wc + excluded.wc').bind(g, String(mid), d, num(n), Math.min(num(n), num(wc))));
  for (const [a, c, d, n] of pairs) if (id(a) && id(c) && a !== c && day(d) && okD(d) && num(n)) { const [x, y] = [String(a), String(c)].sort(); st.push(env.DB.prepare('INSERT INTO soc_pair (g, a, b, d, n) VALUES (?, ?, ?, ?, ?) ON CONFLICT(g, a, b, d) DO UPDATE SET n = n + excluded.n').bind(g, x, y, d, num(n))); }
  for (let i = 0; i < st.length; i += 100) await env.DB.batch(st.slice(i, i + 100));
  const ds = [...on.map(r => r[1]), ...pairs.map(r => r[2])].filter(d => day(d) && okD(d)).sort(), nlo = [ds[0], lo].filter(Boolean).sort()[0] || lo;
  await env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t').bind('clan:' + g, 'socbf', JSON.stringify({ by: uid, n: st.length, lo: nlo }), Date.now()).run();
  return json(req, { ok: true, n: st.length });
}

// Quem joga com quem: uma vez por dia, pelo histórico de partidas de cada membro (só atividades; Torre e órbita não contam).
// Roda no cron de hora em hora, um clã por vez, entre 05h e 23h (Brasília); cada clã guarda até onde já foi lido (socw).
// "Popular no clã": uma vez por dia, lê as armas equipadas (e os perks encaixados) de cada membro de um clã que usa o site
const errHits = new Map(); // limite simples por IP (por instância do worker)
async function clanRollsDaily(env) {
  const key = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'bkey'").first().catch(() => null))?.v; if (!key) return;
  const now = Date.now(), rows = (await env.DB.prepare("SELECT uid, v FROM kv WHERE k = 'hours' AND uid LIKE 'clan:%' LIMIT 200").all().catch(() => ({ results: [] }))).results || [];
  for (const r of rows) {
    let v; try { v = JSON.parse(r.v); } catch { continue; } if (!v.ua || now - v.ua > 30 * 864e5) continue;
    const g = r.uid.slice(5); if (!/^\d{1,20}$/.test(g)) continue;
    const wr = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'crollw'").bind(r.uid).first().catch(() => null);
    let w = 0; try { w = JSON.parse(wr.v).w; } catch {} if (now - w < 20 * 36e5) continue; // este clã já foi lido hoje
    const fake = { headers: new Headers({ 'X-API-Key': key }) }, m = await bungie(fake, `/GroupV2/${g}/Members/?currentpage=1`).catch(() => null); if (!m) return;
    const mem = (m.results || []).map(x => x.destinyUserInfo).filter(u => u?.membershipId), st = [], W = new Set([1498876634, 2465295065, 953998645]); // cinética, energia, pesada
    let i = 0; await Promise.all(Array.from({ length: 6 }, async () => { while (i < mem.length) { const u = mem[i++];
      const pr = await bungie(fake, `/Destiny2/${u.membershipType}/Profile/${u.membershipId}/?components=205,305`).catch(() => null); if (!pr) continue;
      const so = pr.itemComponents?.sockets?.data || {};
      for (const c of Object.values(pr.characterEquipment?.data || {})) for (const it of c.items || []) {
        if (!W.has(it.bucketHash) || !it.itemInstanceId) continue; const pk = (so[it.itemInstanceId]?.sockets || []).map(x => x.plugHash).filter(Boolean); if (!pk.length) continue;
        st.push(env.DB.prepare('INSERT INTO croll (g, mid, h, p, t) VALUES (?, ?, ?, ?, ?) ON CONFLICT(g, mid, h) DO UPDATE SET p = excluded.p, t = excluded.t').bind(g, u.membershipId, it.itemHash, pk.join(','), now));
      } } }));
    st.push(env.DB.prepare('DELETE FROM croll WHERE g = ? AND t < ?').bind(g, now - 14 * 864e5));
    st.push(env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t').bind(r.uid, 'crollw', JSON.stringify({ w: now }), now));
    for (let k = 0; k < st.length; k += 100) await env.DB.batch(st.slice(k, k + 100));
    return; // um clã por rodada
  }
}
async function socialDaily(env) {
  const key = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'bkey'").first().catch(() => null))?.v; if (!key) return;
  const now = Date.now(), dayStart = Date.parse(spDay(now) + 'T03:00:00Z'); // 00h de hoje em Brasília
  const rows = (await env.DB.prepare("SELECT uid, v FROM kv WHERE k = 'hours' AND uid LIKE 'clan:%' LIMIT 200").all().catch(() => ({ results: [] }))).results || [];
  for (const r of rows) {
    let v; try { v = JSON.parse(r.v); } catch { continue; } if (!v.ua || now - v.ua > 30 * 864e5) continue;
    const g = r.uid.slice(5); if (!/^\d{1,20}$/.test(g)) continue;
    const wr = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'socw'").bind(r.uid).first().catch(() => null);
    let w = 0; try { w = JSON.parse(wr.v).w; } catch {}
    if (!w) { const sn = await env.DB.prepare("SELECT v FROM kv WHERE uid = ? AND k = 'social'").bind(r.uid).first().catch(() => null); try { w = JSON.parse(sn.v).at; } catch {} if (!w) w = dayStart - 864e5; }
    if (w >= dayStart) continue; // este clã já está em dia
    await socialHistory(env, key, g, Math.max(w, dayStart - 3 * 864e5), dayStart);
    await env.DB.prepare('INSERT INTO kv (uid, k, v, t) VALUES (?, ?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v, t = excluded.t').bind(r.uid, 'socw', JSON.stringify({ w: dayStart }), now).run();
    return; // um clã por rodada
  }
}
async function socialHistory(env, key, g, from, to) {
  const fake = { headers: new Headers({ 'X-API-Key': key }) }, m = await bungie(fake, `/GroupV2/${g}/Members/?currentpage=1`).catch(() => null); if (!m) return;
  const mem = (m.results || []).map(x => x.destinyUserInfo).filter(u => u?.membershipId), idMap = {}, on = {}, inst = {}, wc = {}, pr = {};
  mem.forEach(u => idMap[u.membershipId] = u.membershipId);
  const pool = async (list, fn, n) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) await fn(list[i++]); })); };
  await pool(mem, async u => {
    const p = await bungie(fake, `/Destiny2/${u.membershipType}/Profile/${u.membershipId}/?components=100,200`).catch(() => null); if (!p) return;
    const prim = p.profile?.data?.userInfo?.membershipId; if (prim) idMap[prim] = u.membershipId;
    // quem não jogou no período nem precisa do histórico
    const chars = Object.values(p.characters?.data || {}).filter(c => Date.parse(c.dateLastPlayed) >= from);
    for (const c of chars) {
      const h = await bungie(fake, `/Destiny2/${u.membershipType}/Account/${u.membershipId}/Character/${c.characterId}/Stats/Activities/?count=50&mode=0`).catch(() => null);
      for (const a of h?.activities || []) { const t = Date.parse(a.period); if (t < from || t >= to) continue; const sec = a.values?.timePlayedSeconds?.basic?.value || 0; if (!sec) continue;
        const d = spDay(t), k = u.membershipId + '|' + d; on[k] = (on[k] || 0) + sec; const id = a.activityDetails?.instanceId; if (id) (inst[id] = inst[id] || { d, m: new Set() }).m.add(u.membershipId); }
    }
  }, 6);
  const shared = Object.entries(inst).filter(([, v]) => v.m.size > 1);
  await pool(shared, async ([id, v]) => {
    const r = await fetch(`https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${id}/`, { headers: { 'X-API-Key': key } }).then(x => x.json()).then(j => j.Response).catch(() => null), ft = {};
    for (const e of r?.entries || []) { const mid = idMap[e.player?.destinyUserInfo?.membershipId]; if (!mid) continue; const f = e.values?.fireteamId?.basic?.value ?? 't' + (e.values?.team?.basic?.value ?? ''), sec = e.values?.timePlayedSeconds?.basic?.value || 0; (ft[f] = ft[f] || {})[mid] = (ft[f][mid] || 0) + sec; }
    for (const grp of Object.values(ft)) { const ids = Object.keys(grp).sort(); if (ids.length < 2) continue;
      for (const x of ids) { const k = x + '|' + v.d; wc[k] = (wc[k] || 0) + grp[x]; }
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = ids[i] + '|' + ids[j] + '|' + v.d; pr[k] = (pr[k] || 0) + Math.min(grp[ids[i]], grp[ids[j]]); } }
  }, 6);
  const q = sec => Math.round(sec / 900), st = []; // segundos → unidades de 15 min (mesma escala da importação)
  for (const [k, sec] of Object.entries(on)) { const [mid, d] = k.split('|'), n = q(sec); if (!n) continue; st.push(env.DB.prepare('INSERT INTO soc_on (g, mid, d, n, wc) VALUES (?, ?, ?, ?, ?) ON CONFLICT(g, mid, d) DO UPDATE SET n = n + excluded.n, wc = wc + excluded.wc').bind(g, mid, d, n, Math.min(n, q(wc[k] || 0)))); }
  for (const [k, sec] of Object.entries(pr)) { const [a, b, d] = k.split('|'), n = q(sec); if (n) st.push(env.DB.prepare('INSERT INTO soc_pair (g, a, b, d, n) VALUES (?, ?, ?, ?, ?) ON CONFLICT(g, a, b, d) DO UPDATE SET n = n + excluded.n').bind(g, a, b, d, n)); }
  for (let i = 0; i < st.length; i += 100) await env.DB.batch(st.slice(i, i + 100));
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
// CMS de vídeos: só o dono do site cadastra, edita e apaga
async function videosEdit(req, env, path) {
  const uid = await who(req, env); if (!uid) return json(req, { error: 'auth' }, 401);
  if (uid !== String(env.OWNER)) return json(req, { error: 'forbidden' }, 403);
  const id = Number(path.split('/')[2] || 0), yt = u => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(u || '');
  if (req.method === 'DELETE' && id) { await env.DB.prepare('DELETE FROM vid WHERE id = ?').bind(id).run(); return json(req, { ok: true }); }
  const b = await req.json().catch(() => null);
  if (!b || !/^(raid|dg|xm):[\w-]{1,40}$/.test(b.k || '') || !yt(b.url)) return json(req, { error: 'Atividade ou link do YouTube inválido.' }, 400);
  const pt = String(b.pt || '').slice(0, 80), en = String(b.en || '').slice(0, 80), ord = Number(b.ord) || 0;
  if (req.method === 'PUT' && id) { await env.DB.prepare('UPDATE vid SET k = ?, url = ?, pt = ?, en = ?, ord = ?, at = ? WHERE id = ?').bind(b.k, b.url, pt, en, ord, Date.now(), id).run(); return json(req, { ok: true, id }); }
  if (req.method === 'POST' && !id) { const r = await env.DB.prepare('INSERT INTO vid (k, url, pt, en, ord, at) VALUES (?, ?, ?, ?, ?, ?)').bind(b.k, b.url, pt, en, ord, Date.now()).run(); return json(req, { ok: true, id: r.meta.last_row_id }); }
  return json(req, { error: 'method' }, 405);
}
// Página /guias: só o dono grava; cada chave substitui o padrão do site para uma atividade (vídeos, imagens ou guia por encontro)
async function guiasEdit(req, env, path) {
  const uid = await who(req, env); if (!uid) return json(req, { error: 'auth' }, 401);
  if (uid !== String(env.OWNER)) return json(req, { error: 'forbidden' }, 403);
  const hist = path.startsWith('/guias/h/'), k = decodeURIComponent(path.slice(hist ? 9 : 7));
  if (!/^(lnk|img|enc):(raid|dg|xm):[\w-]{1,40}$/.test(k)) return json(req, { error: 'Chave inválida.' }, 400);
  if (hist) { const r = await env.DB.prepare('SELECT id, v, at FROM gde_h WHERE k = ? ORDER BY at DESC LIMIT 20').bind(k).all().catch(() => ({ results: [] })); return json(req, { list: r.results.map(x => ({ id: x.id, at: x.at, v: JSON.parse(x.v) })) }); }
  const keep = async () => { const old = await env.DB.prepare('SELECT v, at FROM gde WHERE k = ?').bind(k).first().catch(() => null); if (old) { await env.DB.prepare('INSERT INTO gde_h (k, v, at) VALUES (?, ?, ?)').bind(k, old.v, old.at).run().catch(() => {}); await env.DB.prepare('DELETE FROM gde_h WHERE k = ? AND id NOT IN (SELECT id FROM gde_h WHERE k = ? ORDER BY at DESC LIMIT 20)').bind(k, k).run().catch(() => {}); } };
  if (req.method === 'DELETE') { await keep(); await env.DB.prepare('DELETE FROM gde WHERE k = ?').bind(k).run(); return json(req, { ok: true }); }
  if (req.method !== 'PUT') return json(req, { error: 'method' }, 405);
  const txt = await req.text(); if (txt.length > 120000) return json(req, { error: 'Grande demais.' }, 413);
  let v; try { v = JSON.parse(txt); } catch { return json(req, { error: 'JSON inválido.' }, 400); }
  const yt = u => /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(u || ''), str = x => typeof x === 'string';
  const t = k.slice(0, 3);
  const ok = t === 'lnk' ? Array.isArray(v?.l) && v.l.every(x => Array.isArray(x) && yt(x[0]) && str(x[1] ?? '') && str(x[2] ?? ''))
    : t === 'img' ? Array.isArray(v?.l) && v.l.every(x => Array.isArray(x) && str(x[0]) && (/^https:\/\//.test(x[0]) || /^\/guides\/[\w./-]+$/.test(x[0])))
    : Array.isArray(v?.enc) && v.enc.every(e => e && str(e.n) && str(e.obj ?? '') && Array.isArray(e.steps) && e.steps.every(str) && (!e.roles || (Array.isArray(e.roles) && e.roles.every(r => Array.isArray(r) && r.every(str)))) && (!e.yt || yt(e.yt)));
  if (!ok) return json(req, { error: 'Dados inválidos (confira os links).' }, 400);
  await keep();
  await env.DB.prepare('INSERT OR REPLACE INTO gde (k, v, at) VALUES (?, ?, ?)').bind(k, JSON.stringify(v), Date.now()).run();
  return json(req, { ok: true });
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
    sug: await sugList(env),
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
    if (!(await brake(env))) await clanHoursCron(env).catch(() => {});
    if (!(await brake(env)) && new Date().getUTCHours() >= 8) await socialDaily(env).catch(() => {}); // a partir das 5h (Brasília): lê o dia anterior
    if (!(await brake(env)) && new Date().getUTCHours() >= 12) await clanRollsDaily(env).catch(() => {}); // a partir das 9h (Brasília): armas equipadas do clã
    if (new Date().getUTCHours() === 6) await env.DB.prepare('DELETE FROM visit WHERE d < ?').bind(spDay(Date.now() - 400 * 864e5)).run().catch(() => {}); // guarda ~13 meses
  },
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (path !== '/stats' && path !== '/whoami' && path !== '/health' && !path.startsWith('/page/') && !path.startsWith('/gpage/') && !(path.startsWith('/pubimg/') && req.method === 'GET') && (await brake(env)) >= 2) return json(req, { error: 'brake' }, 503);
      if (path === '/defs' && req.method === 'POST') return await defs(req, env);
      if (path === '/sync' && (req.method === 'GET' || req.method === 'PUT')) return await sync(req, env);
      if (path === '/clan/notice' || path === '/clan/hours') return await clanRoute(req, env, path, new URL(req.url));
      if (path === '/clan/social' && req.method === 'GET') return await socialRoute(req, env, new URL(req.url));
      if (path === '/clan/social/backfill' && req.method === 'POST') return await socialBackfill(req, env, new URL(req.url));
      if (path === '/clan/rolls' && req.method === 'GET') { // "Popular no clã": por arma, quantos membros usaram e quantos com cada perk
        const g = new URL(req.url).searchParams.get('g') || ''; if (!/^\d{1,20}$/.test(g)) return json(req, { error: 'g' }, 400);
        const r = await env.DB.prepare('SELECT h, p FROM croll WHERE g = ?').bind(g).all().catch(() => ({ results: [] })), w = {};
        for (const x of r.results) { const o = w[x.h] ||= { n: 0, p: {} }; o.n++; for (const k of x.p.split(',')) o.p[k] = (o.p[k] || 0) + 1; }
        return new Response(JSON.stringify({ w, at: Date.now() }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800', ...cors(req) } });
      }
      if (path === '/twins' && req.method === 'GET') { // armas lendárias com o mesmo nome e hashes diferentes (relançadas, Adept), gerado pelo script do manifesto
        const v = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'twins'").first().catch(() => null))?.v || '{"g":[]}';
        return new Response(v, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600', ...cors(req) } });
      }
      if (path === '/err' && req.method === 'POST') { // erro de JavaScript de um visitante (sem dados da conta)
        const b = await req.json().catch(() => null); if (!b?.m) return json(req, { ok: false }, 400);
        const ip = req.headers.get('CF-Connecting-IP') || '', k = 'e' + ip, n = (errHits.get(k) || 0) + 1; errHits.set(k, n); if (n > 20) return json(req, { ok: false }, 429);
        await env.DB.batch([env.DB.prepare('INSERT INTO errs (t, m, v, ua) VALUES (?, ?, ?, ?)').bind(Date.now(), String(b.m).slice(0, 1200), String(b.v || '').slice(0, 120), String(req.headers.get('User-Agent') || '').slice(0, 160)),
          env.DB.prepare('DELETE FROM errs WHERE id NOT IN (SELECT id FROM errs ORDER BY id DESC LIMIT 300)')]).catch(() => {});
        return json(req, { ok: true });
      }
      if (path === '/err' && req.method === 'GET') { // só o dono: últimos erros
        const uid = await who(req, env); if (!uid || uid !== String(env.OWNER)) return json(req, { error: 'forbidden' }, 403);
        const r = await env.DB.prepare('SELECT t, m, v, ua FROM errs ORDER BY id DESC LIMIT 100').all().catch(() => ({ results: [] })); return json(req, { list: r.results });
      }
      if (path === '/hit' && req.method === 'POST') return await hit(req, env);
      if (path === '/pub' && req.method === 'POST') return await pubPost(req, env);
      if (path === '/videos' && req.method === 'GET') { // vídeos de guia do CMS (página /videos do dono), lidos por todos
        const r = await env.DB.prepare('SELECT id, k, url, pt, en, ord FROM vid ORDER BY k, ord, id').all().catch(() => ({ results: [] }));
        return new Response(JSON.stringify({ list: r.results }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', ...cors(req) } });
      }
      if (path === '/guias' && req.method === 'GET') { // ajustes da página /guias, lidos por todos
        const r = await env.DB.prepare('SELECT k, v, at FROM gde').all().catch(() => ({ results: [] })); const m = {}; for (const x of r.results) { try { m[x.k] = { ...JSON.parse(x.v), at: x.at }; } catch {} }
        return new Response(JSON.stringify({ m }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120', ...cors(req) } });
      }
      if (path.startsWith('/guias/')) return await guiasEdit(req, env, path);
      if (path === '/videos' || path.startsWith('/videos/')) return await videosEdit(req, env, path);
      if (path === '/sug' && req.method === 'POST') return await sugPost(req, env);
      if (path === '/sug/read' && req.method === 'POST') return await sugRead(req, env);
      if (path.startsWith('/pubimg/') && req.method === 'POST') return await pubImgPost(req, env, path.slice(8));
      if (path.startsWith('/pubimg/') && req.method === 'GET') return await pubImgGet(req, env, path.slice(8));
      if (path.startsWith('/pub/') && req.method === 'GET') return await pubGet(req, env, path.slice(5));
      if (path.startsWith('/page/') && req.method === 'GET') return await pubPage(req, env, path.slice(6));
      if (path.startsWith('/gpage/') && req.method === 'GET') return await gPage(req, env, path.slice(7));
      if (path === '/stats' && req.method === 'GET') return await stats(req, env);
      if (path === '/health' && req.method === 'GET') { // página pública /estado: o servidor responde e quando foi a última rodada de hora em hora
        const b = await env.DB.prepare("SELECT v FROM meta WHERE k = 'brake'").first().catch(() => null), m = b ? JSON.parse(b.v) : null;
        return json(req, { ok: true, now: Date.now(), hourly: m?.at || null, brake: m?.level || 0 });
      }
      if (path === '/whoami' && req.method === 'GET') { const uid = await who(req, env), owner = !!uid && uid === String(env.OWNER); const sug = owner ? (await env.DB.prepare('SELECT COUNT(*) n FROM sug WHERE rd = 0').first().catch(() => null))?.n || 0 : undefined; return json(req, { uid, owner, sug }); }
      if (path === '/') return json(req, { ok: true, service: 'dni-api' });
      return json(req, { error: 'not found' }, 404);
    } catch (e) {
      return json(req, { error: String(e.message || e) }, 502);
    }
  },
};
