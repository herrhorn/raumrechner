const { generateClientTokenFromReadWriteToken } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { pathname, contentType } = req.body;
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      pathname,
      allowedContentTypes: contentType ? [contentType] : undefined,
      maximumSizeInBytes: 100 * 1024 * 1024,
    });
    res.json({ clientToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
