module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid url' }); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  if (!parsed.pathname.startsWith('/projects/') && !parsed.pathname.startsWith('/pdfs/')) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Blob not found' });
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cache-control', 'private, max-age=3600');
    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
