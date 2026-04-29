const { put } = require('@vercel/blob');

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const pathname = req.headers['x-pathname'];
    const contentType = req.headers['x-content-type'];
    if (!pathname) return res.status(400).json({ error: 'Missing x-pathname header' });

    const blob = await put(pathname, req, { access: 'public', contentType });
    res.json(blob);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
