// Entrega ao navegador só o que é público: a chave da API (restrita ao domínio do site pela Bungie)
// e o client_id do OAuth. O segredo do OAuth nunca sai do servidor.
module.exports = (req, res) => {
  const apiKey = (process.env.BUNGIE_API_KEY || '').trim();
  const clientId = (process.env.BUNGIE_CLIENT_ID || '').trim();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ apiKey, clientId, configured: Boolean(apiKey && clientId && process.env.BUNGIE_CLIENT_SECRET) });
};
