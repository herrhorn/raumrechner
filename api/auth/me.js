const { requireAuth } = require('../_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const auth = await requireAuth(req, res);
  if (!auth) return;
  return res.json({ userId: auth.userId, email: auth.email });
};
