const { SignJWT, jwtVerify } = require('jose');
const { createHash } = require('crypto');

const SESSION_COOKIE = 'planar_session';
const SESSION_EXPIRY_DAYS = 30;
const MAGIC_LINK_EXPIRY = '15m';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
}

function userIdFromEmail(email) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

async function signSessionToken(userId, email) {
  return await new SignJWT({ userId, email, type: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRY_DAYS}d`)
    .sign(getJwtSecret());
}

async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'session') return null;
    return payload;
  } catch {
    return null;
  }
}

async function signMagicLinkToken(email) {
  return await new SignJWT({ email: email.trim().toLowerCase(), type: 'magic' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(MAGIC_LINK_EXPIRY)
    .sign(getJwtSecret());
}

async function verifyMagicLinkToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'magic') return null;
    return payload.email;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(part => {
    const eq = part.indexOf('=');
    if (eq < 0) return;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  });
  return cookies;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_EXPIRY_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

async function requireAuth(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  const payload = await verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid session' });
    return null;
  }
  return payload;
}

module.exports = {
  userIdFromEmail,
  signSessionToken,
  signMagicLinkToken,
  verifyMagicLinkToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
};
