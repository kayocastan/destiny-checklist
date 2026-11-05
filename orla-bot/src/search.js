/* Busca do catálogo de atividades tolerante a variações:
   sem acento, maiúsculas/minúsculas, artigos ("O Fim de Crota" → "Fim de Crota"), nome em inglês (slug do grupo),
   siglas comuns da comunidade (vog, dsc, kf…) e um erro de digitação por palavra. */

const STOP = new Set(['o', 'a', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'the', 'of', 'raid', 'incursao', 'masmorra', 'dungeon']);
// siglas por grupo (eligibility_group "tipo:slug:dificuldade")
const ALIAS = {
  'vault-of-glass': 'vog cdc camara cristal', 'deep-stone-crypt': 'dsc cpp', 'garden-of-salvation': 'gos js', 'kings-fall': 'kf qdr',
  'last-wish': 'lw ud', 'vow-of-the-disciple': 'vow vod jd', 'root-of-nightmares': 'ron rdp', 'crotas-end': 'ce fdc', 'salvations-edge': 'se',
  'desert-perpetual': 'dp', 'crown-of-sorrow': 'cos', 'grasp-of-avarice': 'goa', 'ghosts-of-the-deep': 'gotd', 'spire-of-the-watcher': 'sotw',
  'prophecy': 'profecia', 'pit-of-heresy': 'poh', 'shattered-throne': 'st', 'warlords-ruin': 'wr', 'vespers-host': 'vh',
  // missões exóticas (grupo "xm:<chave>"): nome em inglês
  avalon: 'avalon node ovrd', encore: 'encore', zero: 'zero hour', whisper: 'whisper', presage: 'presage', vox: 'vox obscura', seraph: 'operation seraphs shield seraph',
  star: 'starcrossed', kell: 'kells fall', fire: 'fire ice', helio: 'heliostat', dereal: 'derealize', oblation: 'oblation bloodline', dual: 'dual destiny',
};
const DIFF = new Set(['normal', 'mestre', 'master', 'padrao', 'standard', 'missao', 'exotica', 'operacao']); // palavras que o título digitado pode omitir

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const words = s => norm(s).split(' ').filter(t => t && !STOP.has(t));

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
// nota de uma palavra da busca contra as palavras da atividade (0 = não bate)
function tokenScore(q, hay) {
  let s = 0;
  for (const h of hay) {
    if (h === q) return 3;
    if (h.startsWith(q)) s = Math.max(s, q.length >= 2 ? 2 : 1);
    else if (q.length >= 3 && h.includes(q)) s = Math.max(s, 1.5);
    else if (q.length >= 4 && lev(q, h, q.length >= 7 ? 2 : 1) <= (q.length >= 7 ? 2 : 1)) s = Math.max(s, 1);
  }
  return s;
}
const hayOf = a => {
  const slug = String(a.eligibility_group || '').split(':')[1] || '';
  return [...new Set([...words(a.name), ...words(slug.replace(/-/g, ' ')), ...(ALIAS[slug] || '').split(' ').filter(Boolean)])];
};

// lista ordenada pela relevância; busca vazia = catálogo em ordem alfabética
export function searchActivities(list, query, limit = 25) {
  const ok = list.filter(a => String(a.name).length <= 80), qs = words(query);
  if (!qs.length) return ok.slice().sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id).slice(0, limit);
  const nq = norm(query);
  const scored = [];
  for (const a of ok) {
    const hay = hayOf(a); let t = 0, all = true;
    for (const q of qs) { const s = tokenScore(q, hay); if (!s) { all = false; break; } t += s; }
    if (!all) continue;
    if (norm(a.name).startsWith(nq)) t += 2;
    if (/mestre|master/i.test(a.name) && !qs.some(q => q === 'mestre' || q === 'master')) t -= 0.1; // Normal antes de Mestre
    scored.push({ a, t });
  }
  return scored.sort((x, y) => y.t - x.t || x.a.name.localeCompare(y.a.name) || x.a.id - y.a.id).slice(0, limit).map(x => x.a);
}

// título digitado sem escolher sugestão: liga ao catálogo só quando não há dúvida
// (todas as palavras batem com o nome e só sobra, no máximo, a dificuldade; empate Normal/Mestre fica com Normal)
export function matchActivity(list, typed) {
  const qs = words(typed); if (!qs.length) return null;
  const hits = list.filter(a => a.id !== 1).filter(a => {
    const nw = words(a.name), hay = hayOf(a);
    if (!qs.every(q => tokenScore(q, hay) >= 1 && (tokenScore(q, nw) >= 1 || tokenScore(q, hay) === 3))) return false;
    return nw.every(w => DIFF.has(w) || qs.some(q => tokenScore(q, [w]) >= 1));
  });
  if (hits.length === 1) return hits[0];
  const groups = new Set(hits.map(a => String(a.eligibility_group).split(':').slice(0, 2).join(':')));
  if (groups.size !== 1) return null;
  const wantMaster = qs.some(q => q === 'mestre' || q === 'master');
  return hits.find(a => /mestre|master/i.test(a.name) === wantMaster) || null;
}

// catálogo em memória (muda só com nova migração); evita ler o D1 a cada tecla
let CAT = null;
export async function catalog(db) {
  if (CAT && CAT.exp > Date.now()) return CAT.list;
  const list = (await db.prepare('SELECT id, name, type, eligibility_group FROM curated_bungie_activities').all()).results;
  CAT = { list, exp: Date.now() + 600_000 };
  return list;
}
