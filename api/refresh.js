// Renova o acesso usando o refresh_token (válido por ~90 dias na Bungie).
const { tokenRequest } = require('./_bungie');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const refresh = body && body.refresh_token;
  if (!refresh || typeof refresh !== 'string' || refresh.length > 4096) return res.status(400).json({ error: 'refresh_token ausente' });
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
    res.status(200).json(t);
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
};
