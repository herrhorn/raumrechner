const { clearSessionCookie } = require('../_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  clearSessionCookie(res);
  return res.json({ ok: true });
};
