const express = require('express');
const router = express.Router();
const { getVideoInfo, downloadMedia } = require('../services/ytdlp');
const { removeFile } = require('../utils/cleanup');

// Home page
router.get('/', (req, res) => {
  res.render('index');
});

// Get video info
router.post('/api/info', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Download video/audio
router.get('/download', async (req, res) => {
  const { url, format } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const isAudio = format === 'audio';
    const { filePath, filename } = await downloadMedia(url, isAudio);

    console.log('Serving file:', filePath);

    res.download(filePath, filename, (err) => {
      removeFile(filePath);

      if (err && !res.headersSent) {
        console.error('Download send error:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;

