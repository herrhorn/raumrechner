const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf', 'application/json'],
        access: 'private',
        maximumSizeInBytes: 100 * 1024 * 1024,
      }),
      onUploadCompleted: async () => {},
    });
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
