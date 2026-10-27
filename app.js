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
    tabs: { obj: 'Objetivos', act: 'Atividades', drops: 'Drops', gd: 'Guardião' },
    subs: { camp: 'Campanhas', raid: 'Incursões', dg: 'Masmorras', tit: 'Títulos', exo: 'Exóticos', cat: 'Catalisadores' },
    heroTitle: 'Seu checklist de Destiny 2', heroText: 'Entre com a sua conta Bungie.net para ver o que falta: exóticos, catalisadores, títulos, incursões, masmorras e campanhas, do mais fácil para o mais difícil.',
    heroList: ['O site só lê os seus dados; não altera nada no jogo.', 'Sua senha fica na Bungie; o site nunca vê.', 'As suas marcações ficam salvas neste navegador.'],
    login: 'Entrar com Bungie.net', notConfigured: 'O site ainda não foi configurado: faltam as chaves da Bungie nas variáveis de ambiente da Vercel.',
    loading: 'Carregando sua conta…', loadingDefs: 'Buscando nomes de missões e itens…', loadingPlaces: 'Buscando locais das missões…', cached: t => `Mostrando dados das ${t}; atualizando…`, updated: t => `Atualizado às ${t}`,
    authError: m => `Não deu para entrar: ${m}. Tente de novo.`, apiError: m => `Erro ao falar com a Bungie: ${m}`,
    maintenance: 'A API da Bungie está em manutenção agora. Tente de novo em alguns minutos.',
    noChars: 'Nenhum personagem de Destiny 2 encontrado nesta conta.',
    done1: (n, t) => `${n} de ${t} feitos`, dg: (n, t) => `${n} de ${t} masmorras concluídas`, raid: (n, t) => `${n} de ${t} incursões concluídas`,
    tit: (n, t) => `${n} de ${t} títulos conquistados`, camp: n => `${n} campanha${n === 1 ? '' : 's'} em andamento`, ld: n => `${n} loadout${n === 1 ? '' : 's'} no jogo`,
    panels: (n, sh) => n === 1 ? '1 painel concluído ' + (sh ? 'aparecendo.' : 'oculto.') : `${n} painéis concluídos ${sh ? 'aparecendo.' : 'ocultos.'}`,
    show: 'Mostrar', hideDone: 'Ocultar concluídos',
    s: {
      contracts: 'Contratos ativos', contractsNote: 'Contratos e recompensas que estão com você agora.', noContracts: 'Nenhum contrato ativo agora. Pegue novos com os Sindicatos ou vendedores.', expires: h => h >= 48 ? `Expira em ${Math.round(h / 24)} dias.` : `Expira em ${h} h.`,
      loadingQuests: 'Carregando missões e contratos…', loadingRecords: 'Carregando títulos e catalisadores…',
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
      xg: { archive: 'Arquivo Exótico na Torre', armor: c => `Armaduras exóticas de ${c}`, explore: 'Exploração e atividades', mission: 'Jornadas e missões exóticas', dungeon: 'Masmorras', raid: 'Incursões', season: 'Passes e temporadas' },
      xn: { archive: 'Fácil · solo. Compra direta no Arquivo Exótico, na Torre; só precisa dos materiais.', armor: 'Fácil · solo. Foco de engrama exótico na Torre ou a fonte indicada em cada uma.', explore: 'Fácil a médio · solo. Engramas exóticos, Xûr, setores perdidos e outras atividades.', mission: 'Médio · quase todas dá para fazer solo. Missões exóticas pedem atenção às mecânicas.', dungeon: 'Médio · trio. Ideal para jogar com dois amigos.', raid: 'Difícil · incursão com 6 jogadores. O exótico cai com chance baixa.', season: 'Médio · solo. Passes e eventos antigos; alguns custam Prata.' },
      tierNote: ['Fácil · solo', 'Médio · masmorras e um pouco de PvP', 'Difícil · incursão (6 jogadores)', 'Muito difícil · PvP competitivo e Grão-mestre', 'Evento · só com o evento ativo'],
    },
    chip: { 'Fácil': 'Fácil', 'Médio': 'Médio', 'Difícil': 'Difícil', 'Muito difícil': 'Muito difícil', 'Evento': 'Evento', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 jogadores', 'Exótico': 'Exótico', 'Mestre': 'Mestre' },
    w: {
      week: 'Esta semana', xurSells: n => `Xûr vende ${n}`, xurSub: (c, h, t) => `${c} moedas${h != null ? ` · você tem ${h}` : ''} · sai em ${t}`,
      featured: 'Em destaque: ', missingEx: n => `${n} ainda falta`, untilReset: 'até o reset', reset: 'Reset semanal', resetSub: t => `em ${t} · terça, 14h (Brasília)`,
      featWeek: 'Em destaque nesta semana', clears: n => n === 1 ? '1 conclusão' : `${n} conclusões`, showBuild: 'Ver a build equipada',
      subclass: 'Subclasse', weapons: 'Armas', armor: 'Armadura e mods', aspects: 'Aspectos', frags: 'Fragmentos',
      ranksT: 'Patentes e reputação', gRank: 'Patente de Guardião', pass: 'Passe',
      clearsT: 'Conclusões', dgW: 'Masmorra', raidW: 'Incursão', others: (k, z, any) => k === 'dg' ? (any ? `Outras ${z} masmorras` : 'Masmorras') : (any ? `Outras ${z} incursões` : 'Incursões'), noneYet: 'nenhuma ainda',
      wpnT: 'Armas que você mais usa', wpnNote: 'Abates e precisão com cada arma neste personagem, segundo a Bungie.', kills: 'abates', prec: 'precisão',
      commT: 'Elogios', commScore: 'Pontuação de elogios', clanT: 'Clã', noClan: 'Você não está em um clã.', clanNote: n => n === 1 ? '1 pessoa do clã online agora.' : n ? `${n} pessoas do clã online agora.` : 'Ninguém do clã online agora.',
      unavailable: 'Não deu para carregar agora. Tente Atualizar.',
      optsT: 'Ajustes', optsNote: 'Ligue ou desligue as partes novas. Fica salvo neste navegador.', optWeek: 'Mostrar a faixa “Esta semana”', optClears: 'Mostrar conclusões nas incursões e masmorras', optBuild: 'Abrir a build ao tocar nos ícones do cabeçalho',
    },
    openDim: 'Abrir no DIM', noLoadouts: 'Nenhum loadout salvo no jogo para este personagem.',
    toLight: 'Mudar para tema claro', toDark: 'Mudar para tema escuro', classes: ['Titã', 'Caçador', 'Arcano'], races: ['Humano', 'Despertado', 'Exo'], power: 'Poder', max: 'máx.', where: 'Onde',
  },
  en: {
    hide: 'Hide done', search: 'Search by name or source', refresh: 'Refresh', logout: 'Sign out',
    disclaimer: 'Data read from your account through the official Bungie API. This site is not affiliated with Bungie.',
    loadouts: 'Loadouts', checklist: 'Checklist',
    tabs: { obj: 'Objectives', act: 'Activities', drops: 'Drops', gd: 'Guardian' },
    subs: { camp: 'Campaigns', raid: 'Raids', dg: 'Dungeons', tit: 'Titles', exo: 'Exotics', cat: 'Catalysts' },
    heroTitle: 'Your Destiny 2 checklist', heroText: "Sign in with your Bungie.net account to see what's left: exotics, catalysts, titles, raids, dungeons and campaigns, from easiest to hardest.",
    heroList: ['The site only reads your data; it never changes anything in the game.', 'Your password stays with Bungie; the site never sees it.', 'Your checkmarks are saved in this browser.'],
    login: 'Sign in with Bungie.net', notConfigured: "The site isn't configured yet: the Bungie keys are missing from the Vercel environment variables.",
    loading: 'Loading your account…', loadingDefs: 'Fetching quest and item names…', loadingPlaces: 'Fetching quest locations…', cached: t => `Showing data from ${t}; updating…`, updated: t => `Updated at ${t}`,
    authError: m => `Couldn't sign in: ${m}. Please try again.`, apiError: m => `Error talking to Bungie: ${m}`,
    maintenance: 'The Bungie API is down for maintenance. Try again in a few minutes.',
    noChars: 'No Destiny 2 characters found on this account.',
    done1: (n, t) => `${n} of ${t} done`, dg: (n, t) => `${n} of ${t} dungeons cleared`, raid: (n, t) => `${n} of ${t} raids cleared`,
    tit: (n, t) => `${n} of ${t} titles earned`, camp: n => `${n} campaign${n === 1 ? '' : 's'} in progress`, ld: n => `${n} in-game loadout${n === 1 ? '' : 's'}`,
    panels: (n, sh) => `${n} completed panel${n === 1 ? '' : 's'} ${sh ? 'shown.' : 'hidden.'}`,
    show: 'Show', hideDone: 'Hide completed',
    s: {
      contracts: 'Active contracts', contractsNote: 'Contracts and bounties you are holding right now.', noContracts: 'No active contracts right now. Pick up new ones from the Syndicates or vendors.', expires: h => h >= 48 ? `Expires in ${Math.round(h / 24)} days.` : `Expires in ${h} h.`,
      loadingQuests: 'Loading quests and contracts…', loadingRecords: 'Loading titles and catalysts…',
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
      xg: { archive: 'Exotic Archive in the Tower', armor: c => `${c} exotic armor`, explore: 'Exploration and activities', mission: 'Exotic quests and missions', dungeon: 'Dungeons', raid: 'Raids', season: 'Passes and seasons' },
      xn: { archive: 'Easy · solo. Buy it at the Exotic Archive in the Tower; you only need the materials.', armor: 'Easy · solo. Exotic engram focusing in the Tower, or the source shown on each one.', explore: 'Easy to medium · solo. Exotic engrams, Xûr, Lost Sectors and other activities.', mission: 'Medium · almost all can be done solo. Exotic missions need attention to mechanics.', dungeon: 'Medium · trio. Great with two friends.', raid: 'Hard · 6-player raid. The exotic has a low drop chance.', season: 'Medium · solo. Old passes and events; some cost Silver.' },
      tierNote: ['Easy · solo', 'Medium · dungeons and some PvP', 'Hard · raid (6 players)', 'Very hard · competitive PvP and Grandmaster', 'Event · only while the event is live'],
    },
    chip: { 'Fácil': 'Easy', 'Médio': 'Medium', 'Difícil': 'Hard', 'Muito difícil': 'Very hard', 'Evento': 'Event', 'Solo': 'Solo', 'Trio': 'Trio', '6': '6 players', 'Exótico': 'Exotic', 'Mestre': 'Master' },
    w: {
      week: 'This week', xurSells: n => `Xûr sells ${n}`, xurSub: (c, h, t) => `${c} coins${h != null ? ` · you have ${h}` : ''} · leaves in ${t}`,
      featured: 'Featured: ', missingEx: n => `${n} still missing`, untilReset: 'until reset', reset: 'Weekly reset', resetSub: t => `in ${t} · Tuesday, 17:00 UTC`,
      featWeek: 'Featured this week', clears: n => n === 1 ? '1 clear' : `${n} clears`, showBuild: 'Show the equipped build',
      subclass: 'Subclass', weapons: 'Weapons', armor: 'Armor and mods', aspects: 'Aspects', frags: 'Fragments',
      ranksT: 'Ranks and reputation', gRank: 'Guardian Rank', pass: 'Pass',
      clearsT: 'Clears', dgW: 'Dungeon', raidW: 'Raid', others: (k, z, any) => k === 'dg' ? (any ? `Other ${z} dungeons` : 'Dungeons') : (any ? `Other ${z} raids` : 'Raids'), noneYet: 'none yet',
      wpnT: 'Your most used weapons', wpnNote: 'Kills and precision with each weapon on this character, from Bungie.', kills: 'kills', prec: 'precision',
      commT: 'Commendations', commScore: 'Commendation score', clanT: 'Clan', noClan: "You're not in a clan.", clanNote: n => n === 1 ? '1 clanmate online now.' : n ? `${n} clanmates online now.` : 'No clanmates online right now.',
      unavailable: "Couldn't load this right now. Try Refresh.",
      optsT: 'Settings', optsNote: 'Turn the new parts on or off. Saved in this browser.', optWeek: 'Show the “This week” strip', optClears: 'Show clears on raids and dungeons', optBuild: 'Open the build when tapping the header icons',
    },
    openDim: 'Open in DIM', noLoadouts: 'No in-game loadouts saved for this character.',
    toLight: 'Switch to light theme', toDark: 'Switch to dark theme', classes: ['Titan', 'Hunter', 'Warlock'], races: ['Human', 'Awoken', 'Exo'], power: 'Power', max: 'max', where: 'Where',
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
const openSecs = new Set(), openItems = new Set();
const GROUPS = [{ id: 'obj', subs: ['obj'] }, { id: 'act', subs: ['camp', 'raid', 'dg', 'tit'] }, { id: 'drops', subs: ['exo', 'cat'] }, { id: 'gd', subs: ['gd'] }];
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
function logout() { XUR = null; GD = null; BUILD = null; buildOpen = false; if (member) idbDel('profile-' + member.id); LS.del('dc-auth'); LS.del('dc-member'); LS.del('dc-el'); auth = null; profile = null; member = null; render(); }
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
LS.del('dc-ent3-en'); LS.del('dc-ent3-pt');
const entCache = { en: LS.get('dc-ent4-en', {}), pt: LS.get('dc-ent4-pt', {}) };
for (const k of ['dc-ent-en', 'dc-ent-pt', 'dc-ent2-en', 'dc-ent2-pt']) LS.del(k);
let entDirty = false;
async function entity(type, hash, lc) {
  const key = type + ':' + hash, store = entCache[lc];
  if (store[key]) return store[key];
  try {
    const d = await bungie(`/Destiny2/Manifest/${type}/${hash >>> 0}/?lc=${lc === 'pt' ? 'pt-br' : 'en'}`, false);
    const v = { n: d.displayProperties?.name || '', d: d.displayProperties?.description || '', ql: d.setData?.questLineName || '', il: (d.setData?.itemList || []).map(x => x.itemHash), b: d.inventory?.bucketTypeHash || 0, it: d.itemType || 0, tl: d.itemTypeDisplayName || '', su: d.inventory?.stackUniqueLabel || '', ob: d.objectives?.objectiveHashes || [], lh: d.locationHash || 0, lr: (d.locationReleases || []).map(r => [r.destinationHash || 0, r.activityHash || 0]).slice(-1)[0] || null, ic: d.displayProperties?.icon || '', tt: d.inventory?.tierType || 0, dt: d.talentGrid?.hudDamageType || 0 };
    store[key] = v; entDirty = true;
    return v;
  } catch { return { n: '', d: '', ql: '', il: [], b: 0, it: 0, tl: '', su: '', ob: [], lh: 0, lr: null }; }
}
async function entities(type, hashes, lc) {
  const list = [...new Set(hashes)];
  const out = {};
  let i = 0;
  const worker = async () => { while (i < list.length) { const h = list[i++]; out[h] = await entity(type, h, lc); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (entDirty) { LS.set('dc-ent4-en', entCache.en); LS.set('dc-ent4-pt', entCache.pt); entDirty = false; }
  return out;
}

/* ---------- cópia local do último perfil (IndexedDB) ---------- */
const idb = () => new Promise((res, rej) => { const q = indexedDB.open('destiny-checklist', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
async function idbGet(k) { try { const db = await idb(); return await new Promise(r => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch { return null; } }
async function idbSet(k, v) { try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch {} }
async function idbDel(k) { try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').delete(k); } catch {} }

/* ---------- leitura do perfil ----------
   O perfil vem em 3 partes em paralelo, da mais leve para a mais pesada, e a tela é desenhada
   conforme cada parte chega. Se houver uma cópia da última visita, ela aparece na hora. */
// id: personagens e equipados (cabeçalho e cor da subclasse, sempre primeiro) · q: missões e contratos
// a: coleções, métricas, marcos e elogios · b: triunfos · c: inventário, instâncias e loadouts · g: encaixes do equipamento (build)
// 201 também em c: a Bungie só manda instâncias (300) dos itens incluídos na mesma resposta
const PARTS = { id: '200,205', q: '201,301', a: '100,202,800,1100,1400', b: '900', c: '102,201,205,206,300', g: '205,300,305' };
// parte de que cada aba depende: ela é pedida logo depois do cabeçalho
const TAB_PART = { obj: 'q', camp: 'q', raid: 'a', dg: 'a', exo: 'a', cat: 'b', tit: 'b', ld: 'c', gd: 'a' };
let have = { id: false, q: false, a: false, b: false, c: false, g: false };
function pickChar() {
  const chars = Object.values(profile.characters?.data || {});
  if (!chars.length) return false;
  const saved = LS.get('dc-char-' + member.id, null);
  if (!chars.some(c => c.characterId === charId)) charId = chars.some(c => c.characterId === saved) ? saved : chars.slice().sort((a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed))[0].characterId;
  return true;
}
async function loadMember() {
  const m = await bungie('/User/GetMembershipsForCurrentUser/');
  const list = m.destinyMemberships || [];
  if (!list.length) return null;
  const pick = list.find(x => x.membershipId === m.primaryMembershipId) || list.find(x => x.crossSaveOverride && x.crossSaveOverride === x.membershipType) || list[0];
  return { type: pick.membershipType, id: pick.membershipId, name: m.bungieNetUser?.uniqueName || pick.bungieGlobalDisplayName || pick.displayName };
}
async function loadAccount() {
  status(u().loading);
  member = LS.get('dc-member', null);
  if (!member) {
    showMessage(`<p class="loading">${esc(u().loading)}</p>`);
    member = await loadMember();
    if (!member) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
    LS.set('dc-member', member);
  }
  marks = new Set(LS.get('dc-marks-' + member.id, []));
  // 1) cópia da última visita, se houver
  let usingCache = false;
  if (!profile) {
    const cached = await idbGet('profile-' + member.id);
    if (cached?.p?.characters) {
      profile = cached.p; have = { id: true, q: true, a: true, b: true, c: true, g: true }; usingCache = true;
      if (pickChar()) { loadedAt = new Date(cached.t); hydrate(u().cached(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }))); }
    } else showMessage(`<p class="loading">${esc(u().loading)}</p>`);
  } else usingCache = true;
  // 2) dados ao vivo, em 3 partes
  const live = {}, got = { id: false, q: false, a: false, b: false, c: false, g: false };
  let hydrated = false;
  const need = TAB_PART[tab] || 'q';
  const url = k => `/Destiny2/${member.type}/Profile/${member.id}/?components=${PARTS[k]}`;
  const onPart = (k, r) => {
    const ic = live.itemComponents; Object.assign(live, r); if (ic && r.itemComponents) { const m = { ...ic }; for (const [c, v] of Object.entries(r.itemComponents)) m[c] = { ...ic[c], ...v, data: { ...ic[c]?.data, ...v?.data } }; live.itemComponents = m; } got[k] = true;
    if (usingCache) return; // troca tudo de uma vez quando as 3 partes chegarem
    profile = live; have = { ...got };
    if (!got.id || !pickChar()) return;
    loadedAt = new Date();
    if (got.q && got[need] && !hydrated) { hydrated = true; hydrate(); return; }
    if (k === 'id') { build(); render(); loadGear(gen); }
    else if (k === 'c' && hydrated) loadLoadouts(gen);
    else if (k === 'g' && hydrated) loadBuild(gen);
    else { build(); render(); if (k === 'a' && hydrated) { loadMilestones(gen); if (tab === 'gd') loadGuardian(gen); } }
  };
  // ordem: cabeçalho, a parte da aba aberta, e o resto
  const order = ['id', need, ...['q', 'a', 'b', 'c', 'g'].filter(k => k !== need)];
  const results = await Promise.allSettled(order.map(k => bungie(url(k)).then(r => onPart(k, r))));
  const failed = results.find(r => r.status === 'rejected');
  if (failed) {
    if (failed.reason?.message === 'auth') throw failed.reason;
    if (!got.id && !usingCache) { LS.del('dc-member'); throw failed.reason; }
  }
  if (!hydrated && got.id && got.q && !usingCache && pickChar()) { hydrated = true; hydrate(); }
  if (!Object.values(got).every(Boolean)) { if (!usingCache) throw failed?.reason || new Error('profile'); status(u().apiError(failed?.reason?.message || '')); return; }
  profile = live; have = { id: true, q: true, a: true, b: true, c: true, g: true };
  if (!pickChar()) { showMessage(`<p class="notice">${esc(u().noChars)}</p>`); return; }
  loadedAt = new Date();
  idbSet('profile-' + member.id, { t: Date.now(), p: live });
  if (usingCache) hydrate();
}

let questInfo = {}, loadoutNames = {}, itemNames = {}, questLoc = {}, gearDefs = {};
/* Local oficial da missão: objetivo -> local -> destino/atividade (quando a Bungie informa). */
async function prepareLocations(defsEn) {
  const objHashes = [...new Set(defsEn.flatMap(d => d.ob || []))];
  const objs = await entities('DestinyObjectiveDefinition', objHashes, 'en');
  const locHashes = [...new Set(Object.values(objs).map(o => o.lh).filter(Boolean))];
  const locs = await entities('DestinyLocationDefinition', locHashes, 'en');
  const dests = [], acts = [];
  for (const l of Object.values(locs)) if (l.lr) { if (l.lr[0]) dests.push(l.lr[0]); if (l.lr[1]) acts.push(l.lr[1]); }
  const dN = await entities('DestinyDestinationDefinition', dests, lang), aN = await entities('DestinyActivityDefinition', acts, lang);
  questLoc = {};
  const quests = Object.entries(questInfo.en);
  for (const [h, d] of quests) {
    const names = [];
    for (const o of d.ob || []) { const l = locs[objs[o]?.lh]; if (!l || !l.lr) continue; let nm = (l.lr[0] && dN[l.lr[0]]?.n) || (l.lr[1] && aN[l.lr[1]]?.n); if (nm && nm === nm.toUpperCase()) nm = nm.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); if (nm && !names.includes(nm)) names.push(nm); }
    if (names.length) questLoc[h] = names.join(', ');
  }
}
/* Sem local oficial: deduz pela descrição em inglês. */
const PLACE = [[/neomuna/i, 'Neomuna', 'Neomuna'], [/dreaming city/i, 'Dreaming City', 'Cidade Onírica'], [/pale heart/i, 'The Pale Heart', 'Coração Pálido'], [/europa|eventide|asterion|cadmus/i, 'Europa', 'Europa'], [/\bmoon\b/i, 'The Moon', 'Lua'], [/kepler/i, 'Kepler', 'Kepler'], [/throne world|savath[uû]n/i, 'Throne World', 'Mundo-trono'], [/\benclave\b/i, 'Mars, Enclave', 'Marte, Enclave'], [/\bnessus\b/i, 'Nessus', 'Nesso'], [/\bEDZ\b|european dead zone/i, 'EDZ', 'ZME'], [/\btower\b/i, 'Tower', 'Torre']];
function guessLoc(en) {
  const t = en || '', out = [];
  const dg = t.match(/dungeon\W+"?([^".]+?)"?(?:[.]|\s|$)|"([^"]+?)\.?"\s+dungeon/i);
  if (dg) { const n = (dg[1] || dg[2] || '').trim(); const a = defs.dungeons.find(x => x.n[0].toLowerCase() === n.toLowerCase()); if (a) return lang === 'en' ? `${a.n[0]} dungeon` : `Masmorra ${a.n[1]}`; }
  const rd = t.match(/raid\W+"?([^".]+?)"?(?:[.]|\s|$)|"([^"]+?)\.?"\s+raid/i);
  if (rd) { const n = (rd[1] || rd[2] || '').trim(); const a = defs.raids.find(x => x.n[0].toLowerCase() === n.toLowerCase()); if (a) return lang === 'en' ? `${a.n[0]} raid` : `Incursão ${a.n[1]}`; }
  const ops = /\bops\b|operations/i.test(t), cru = /crucible/i.test(t), gam = /gambit/i.test(t), comp = /competitive/i.test(t), nf = /nightfall/i.test(t), ls = /lost sector/i.test(t);
  const P = lang === 'en';
  if (ops) out.push(P ? 'Ops in the Portal' : 'Operações no Portal');
  if (nf) out.push(P ? 'Nightfall' : 'Anoitecer');
  if (ls) out.push(P ? 'Lost Sectors' : 'Setores perdidos');
  if (gam) out.push(P ? 'Gambit' : 'Artimanha');
  if (comp) out.push(P ? 'Competitive Crucible' : 'Crisol competitivo'); else if (cru) out.push(P ? 'Crucible' : 'Crisol');
  for (const [re, e, p] of PLACE) if (re.test(t)) out.push(P ? e : p);
  return out.length ? out.join(P ? ', ' : ', ').replace(/, ([^,]+)$/, P ? ' and $1' : ' e $1') : '';
}
const questWhere = x => questLoc[x.it.itemHash] || guessLoc(x.q.d);
/* Carregamento em etapas: a lista aparece na hora; nomes de missões e loadouts chegam em seguida,
   e os locais por último. Cada etapa redesenha a tela sem perder aba, itens abertos ou busca. */
let gen = 0, stage = 0;
const updatedText = () => u().updated(loadedAt.toLocaleTimeString(lang === 'pt' ? 'pt-BR' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
async function hydrate(doneMsg) {
  const my = ++gen, p = profile;
  stage = 0; questLoc = {};
  build(); render();
  await loadGear(my); if (my !== gen) return; // cabeçalho e cor primeiro
  XUR = null; GD = null; loadXur(my); if (have.g) loadBuild(my); if (have.a) loadMilestones(my); if (tab === 'gd' && have.a) loadGuardian(my);
  status(u().loadingDefs);
  const quests = [];
  for (const inv of Object.values(p.characterInventories?.data || {})) for (const it of inv.items || []) if (it.bucketHash === QUEST_BUCKET) quests.push(it.itemHash);
  const qEn = await entities('DestinyInventoryItemDefinition', quests, 'en'); if (my !== gen) return;
  const qLang = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', quests, 'pt') : qEn; if (my !== gen) return;
  questInfo = { en: qEn, pt: qLang };
  stage = 1;
  if (have.c) await loadLoadouts(my, true); if (my !== gen) return;
  build(); render();
  status(u().loadingPlaces);
  await prepareLocations(quests.map(h => qEn[h]).filter(Boolean)); if (my !== gen) return;
  stage = 2; build(); render();
  status(doneMsg || updatedText());
}
/* Nomes dos loadouts e dos itens deles (precisa da parte de equipamentos). */
async function loadLoadouts(my, quiet) {
  const p = profile, inst = instanceMap(), ldItems = [], ldNames = [];
  for (const l of p.characterLoadouts?.data?.[charId]?.loadouts || []) { ldNames.push(l.nameHash); for (const i of l.items || []) if (inst[i.itemInstanceId]) ldItems.push(inst[i.itemInstanceId]); }
  const ln = await entities('DestinyLoadoutNameDefinition', ldNames, lang); if (my !== gen) return;
  const it = await entities('DestinyInventoryItemDefinition', ldItems, lang); if (my !== gen) return;
  loadoutNames = ln; itemNames = it;
  if (!quiet) { build(); render(); }
}
/* Identidade do personagem: subclasse e exóticos equipados (cor de destaque = elemento da subclasse) */
const SUB_BUCKET = 3284755031, GEAR_BUCKETS = [3284755031, 1498876634, 2465295065, 953998645, 3448274439, 3551918588, 14239492, 20886954, 1585787867];
const ELEMENTS = { 1: 'prismatic', 2: 'arc', 3: 'solar', 4: 'void', 6: 'stasis', 7: 'strand' };
const BNET = 'https://www.bungie.net';
async function loadGear(my) {
  const eq = (profile.characterEquipment?.data?.[charId]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).map(i => i.itemHash);
  if (!eq.length) return;
  const gd = await entities('DestinyInventoryItemDefinition', eq, lang); if (my !== gen) return;
  gearDefs = gd; render();
}
function renderGuardian(ch) {
  const gh = $('gh');
  if (!ch) { gh.classList.add('noemb'); $('ghband').style.backgroundImage = ''; $('gear').innerHTML = ''; $('ghpw').hidden = true; delete document.documentElement.dataset.el; return; }
  gh.classList.toggle('noemb', !ch.emblemBackgroundPath);
  $('ghband').style.backgroundImage = ch.emblemBackgroundPath ? `url("${BNET}${ch.emblemBackgroundPath}")` : '';
  const eq = profile.characterEquipment?.data?.[ch.characterId]?.items || [];
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET), sd = sub && gearDefs[sub.itemHash];
  const exo = eq.filter(i => i.bucketHash !== SUB_BUCKET && gearDefs[i.itemHash]?.tt === 6).map(i => gearDefs[i.itemHash]);
  const el = sd ? ELEMENTS[sd.dt] : null;
  if (el) { document.documentElement.dataset.el = el; LS.set('dc-el', el); } else if (sd) delete document.documentElement.dataset.el;
  const g = (d, cls) => d && d.ic ? `<span class="g${cls}" title="${esc(d.n)}"><img src="${BNET}${d.ic}" alt="" loading="lazy"><span>${esc(d.n)}</span></span>` : '';
  $('gear').innerHTML = g(sd, ' g-sub') + exo.map(d => g(d, '')).join('');
  return el;
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
  const t = (s || '').split(/\.\s/)[0].toLowerCase(); // só a 1ª frase: o resto explica onde começar
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
const CAMPAIGN_RE = /^(the edge of fate|renegades|lightfall|the final shape|legacy:|the witch queen|beyond light|shadowkeep|forsaken)/i;

/* ---------- montagem das seções ---------- */
// Tira o nome repetido no começo da descrição ("Nome — texto") e variáveis internas do jogo ({var:123}).
const cleanDesc = x => { const n = x.qd.n || x.q.n || ''; let d = (x.qd.d || '').replace(/\{var:\d+\}/g, '…'); if (n && d.startsWith(n + ' — ')) d = d.slice(n.length + 3); if (x.qd.ql && x.qd.ql !== n) d = x.qd.ql + ' — ' + d; return d.trim(); };
const S = (tab, id, title, note, items, extra) => ({ tab, id, title, note, items, ...extra });
const I = (id, t, d, c, done, extra) => ({ id, t, d, c: c || [], auto: !!done, ...extra });
function build() {
  const p = profile, U = u(), s = U.s, ch = p.characters.data[charId];
  const waiting = stage < 1;
  const out = [];
  // Objetivos: missões em andamento
  const qItems = [];
  const inv = p.characterInventories?.data?.[charId]?.items || [];
  for (const it of inv) {
    if (it.bucketHash !== QUEST_BUCKET) continue;
    const q = (questInfo.en || {})[it.itemHash], qd = (questInfo[lang] || questInfo.en || {})[it.itemHash];
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
  if (!contracts.length) out.push(S('obj', 'contracts', s.contracts, waiting ? s.loadingQuests : s.noContracts, []));
  // Um painel por vendedor/origem, usando o rótulo oficial do jogo (ex.: "Recompensa da Vanguarda", "Contrato do Sindicato").
  const byVendor = new Map();
  for (const x of contracts) { const label = x.qd.tl || x.q.tl || s.contracts; if (!byVendor.has(label)) byVendor.set(label, []); byVendor.get(label).push(x); }
  for (const [label, list] of byVendor) out.push(S('obj', 'contracts-' + label.replace(/[^a-z0-9]+/gi, '-'), label, null, list.map(x => I('k-' + (x.it.itemInstanceId || x.it.itemHash), x.qd.n || x.q.n, [cleanDesc(x), expires(x)].filter(Boolean).join(' '), [Math.round(x.frac * 100) + '%'], x.frac >= 1, { loc: questWhere(x) }))));
  const quests = qItems.filter(x => !x.isCamp && !x.isContract && x.objs.length).sort((a, b) => b.frac - a.frac).slice(0, 20);
  out.push(S('obj', 'quests', s.quests, waiting ? s.loadingQuests : s.questsNote, quests.map(x => I('q-' + x.it.itemHash, x.qd.n || x.q.n, cleanDesc(x), [Math.round(x.frac * 100) + '%'], x.frac >= 1, { loc: questWhere(x) }))));
  // catalisadores quase prontos
  const recOK = have.b;
  const nearCats = !recOK ? [] : defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !recDone(x.r) && pct(x.r) >= 0.5).sort((a, b) => pct(b.r) - pct(a.r));
  if (nearCats.length) out.push(S('obj', 'nearcats', s.nearCats, s.nearCatsNote, nearCats.map(x => I('c-' + x.c.h, L(x.c.n), L(x.c.d), [progText(x.r) || Math.round(pct(x.r) * 100) + '%'], false))));
  // títulos quase prontos
  const sealStats = !recOK ? [] : defs.seals.map(se => { const recs = se.r.filter(r => { const st = recState(r[0]); return !st || !(st.state & 16); }); const done = recs.filter(r => recDone(recState(r[0]))).length; return { se, recs, done, total: recs.length }; }).filter(x => x.total);
  const near = sealStats.filter(x => x.done < x.total && x.done / x.total >= 0.7 && x.se.tier < 5).sort((a, b) => b.done / b.total - a.done / a.total).slice(0, 5);
  if (near.length) out.push(S('obj', 'neartitles', s.nearTitles, s.nearTitlesNote, near.map(x => I('nt-' + x.se.cr, L(x.se.t), L(x.se.ds), [`${x.done}/${x.total}`], false))));
  // Campanhas
  const camps = qItems.filter(x => x.isCamp);
  if (camps.length) {
    for (const x of camps) {
      const idx = Math.max(0, x.q.il.indexOf(x.it.itemHash)) + 1, tot = x.q.il.length || 1;
      out.push(S('camp', 'cp-' + x.it.itemHash, x.qd.ql || x.q.ql, s.campNote(idx, tot), [I('cp-' + x.it.itemHash, x.qd.n || x.q.n, x.qd.d, [`${idx}/${tot}`], false)]));
    }
  } else out.push(S('camp', 'nocamp', '', waiting ? s.loadingQuests : s.noCamp, [], { empty: true }));
  // Atividades: incursões e masmorras
  for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) {
    for (const a of list) {
      const items = [I(`${kind}-${a.k}-clear`, s.clear(L(a.n)), null, [U.chip[a.d], kind === 'raid' ? U.chip['6'] : U.chip.Trio], a.m && metric(a.m) > 0)];
      const ex = a.x && exoticByName(a.x);
      if (ex) items.push(I(`${kind}-${a.k}-x`, s.exotic(L(ex.n)), L(ex.s), [U.chip['Exótico']], colAcquired(ex.h), { isEx: true, exName: L(ex.n) }));
      out.push(S(kind, `${kind}-${a.k}`, L(a.n), L([a.note[1], a.note[0]]), items, { firstIsClear: true, kind, key: a.k, metric: a.m }));
    }
  }
  // Títulos
  if (!recOK) out.push(S('tit', 'tit-wait', '', s.loadingRecords, [], { empty: true }), S('cat', 'cat-wait', '', s.loadingRecords, [], { empty: true }));
  const ordered = sealStats.slice().sort((a, b) => (a.se.tier - b.se.tier) || (b.done / b.total - a.done / a.total));
  for (const x of ordered) {
    const items = x.recs.map(r => { const st = recState(r[0]); return I('t-' + r[0], L(r[1]), L(r[2]), [progText(st) || U.chip[['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Evento'][x.se.tier - 1]]].filter(Boolean), recDone(st)); });
    out.push(S('tit', 'seal-' + x.se.cr, L(x.se.t), s.tierNote[x.se.tier - 1] + '. ' + L(x.se.ds), items, { coll: true, titleSeal: true }));
  }
  // Drops: exóticos
  const cls = ch.classType;
  // Toda a coleção que ainda dá para obter: o que você já tem aparece marcado, para mostrar o progresso de cada grupo.
  const obtainable = defs.exotics.filter(e => (e.t === 'w' || e.c === cls) && (colAcquired(e.h) || colMissing(e.h)));
  const XG = { archive: 'archive', xur: 'explore', engram: 'explore', lost: 'explore', other: 'explore', mission: 'mission', dungeon: 'dungeon', raid: 'raid', season: 'season' };
  const byG = {};
  for (const e of obtainable) { const g = srcGroup(e.s[0]), k = e.t === 'a' ? 'armor' : XG[g[0]]; (byG[k] = byG[k] || []).push([e, g]); }
  if (have.a) for (const k of ['archive', 'armor', 'explore', 'mission', 'dungeon', 'raid', 'season']) if (byG[k]) {
    const list = byG[k].map(([e, g]) => ({ e, g, has: colAcquired(e.h) })).sort((a, b) => (a.has - b.has) || ['Fácil', 'Médio', 'Difícil'].indexOf(a.g[1]) - ['Fácil', 'Médio', 'Difícil'].indexOf(b.g[1]));
    out.push(S('exo', 'exo-' + k, k === 'armor' ? s.xg.armor(U.classes[cls]) : s.xg[k], s.xn[k], list.map(x => I('x-' + x.e.h[0], L(x.e.n), L(x.e.s), [U.chip[x.g[1]], U.chip[x.g[2]]], x.has))));
  }
  // Drops: catalisadores
  const catRows = !recOK ? [] : defs.cats.map(c => ({ c, r: recState(c.h) })).filter(x => x.r && !(x.r.state & 16));
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

/* ---------- novidades: faixa da semana, build, conclusões e aba Guardião ---------- */
const XUR_VENDOR = 2190858386, STRANGE_COIN = 800069450;
const RANK_PROGS = [457612306, 3011295063, 1807348350, 689153319, 584850370];
const COUNT_METRICS = [740213466, 2959623395, 26751835, 3264536674];
const OPTS = Object.assign({ week: true, clears: true, build: true }, LS.get('dc-opts', {}));
let XUR = null, MSN = {}, BUILD = null, buildOpen = false, GD = null, gdLoading = false;
const rtf = () => { try { return new Intl.RelativeTimeFormat(lang === 'pt' ? 'pt-BR' : 'en', { numeric: 'auto' }); } catch { return null; } };
function nextReset() { const d = new Date(); d.setUTCHours(17, 0, 0, 0); while (d.getUTCDay() !== 2 || d <= Date.now()) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); }
function cd(ms) { const m = Math.max(0, Math.round(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60; return d ? `${d}d ${h}h` : h ? `${h}h ${String(mm).padStart(2, '0')}min` : `${mm}min`; }
const fmtN = n => Number(n || 0).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');

/* Xûr: o que ele vende agora (só aparece quando ele está no jogo) */
async function loadXur(my) {
  try {
    const r = await bungie(`/Destiny2/${member.type}/Profile/${member.id}/Character/${charId}/Vendors/${XUR_VENDOR}/?components=400,402`);
    const sales = Object.values(r.sales?.data || {});
    const hs = sales.map(s => s.itemHash);
    const en = await entities('DestinyInventoryItemDefinition', hs, 'en'); if (my !== gen) return;
    const loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', hs, 'pt') : en; if (my !== gen) return;
    XUR = { until: r.vendor?.data?.nextRefreshDate || null, items: sales.filter(s => en[s.itemHash]?.tt === 6).map(s => ({ en: en[s.itemHash].n, n: loc[s.itemHash]?.n || en[s.itemHash].n, cost: (s.costs || []).find(c => c.itemHash === STRANGE_COIN)?.quantity || 0 })) };
  } catch { XUR = null; }
  if (my === gen) renderWeek();
}
const coins = () => { let n = 0; for (const it of profile.profileInventory?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; for (const it of profile.profileCurrencies?.data?.items || []) if (it.itemHash === STRANGE_COIN) n += it.quantity || 0; return n; };
function xurMissing() {
  if (!XUR || !have.a) return [];
  const cls = profile.characters.data[charId].classType;
  return XUR.items.filter(x => { const e = exoticByName(x.en); return e && (e.t === 'w' || e.c === cls) && colMissing(e.h); });
}
/* Rotação: incursões e masmorras com desafios ativos nos marcos do personagem */
async function loadMilestones(my) {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones; if (!ms) return;
  const d = await entities('DestinyMilestoneDefinition', Object.keys(ms).map(Number), 'en'); if (my !== gen) return;
  MSN = d; build(); render();
}
function featured() {
  const ms = profile.characterProgressions?.data?.[charId]?.milestones || {}, out = { raid: new Set(), dg: new Set(), ends: null };
  for (const m of Object.values(ms)) {
    const name = (MSN[m.milestoneHash]?.n || '').toLowerCase(); if (!name) continue;
    if (!(m.activities || []).some(a => (a.challenges || []).length)) continue;
    for (const [kind, list] of [['raid', defs.raids], ['dg', defs.dungeons]]) { const a = list.find(x => x.n[0].toLowerCase() === name); if (a) { out[kind].add(a.k); if (m.endDate) out.ends = Math.min(out.ends || Infinity, Date.parse(m.endDate)); } }
  }
  return out;
}
let WK = [];
function weekItems() {
  const W = u().w, it = [], t = Date.now();
  const miss = xurMissing();
  if (miss.length && XUR.until && Date.parse(XUR.until) > t) it.push({ cls: 'xur', ic: '◆', t: W.xurSells(miss.map(x => x.n).join(', ')), s: W.xurSub(miss[0].cost, have.c ? coins() : null, cd(Date.parse(XUR.until) - t)), to: null });
  const f = featured(), feat = [...[...f.raid].map(k => 'raid-' + k), ...[...f.dg].map(k => 'dg-' + k)].map(id => SECTIONS.find(s => s.id === id)).filter(s => s && !s.items.every(isDone));
  if (feat.length) { const ex = feat.map(s => s.items.find(i => i.isEx && !isDone(i))).find(Boolean); it.push({ cls: 'rot', ic: '★', t: W.featured + feat.map(s => s.title).join(' · '), s: ex ? W.missingEx(ex.exName) : W.untilReset, to: [feat[0].tab, feat[0].id] }); }
  it.push({ cls: 'reset', ic: '↻', t: W.reset, s: W.resetSub(cd(nextReset() - t)), to: null });
  return it.slice(0, 3);
}
function renderWeek() {
  const el = $('week'); if (!el) return;
  WK = OPTS.week && auth && profile && have.id ? weekItems() : []; el.hidden = !WK.length;
  el.innerHTML = WK.length ? `<div class="week-k">${esc(u().w.week)}</div><div class="week-items">${WK.map((w, i) => `<button class="wk ${w.cls}" type="button" data-wk="${i}"${w.to ? '' : ' tabindex="-1"'}><span class="wk-ic" aria-hidden="true">${w.ic}</span><span class="wk-t">${esc(w.t)}</span><span class="wk-s">${esc(w.s)}</span></button>`).join('')}</div>` : '';
}
function jumpTo(t, id) { go(t); requestAnimationFrame(() => { const sec = document.querySelector(`[data-sec="${id}"]`); if (!sec) return; const h = sec.querySelector('.sec-head[data-coll]'); if (h && sec.classList.contains('collapsed')) toggleSec(h); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); }
function secMeta(sec) {
  const W = u().w, c = [], f = featured(), n = metric(sec.metric);
  if (f[sec.kind].has(sec.key) && (!f.ends || f.ends > Date.now())) c.push(`<span class="chip feat">${esc(W.featWeek)}</span>`);
  if (n && have.a) c.push(`<span class="chip clr">${esc(W.clears(n))}</span>`);
  return c.length ? `<div class="sec-meta">${c.join('')}</div>` : '';
}

/* Build equipada: abre ao tocar nos ícones do cabeçalho */
async function loadBuild(my) {
  const eq = profile.characterEquipment?.data?.[charId]?.items || [], sk = profile.itemComponents?.sockets?.data;
  if (!sk || !eq.length) return;
  const plugs = []; for (const i of eq) for (const s of sk[i.itemInstanceId]?.sockets || []) if (s.plugHash && s.isVisible !== false) plugs.push(s.plugHash);
  const all = [...plugs, ...eq.map(i => i.itemHash)];
  const en = await entities('DestinyInventoryItemDefinition', all, 'en'); if (my !== gen) return;
  const loc = lang === 'pt' ? await entities('DestinyInventoryItemDefinition', all, 'pt') : en; if (my !== gen) return;
  BUILD = { en, loc }; if (buildOpen) renderBuild();
}
const SKIP_NAME = /^(Empty|Default|Upgrade Armor|Locked|No |Restore Defaults|Kill Tracker|Tracker Disabled|Change Energy|Deepsight)/i;
const SKIP_TYPE = /Shader|Ornament|Memento|Tracker|Flair|Emote|Transmat|Projection/i;
function buildHTML() {
  const W = u().w, B = BUILD; if (!B) return `<p class="b-note">${esc(u().loadingDefs)}</p>`;
  const inst = profile.itemComponents?.instances?.data || {}, sk = profile.itemComponents?.sockets?.data || {};
  const eq = (profile.characterEquipment?.data?.[charId]?.items || []).filter(i => GEAR_BUCKETS.includes(i.bucketHash)).sort((a, b) => GEAR_BUCKETS.indexOf(a.bucketHash) - GEAR_BUCKETS.indexOf(b.bucketHash));
  const chip = (h, cls) => { const d = B.loc[h] || B.en[h] || {}; return `<span class="${cls || ''}">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}${esc(d.n)}</span>`; };
  const plugsOf = i => { const own = B.en[i.itemHash]?.tl || ''; return (sk[i.itemInstanceId]?.sockets || []).filter(s => s.plugHash && s.isVisible !== false).map(s => s.plugHash).filter(h => { const e = B.en[h]; return e && e.n && !SKIP_NAME.test(e.n) && !SKIP_TYPE.test(e.tl) && e.tl !== own; }); };
  const row = (i, body) => { const d = B.loc[i.itemHash] || {}, pw = inst[i.itemInstanceId]?.primaryStat?.value; return `<div class="b-row${d.tt === 6 ? ' exo' : ''}"><div class="b-name">${d.ic ? `<img src="${BNET}${d.ic}" alt="" loading="lazy">` : ''}<span>${esc(d.n)}</span><small>${esc(d.tl || '')}${pw && pw > 0 ? ` · <b>${pw}</b>` : ''}</small></div>${body}</div>`; };
  const sub = eq.find(i => i.bucketHash === SUB_BUCKET);
  let html = '';
  if (sub) {
    const ps = plugsOf(sub), t = h => B.en[h]?.tl || '';
    const sup = ps.filter(h => /Super/.test(t(h))), asp = ps.filter(h => /Aspect/.test(t(h))), fr = ps.filter(h => /Fragment/.test(t(h))), ab = ps.filter(h => !sup.includes(h) && !asp.includes(h) && !fr.includes(h));
    html += `<div class="b-grp"><div class="b-k">${esc(W.subclass)}</div>${row(sub, `<div class="b-perks">${sup.map(h => chip(h, 'mw')).join('')}${ab.map(h => chip(h)).join('')}</div>${asp.length ? `<div class="b-perks"><span class="k">${esc(W.aspects)}</span>${asp.map(h => chip(h)).join('')}</div>` : ''}${fr.length ? `<div class="b-perks"><span class="k">${esc(W.frags)}</span>${fr.map(h => chip(h)).join('')}</div>` : ''}`)}</div>`;
  }
  const grp = (k, list) => list.length ? `<div class="b-grp"><div class="b-k">${esc(k)}</div>${list.map(i => row(i, `<div class="b-perks">${plugsOf(i).map(h => { const e = B.en[h]; return chip(h, /^Masterworked|^Tier \d/i.test(e.n) || /Intrinsic/i.test(e.tl) ? 'mw' : ''); }).join('')}</div>`)).join('')}</div>` : '';
  html += `<div class="b-cols">${grp(W.weapons, eq.filter(i => [1498876634, 2465295065, 953998645].includes(i.bucketHash)))}${grp(W.armor, eq.filter(i => [3448274439, 3551918588, 14239492, 20886954, 1585787867].includes(i.bucketHash)))}</div>`;
  return html;
}
function renderBuild() { const b = $('build'); if (!b) return; b.hidden = !buildOpen || !OPTS.build; if (!b.hidden) b.innerHTML = buildHTML(); const g = $('gear'); if (OPTS.build && profile) { g.setAttribute('role', 'button'); g.tabIndex = 0; g.setAttribute('aria-expanded', !b.hidden); g.title = u().w.showBuild; if (!g.querySelector('.g-more') && g.children.length) g.insertAdjacentHTML('beforeend', '<span class="g-more" aria-hidden="true"></span>'); } else { g.removeAttribute('role'); g.removeAttribute('tabindex'); g.removeAttribute('aria-expanded'); g.title = ''; g.querySelector('.g-more')?.remove(); } }
function toggleBuild() { if (!OPTS.build || !profile) return; buildOpen = !buildOpen; renderBuild(); }

/* Aba Guardião: o que é para consultar */
async function loadGuardian(my) {
  if (gdLoading) return; gdLoading = true;
  const out = { weapons: null, clan: null, pass: null, names: {}, metricNames: {}, commNames: {} };
  const tasks = [
    entities('DestinyProgressionDefinition', RANK_PROGS, lang).then(d => { out.names = d; }),
    entities('DestinyMetricDefinition', COUNT_METRICS, lang).then(d => { out.metricNames = d; }),
    (async () => { const h = profile.profile?.data?.currentSeasonPassHash; if (!h) return; const d = await bungie(`/Destiny2/Manifest/DestinySeasonPassDefinition/${h}/?lc=${lang === 'pt' ? 'pt-br' : 'en'}`, false); const p = profile.characterProgressions?.data?.[charId]?.progressions?.[d.rewardProgressionHash]; if (p) out.pass = { n: d.displayProperties?.name || '', lvl: p.level, a: p.progressToNextLevel, b: p.nextLevelAt }; })(),
    (async () => { const r = await bungie(`/Destiny2/${member.type}/Account/${member.id}/Character/${charId}/Stats/UniqueWeapons/`); const v = (w, k) => w.values?.[k]?.basic?.value || 0; const top = (r.weapons || []).map(w => ({ h: w.referenceId, k: v(w, 'uniqueWeaponKills'), p: v(w, 'uniqueWeaponKillsPrecisionKills') })).sort((a, b) => b.k - a.k).slice(0, 6); const n = await entities('DestinyInventoryItemDefinition', top.map(w => w.h), lang); out.weapons = top.map(w => ({ ...w, n: n[w.h]?.n || '', ic: n[w.h]?.ic || '' })); })(),
    (async () => { const g = await bungie(`/GroupV2/User/${member.type}/${member.id}/0/1/`); const grp = g.results?.[0]?.group; if (!grp) { out.clan = { none: true }; return; } const m = await bungie(`/GroupV2/${grp.groupId}/Members/?currentpage=1`); const list = (m.results || []).filter(x => x.destinyUserInfo?.membershipId !== member.id).map(x => ({ n: x.destinyUserInfo?.bungieGlobalDisplayName || x.destinyUserInfo?.displayName || '?', on: !!x.isOnline, t: (x.lastOnlineStatusChange || 0) * 1000 })).sort((a, b) => (b.on - a.on) || (b.t - a.t)); out.clan = { name: grp.name, list }; })(),
    (async () => { const c = profile.profileCommendations?.data; if (!c) return; out.comm = c; const ks = Object.keys(c.commendationNodePercentagesByHash || {}).map(Number); if (ks.length) out.commNames = await entities('DestinySocialCommendationNodeDefinition', ks, lang); })(),
  ];
  await Promise.allSettled(tasks);
  gdLoading = false; if (my !== gen) return;
  GD = out; if (tab === 'gd') render();
}
function gdHTML() {
  const W = u().w, G = GD, p = profile, cp = p.characterProgressions?.data?.[charId];
  const pc = (a, b) => b ? Math.min(100, a / b * 100) : 100;
  const st = (big, label, bar) => `<div class="st"><b>${big}</b><span>${esc(label)}</span>${bar != null ? `<i><u style="width:${bar}%"></u></i>` : ''}</div>`;
  const wait = `<p class="gd-wait">${esc(u().loadingDefs)}</p>`;
  const gr = p.profile?.data?.currentGuardianRank;
  const ranks = `<article class="gd"><div class="gd-head"><h2>${esc(W.ranksT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">
    ${gr ? st(gr, W.gRank) : ''}${G?.pass ? st(G.pass.lvl, `${W.pass} ${G.pass.n}`, pc(G.pass.a, G.pass.b)) : ''}
    ${RANK_PROGS.map(h => { const x = cp?.progressions?.[h]; const n = G?.names?.[h]?.n; return x && n && (x.level || x.currentProgress) ? st(x.level, n, x.nextLevelAt ? pc(x.progressToNextLevel, x.nextLevelAt) : null) : ''; }).join('')}</div>`}</article>`;
  const rows = (kind, list) => { const done = list.filter(a => metric(a.m) > 0).sort((a, b) => metric(b.m) - metric(a.m)), z = list.length - done.length; return done.map(a => `<tr><td>${esc((kind === 'dg' ? W.dgW : W.raidW) + ' ' + L(a.n))}</td><td class="n">${fmtN(metric(a.m))}</td></tr>`).join('') + (z ? `<tr><td class="z">${esc(W.others(kind, z, done.length))}</td><td class="n z">${esc(W.noneYet)}</td></tr>` : ''); };
  const clears = `<article class="gd"><div class="gd-head"><h2>${esc(W.clearsT)}</h2></div>${!have.a ? wait : `<div class="gd-grid">${COUNT_METRICS.map(h => G?.metricNames?.[h]?.n ? st(fmtN(metric(h)), G.metricNames[h].n) : '').join('')}</div><table>${rows('dg', defs.dungeons)}${rows('raid', defs.raids)}</table>`}</article>`;
  const wp = `<article class="gd"><div class="gd-head"><h2>${esc(W.wpnT)}</h2></div><p>${esc(W.wpnNote)}</p>${!G ? wait : G.weapons?.length ? `<table>${G.weapons.map(w => `<tr><td class="wn">${w.ic ? `<img src="${BNET}${w.ic}" alt="" loading="lazy">` : ''}${esc(w.n)}</td><td class="n">${fmtN(w.k)} ${esc(W.kills)}</td><td class="n z">${Math.round(w.p <= 1 ? w.p * 100 : w.p)}% ${esc(W.prec)}</td></tr>`).join('')}</table>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const c = G?.comm;
  const comm = `<article class="gd"><div class="gd-head"><h2>${esc(W.commT)}</h2></div>${!G ? wait : c ? `<div class="gd-grid">${st(fmtN(c.totalScore), W.commScore)}${Object.entries(c.commendationNodePercentagesByHash || {}).filter(([h]) => G.commNames[h]?.n).sort((a, b) => b[1] - a[1]).map(([h, v]) => st(v + '%', G.commNames[h].n, v)).join('')}</div>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const r = rtf(), ago = t => t && r ? (() => { const d = (t - Date.now()) / 1000; const a = Math.abs(d); return a < 3600 ? r.format(Math.round(d / 60), 'minute') : a < 86400 ? r.format(Math.round(d / 3600), 'hour') : r.format(Math.round(d / 86400), 'day'); })() : '';
  const clan = `<article class="gd"><div class="gd-head"><h2>${esc(G?.clan?.name || W.clanT)}</h2></div>${!G ? wait : G.clan?.none ? `<p>${esc(W.noClan)}</p>` : G.clan ? `<p>${esc(W.clanNote(G.clan.list.filter(x => x.on).length))}</p><div class="cl">${G.clan.list.slice(0, 12).map(x => `<span class="${x.on ? 'on' : ''}">${esc(x.n)}${x.on ? '' : ` · ${esc(ago(x.t))}`}</span>`).join('')}</div>` : `<p>${esc(W.unavailable)}</p>`}</article>`;
  const opts = `<article class="gd"><div class="gd-head"><h2>${esc(W.optsT)}</h2></div><p>${esc(W.optsNote)}</p><div class="opts">${[['week', W.optWeek], ['clears', W.optClears], ['build', W.optBuild]].map(([k, t]) => `<label><input type="checkbox" data-opt="${k}"${OPTS[k] ? ' checked' : ''}> ${esc(t)}</label>`).join('')}</div></article>`;
  return `<div class="panel">${ranks}${clears}${wp}${comm}${clan}${opts}</div>`;
}

/* ---------- renderização ---------- */
/* Tema claro/escuro: segue o sistema até a pessoa escolher; a escolha fica salva neste navegador */
const SUN = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 1.8v2.2M10 16v2.2M1.8 10H4M16 10h2.2M4.2 4.2l1.6 1.6M14.2 14.2l1.6 1.6M4.2 15.8l1.6-1.6M14.2 5.8l1.6-1.6"/></g></svg>';
const MOON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.8 12.6A6.8 6.8 0 0 1 7.4 4.2a6.8 6.8 0 1 0 8.4 8.4z" fill="currentColor"/></svg>';
const curTheme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
function applyTheme() { const b = $('themebtn'), d = curTheme() === 'dark', l = d ? u().toLight : u().toDark; b.innerHTML = d ? SUN : MOON; b.title = l; b.setAttribute('aria-label', l); }
function applyUI() {
  applyTheme();
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
  renderWeek(); renderBuild();
  if (!cfg) return;
  if (!logged) {
    $('title').textContent = 'Destiny Checklist'; document.title = 'Destiny Checklist'; $('eyebrow').textContent = 'Destiny 2'; renderGuardian(null);
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
  const sub = (profile.characterEquipment?.data?.[charId]?.items || []).find(i => i.bucketHash === SUB_BUCKET), sn = sub && gearDefs[sub.itemHash]?.n;
  renderGuardian(ch);
  $('eyebrow').textContent = `${U.races[ch.raceType] || ''} ${cls} · ${member.name}`;
  $('eyebrow').title = sn || '';
  $('ghpw').hidden = false; $('pwv').textContent = ch.light; $('pwmax').textContent = mx && mx > ch.light ? `${U.max} ${mx}` : U.power;
  $('chars').innerHTML = Object.values(profile.characters.data).map(c => `<button class="char" type="button" data-char="${c.characterId}" aria-pressed="${c.characterId === charId}">${esc(U.classes[c.classType])}<span class="pw">${c.light}</span></button>`).join('');
  $('chars').hidden = Object.keys(profile.characters.data).length < 2;
  $('tabs').innerHTML = GROUPS.map(g => `<button class="tab" type="button" data-group="${g.id}" aria-current="${groupOf(tab)?.id === g.id}">${esc(U.tabs[g.id])}</button>`).join('');
  const g = groupOf(tab), st = $('subtabs');
  if (g && g.subs.length > 1) { st.hidden = false; st.innerHTML = g.subs.map(id => `<button class="sub" type="button" data-sub="${id}" aria-pressed="${id === tab}">${esc(U.subs[id])}</button>`).join(''); }
  else { st.hidden = true; st.innerHTML = ''; }
  $('ldbtn').setAttribute('aria-pressed', tab === 'ld'); $('ldbtn').textContent = tab === 'ld' ? U.checklist : U.loadouts;
  document.body.classList.toggle('on-ld', tab === 'ld'); document.body.classList.toggle('no-clears', !OPTS.clears);
  $('overall').hidden = tab === 'gd';
  if (tab === 'gd') { $('list').innerHTML = gdHTML(); if (!GD && have.a) loadGuardian(gen); return; }
  if (tab === 'ld') {
    showMessage(stage < 1 || !have.c ? `<p class="empty-msg">${esc(U.loadingDefs)}</p>` : LOADOUTS.length ? LOADOUTS.map(l => `<article class="ld"><div class="ld-head"><h2>${esc(l.name)}</h2></div><ul class="items">${l.items.map(n => `<li>${esc(n)}</li>`).join('')}</ul><div class="ld-actions"><a class="ld-btn" href="https://app.destinyitemmanager.com/" target="_blank" rel="noopener">${esc(U.openDim)}</a></div></article>`).join('') : `<p class="empty-msg">${esc(U.noLoadouts)}</p>`);
    $('ovcount').textContent = U.ld(LOADOUTS.length); $('ovbar').style.width = '0';
    return;
  }
  const secs = SECTIONS.filter(x => x.tab === tab);
  // O que já foi concluído fica no fim da lista, minimizado.
  const secDone = x => x.items.length > 0 && x.items.every(isDone);
  secs.sort((a, b) => secDone(a) - secDone(b));
  $('list').innerHTML = `<div class="panel">${secs.map(sec => {
    if (sec.empty) return `<p class="empty-msg">${esc(sec.note)}</p>`;
    if (!sec.items.length) return `<section data-sec="${sec.id}"><div class="sec-head"><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2></div></div><p>${esc(sec.note)}</p></div></section>`;
    const keep = true, coll = sec.coll || ((tab === 'exo' || tab === 'cat') && sec.items?.length) || (keep && secDone(sec)), open = openSecs.has(sec.id);
    return `<section data-sec="${sec.id}" class="${keep ? 'keep' : ''}${coll ? ` coll${open ? '' : ' collapsed'}` : ''}">
      <div class="sec-head"${coll ? ` data-coll="${sec.id}" role="button" tabindex="0" aria-expanded="${open}"` : ''}><div class="sec-title"><div class="sec-name"><h2>${esc(sec.title)}</h2>${sec.kind ? secMeta(sec) : ''}</div><span class="count" data-sc="${sec.id}"></span>${coll ? '<span class="chev" aria-hidden="true"></span>' : ''}</div>
      ${sec.note ? `<p>${esc(sec.note)}</p>` : ''}<div class="sec-bar"><i data-sb="${sec.id}"></i></div></div>
      <ul>${sec.items.map(i => {
        const cid = 'c-' + i.id.replace(/[^a-z0-9]+/gi, '-'), first = i.c[0], rest = i.c.slice(1), more = !!(i.d || rest.length || i.loc);
        const head = `<span class="t">${esc(i.t)}</span>${first ? `<span class="chip ${chipClass(first)}">${esc(first)}</span>` : ''}`;
        return `<li data-li="${esc(i.id)}" data-search="${esc([i.t, i.d, i.loc, ...i.c, sec.title].join(' ').toLowerCase())}"><div class="row"><label class="ck" for="${cid}"><input type="checkbox" id="${cid}" data-id="${esc(i.id)}" aria-label="${esc(i.t)}"${i.auto ? ' checked disabled' : ''}></label>${more ? `<button class="it" type="button" aria-expanded="false">${head}<span class="chev" aria-hidden="true"></span></button>` : `<span class="it">${head}</span>`}</div>${more ? `<div class="more">${i.loc ? `<div class="loc"><span class="loc-k">${esc(U.where)}</span> ${esc(i.loc)}</div>` : ''}${i.d ? `<div class="d">${esc(i.d)}</div>` : ''}${rest.length ? `<div class="chips">${rest.map(x => `<span class="chip ${chipClass(x)}">${esc(x)}</span>`).join('')}</div>` : ''}</div>` : ''}</li>`;
      }).join('')}</ul></section>`;
  }).join('')}<p class="donebar" id="donebar" hidden><span id="donetxt"></span><button class="reset" id="togglecomplete" type="button"></button></p></div>`;
  document.querySelectorAll('#list li[data-li]').forEach(li => { if (openItems.has(li.dataset.li)) { li.classList.add('open'); li.querySelector('button.it')?.setAttribute('aria-expanded', 'true'); } });
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
    el.textContent = (t && n === t ? '✓ ' : '') + `${n}/${t}`;
    document.querySelector(`[data-sb="${sec.id}"]`).style.width = (t ? n / t * 100 : 0) + '%';
    const complete = t > 0 && n === t; const secEl = el.closest('section'); secEl.classList.toggle('complete', complete); if (complete && !secEl.classList.contains('keep')) full++;
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
$('chars').addEventListener('click', e => { const b = e.target.closest('.char'); if (!b || b.dataset.char === charId) return; charId = b.dataset.char; LS.set('dc-char-' + member.id, charId); hydrate(); });
$('ldbtn').addEventListener('click', () => { if (tab === 'ld') go(prevTab || 'obj'); else { prevTab = tab; go('ld'); } });
$('themebtn').addEventListener('click', () => { const t = curTheme() === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; LS.set('dc-theme', t); applyTheme(); });
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch {}
$('langbtn').addEventListener('click', () => { lang = lang === 'en' ? 'pt' : 'en'; LS.set('dc-lang', lang); if (profile) hydrate(); else render(); });
$('refresh').addEventListener('click', () => start());
$('logout').addEventListener('click', logout);
$('hide').addEventListener('change', e => { document.body.classList.toggle('hide-done', e.target.checked); LS.set('dc-hide2', e.target.checked); });
$('searchbtn').addEventListener('click', () => { const q = $('q'), show = q.hidden; q.hidden = !show; $('searchbtn').setAttribute('aria-expanded', show); if (show) q.focus(); else { q.value = ''; query = ''; filter(); } });
$('q').addEventListener('input', e => { query = e.target.value; filter(); });
const toggleSec = h => { const id = h.dataset.coll, sec = h.closest('section'); const o = sec.classList.toggle('collapsed') === false; o ? openSecs.add(id) : openSecs.delete(id); h.setAttribute('aria-expanded', o); };
$('list').addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.sec-head[data-coll]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSec(h); } });
$('list').addEventListener('click', e => {
  const hd = e.target.closest('.sec-head[data-coll]'); if (hd) { toggleSec(hd); return; }
  const it = e.target.closest('button.it'); if (it) { const li = it.closest('li'); const o = li.classList.toggle('open'); it.setAttribute('aria-expanded', o); o ? openItems.add(li.dataset.li) : openItems.delete(li.dataset.li); return; }
  if (e.target.id === 'togglecomplete') { document.body.classList.toggle('show-complete'); update(); }
});
$('list').addEventListener('change', e => { const k = e.target.dataset.opt; if (k) { OPTS[k] = e.target.checked; LS.set('dc-opts', OPTS); render(); return; } const id = e.target.dataset.id; if (!id || !member) return; e.target.checked ? marks.add(id) : marks.delete(id); LS.set('dc-marks-' + member.id, [...marks]); update(); renderWeek(); });
$('week').addEventListener('click', e => { const b = e.target.closest('.wk'); if (!b) return; const w = WK[+b.dataset.wk]; if (w && w.to) jumpTo(w.to[0], w.to[1]); });
$('gear').addEventListener('click', toggleBuild);
$('gear').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBuild(); } });
setInterval(() => { if (document.visibilityState === 'visible') renderWeek(); }, 60000);

/* ---------- início ---------- */
async function start() {
  try {
    status(u().loading);
    await loadAccount();
  } catch (e) {
    if (e.message === 'auth') { status(''); render(); return; }
    status('');
    showMessage(`<p class="notice">${esc(e.message === 'maintenance' ? u().maintenance : u().apiError(e.message))}</p>`);
  }
}
(async function init() {
  if (LS.get('dc-hide2', false)) { $('hide').checked = true; document.body.classList.add('hide-done'); }
  applyUI();
  const h = readHash();
  try {
    [cfg, defs, ITEMS] = await Promise.all([fetch('/api/config').then(r => r.json()), fetch('/data/defs.json', { cache: 'no-cache' }).then(r => r.json()), fetch('/data/items.json', { cache: 'no-cache' }).then(r => r.json()).catch(() => ({}))]);
  } catch { cfg = { configured: false }; showMessage(`<p class="notice">${esc(u().notConfigured)}</p>`); return; }
  if (h?.error) { render(); $('list').insertAdjacentHTML('afterbegin', `<p class="notice">${esc(u().authError(h.error))}</p>`); return; }
  if (h?.auth) { auth = h.auth; LS.set('dc-auth', auth); }
  if (auth) { render(); await start(); } else render();
})();
})();
