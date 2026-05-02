const { list } = require('@vercel/blob');
const { requireAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const { blobs } = await list({ prefix: `projects/${auth.userId}/`, token: process.env.BLOB_READ_WRITE_TOKEN });
    res.json(blobs.map(b => ({ url: b.url, pathname: b.pathname, uploadedAt: b.uploadedAt })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
