const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith('projects/')) {
          return {
            allowedContentTypes: ['application/json'],
            access: 'private',
            maximumSizeInBytes: 1 * 1024 * 1024,
            allowOverwrite: true,
          };
        }
        if (pathname.startsWith('pdfs/')) {
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
