module.exports = async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Blob not found' });
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('cache-control', 'private, max-age=3600');
    const data = await upstream.arrayBuffer();
    res.send(Buffer.from(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
