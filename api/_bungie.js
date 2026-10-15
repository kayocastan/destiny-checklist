// Funções auxiliares do servidor (não é um endpoint: arquivos com "_" são ignorados pela Vercel).
const TOKEN_URL = 'https://www.bungie.net/platform/app/oauth/token/';

function env(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

async function tokenRequest(params) {
  const id = env('BUNGIE_CLIENT_ID');
  const secret = env('BUNGIE_CLIENT_SECRET');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!r.ok || !data.access_token) {
    const detail = data.error_description || data.error || text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const msg = `HTTP ${r.status}${detail ? ' – ' + detail : ''}`;
    console.error('Bungie token error', r.status, text.slice(0, 500));
    const err = new Error(msg);
    err.status = r.status === 400 || r.status === 401 ? 401 : 502;
    throw err;
  }
  const now = Date.now();
  return {
    access_token: data.access_token,
    access_expires: now + (data.expires_in || 3600) * 1000,
    refresh_token: data.refresh_token,
    refresh_expires: now + (data.refresh_expires_in || 0) * 1000,
    membership_id: data.membership_id,
  };
}

module.exports = { env, tokenRequest };
