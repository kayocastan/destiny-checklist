/* Orla Bot · Worker da Cloudflare.
   POST /discord/interactions  – comandos, botões e modais do Discord (substitui o bot em Python).
   /me, /link/start, /link/callback, /activities, /grades  – usados pela aba "Orla Bot" do DPI.
   Cron (1 min): apaga grades que começaram há mais de 1 hora. */
import { handleInteraction } from './interactions.js';
import { verifySignature, oauthUser, deleteMessage, DiscordError } from './discord.js';
import { BungieApiError, currentUser, upsertUser, userGroupIds } from './bungie.js';
import { ActivityInputError } from './rules.js';
import { createGrade, CATALOG_PREFIX } from './grades.js';

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
  if (hit && hit.exp > Date.now()) return hit.ok;
  const ok = (await userGroupIds(env, me.uid, me.token)).includes(String(env.CLAN_ID));
  clanCache.set(me.uid + env.CLAN_ID, { ok, exp: Date.now() + (ok ? 300_000 : 30_000) });
  return ok;
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
    const q = (url.searchParams.get('q') || '').slice(0, 80).replace(/[%_\\]/g, m => '\\' + m);
    const rows = (await env.DB.prepare(`SELECT id, name, type FROM curated_bungie_activities WHERE name LIKE ? ESCAPE '\\' AND length(name) <= 80 ORDER BY name, id LIMIT 25`).bind(`%${q}%`).all()).results;
    return json(req, { activities: rows });
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
    await env.DB.prepare('DELETE FROM activities WHERE id = ?').bind(r.id).run();
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
