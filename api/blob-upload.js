const { handleUpload } = require('@vercel/blob/client');
const { requireAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const { userId } = auth;

  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith(`projects/${userId}/`)) {
          return {
            allowedContentTypes: ['application/json'],
            access: 'private',
            maximumSizeInBytes: 1 * 1024 * 1024,
            allowOverwrite: true,
          };
        }
        if (pathname.startsWith(`pdfs/${userId}/`)) {
          return {
            allowedContentTypes: ['application/pdf'],
            access: 'private',
            maximumSizeInBytes: 100 * 1024 * 1024,
            allowOverwrite: true,
          };
        }
        throw new Error('Pathname not allowed');
      },
      onUploadCompleted: async () => {},
    });
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
