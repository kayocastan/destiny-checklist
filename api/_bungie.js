// Funções auxiliares do servidor (não é um endpoint: arquivos com "_" são ignorados pela Vercel).
const TOKEN_URL = 'https://www.bungie.net/platform/app/oauth/token/';

function env(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

async function post(params, useBasic) {
  const id = env('BUNGIE_CLIENT_ID');
  const secret = env('BUNGIE_CLIENT_SECRET');
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'X-API-Key': env('BUNGIE_API_KEY') };
  const body = new URLSearchParams(params);
  if (useBasic) headers.Authorization = 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
  else { body.set('client_id', id); body.set('client_secret', secret); }
  const r = await fetch(TOKEN_URL, { method: 'POST', headers, body: body.toString() });
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  return { r, text, data };
}

async function tokenRequest(params) {
  // A Bungie aceita as credenciais do app no cabeçalho (Basic) ou no corpo; tentamos os dois.
  let res = await post(params, true);
  if (!res.data.access_token && (res.r.status === 401 || res.r.status === 400) && params.grant_type === 'refresh_token') res = await post(params, false);
  if (!res.data.access_token && res.r.status === 401 && params.grant_type !== 'refresh_token') {
    // O código de autorização só vale uma vez; se a Bungie recusou as credenciais sem consumi-lo, a segunda forma ainda funciona.
    res = await post(params, false);
  }
  const { r, text, data } = res;
  if (!r.ok || !data.access_token) {
    const detail = data.error_description || data.error || text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'credenciais do app recusadas (confira o client_secret)';
    console.error('Bungie token error', r.status, text.slice(0, 500));
    const err = new Error(`HTTP ${r.status} – ${detail}`);
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
