// Sign a session JWT with the deployment's JWT_SECRET and inject it as a
// cookie. Lets tests skip the magic-link flow entirely without adding any
// test-only endpoint to production.
const { SignJWT } = require('jose');
const { userIdFromEmail } = require('../../api/_auth');

const TEST_EMAIL = process.env.TEST_EMAIL || 'e2e@planar.test';

async function signSessionToken(email) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var required (must match deployment)');
  const userId = userIdFromEmail(email);
  return await new SignJWT({ userId, email, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
}

async function loginAs(context, baseUrl, email = TEST_EMAIL) {
  const token = await signSessionToken(email);
  const url = new URL(baseUrl);
  await context.addCookies([{
    name: 'planar_session',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  }]);
  return { email, userId: userIdFromEmail(email) };
}

module.exports = { loginAs, TEST_EMAIL, userIdFromEmail };
