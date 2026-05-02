const { Resend } = require('resend');
const { signMagicLinkToken } = require('../_auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const token = await signMagicLinkToken(email);
    const link = `${process.env.APP_URL}/verify.html?token=${encodeURIComponent(token)}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: email,
      subject: 'Sign in to Planar',
      text: `Click to sign in to Planar:\n\n${link}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, ignore this email.`,
      html: `<p>Click to sign in to Planar:</p><p><a href="${link}">Sign in</a></p><p>This link expires in 15 minutes.</p><p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>`,
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
