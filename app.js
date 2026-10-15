/* Destiny Checklist — lê a conta Bungie.net da pessoa e monta o checklist.
   Tudo roda no navegador; o servidor só troca o código do login pelos tokens. */
(() => {
'use strict';
const API = 'https://www.bungie.net/Platform';
const QUEST_BUCKET = 1345459588;
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- textos da interface ---------- */
const UI = {
  pt: {
    hide: 'Ocultar feitos', search: 'Buscar por nome ou origem', refresh: 'Atualizar', logout: 'Sair',
    disclaimer: 'Dados lidos da sua conta pela API oficial da Bungie. Este site não é afiliado à Bungie.',
    loadouts: 'Loadouts', checklist: 'Checklist',
    tabs: { obj: 'Objetivos', camp: 'Campanhas', act: 'Atividades', drops: 'Drops' },
    subs: { raid: 'Incursões', dg: 'Masmorras', tit: 'Títulos', exo: 'Exóticos', cat: 'Catalisadores' },
    heroTitle: 'Seu checklist de Destiny 2', heroText: 'Entre com a sua conta Bungie.net para ver o que falta: exóticos, catalisadores, títulos, incursões, masmorras e campanhas, do mais fácil para o mais difícil.',
    heroList: ['O site só lê os seus dados; não altera nada no jogo.', 'Sua senha fica na Bungie; o site nunca vê.', 'As suas marcações ficam salvas neste navegador.'],
    login: 'Entrar com Bungie.net', notConfigured: 'O site ainda não foi configurado: faltam as chaves da Bungie nas variáveis de ambiente da Vercel.',
    loading: 'Carregando sua conta…', loadingDefs: 'Buscando nomes de itens…', updated: t => `Atualizado às ${t}`,
    authError: m => `Não deu para entrar: ${m}. Tente de novo.`, apiError: m => `Erro ao falar com a Bungie: ${m}`,
    maintenance: 'A API da Bungie está em manutenção agora. Tente de novo em alguns minutos.',
    noChars: 'Nenhum personagem de Destiny 2 encontrado nesta conta.',
    done1: (n, t) => `${n} de ${t} feitos`, dg: (n, t) => `${n} de ${t} masmorras concluídas`, raid: (n, t) => `${n} de ${t} incursões concluídas`,
    tit: (n, t) => `${n} de ${t} títulos conquistados`, camp: n => `${n} campanha${n === 1 ? '' : 's'} em andamento`, ld: n => `${n} loadout${n === 1 ? '' : 's'} no jogo`,
    panels: (n, sh) => n === 1 ? '1 painel concluído ' + (sh ? 'aparecendo.' : 'oculto.') : `${n} painéis concluídos ${sh ? 'aparecendo.' : 'ocultos.'}`,
    show: 'Mostrar', hideDone: 'Ocultar concluídos',
    s: {
      contracts: 'Contratos ativos', contractsNote: 'Contratos e recompensas que estão com você agora.', noContracts: 'Nenhum contrato ativo agora. Pegue novos com os Sindicatos ou vendedores.', expires: h => h >= 48 ? `Expira em ${Math.round(h / 24)} dias.` : `Expira em ${h} h.`,
      quests: 'Missões em andamento', questsNote: 'Do seu registro de missões, das mais adiantadas para as menos.',
      nearCats: 'Catalisadores quase prontos', nearCatsNote: 'Já passaram da metade.',
      nearTitles: 'Títulos quase prontos', nearTitlesNote: 'Faltam poucos triunfos.',
      noCamp: 'Nenhuma campanha em andamento no registro deste personagem. Campanhas concluídas não aparecem.',
      campNote: (a, b) => `Passo ${a} de ${b}.`, current: 'Passo atual',
      clear: n => `Concluir ${n}`, exotic: n => `Exótico: ${n}`,
      wpn: 'Armas exóticas', armor: c => `Armaduras exóticas de ${c}`,
      catProg: 'Em progresso', catProgNote: 'Catalisador obtido; use a arma para completar.',
      catNew: 'Ainda não iniciados', catNewNote: 'Ainda sem progresso. Alguns precisam ser obtidos antes.',
      src: { archive: 'Arquivo Exótico', engram: 'Engramas exóticos', raid: 'Incursões', dungeon: 'Masmorras', mission: 'Missões e jornadas', lost: 'Setores perdidos', xur: 'Xûr', season: 'Temporadas, passes e eventos', other: 'Outras fontes' },
      tierNote: ['Fácil · solo', 'Médio · masmorras e um pouco de PvP', 'Difícil · incursão (6 jogadores)', 'Muito difícil · PvP competitivo e Grão-mestre', 'Evento · só com o evento ativo'],
    },
    chip: { 'Fácil': 'Fácil', 'Médio': 'Médio', 'Difícil': 'Difícil', 'Muito difícil': 'Muito difícil', 'Evento': 'Evento', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 jogadores', 'Exótico': 'Exótico', 'Mestre': 'Mestre' },
    openDim: 'Abrir no DIM', noLoadouts: 'Nenhum loadout salvo no jogo para este personagem.',
    classes: ['Titã', 'Caçador', 'Arcano'], races: ['Humano', 'Despertado', 'Exo'], power: 'Poder', max: 'máx.',
  },
  en: {
    hide: 'Hide done', search: 'Search by name or source', refresh: 'Refresh', logout: 'Sign out',
    disclaimer: 'Data read from your account through the official Bungie API. This site is not affiliated with Bungie.',
    loadouts: 'Loadouts', checklist: 'Checklist',
    tabs: { obj: 'Objectives', camp: 'Campaigns', act: 'Activities', drops: 'Drops' },
    subs: { raid: 'Raids', dg: 'Dungeons', tit: 'Titles', exo: 'Exotics', cat: 'Catalysts' },
    heroTitle: 'Your Destiny 2 checklist', heroText: "Sign in with your Bungie.net account to see what's left: exotics, catalysts, titles, raids, dungeons and campaigns, from easiest to hardest.",
    heroList: ['The site only reads your data; it never changes anything in the game.', 'Your password stays with Bungie; the site never sees it.', 'Your checkmarks are saved in this browser.'],
    login: 'Sign in with Bungie.net', notConfigured: "The site isn't configured yet: the Bungie keys are missing from the Vercel environment variables.",
    loading: 'Loading your account…', loadingDefs: 'Fetching item names…', updated: t => `Updated at ${t}`,
    authError: m => `Couldn't sign in: ${m}. Please try again.`, apiError: m => `Error talking to Bungie: ${m}`,
    maintenance: 'The Bungie API is down for maintenance. Try again in a few minutes.',
    noChars: 'No Destiny 2 characters found on this account.',
    done1: (n, t) => `${n} of ${t} done`, dg: (n, t) => `${n} of ${t} dungeons cleared`, raid: (n, t) => `${n} of ${t} raids cleared`,
    tit: (n, t) => `${n} of ${t} titles earned`, camp: n => `${n} campaign${n === 1 ? '' : 's'} in progress`, ld: n => `${n} in-game loadout${n === 1 ? '' : 's'}`,
    panels: (n, sh) => `${n} completed panel${n === 1 ? '' : 's'} ${sh ? 'shown.' : 'hidden.'}`,
    show: 'Show', hideDone: 'Hide completed',
    s: {
      contracts: 'Active contracts', contractsNote: 'Contracts and bounties you are holding right now.', noContracts: 'No active contracts right now. Pick up new ones from the Syndicates or vendors.', expires: h => h >= 48 ? `Expires in ${Math.round(h / 24)} days.` : `Expires in ${h} h.`,
      quests: 'Quests in progress', questsNote: 'From your quest log, most advanced first.',
      nearCats: 'Catalysts almost done', nearCatsNote: 'Already past halfway.',
      nearTitles: 'Titles almost done', nearTitlesNote: 'Only a few triumphs left.',
      noCamp: 'No campaign in progress in this character\'s quest log. Finished campaigns are not shown.',
      campNote: (a, b) => `Step ${a} of ${b}.`, current: 'Current step',
      clear: n => `Complete ${n}`, exotic: n => `Exotic: ${n}`,
      wpn: 'Exotic weapons', armor: c => `${c} exotic armor`,
      catProg: 'In progress', catProgNote: 'Catalyst obtained; use the weapon to finish it.',
      catNew: 'Not started', catNewNote: 'No progress yet. Some must be obtained first.',
      src: { archive: 'Exotic Archive', engram: 'Exotic engrams', raid: 'Raids', dungeon: 'Dungeons', mission: 'Missions and quests', lost: 'Lost Sectors', xur: 'Xûr', season: 'Seasons, passes and events', other: 'Other sources' },
      tierNote: ['Easy · solo', 'Medium · dungeons and some PvP', 'Hard · raid (6 players)', 'Very hard · competitive PvP and Grandmaster', 'Event · only while the event is live'],
    },
    chip: { 'Fácil': 'Easy', 'Médio': 'Medium', 'Difícil': 'Hard', 'Muito difícil': 'Very hard', 'Evento': 'Event', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 players', 'Exótico': 'Exotic', 'Mestre': 'Master' },
    openDim: 'Open in DIM', noLoadouts: 'No in-game loadouts saved for this character.',
    classes: ['Titan', 'Hunter', 'Warlock'], races: ['Human', 'Awoken', 'Exo'], power: 'Power', max: 'max',
  },
};
let lang = LS.get('dc-lang', null) || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en');
const u = () => UI[lang];
const L = pair => Array.isArray(pair) ? (lang === 'en' ? pair[0] : (pair[1] || pair[0])) : pair;
const chipClass = x => /^(Fácil|Easy)$/.test(x) ? 'easy' : /^(Médio|Medium)$/.test(x) ? 'mid' : /^(Difícil|Hard|Muito difícil|Very hard)$/.test(x) ? 'hard' : /%$/.test(x) ? 'hot' : '';

/* ---------- estado ---------- */
let cfg = null, defs = null, ITEMS = null, auth = LS.get('dc-auth', null), profile = null, member = null;
let charId = null, tab = LS.get('dc-tab', 'obj'), prevTab = 'obj', query = '';
const lastSub = LS.get('dc-subs', {});
let marks = new Set(), SECTIONS = [], LOADOUTS = [], loadedAt = null;
const openSecs = new Set();
const GROUPS = [{ id: 'obj', subs: ['obj'] }, { id: 'camp', subs: ['camp'] }, { id: 'act', subs: ['raid', 'dg', 'tit'] }, { id: 'drops', subs: ['exo', 'cat'] }];
const groupOf = t => GROUPS.find(g => g.subs.includes(t));

/* ---------- status ---------- */
function status(msg) { $('status').textContent = msg || ''; }
function showMessage(html) { $('list').innerHTML = `<div class="panel">${html}</div>`; }

/* ---------- autenticação ---------- */
function readHash() {
  const h = location.hash.slice(1);
  if (!h) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('auth_error')) return { error: p.get('auth_error') };
  const a = p.get('auth');
  if (!a) return null;
  try {
    const t = JSON.parse(atob(a.replace(/-/g, '+').replace(/_/g, '/')));
    const expected = sessionStorage.getItem('dc-state');
    sessionStorage.removeItem('dc-state');
    if (!expected || t.state !== expected) return { error: 'state' };
    delete t.state;
    return { auth: t };
  } catch { return { error: 'token' }; }
}
function login() {
  const st = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('dc-state', st); } catch {}
  location.href = `https://www.bungie.net/${lang === 'pt' ? 'pt-br' : 'en'}/OAuth/Authorize?client_id=${encodeURIComponent(cfg.clientId)}&response_type=code&state=${st}`;
}
function logout() { LS.del('dc-auth'); auth = null; profile = null; render(); }
async function token() {
  if (!auth) throw new Error('auth');
  if (auth.access_expires - Date.now() > 60000) return auth.access_token;
  if (!auth.refresh_token || (auth.refresh_expires && auth.refresh_expires < Date.now())) { logout(); throw new Error('auth'); }
  const r = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.refresh_token }) });
  if (!r.ok) { logout(); throw new Error('auth'); }
  auth = { ...auth, ...(await r.json()) };
  LS.set('dc-auth', auth);
  return auth.access_token;
}
async function bungie(path, needAuth = true) {
  const headers = { 'X-API-Key': cfg.apiKey };
  if (needAuth) headers.Authorization = 'Bearer ' + await token();
  const r = await fetch(API + path, { headers });
  const j = await r.json().catch(() => null);
  if (!j) throw new Error(`HTTP ${r.status}`);
  if (j.ErrorCode === 5) throw new Error('maintenance');
  if (j.ErrorCode === 99 || j.ErrorCode === 22) { logout(); throw new Error('auth'); }
  if (j.ErrorCode !== 1) throw new Error(j.Message || j.ErrorStatus);
  return j.Response;
}

/* ---------- nomes de itens (API de entidades, com cache) ---------- */
const entCache = { en: LS.get('dc-ent2-en', {}), pt: LS.get('dc-ent2-pt', {}) };
LS.del('dc-ent-en'); LS.del('dc-ent-pt');
let entDirty = false;
async function entity(type, hash, lc) {
  const key = type + ':' + hash, store = entCache[lc];
  if (store[key]) return store[key];
  try {
    const d = await bungie(`/Destiny2/Manifest/${type}/${hash >>> 0}/?lc=${lc === 'pt' ? 'pt-br' : 'en'}`, false);
    const v = { n: d.displayProperties?.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '' };
    store[key] = v; entDirty = true;
    return v;
  } catch { return { n: '', d: '', ql: '', il: [], b: 0, it: 0, tl: '', su: '' }; }
}
async function entities(type, hashes, lc) {
  const list = [...new Set(hashes)];
  const out = {};
  let i = 0;
  const worker = async () => { while (i < list.length) { const h = list[i++]; out[h] = await entity(type, h, lc); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (entDirty) { LS.set('dc-ent2-en', entCache.en); LS.set('dc-ent2-pt', entCache.pt); entDirty = false; }
  return out;
}

/* ---------- leitura do perfil ---------- */
async function loadAccount() {
  status(u().loading);
  showMessage(`<p class="loading">${esc(u().loading)}</p>`);
  const m = await bungie('/User/GetMembershipsForCurrentUser/');
  const list = m.destinyMemberships || [];
  if (!list.length) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
  let pick = list.find(x => x.membershipId === m.primaryMembershipId) || list.find(x => x.crossSaveOverride && x.crossSaveOverride === x.membershipType) || list[0];
  member = { type: pick.membershipType, id: pick.membershipId, name: m.bungieNetUser?.uniqueName || pick.bungieGlobalDisplayName || pick.displayName };
  const p = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/?components=100,102,200,201,202,205,206,300,301,800,900,1100`);
  profile = p;
  marks = new Set(LS.get('dc-marks-' + member.id, []));
  const chars = Object.values(p.characters?.data || {});
  if (!chars.length) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
  const saved = LS.get('dc-char-' + member.id, null);
  charId = chars.some(c => c.characterId === saved) ? saved : chars.sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))[0].characterId;
  status(u().loadingDefs);
  await prepareEntities();
  loadedAt = new Date();
  build(); render();
}

let questInfo = {}, loadoutNames = {}, itemNames = {};
async function prepareEntities() {
  const p = profile, quests = [];
  for (const [cid, inv] of Object.entries(p.characterInventories?.data || {})) for (const it of inv.items || []) if (it.bucketHash === QUEST_BUCKET) quests.push(it.itemHash);
  const qEn = await entities('DestinyInventoryItemDefinition', quests, 'en');
  const steps = [];
  for (const h of quests) { const q = qEn[h]; if (q && q.il.length) steps.push(...q.il); }
  questInfo = { en: qEn, pt: lang === 'pt' ? await entities('DestinyInventoryItemDefinition', quests, 'pt') : qEn };
  // loadouts
  const inst = instanceMap();
  const ldItems = [], ldNames = [];
  for (const l of p.characterLoadouts?.data?.[charId]?.loadouts || []) { ldNames.push(l.nameHash); for (const i of l.items || []) if (inst[i.itemInstanceId]) ldItems.push(inst[i.itemInstanceId]); }
  const lc = lang;
  loadoutNames = await entities('DestinyLoadoutNameDefinition', ldNames, lc);
  itemNames = await entities('DestinyInventoryItemDefinition', ldItems, lc);
}
function instanceMap() {
  const p = profile, map = {};
  const add = items => { for (const it of items || []) if (it.itemInstanceId) map[it.itemInstanceId] = it.itemHash; };
  add(p.profileInventory?.data?.items);
  for (const v of Object.values(p.characterInventories?.data || {})) add(v.items);
  for (const v of Object.values(p.characterEquipment?.data || {})) add(v.items);
  return map;
}

/* ---------- poder máximo (como o DIM: melhor item por espaço, no máximo 1 exótico de arma e 1 de armadura) ---------- */
function maxPower(cls) {
  if (!ITEMS) return null;
  const inst = profile.itemComponents?.instances?.data || {}, all = [];
  const add = items => { for (const it of items || []) if (it.itemInstanceId) all.push(it); };
  add(profile.profileInventory?.data?.items);
  for (const v of Object.values(profile.characterInventories?.data || {})) add(v.items);
  for (const v of Object.values(profile.characterEquipment?.data || {})) add(v.items);
  const best = Array.from({ length: 8 }, () => ({ n: 0, x: 0 }));
  for (const it of all) {
    const code = ITEMS[it.itemHash]; if (code == null) continue;
    const slot = Math.floor(code / 100), c = Math.floor(code / 10) % 10, ex = code % 2;
    if (slot >= 3 && c !== 3 && c !== cls) continue;
    const pw = inst[it.itemInstanceId]?.primaryStat?.value; if (!pw) continue;
    const k = ex ? 'x' : 'n'; if (pw > best[slot][k]) best[slot][k] = pw;
  }
  const pick = slots => {
    let top = slots.every(t => best[t].n) ? slots.reduce((a, t) => a + best[t].n, 0) : 0;
    for (const s of slots) {
      if (!best[s].x || !slots.every(t => t === s || best[t].n)) continue;
      const sum = slots.reduce((a, t) => a + (t === s ? best[t].x : best[t].n), 0);
      if (sum > top) top = sum;
    }
    return top;
  };
  const w = pick([0, 1, 2]), a = pick([3, 4, 5, 6, 7]);
  return w && a ? Math.floor((w + a) / 8) : null;
}

/* ---------- regras ---------- */
const recState = h => profile.profileRecords?.data?.records?.[h] || profile.characterRecords?.data?.[charId]?.records?.[h] || null;
const recDone = r => !!r && (!!(r.state & 1) || !(r.state & 4));
const recObjs = r => (r && (r.objectives?.length ? r.objectives : r.intervalObjectives)) || [];
const progText = r => { const o = recObjs(r); if (o.length !== 1 || !o[0].completionValue || o[0].completionValue <= 1) return ''; return `${Math.min(o[0].progress || 0, o[0].completionValue)}/${o[0].completionValue}`; };
const pct = r => { const o = recObjs(r); let a = 0, b = 0; for (const x of o) { a += Math.min(x.progress || 0, x.completionValue || 1); b += x.completionValue || 1; } return b ? a / b : 0; };
const colStates = hashes => hashes.map(h => profile.profileCollectibles?.data?.collectibles?.[h]?.state ?? profile.characterCollectibles?.data?.[charId]?.collectibles?.[h]?.state).filter(s => s !== undefined);
const colAcquired = hashes => colStates(hashes).some(s => !(s & 1));
// Faltando = não adquirido e visível nas Coleções do jogo (o bit 4 marca itens que o jogo esconde, como exóticos que não dá mais para obter).
const colMissing = hashes => { const st = colStates(hashes); return st.length > 0 && !st.some(s => !(s & 1)) && st.some(s => !(s & 4)); };
const metric = h => profile.metrics?.data?.metrics?.[h]?.objectiveProgress?.progress || 0;
const exoticByName = name => defs.exotics.find(e => e.n[0] === name);
function srcGroup(s) {
  const t = (s || '').toLowerCase();
  if (/archive/.test(t)) return ['archive', 'Fácil', 'Solo'];
  if (/xûr|xur/.test(t)) return ['xur', 'Fácil', 'Solo'];
  if (/engram/.test(t)) return ['engram', 'Fácil', 'Solo'];
  if (/raid/.test(t)) return ['raid', 'Difícil', '6'];
  if (/dungeon/.test(t)) return ['dungeon', 'Médio', 'Trio'];
  if (/lost sector/.test(t)) return ['lost', 'Médio', 'Solo'];
  if (/quest|mission|exotic mission/.test(t)) return ['mission', 'Médio', 'Solo'];
  if (/season|pass|event|festival|solstice|dawning|guardian games|episode/.test(t)) return ['season', 'Médio', 'Solo'];
  return ['other', 'Médio', 'Solo'];
}
const SRC_ORDER = ['archive', 'xur', 'engram', 'mission', 'lost', 'dungeon', 'season', 'raid', 'other'];
const CAMPAIGN_RE = /^(the edge of fate|renegades|lightfall|the final shape|legacy:|the witch queen|beyond light|shadowkeep|forsaken)/i;

/* ---------- montagem das seções ---------- */
// Tira o nome repetido no começo da descrição ("Nome — texto") e variáveis internas do jogo ({var:123}).
const cleanDesc = x => { const n = x.qd.n || x.q.n || ''; let d = (x.qd.d || '').replace(/\{var:\d+\}/g, '…'); if (n && d.startsWith(n + ' — ')) d = d.slice(n.length + 3); if (x.qd.ql && x.qd.ql !== n) d = x.qd.ql + ' — ' + d; return d.trim(); };
const S = (tab, id, title, note, items, extra) => ({ tab, id, title, note, items, ...extra });
const I = (id, t, d, c, done, extra) => ({ id, t, d, c: c || [], auto: !!done, ...extra });
function build() {
  const p = profile, U = u(), s = U.s, ch = p.characters.data[charId];
  const out = [];
  // Objetivos: missões em andamento
  const qItems = [];
  const inv = p.characterInventories?.data?.[charId]?.items || [];
  for (const it of inv) {
    if (it.bucketHash !== QUEST_BUCKET) continue;
    const q = questInfo.en[it.itemHash], qd = (questInfo[lang] || questInfo.en)[it.itemHash];
    if (!q || !q.n) continue;
    const objs = (it.itemInstanceId ? p.itemComponents?.objectives?.data?.[it.itemInstanceId]?.objectives : null) || p.characterUninstancedItemComponents?.[charId]?.objectives?.data?.[it.itemHash]?.objectives || [];
    let a = 0, b = 0; for (const o of objs) { a += Math.min(o.progress || 0, o.completionValue || 1); b += o.completionValue || 1; }
    const frac = b ? a / b : 0;
    const isCamp = CAMPAIGN_RE.test(q.ql);
    const isContract = q.it === 26 || /\bcontract\b/i.test(q.n) || /\bcontract/i.test(q.ql);
    qItems.push({ it, q, qd, frac, objs, isCamp, isContract });
  }
  const contracts = qItems.filter(x => x.isContract).sort((a, b) => b.frac - a.frac);
  const expires = x => { const d = x.it.expirationDate ? new Date(x.it.expirationDate) : null; if (!d || isNaN(d)) return ''; const h = Math.max(0, Math.round((d - Date.now()) / 3600000)); return s.expires(h); };
  if (!contracts.length) out.push(S('obj', 'contracts', s.contracts, s.noContracts, []));
  // Um painel por vendedor/origem, usando o rótulo oficial do jogo (ex.: "Recompensa da Vanguarda", "Contrato do Sindicato").
  const byVendor = new Map();
  for (const x of contracts) { const label = x.qd.tl || x.q.tl || s.contracts; if (!byVendor.has(label)) byVendor.set(label, []); byVendor.get(label).push(x); }
  for (const [label, list] of byVendor) out.push(S('obj', 'contracts-' + label.replace(/[^a-z0-9]+/gi, '-'), label, null, list.map(x => I('k-' + (x.it.itemInstanceId || x.it.itemHash), x.qd.n || x.q.n, [cleanDesc(x), expires(x)].filter(Boolean).join(' '), [Math.round(x.frac * 100) + '%'], x.frac >= 1))));
  const quests = qItems.filter(x => !x.isCamp && !x.isContract && x.objs.length).sort((a, b) => b.frac - a.frac).slice(0, 20);
  out.push(S('obj', 'quests', s.quests, s.questsNote, quests.map(x => I('q-' + x.it.itemHash, x.qd.n || x.q.n, cleanDesc(x), [Math.round(x.frac * 100) + '%'], x.frac >= 1))));
  // catalisadores quase prontos
  const nearCats = defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !recDone(x.r) && pct(x.r) >= 0.5).sort((a, b) => pct(b.r) - pct(a.r));
  if (nearCats.length) out.push(S('obj', 'nearcats', s.nearCats, s.nearCatsNote, nearCats.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  // títulos quase prontos
  const sealStats = defs.seals.map(se => { const recs = se.r.filter(r => { const st = recState(r[0]); return !st || !(st.state & 16); }); const done = recs.filter(r => recDone(recState(r[0]))).length; return { se, recs, done, total: recs.length }; }).filter(x => x.total);
  const near = sealStats.filter(x => x.done < x.total && x.done / x.total >= 0.7 && x.se.tier < 5).sort((a, b) => b.done / b.total - a.done / a.total).slice(0, 5);
  if (near.length) out.push(S('obj', 'neartitles', s.nearTitles, s.nearTitlesNote, near.map(x => I('nt-' + x.se.cr, L(x.se.t), L(x.se.ds), [`${x.done}/${x.total}`], false))));
  // Campanhas
  const camps = qItems.filter(x => x.isCamp);
  if (camps.length) {
    for (const x of camps) {
      const idx = Math.max(0, x.q.il.indexOf(x.it.itemHash)) + 1, tot = x.q.il.length || 1;
      out.push(S('camp', 'cp-' + x.it.itemHash, x.qd.ql || x.q.ql, s.campNote(idx, tot), [I('cp-' + x.it.itemHash, x.qd.n || x.q.n, x.qd.d, [`${idx}/${tot}`], false)]));
    }
  } else out.push(S('camp', 'nocamp', '', s.noCamp, [], { empty: true }));
  // Atividades: incursões e masmorras
  for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) {
    for (const a of list) {
      const items = [I(`${kind}-${a.k}-clear`, s.clear(L(a.n)), null, [U.chip[a.d], kind === 'raid' ? U.chip['6'] : U.chip.Trio], a.m && metric(a.m) > 0)];
      const ex = a.x && exoticByName(a.x);
      if (ex) items.push(I(`${kind}-${a.k}-x`, s.exotic(L(ex.n)), L(ex.s), [U.chip['Exótico']], colAcquired(ex.h)));
      out.push(S(kind, `${kind}-${a.k}`, L(a.n), L(a.note), items, { firstIsClear: true }));
    }
  }
  // Títulos
  const ordered = sealStats.slice().sort((a, b) => (a.se.tier - b.se.tier) || (b.done / b.total - a.done / a.total));
  for (const x of ordered) {
    const items = x.recs.map(r => { const st = recState(r[0]); return I('t-' + r[0], L(r[1]), L(r[2]), [progText(st) || U.chip[['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Evento'][x.se.tier - 1]]].filter(Boolean), recDone(st)); });
    out.push(S('tit', 'seal-' + x.se.cr, L(x.se.t), s.tierNote[x.se.tier - 1] + '. ' + L(x.se.ds), items, { coll: true, titleSeal: true }));
  }
  // Drops: exóticos
  const cls = ch.classType;
  const missing = defs.exotics.filter(e => (e.t === 'w' || e.c === cls) && colMissing(e.h));
  const weapons = missing.filter(e => e.t === 'w');
  const bySrc = {};
  for (const e of weapons) { const g = srcGroup(e.s[0]); (bySrc[g[0]] = bySrc[g[0]] || []).push([e, g]); }
  for (const g of SRC_ORDER) if (bySrc[g]) out.push(S('exo', 'exo-' + g, `${s.wpn} · ${s.src[g]}`, null, bySrc[g].map(([e, gg]) => I('x-' + e.h[0], L(e.n), L(e.s), [U.chip[gg[1]], U.chip[gg[2]]], false))));
  const armor = missing.filter(e => e.t === 'a');
  if (armor.length) out.push(S('exo', 'exo-armor', s.armor(U.classes[cls]), null, armor.map(e => { const g = srcGroup(e.s[0]); return I('x-' + e.h[0], L(e.n), L(e.s), [U.chip[g[1]], U.chip[g[2]]], false); })));
  // Drops: catalisadores
  const catRows = defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !(x.r.state & 16));
  const catSrc = c => { const k = c.n[0].replace(/ Catalyst$/, ''); return defs.catsrc[k] ? L(defs.catsrc[k]) : ''; };
  const prog = catRows.filter(x => !recDone(x.r) && pct(x.r) > 0).sort((a, b) => pct(b.r) - pct(a.r));
  const fresh = catRows.filter(x => !recDone(x.r) && pct(x.r) === 0);
  if (prog.length) out.push(S('cat', 'cat-prog', s.catProg, s.catProgNote, prog.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  if (fresh.length) out.push(S('cat', 'cat-new', s.catNew, s.catNewNote, fresh.map(x => I('c-' + x.c.h, L(x.c.n), [catSrc(x.c), L(x.c.d)].filter(Boolean).join(' '), [], false))));
  SECTIONS = out;
  // Loadouts
  const inst = instanceMap();
  LOADOUTS = (p.characterLoadouts?.data?.[charId]?.loadouts || []).map((l, i) => ({ i, name: loadoutNames[l.nameHash]?.n || `Loadout ${i + 1}`, items: (l.items || []).map(x => itemNames[inst[x.itemInstanceId]]?.n).filter(Boolean) })).filter(l => l.items.length);
}

/* ---------- renderização ---------- */
function applyUI() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.querySelectorAll('[data-u]').forEach(el => { const v = u()[el.dataset.u]; if (typeof v === 'string') el.textContent = v; });
  const q = $('q'); q.placeholder = u().search; q.setAttribute('aria-label', u().search); $('searchbtn').setAttribute('aria-label', u().search);
  $('langbtn').innerHTML = lang === 'en' ? '<b>EN</b><span class="sep">/</span><span>PT</span>' : '<span>EN</span><span class="sep">/</span><b>PT</b>';
  $('langbtn').title = lang === 'en' ? 'Mudar para português' : 'Switch to English';
}
function render() {
  applyUI();
  const logged = !!(auth && profile);
  for (const id of ['tabs', 'overall', 'chars', 'ldbtn', 'refresh', 'logout']) $(id).hidden = !logged;
  if (!cfg) return;
  if (!logged) {
    $('title').textContent = 'Destiny Checklist'; document.title = 'Destiny Checklist'; $('eyebrow').textContent = 'Destiny 2';
    $('subtabs').hidden = true;
    if (auth) return; // carregando
    const U = u();
    showMessage(`<section class="hero"><h2>${esc(U.heroTitle)}</h2><p>${esc(U.heroText)}</p>${cfg.configured ? `<button class="btn" id="loginbtn" type="button">${esc(U.login)}</button>` : `<p class="notice">${esc(U.notConfigured)}</p>`}<ul>${U.heroList.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`);
    const b = $('loginbtn'); if (b) b.onclick = login;
    return;
  }
  const U = u(), ch = profile.characters.data[charId];
  const cls = U.classes[ch.classType] || '';
  $('title').textContent = cls; document.title = cls + ' · Destiny Checklist';
  const mx = maxPower(ch.classType);
  $('eyebrow').textContent = `${U.races[ch.raceType] || ''} ${cls} · ${U.power} ${ch.light}${mx && mx > ch.light ? ` (${U.max} ${mx})` : ''} · ${member.name}`;
  $('chars').innerHTML = Object.values(profile.characters.data).map(c => `<button class="char" type="button" data-char="${c.characterId}" aria-pressed="${c.characterId === charId}">${esc(U.classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('');
  $('chars').hidden = Object.keys(profile.characters.data).length < 2;
  $('tabs').innerHTML = GROUPS.map(g => `<button class="tab" type="button" data-group="${g.id}" aria-current="${groupOf(tab)?.id === g.id}">${esc(U.tabs[g.id])}</button>`).join('');
  const g = groupOf(tab), st = $('subtabs');
  if (g && g.subs.length > 1) { st.hidden = false; st.innerHTML = g.subs.map(id => `<button class="sub" type="button" data-sub="${id}" aria-pressed="${id === tab}">${esc(U.subs[id])}</button>`).join(''); }
  else { st.hidden = true; st.innerHTML = ''; }
  $('ldbtn').setAttribute('aria-pressed', tab === 'ld'); $('ldbtn').textContent = tab === 'ld' ? U.checklist : U.loadouts;
  document.body.classList.toggle('on-ld', tab === 'ld');
  if (tab === 'ld') {
    showMessage(LOADOUTS.length ? LOADOUTS.map(l => `<article class="ld"><div class="ld-head"><h2>${esc(l.name)}</h2></div><ul class="items">${l.items.map(n => `<li>${esc(n)}</li>`).join('')}</ul><div class="ld-actions"><a class="ld-btn" href="https://app.destinyitemmanager.com/" target="_blank" rel="noopener">${esc(U.openDim)}</a></div></article>`).join('') : `<p class="empty-msg">${esc(U.noLoadouts)}</p>`);
    $('ovcount').textContent = U.ld(LOADOUTS.length); $('ovbar').style.width = '0';
    return;
  }
  const secs = SECTIONS.filter(x => x.tab === tab);
  $('list').innerHTML = `<div class="panel">${secs.map(sec => {
    if (sec.empty) return `<p class="empty-msg">${esc(sec.note)}</p>`;
    if (!sec.items.length) return `<section data-sec="${sec.id}"><div class="sec-head"><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div></div><p>${esc(sec.note)}</p></div></section>`;
    const coll = sec.coll, open = openSecs.has(sec.id);
    return `<section data-sec="${sec.id}"${coll ? ` class="coll${open ? '' : ' collapsed'}"` : ''}>
      <div class="sec-head"${coll ? ` data-coll="${sec.id}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div><span class="count" data-sc="${sec.id}"></span>${coll ? '<span class="chev" aria-hidden="true"></span>' : ''}</div>
      ${sec.note ? `<p>${esc(sec.note)}</p>` : ''}<div class="sec-bar"><i data-sb="${sec.id}"></i></div></div>
      <ul>${sec.items.map(i => {
        const cid = 'c-' + i.id.replace(/[^a-z0-9]+/gi, '-'), first = i.c[0], rest = i.c.slice(1), more = !!(i.d || rest.length);
        const head = `<span class="t">${esc(i.t)}</span>${first ? `<span class="chip ${chipClass(first)}">${esc(first)}</span>` : ''}`;
        return `<li data-li="${esc(i.id)}" data-search="${esc([i.t, i.d, ...i.c, sec.title].join(' ').toLowerCase())}"><div class="row"><label class="ck" for="${cid}"><input type="checkbox" id="${cid}" data-id="${esc(i.id)}" aria-label="${esc(i.t)}"${i.auto ? ' checked disabled' : ''}></label>${more ? `<button class="it" type="button" aria-expanded="false">${head}<span class="chev" aria-hidden="true"></span></button>` : `<span class="it">${head}</span>`}</div>${more ? `<div class="more">${i.d ? `<div class="d">${esc(i.d)}</div>` : ''}${rest.length ? `<div class="chips">${rest.map(x => `<span class="chip ${chipClass(x)}">${esc(x)}</span>`).join('')}</div>` : ''}</div>` : ''}</li>`;
      }).join('')}</ul></section>`;
  }).join('')}<p class="donebar" id="donebar" hidden><span id="donetxt"></span><button class="reset" id="togglecomplete" type="button"></button></p></div>`;
  update(); filter();
}
const isDone = i => i.auto || marks.has(i.id);
function update() {
  const U = u();
  document.querySelectorAll('#list input[data-id]').forEach(cb => { const it = findItem(cb.dataset.id); const d = it ? isDone(it) : false; cb.checked = d; cb.closest('li').classList.toggle('is-done', d); });
  let full = 0;
  for (const sec of SECTIONS) {
    const el = document.querySelector(`[data-sc="${sec.id}"]`); if (!el) continue;
    const n = sec.items.filter(isDone).length, t = sec.items.length;
    el.textContent = `${n}/${t}`;
    document.querySelector(`[data-sb="${sec.id}"]`).style.width = (t ? n / t * 100 : 0) + '%';
    const complete = t > 0 && n === t; el.closest('section').classList.toggle('complete', complete); if (complete) full++;
  }
  const bar = $('donebar');
  if (bar) { bar.hidden = full === 0; const sh = document.body.classList.contains('show-complete'); $('donetxt').textContent = U.panels(full, sh); $('togglecomplete').textContent = sh ? U.hideDone : U.show; }
  const secs = SECTIONS.filter(x => x.tab === tab && !x.empty);
  let n, t, label;
  if (tab === 'raid' || tab === 'dg') { t = secs.length; n = secs.filter(x => isDone(x.items[0])).length; label = U[tab](n, t); }
  else if (tab === 'tit') { t = secs.length; n = secs.filter(x => x.items.every(isDone)).length; label = U.tit(n, t); }
  else if (tab === 'camp') { t = secs.length; n = 0; label = U.camp(t); }
  else { const items = secs.flatMap(x => x.items); t = items.length; n = items.filter(isDone).length; label = U.done1(n, t); }
  $('ovcount').textContent = label; $('ovbar').style.width = (t ? n / t * 100 : 0) + '%';
}
let itemIndex = null;
function findItem(id) { if (!itemIndex || itemIndex.v !== SECTIONS) { itemIndex = { v: SECTIONS, m: new Map() }; for (const s of SECTIONS) for (const i of s.items) itemIndex.m.set(i.id, i); } return itemIndex.m.get(id); }
function filter() {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('#list li').forEach(li => li.classList.toggle('no-match', !!q && !li.dataset.search.includes(q)));
  document.querySelectorAll('#list section').forEach(sec => { sec.classList.toggle('empty', !!q && !sec.querySelector('li:not(.no-match)')); sec.classList.toggle('q-open', !!q); });
}

/* ---------- eventos ---------- */
function go(t) { tab = t; const g = groupOf(t); if (g) { lastSub[g.id] = t; LS.set('dc-subs', lastSub); } LS.set('dc-tab', t); render(); }
$('tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; const g = GROUPS.find(x => x.id === b.dataset.group); go(lastSub[g.id] || g.subs[0]); });
$('subtabs').addEventListener('click', e => { const b = e.target.closest('.sub'); if (b) go(b.dataset.sub); });
$('chars').addEventListener('click', async e => { const b = e.target.closest('.char'); if (!b || b.dataset.char === charId) return; charId = b.dataset.char; LS.set('dc-char-' + member.id, charId); await prepareEntities(); build(); render(); });
$('ldbtn').addEventListener('click', () => { if (tab === 'ld') go(prevTab || 'obj'); else { prevTab = tab; go('ld'); } });
$('langbtn').addEventListener('click', async () => { lang = lang === 'en' ? 'pt' : 'en'; LS.set('dc-lang', lang); if (profile) { status(u().loadingDefs); await prepareEntities(); build(); status(u().updated(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }))); } render(); });
$('refresh').addEventListener('click', () => start());
$('logout').addEventListener('click', logout);
$('hide').addEventListener('change', e => { document.body.classList.toggle('hide-done', e.target.checked); LS.set('dc-hide', e.target.checked); });
$('searchbtn').addEventListener('click', () => { const q = $('q'), show = q.hidden; q.hidden = !show; $('searchbtn').setAttribute('aria-expanded', show); if (show) q.focus(); else { q.value = ''; query = ''; filter(); } });
$('q').addEventListener('input', e => { query = e.target.value; filter(); });
const toggleSec = h => { const id = h.dataset.coll, sec = h.closest('section'); const o = sec.classList.toggle('collapsed') === false; o ? openSecs.add(id) : openSecs.delete(id); h.setAttribute('aria-expanded', o); };
$('list').addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.sec-head[data-coll]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSec(h); } });
$('list').addEventListener('click', e => {
  const hd = e.target.closest('.sec-head[data-coll]'); if (hd) { toggleSec(hd); return; }
  const it = e.target.closest('button.it'); if (it) { const li = it.closest('li'); const o = li.classList.toggle('open'); it.setAttribute('aria-expanded', o); return; }
  if (e.target.id === 'togglecomplete') { document.body.classList.toggle('show-complete'); update(); }
});
$('list').addEventListener('change', e => { const id = e.target.dataset.id; if (!id || !member) return; e.target.checked ? marks.add(id) : marks.delete(id); LS.set('dc-marks-' + member.id, [...marks]); update(); });

/* ---------- início ---------- */
async function start() {
  try {
    status(u().loading);
    await loadAccount();
    status(u().updated(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' })));
  } catch (e) {
    if (e.message === 'auth') { status(''); render(); return; }
    status('');
    showMessage(`<p class="notice">${esc(e.message === 'maintenance' ? u().maintenance : u().apiError(e.message))}</p>`);
  }
}
(async function init() {
  if (LS.get('dc-hide', true)) { $('hide').checked = true; document.body.classList.add('hide-done'); }
  applyUI();
  const h = readHash();
  try {
    [cfg, defs, ITEMS] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/data/defs.json').then(r => r.json()), fetch('/data/items.json').then(r => r.json()).catch(() => ({}))]);
  } catch { cfg = { configured: false }; showMessage(`<p class="notice">${esc(u().notConfigured)}</p>`); return; }
  if (h?.error) { render(); $('list').insertAdjacentHTML('afterbegin', `<p class="notice">${esc(u().authError(h.error))}</p>`); return; }
  if (h?.auth) { auth = h.auth; LS.set('dc-auth', auth); }
  if (auth) { render(); await start(); } else render();
})();
})();
