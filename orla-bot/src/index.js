/* Orla Bot · Worker da Cloudflare.
   POST /discord/interactions  – comandos, botões e modais do Discord (substitui o bot em Python).
   /me, /link/start, /link/callback, /activities, /grades  – usados pela aba "Orla Bot" do DPI.
   /clan/panel  – painel "Discord do clã" do DPI (só admins).
   Cron (1 min): apaga grades que começaram há mais de 1 hora. */
import { handleInteraction } from './interactions.js';
import { verifySignature, oauthUser, deleteMessage, DiscordError } from './discord.js';
import { BungieApiError, currentUser, upsertUser, userGroups } from './bungie.js';
import { ActivityInputError } from './rules.js';
import { createGrade, CATALOG_PREFIX, applySignup } from './grades.js';
import { catalog, searchActivities, matchActivity } from './search.js';

const ORIGINS = ['https://destinyparallel.vercel.app', 'https://destiny-checklist.vercel.app'];
const cors = req => {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
};
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });
const b64 = s => btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// estado assinado do OAuth (carrega o perfil Bungie já validado no servidor)
async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('orla-link:' + env.DISCORD_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return { key, sign: async () => b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))) };
}
export async function signState(env, payload) {
  const body = b64(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await (await hmac(env, body)).sign()}`;
}
export async function readState(env, state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const { key } = await hmac(env, body);
  if (!(await crypto.subtle.verify('HMAC', key, unb64(sig), new TextEncoder().encode(body)))) return null;
  const p = JSON.parse(new TextDecoder().decode(unb64(body)));
  return p.e > Date.now() ? p : null;
}

const norm = t => String(t || '').trim().replace(/^@/, '').replace(/#0+$/, '').toLowerCase();

async function who(req, env) {
  const a = req.headers.get('Authorization') || '';
  if (!a.startsWith('Bearer ')) return null;
  try { return { ...(await currentUser(env, a.slice(7))), token: a.slice(7) }; } catch (e) { if (e instanceof BungieApiError) { req.authErr = { code: e.code || null, msg: e.message }; return null; } throw e; }
}

// só membros do clã Orla Emaranhada (CLAN_ID) usam o Orla Bot; confirmado na Bungie (cache curto por conta)
const clanCache = new Map();
async function inClan(env, me) {
  const hit = clanCache.get(me.uid + env.CLAN_ID);
  if (hit && hit.exp > Date.now()) { me.role = hit.role; return hit.ok; }
  const g = (await userGroups(env, me.uid, me.token)).find(x => x.id === String(env.CLAN_ID)), ok = !!g;
  me.role = g?.role || 0;
  clanCache.set(me.uid + env.CLAN_ID, { ok, role: me.role, exp: Date.now() + (ok ? 300_000 : 30_000) });
  return ok;
}
// painel "Discord do clã" no DPI: só dono do site, admins e fundador
const isAdmin = (env, me) => me.role >= 3 || (env.OWNER && me.uid === String(env.OWNER));

/* Painel do DPI (Clã › Discord do clã): quem registrou o Discord, participação nas grades e experiência por atividade.
   Só leitura; as grades vêm do histórico (grade_hist, guardado pela limpeza) + as que ainda estão abertas. */
async function clanPanel(env, days) {
  const since = new Date(Date.now() - days * 864e5).toISOString(), db = env.DB;
  const all = sql => db.prepare(sql).bind(since).all().then(r => r.results);
  const [users, part, made, grades, exp, first] = await Promise.all([
    db.prepare('SELECT discord_user_id d, discord_member_name n, bungie_membership_id m, bungie_name b, linked_at at FROM users').all().then(r => r.results),
    all(`SELECT p.discord_user_id d, p.category c, SUM(CASE WHEN p.is_rookie = 1 THEN 1 ELSE 0 END) rk, COUNT(*) n, MAX(g.starts_at) last FROM (
           SELECT activity_id, discord_user_id, category, is_rookie FROM grade_hist_p UNION ALL SELECT activity_id, discord_user_id, category, is_rookie FROM activity_participants
         ) p JOIN (SELECT id, starts_at FROM grade_hist UNION ALL SELECT id, starts_at FROM activities) g ON g.id = p.activity_id
         WHERE replace(g.starts_at, ' ', 'T') >= ? GROUP BY p.discord_user_id, p.category`),
    all(`SELECT created_by d, COUNT(*) n FROM (SELECT created_by, starts_at FROM grade_hist UNION ALL SELECT created_by_discord_id, starts_at FROM activities)
         WHERE replace(starts_at, ' ', 'T') >= ? GROUP BY created_by`),
    all(`SELECT g.id, g.name, g.capacity cap, g.starts_at s, g.created_by d, (SELECT COUNT(*) FROM grade_hist_p p WHERE p.activity_id = g.id AND p.category = 'titular') tit, 0 open FROM grade_hist g WHERE replace(g.starts_at, ' ', 'T') >= ?
         UNION ALL SELECT a.id, a.name, a.capacity, a.starts_at, a.created_by_discord_id, (SELECT COUNT(*) FROM activity_participants p WHERE p.activity_id = a.id AND p.category = 'titular'), 1 FROM activities a
         ORDER BY s DESC LIMIT 40`),
    db.prepare(`SELECT pa.user_discord_id d, ba.eligibility_group g, MIN(ba.name) a, MIN(ba.type) t, SUM(pa.clear_count) c, MAX(pa.skill) s, MAX(pa.checked_at) at
                FROM player_activities pa JOIN bungie_activities ba ON ba.bungie_id = pa.activity_bungie_id GROUP BY pa.user_discord_id, ba.eligibility_group`).all().then(r => r.results),
    db.prepare('SELECT MIN(archived_at) t FROM grade_hist').first(),
  ]);
  return { days, users, part, made, grades, exp, histSince: first?.t || null, at: Date.now() };
}
const registered = (env, ids) => env.DB.prepare(`SELECT * FROM users WHERE bungie_membership_id IN (${ids.map(() => '?').join(',')}) ORDER BY linked_at DESC LIMIT 1`).bind(...ids).first();

async function api(req, env, url) {
  const path = url.pathname;
  if (path === '/link/callback' && req.method === 'GET') {
    let st = null;
    const back = r => Response.redirect(`${env.SITE_URL}${st?.r === '/grade' ? '/grade' : '/'}?orla=${r}`, 302);
    st = await readState(env, url.searchParams.get('state'));
    if (url.searchParams.get('error')) return back('cancel');
    if (!st || !url.searchParams.get('code')) return back('expired');
    let du;
    try { du = await oauthUser(env, url.searchParams.get('code'), `${env.SELF_URL}/link/callback`); } catch { return back('fail'); }
    const typed = norm(st.t), names = [norm(du.username), du.discriminator && du.discriminator !== '0' ? norm(`${du.username}#${du.discriminator}`) : null].filter(Boolean);
    if (!names.includes(typed)) return back('mismatch');
    await upsertUser(env.DB, du.id, du.username, st.m);
    return back('ok');
  }

  const me = await who(req, env);
  if (!me) return json(req, { error: 'auth', why: req.authErr || null }, 401); // why: motivo vindo da Bungie (sem dados da conta), ajuda a diagnosticar
  try { if (!(await inClan(env, me))) return json(req, { error: 'clan' }, 403); }
  catch (e) { if (e instanceof BungieApiError) return json(req, { error: 'clan' }, 403); throw e; }
  if (path === '/activities' && req.method === 'GET') {
    const rows = searchActivities(await catalog(env.DB), (url.searchParams.get('q') || '').slice(0, 80));
    return json(req, { activities: rows.map(({ id, name, type }) => ({ id, name, type })) });
  }

  if (path === '/clan/panel' && req.method === 'GET') {
    if (!isAdmin(env, me)) return json(req, { error: 'forbidden' }, 403);
    const d = [30, 90, 365].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    return json(req, await clanPanel(env, d));
  }
  if (path === '/me' && req.method === 'GET') {
    const row = await registered(env, me.ids);
    return json(req, { bungieName: me.membership.bungieName, linked: !!row, discord: row ? { id: row.discord_user_id, name: row.discord_member_name } : null });
  }
  if (path === '/link/start' && req.method === 'POST') {
    const { tag, ret } = await req.json().catch(() => ({}));
    if (typeof tag !== 'string' || norm(tag).length < 2 || tag.length > 40) return json(req, { error: 'Informe a tag do Discord (ex.: usuario).' }, 400);
    const state = await signState(env, { m: me.membership, t: tag, r: ret === '/grade' ? '/grade' : '/', e: Date.now() + 15 * 60_000 });
    const u = new URL('https://discord.com/oauth2/authorize');
    u.search = new URLSearchParams({ client_id: env.DISCORD_APP_ID, response_type: 'code', scope: 'identify', redirect_uri: `${env.SELF_URL}/link/callback`, state, prompt: 'consent' }).toString();
    return json(req, { url: u.toString() });
  }
  if (path === '/grades' && req.method === 'GET') { // grades marcadas (abertas), para a ilha "Agenda" do /grade
    const mine = await registered(env, me.ids);
    const acts = (await env.DB.prepare(`SELECT a.id, a.name, a.capacity cap, a.rookie_limit rk, a.starts_at s, a.created_by_discord_id d, a.discord_channel_id c, a.discord_message_id m, cb.eligibility_group g FROM activities a LEFT JOIN curated_bungie_activities cb ON cb.id = a.curated_bungie_activity_id ORDER BY replace(a.starts_at, ' ', 'T'), a.id LIMIT 50`).all()).results;
    const ids = acts.map(a => a.id);
    const ps = ids.length ? (await env.DB.prepare(`SELECT p.activity_id a, p.discord_user_id d, p.category c, p.is_rookie r, coalesce(u.bungie_name, u.discord_member_name, '?') n FROM activity_participants p LEFT JOIN users u ON u.discord_user_id = p.discord_user_id WHERE p.activity_id IN (${ids.map(() => '?').join(',')}) ORDER BY p.category, p.created_at, p.id`).bind(...ids).all()).results : [];
    const by = await env.DB.prepare(`SELECT discord_user_id d, coalesce(bungie_name, discord_member_name) n FROM users WHERE discord_user_id IN (${acts.map(() => '?').join(',') || "''"})`).bind(...acts.map(a => a.d)).all().then(r => Object.fromEntries(r.results.map(x => [x.d, x.n])));
    return json(req, { guild: env.DISCORD_GUILD_ID || null, grades: acts.map(a => ({ id: a.id, name: a.name, g: a.g || null, cap: a.cap, rk: a.rk, s: a.s, by: by[a.d] || null, url: a.c && a.m && env.DISCORD_GUILD_ID ? `https://discord.com/channels/${env.DISCORD_GUILD_ID}/${a.c}/${a.m}` : null,
      mine: mine ? (ps.find(p => p.a === a.id && p.d === mine.discord_user_id)?.c || null) : null, creator: !!mine && a.d === mine.discord_user_id,
      p: ps.filter(p => p.a === a.id).map(p => ({ n: String(p.n).replace(/#\d+$/, ''), c: p.c, r: p.r ? 1 : 0 })) })) });
  }
  const sg = path.match(/^\/grades\/(\d+)\/(join|leave|reserve)$/);
  if (sg && req.method === 'POST') { // botões Entrar / Sair / Reserva do /grade (mesmo fluxo dos botões do Discord)
    const row = await registered(env, me.ids);
    if (!row) return json(req, { error: 'not_registered' }, 409);
    const text = await applySignup(env, String(row.discord_user_id), Number(sg[1]), sg[2] === 'join' ? 'titular' : sg[2] === 'reserve' ? 'reserva' : null);
    const names = {}; for (const id of new Set([...(text || '').matchAll(/<@(\d+)>/g)].map(m => m[1]))) { const u = await env.DB.prepare('SELECT bungie_name n FROM users WHERE discord_user_id = ?').bind(id).first(); names[id] = String(u?.n || 'alguém').replace(/#\d+$/, ''); }
    return json(req, { ok: true, message: (text || 'Inscrição atualizada como titular.').replace(/<@(\d+)>/g, (_, id) => names[id]) });
  }
  if (path === '/grades' && req.method === 'POST') {
    const b = await req.json().catch(() => null);
    if (!b) return json(req, { error: 'Dados inválidos.' }, 400);
    const row = await registered(env, me.ids);
    if (!row) return json(req, { error: 'not_registered' }, 409);
    try {
      const integrantes = Number(b.integrantes), novatos = b.novatos === '' || b.novatos == null ? null : Number(b.novatos);
      if (!Number.isInteger(integrantes) || integrantes < 1 || integrantes > 12) throw new ActivityInputError('Integrantes deve ser um número entre 1 e 12.');
      if (novatos != null && (!Number.isInteger(novatos) || novatos < 0 || novatos > integrantes)) throw new ActivityInputError('A quantidade de novatos deve ser 0 ou um número entre 1 e a quantidade de integrantes.');
      let atividade = String(b.atividade ?? '').trim(), curatedId = null;
      if (b.curatedId != null) {
        const c = await env.DB.prepare('SELECT id, name FROM curated_bungie_activities WHERE id = ?').bind(Number(b.curatedId)).first();
        if (c && c.name === atividade) curatedId = c.id; // texto editado = título livre
      }
      if (atividade.startsWith(CATALOG_PREFIX)) atividade = atividade.slice(CATALOG_PREFIX.length);
      if (curatedId == null) { const m = matchActivity(await catalog(env.DB), atividade); if (m) { curatedId = m.id; atividade = m.name; } } // "o fim de crota" → Fim de Crota: Normal
      const r = await createGrade(env, { userId: row.discord_user_id, atividade, integrantes, inicio: String(b.inicio ?? ''), descricao: String(b.descricao ?? ''), curatedId, rookieLimit: novatos });
      return json(req, { ok: true, activityId: r.activityId, published: r.published, warning: r.warning.trim() });
    } catch (e) {
      if (e instanceof ActivityInputError) return json(req, { error: e.message }, 400);
      throw e;
    }
  }
  return json(req, { error: 'not found' }, 404);
}

async function cleanup(env) {
  const cutoff = new Date(Date.now() - 3600_000).toISOString();
  const rows = (await env.DB.prepare(`SELECT id, discord_channel_id c, discord_message_id m FROM activities WHERE replace(starts_at, ' ', 'T') <= ?`).bind(cutoff).all()).results;
  for (const r of rows) {
    try { if (r.m) await deleteMessage(env, r.c, r.m); }
    catch (e) { if (!(e instanceof DiscordError && e.status === 404)) { console.error('limpeza', r.id, e.message); continue; } }
    // guarda um resumo (sem descrição nem mensagem) para o painel de participação do DPI, antes de apagar
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO grade_hist (id, name, curated_id, capacity, rookie_limit, starts_at, created_by, archived_at)
        SELECT id, name, curated_bungie_activity_id, capacity, rookie_limit, starts_at, created_by_discord_id, ? FROM activities WHERE id = ?`).bind(new Date().toISOString(), r.id),
      env.DB.prepare(`INSERT OR IGNORE INTO grade_hist_p (activity_id, discord_user_id, category, is_rookie)
        SELECT activity_id, discord_user_id, category, is_rookie FROM activity_participants WHERE activity_id = ?`).bind(r.id),
      env.DB.prepare('DELETE FROM activities WHERE id = ?').bind(r.id),
    ]);
  }
  await env.DB.prepare('DELETE FROM pending_grades WHERE created_at < ?').bind(new Date(Date.now() - 3600_000).toISOString()).run();
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    try {
      if (url.pathname === '/discord/interactions' && req.method === 'POST') {
        const text = await req.text();
        if (!(await verifySignature(req, text, env.DISCORD_PUBLIC_KEY))) return new Response('assinatura inválida', { status: 401 });
        return await handleInteraction(env, ctx, JSON.parse(text));
      }
      if (url.pathname === '/') return new Response('Orla Bot', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      return await api(req, env, url);
    } catch (e) {
      console.error('erro', e?.stack || e);
      return json(req, { error: 'erro interno' }, 502);
    }
  },
  async scheduled(_ev, env, ctx) { ctx.waitUntil(cleanup(env)); },
};
