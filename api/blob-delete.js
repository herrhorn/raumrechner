const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid url' }); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  try {
    await del(url);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
