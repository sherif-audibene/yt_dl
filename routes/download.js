const express = require('express');
const router = express.Router();
const { getVideoInfo, downloadMedia } = require('../services/ytdlp');
const { removeFile } = require('../utils/cleanup');
const { logDownloadStart, logDownloadComplete, logDownloadFailed, getStats } = require('../services/logger');

// Helper to get client IP
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
};

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

  let logId = null;

  try {
    const isAudio = format === 'audio';
    
    // Get video info for logging
    let videoInfo = null;
    try {
      videoInfo = await getVideoInfo(url);
    } catch (e) {
      // Continue even if we can't get video info
    }

    // Log the download start
    logId = await logDownloadStart({
      videoUrl: url,
      videoInfo,
      format: isAudio ? 'audio' : 'video',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });

    const { filePath, filename } = await downloadMedia(url, isAudio);

    console.log('Serving file:', filePath);

    res.download(filePath, filename, async (err) => {
      removeFile(filePath);

      if (err && !res.headersSent) {
        console.error('Download send error:', err);
        if (logId) await logDownloadFailed(logId, err.message);
        res.status(500).json({ error: 'Failed to send file' });
      } else if (!err && logId) {
        await logDownloadComplete(logId);
      }
    });
  } catch (error) {
    if (logId) await logDownloadFailed(logId, error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Stats API endpoint
router.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Dashboard page
router.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

module.exports = router;

