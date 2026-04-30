const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { blobs } = await list({ prefix: 'projects/', token: process.env.BLOB_READ_WRITE_TOKEN });
    res.json(blobs.map(b => ({ url: b.url, pathname: b.pathname, uploadedAt: b.uploadedAt })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
