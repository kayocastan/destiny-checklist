/* Servidor do site (Cloudflare Worker + banco D1).
   /defs  – nomes e dados resumidos de definições da Bungie, guardados para todos os visitantes.
   /sync  – favoritos, builds salvas, marcações e preferências de cada pessoa, ligados à conta Bungie.
   A chave da API da Bungie é pública (o site já a entrega ao navegador); o navegador a envia em X-API-Key. */
const BUNGIE = 'https://www.bungie.net/Platform';
const TYPES = new Set(['DestinyInventoryItemDefinition', 'DestinyObjectiveDefinition', 'DestinyLocationDefinition', 'DestinyActivityDefinition', 'DestinyMilestoneDefinition', 'DestinyLoadoutNameDefinition', 'DestinyRecordDefinition', 'DestinyCollectibleDefinition', 'DestinyPresentationNodeDefinition', 'DestinyDestinationDefinition', 'DestinyEquipableItemSetDefinition']);
const SET = 'DestinyEquipableItemSetDefinition';
const SYNC_KEYS = /^(favs|builds|opts|hide2|marks-\d{1,25})$/;
const MAX_BATCH = 25;              // até 25 busca na Bungie por pedido (o plano grátis permite 50 subpedidos)
const DEF_TTL = 30 * 864e5;        // nomes guardados são renovados depois de 30 dias
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

// mesmo formato que o site guarda no navegador
function compact(type, d) {
  const v = { n: d.displayProperties?.name || d.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '', ob: d.objectives?.objectiveHashes || [], lh: d.locationHash || 0, lr: (d.locationReleases || []).map(r => [r.destinationHash || 0, r.activityHash || 0]).slice(-1)[0] || null, ic: d.displayProperties?.icon || '', tt: d.inventory?.tierType || 0, dt: d.talentGrid?.hudDamageType || 0 };
  if (type === 'DestinyInventoryItemDefinition') Object.assign(v, { pc: d.plug?.plugCategoryIdentifier || '', st: d.itemSubType || 0, tr: (d.traitIds || []).includes('item.plug.aspect') ? 'a' : (d.traitIds || []).includes('item.plug.fragment') ? 'f' : '', x: { a: d.equippingBlock?.ammoType || 0, s: d.equippingBlock?.equipableItemSetHash || 0, c: d.collectibleHash || 0 } });
  return v;
}

async function defs(req, env) {
  const { t, lc, h } = await req.json().catch(() => ({}));
  if (!TYPES.has(t) || !['en', 'pt'].includes(lc) || !Array.isArray(h)) return json(req, { error: 'bad request' }, 400);
  const hashes = [...new Set(h.map(x => Number(x) >>> 0).filter(Boolean))].slice(0, t === SET ? 8 : MAX_BATCH); // conjunto = 1 + bônus (até ~5 buscas)
  const key = x => `${t}:${lc}:${x}`, out = {}, now = Date.now();
  if (hashes.length) {
    const rows = await env.DB.prepare(`SELECT k, v, t FROM defs WHERE k IN (${hashes.map(() => '?').join(',')})`).bind(...hashes.map(key)).all();
    for (const r of rows.results || []) if (now - r.t < DEF_TTL) out[r.k.slice(r.k.lastIndexOf(':') + 1)] = JSON.parse(r.v);
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
  if (fresh.length) await env.DB.prepare(`INSERT OR REPLACE INTO defs (k, v, t) VALUES ${fresh.map(() => '(?, ?, ?)').join(',')}`).bind(...fresh.flatMap(([k, v]) => [k, v, now])).run();
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
  await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO tok (h, uid, exp) VALUES (?, ?, ?)').bind(hash, String(uid), now + 50 * 60000), env.DB.prepare('DELETE FROM tok WHERE exp < ?').bind(now)]);
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

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (path === '/defs' && req.method === 'POST') return await defs(req, env);
      if (path === '/sync' && (req.method === 'GET' || req.method === 'PUT')) return await sync(req, env);
      if (path === '/') return json(req, { ok: true, service: 'dni-api' });
      return json(req, { error: 'not found' }, 404);
    } catch (e) {
      return json(req, { error: String(e.message || e) }, 502);
    }
  },
};
