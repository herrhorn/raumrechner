const { handleUpload } = require('@vercel/blob/client');

module.exports = async function handler(req, res) {
  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ['application/pdf', 'application/json'],
        maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('blob uploaded:', blob.url);
      },
    });
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
