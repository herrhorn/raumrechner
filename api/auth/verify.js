const { verifyMagicLinkToken, signSessionToken, userIdFromEmail, setSessionCookie } = require('../_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const email = await verifyMagicLinkToken(token);
  if (!email) {
    return res.status(401).json({ error: 'Invalid or expired link' });
  }

  const userId = userIdFromEmail(email);
  const sessionToken = await signSessionToken(userId, email);
  setSessionCookie(res, sessionToken);
  return res.json({ userId, email });
};
