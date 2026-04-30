const { put } = require('@vercel/blob');

module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const pathname = req.headers['x-pathname'];
    const contentType = req.headers['x-content-type'];
    if (!pathname) return res.status(400).json({ error: 'Missing x-pathname header' });
    if (!pathname.startsWith('projects/')) return res.status(400).json({ error: 'Pathname not allowed' });

    const allowed = ['application/json'];
    if (!allowed.includes(contentType)) return res.status(400).json({ error: 'Content type not allowed' });

    const blob = await put(pathname, req, { access: 'private', contentType });
    res.json(blob);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
