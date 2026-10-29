/* Pré-carrega no banco do servidor (D1) as definições do jogo, a partir do manifesto da Bungie.
   Assim o servidor quase nunca precisa buscar um nome na Bungie na hora (o que gastava tempo de CPU).
   Roda no GitHub Actions: todo dia confere a versão do manifesto; se mudou (ou a carga anterior não terminou),
   grava só o que é novo ou mudou, até MAX_WRITES linhas por execução (o plano grátis permite 100 mil gravações por dia). */
import { compact, compactSet } from '../worker/src/compact.js';

const ACC = process.env.CLOUDFLARE_ACCOUNT_ID, TOK = process.env.CLOUDFLARE_API_TOKEN;
const SITE = process.env.SITE || 'https://destinyparallel.vercel.app';
// cada linha gravada conta ~2 no limite do D1 (a tabela e o índice da chave): 35 mil linhas ≈ 70 mil, sobra folga para o site
const MAX_WRITES = +process.env.MAX_WRITES || 35000;
const CF = `https://api.cloudflare.com/client/v4/accounts/${ACC}/d1/database`;
if (!ACC || !TOK) throw new Error('faltam CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN');

const BOTH = ['DestinyInventoryItemDefinition', 'DestinyActivityDefinition', 'DestinyDestinationDefinition', 'DestinyStatDefinition', 'DestinyLoadoutNameDefinition', 'DestinyMilestoneDefinition', 'DestinyEquipableItemSetDefinition'];
const EN_ONLY = ['DestinyObjectiveDefinition', 'DestinyLocationDefinition'];
const LC = { pt: 'pt-br', en: 'en' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function cf(path, init = {}) {
  const r = await fetch(CF + path, { ...init, headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const j = await r.json().catch(() => null);
  if (!j?.success) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(j?.errors || j).slice(0, 300)}`);
  return j.result;
}
let DB;
const q = async (sql, params) => (await cf(`/${DB}/query`, { method: 'POST', body: JSON.stringify(params ? { sql, params } : { sql }) }))[0];

async function main() {
  DB = (await cf('?name=dni')).find(d => d.name === 'dni')?.uuid;
  if (!DB) throw new Error('banco "dni" não encontrado');
  await q('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)');

  const { apiKey } = await (await fetch(SITE + '/api/config')).json();
  const mr = await (await fetch('https://www.bungie.net/Platform/Destiny2/Manifest/', { headers: { 'X-API-Key': apiKey, Origin: SITE } })).json();
  if (mr.ErrorCode !== 1) throw new Error('manifesto: ' + mr.Message);
  const M = mr.Response, version = M.version;
  const prev = JSON.parse((await q("SELECT v FROM meta WHERE k = 'manifest'")).results?.[0]?.v || 'null');
  if (prev?.version === version && prev?.done && !process.env.FORCE) { log('manifesto já carregado:', version); return; }
  log('manifesto', version, prev ? `(anterior: ${prev.version}, completo: ${prev.done})` : '(primeira carga)');

  // o que já está no banco (para gravar só o que mudou)
  const have = new Map(); let after = '';
  for (;;) {
    const r = await q('SELECT k, v FROM defs WHERE k > ? ORDER BY k LIMIT 20000', [after]);
    const rows = r.results || []; for (const x of rows) have.set(x.k, x.v);
    if (rows.length < 20000) break; after = rows[rows.length - 1].k;
  }
  log('linhas no banco:', have.size);

  const get = async (lc, type) => {
    const path = M.jsonWorldComponentContentPaths?.[LC[lc]]?.[type]; if (!path) throw new Error(`sem caminho para ${type} (${lc})`);
    const r = await fetch('https://www.bungie.net' + path); if (!r.ok) throw new Error(`${type} ${lc}: HTTP ${r.status}`);
    return r.json();
  };
  const jobs = [];
  for (const lc of ['pt', 'en']) for (const t of BOTH) jobs.push([t, lc]);
  for (const t of EN_ONLY) jobs.push([t, 'en']);

  let total = 0, written = 0, pending = 0; const now = Date.now();
  const flush = async rows => {
    // INSERT com os valores no próprio SQL (o limite de parâmetros do D1 é 100); lotes de até ~90 KB
    const esc = s => "'" + s.replace(/'/g, "''") + "'";
    let batch = [], size = 0;
    const send = async () => { if (!batch.length) return; await q(`INSERT OR REPLACE INTO defs (k, v, t) VALUES ${batch.join(',')}`); written += batch.length; batch = []; size = 0; };
    for (const [k, v] of rows) {
      if (written + batch.length >= MAX_WRITES) { pending++; continue; }
      const sql = `(${esc(k)},${esc(v)},${now})`; if (size + sql.length > 90000) await send();
      batch.push(sql); size += sql.length + 1;
    }
    await send();
  };
  for (const [type, lc] of jobs) {
    const defs = await get(lc, type);
    const perks = type === 'DestinyEquipableItemSetDefinition' ? await get(lc, 'DestinySandboxPerkDefinition') : null;
    const rows = [];
    for (const [h, d] of Object.entries(defs)) {
      if (d.redacted || d.blacklisted) continue;
      const v = JSON.stringify(type === 'DestinyEquipableItemSetDefinition' ? compactSet(d, x => perks[x]) : compact(type, d));
      const k = `${type}:${lc}:${h >>> 0}`; total++;
      if (have.get(k) !== v) rows.push([k, v]);
    }
    log(`${type} ${lc}: ${Object.keys(defs).length} definições, ${rows.length} novas ou mudadas`);
    await flush(rows);
  }
  const state = { version, done: pending === 0, total, written, pending, at: now };
  await q("INSERT OR REPLACE INTO meta (k, v) VALUES ('manifest', ?)", [JSON.stringify(state)]);
  log('fim:', JSON.stringify(state));
}
main().catch(e => { console.error(e); process.exit(1); });
