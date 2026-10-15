// A Bungie redireciona para cá depois que a pessoa autoriza o site.
// Trocamos o "code" pelos tokens e devolvemos ao navegador no fragmento (#), que não vai para servidores.
const { tokenRequest } = require('./_bungie');

module.exports = async (req, res) => {
  const { code, state, error } = req.query || {};
  if (error || !code) {
    res.writeHead(302, { Location: '/#auth_error=' + encodeURIComponent(error || 'sem_codigo') });
    return res.end();
  }
  try {
    const t = await tokenRequest({ grant_type: 'authorization_code', code });
    const payload = Buffer.from(JSON.stringify({ ...t, state: state || '' })).toString('base64url');
    res.writeHead(302, { Location: '/#auth=' + payload, 'Cache-Control': 'no-store' });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: '/#auth_error=' + encodeURIComponent(e.message) });
    res.end();
  }
};
