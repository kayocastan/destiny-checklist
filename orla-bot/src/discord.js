/* Discord: verificação de assinatura das Interactions e chamadas REST. */
const API = 'https://discord.com/api/v10';

const hex = s => Uint8Array.from(s.match(/../g) ?? [], h => parseInt(h, 16));

export async function verifySignature(req, bodyText, publicKey) {
  const sig = req.headers.get('X-Signature-Ed25519'), ts = req.headers.get('X-Signature-Timestamp');
  if (!sig || !ts || !publicKey) return false;
  try {
    const key = await crypto.subtle.importKey('raw', hex(publicKey), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hex(sig), new TextEncoder().encode(ts + bodyText));
  } catch { return false; }
}

export class DiscordError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function call(env, method, path, body, { bot = true } = {}) {
  const headers = { 'User-Agent': 'OrlaBot (https://destinyparallel.vercel.app, 2.0)' };
  if (bot) headers.Authorization = 'Bot ' + env.DISCORD_TOKEN;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new DiscordError(r.status, `Discord ${method} ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

export const postMessage = (env, channelId, msg) => call(env, 'POST', `/channels/${channelId}/messages`, msg);
export const editMessage = (env, channelId, messageId, msg) => call(env, 'PATCH', `/channels/${channelId}/messages/${messageId}`, msg);
export const deleteMessage = (env, channelId, messageId) => call(env, 'DELETE', `/channels/${channelId}/messages/${messageId}`);

// respostas posteriores a uma interação (token válido por 15 min)
export const editOriginal = (env, token, msg) => call(env, 'PATCH', `/webhooks/${env.DISCORD_APP_ID}/${token}/messages/@original`, msg, { bot: false });
export const followup = (env, token, content) => call(env, 'POST', `/webhooks/${env.DISCORD_APP_ID}/${token}`, { content, flags: 64 }, { bot: false });
export const ephemeral = content => ({ type: 4, data: { content, flags: 64 } });

// OAuth2 (vínculo pelo site)
export async function oauthExchange(env, code, redirectUri) {
  const r = await fetch(API + '/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.DISCORD_APP_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!r.ok) throw new DiscordError(r.status, 'oauth');
  return r.json();
}
export async function oauthUser(env, code, redirectUri) {
  const t = await oauthExchange(env, code, redirectUri);
  const r = await fetch(API + '/users/@me', { headers: { Authorization: 'Bearer ' + t.access_token } });
  if (!r.ok) throw new DiscordError(r.status, 'user');
  return r.json();
}
