/* Cliente da API da Bungie e sincronização de progresso (porte de bungie/__init__.py e bungie/progress.py). */
import { skillForClears } from './rules.js';

export class BungieApiError extends Error {}
const ROOT = 'https://www.bungie.net/Platform';
const PRIORITY = [3, 2, 1, 4, 5, 6, 10, 20, 254];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function splitBungieName(value) {
  const v = String(value ?? '').trim();
  if (!/^.+#\d{4}$/.test(v)) throw new BungieApiError('Informe o Bungie Name completo no formato Nome#1234.');
  const i = v.lastIndexOf('#'), name = v.slice(0, i);
  if (!name.trim()) throw new BungieApiError('O nome antes do # não pode ficar vazio.');
  return [name, Number(v.slice(i + 1))];
}

// A chave da Bungie só vale para o Origin cadastrado no portal; o servidor envia o do site.
async function request(env, method, path, { body, token } = {}) {
  const headers = { 'X-API-Key': (env.BUNGIE_API_KEY || '').trim(), Origin: env.SITE_URL, 'User-Agent': 'OrlaBot/2.0' };
  if (!headers['X-API-Key']) throw new BungieApiError('A integração Bungie ainda não está configurada.');
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try { r = await fetch(ROOT + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch { if (attempt < 2) { await sleep(250 * (attempt + 1)); continue; } throw new BungieApiError('Não foi possível consultar a Bungie agora.'); }
    if (r.status === 429 && attempt < 2) { await sleep(Math.max(Math.min(Number(r.headers.get('Retry-After')) || 1, 3), 0.1) * 1000); continue; }
    if (r.status >= 500 && attempt < 2) { await sleep(250 * (attempt + 1)); continue; }
    const j = await r.json().catch(() => null);
    if (r.status >= 400 && !j) throw new BungieApiError('A Bungie API recusou a solicitação.');
    if (!j || typeof j !== 'object') throw new BungieApiError('A Bungie retornou uma resposta inválida.');
    if (j.ErrorCode !== 1) { const e = new BungieApiError('A Bungie não retornou dados válidos para esta solicitação.'); e.code = j.ErrorCode; throw e; }
    if (j.Response == null || typeof j.Response !== 'object') throw new BungieApiError('A Bungie retornou uma resposta incompleta.');
    return j.Response;
  }
  throw new BungieApiError('A Bungie API está temporariamente indisponível.');
}

export async function findMembership(env, bungieName) {
  const [display, code] = splitBungieName(bungieName);
  const matches = await request(env, 'POST', '/Destiny2/SearchDestinyPlayerByBungieName/-1/', { body: { displayName: display, displayNameCode: code } });
  if (!Array.isArray(matches) || !matches.length) throw new BungieApiError('Não encontrei esse Bungie Name. Confira o nome e o código.');
  const exact = matches.filter(m => m && m.membershipId && Number.isInteger(m.membershipType)
    && typeof m.bungieGlobalDisplayName === 'string' && m.bungieGlobalDisplayName.toLowerCase() === display.toLowerCase()
    && Number(m.bungieGlobalDisplayNameCode) === code);
  if (!exact.length) throw new BungieApiError('A Bungie encontrou resultados, mas não confirmou o Bungie Name completo. Confira o nome e o código de quatro dígitos no seu perfil.');
  const byType = new Map();
  for (const m of exact) if (PRIORITY.includes(m.membershipType) && !byType.has(m.membershipType)) byType.set(m.membershipType, m);
  const t = PRIORITY.find(x => byType.has(x));
  if (t === undefined) throw new BungieApiError('A Bungie confirmou o Bungie Name, mas não retornou um tipo de plataforma compatível.');
  const m = byType.get(t);
  return { membershipId: String(m.membershipId), membershipType: m.membershipType, bungieName: `${display}#${String(code).padStart(4, '0')}` };
}

// Quem está logado no site (token Bearer da Bungie): conta Bungie.net e memberships do Destiny.
export async function currentUser(env, token) {
  const r = await request(env, 'GET', '/User/GetMembershipsForCurrentUser/', { token });
  const list = (r.destinyMemberships || []).filter(m => m.membershipId);
  const primary = list.find(m => String(m.membershipId) === String(r.primaryMembershipId)) ||
    PRIORITY.map(t => list.find(m => m.membershipType === t)).find(Boolean) || list[0];
  if (!primary) throw new BungieApiError('Sua conta Bungie não tem perfil de Destiny 2.');
  const code = primary.bungieGlobalDisplayNameCode;
  const name = primary.bungieGlobalDisplayName ? `${primary.bungieGlobalDisplayName}#${String(code ?? 0).padStart(4, '0')}` : (primary.displayName || '');
  return { uid: String(r.bungieNetUser?.membershipId || ''), ids: list.map(m => String(m.membershipId)), membership: { membershipId: String(primary.membershipId), membershipType: primary.membershipType, bungieName: name } };
}

// ids dos clãs da conta (GroupV2); usado para liberar a interface só para o clã Orla Emaranhada
export async function userGroupIds(env, uid, token) {
  return (await userGroups(env, uid, token)).map(g => g.id);
}
// clãs da conta com o cargo (memberType: 1 iniciante, 2 membro, 3 admin, 4 fundador interino, 5 fundador)
export async function userGroups(env, uid, token) {
  const r = await request(env, 'GET', `/GroupV2/User/254/${uid}/0/1/`, { token });
  return (r.results || []).map(x => ({ id: String(x.group?.groupId || ''), role: Number(x.member?.memberType) || 0 })).filter(g => g.id);
}

export async function getClearCounts(env, membership, hashes, mode) {
  if (mode !== 4 && mode !== 82) throw new BungieApiError('Só é possível consultar histórico de Raids ou Dungeons.');
  if (!hashes.size) throw new BungieApiError('Não há atividades para consultar no catálogo.');
  const linked = await request(env, 'GET', `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/LinkedProfiles/`);
  const profiles = [], seen = new Set();
  if (!Array.isArray(linked.profiles) || !linked.profiles.length) throw new BungieApiError('A Bungie não disponibilizou perfis vinculados para consultar o histórico.');
  for (const p of linked.profiles) {
    if (!p || !Number.isInteger(p.membershipType) || !/^\d+$/.test(String(p.membershipId))) throw new BungieApiError('A Bungie retornou identificadores de perfil inválidos.');
    const k = `${p.membershipType}:${p.membershipId}`;
    if (!seen.has(k)) { seen.add(k); profiles.push([p.membershipType, String(p.membershipId)]); }
  }
  const chars = (await Promise.all(profiles.map(async ([t, id]) => {
    const r = await request(env, 'GET', `/Destiny2/${t}/Profile/${id}/?components=Profiles`);
    const ids = r.profile?.data?.characterIds ?? [];
    if (!Array.isArray(ids) || ids.some(c => !/^\d+$/.test(String(c)))) throw new BungieApiError('A Bungie retornou identificadores de personagem inválidos.');
    return ids.map(c => [t, id, String(c)]);
  }))).flat();
  if (!chars.length) throw new BungieApiError('A Bungie não disponibilizou personagens para consultar o histórico.');
  const counts = {};
  const results = await Promise.all(chars.map(([t, id, c]) => request(env, 'GET', `/Destiny2/${t}/Account/${id}/Character/${c}/Stats/AggregateActivityStats/`)));
  for (const body of results) {
    if (!Array.isArray(body.activities)) throw new BungieApiError('A Bungie retornou estatísticas agregadas em formato inválido.');
    for (const e of body.activities) {
      if (!e || !Number.isInteger(e.activityHash)) throw new BungieApiError('A Bungie retornou um hash de atividade inválido.');
      if (!hashes.has(e.activityHash)) continue;
      const v = e.values?.activityCompletions?.basic?.value;
      if (typeof v !== 'number' || v < 0 || !Number.isInteger(v)) throw new BungieApiError('A Bungie não retornou uma contagem válida de atividades concluídas.');
      counts[e.activityHash] = (counts[e.activityHash] || 0) + v;
    }
  }
  return counts;
}

export async function upsertUser(db, discordId, discordName, m) {
  await db.prepare(`INSERT INTO users (discord_user_id, discord_member_name, bungie_membership_id, bungie_membership_type, bungie_name, linked_at)
    VALUES (?,?,?,?,?,?) ON CONFLICT(discord_user_id) DO UPDATE SET discord_member_name = excluded.discord_member_name,
    bungie_membership_id = excluded.bungie_membership_id, bungie_membership_type = excluded.bungie_membership_type,
    bungie_name = excluded.bungie_name, linked_at = excluded.linked_at`)
    .bind(String(discordId), discordName, m.membershipId, m.membershipType, m.bungieName, new Date().toISOString()).run();
}

// Atualiza clears/skill do grupo da atividade curada e devolve {hash: clears}.
export async function syncPlayerActivities(env, discordId, curatedId) {
  const db = env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE discord_user_id = ?').bind(String(discordId)).first();
  if (!user) throw new BungieApiError('Vincule seu Bungie Name antes de continuar.');
  const sel = await db.prepare('SELECT * FROM curated_bungie_activities WHERE id = ?').bind(curatedId).first();
  if (!sel) throw new BungieApiError('Essa atividade não está mais no catálogo curado.');
  const acts = (await db.prepare('SELECT bungie_id, eligibility_group FROM bungie_activities WHERE eligibility_group = ?').bind(sel.eligibility_group).all()).results;
  const hashes = new Set(acts.map(a => a.bungie_id));
  if (!hashes.size) throw new BungieApiError('O catálogo de atividades está vazio. Atualize-o antes de se inscrever.');
  const type = sel.type.toLowerCase();
  const mode = type.includes('raid') ? 4 : type.includes('dungeon') ? 82 : null;
  if (!mode) throw new BungieApiError('O histórico só pode ser consultado para atividades classificadas como Raid ou Dungeon.');
  const counts = await getClearCounts(env, { membershipId: user.bungie_membership_id, membershipType: user.bungie_membership_type }, hashes, mode);
  // A Bungie omite atividades nunca concluídas: ausência do hash = 0 conclusões (rookie), não erro.
  const total = acts.reduce((s, a) => s + (counts[a.bungie_id] || 0), 0);
  const skill = skillForClears(total);
  let store = acts.filter(a => (counts[a.bungie_id] || 0) > 0).map(a => a.bungie_id);
  if (!store.length) store = [Math.min(...hashes)];
  const ts = new Date().toISOString(), stmts = [], out = {};
  for (const a of acts) {
    if (!store.includes(a.bungie_id)) { stmts.push(db.prepare('DELETE FROM player_activities WHERE user_discord_id = ? AND activity_bungie_id = ?').bind(String(discordId), a.bungie_id)); continue; }
    const c = counts[a.bungie_id] || 0;
    stmts.push(db.prepare(`INSERT INTO player_activities (user_discord_id, activity_bungie_id, clear_count, skill, checked_at) VALUES (?,?,?,?,?)
      ON CONFLICT(user_discord_id, activity_bungie_id) DO UPDATE SET clear_count = excluded.clear_count, skill = excluded.skill, checked_at = excluded.checked_at`).bind(String(discordId), a.bungie_id, c, skill, ts));
    out[a.bungie_id] = c;
  }
  await db.batch(stmts);
  return out;
}
