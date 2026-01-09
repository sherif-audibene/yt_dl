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

// Download video/audio with SSE progress
router.get('/download', async (req, res) => {
  const { url, format } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let logId = null;

  try {
    const isAudio = format === 'audio';
    
    // Get video info for logging
    let videoInfo = null;
    try {
      videoInfo = await getVideoInfo(url);
      sendEvent('info', { title: videoInfo.title });
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

    // Progress callback
    const onProgress = (percent) => {
      sendEvent('progress', { percent: Math.round(percent) });
    };

    const { filePath, filename } = await downloadMedia(url, isAudio, onProgress);

    console.log('Download complete:', filePath);

    // Send completion event with download URL
    sendEvent('complete', { 
      downloadUrl: `/file/${encodeURIComponent(filename)}?path=${encodeURIComponent(filePath)}` 
    });

    if (logId) await logDownloadComplete(logId);
    res.end();
  } catch (error) {
    sendEvent('error', { message: error.message });
    if (logId) await logDownloadFailed(logId, error.message);
    res.end();
  }
});

// Serve downloaded file
router.get('/file/:filename', (req, res) => {
  const { path: filePath } = req.query;
  const { filename } = req.params;

  if (!filePath) {
    return res.status(400).json({ error: 'File path required' });
  }

  res.download(filePath, filename, (err) => {
    // Keep files instead of deleting after download
    // removeFile(filePath);
    if (err && !res.headersSent) {
      console.error('File send error:', err);
      res.status(500).json({ error: 'Failed to send file' });
    }
  });
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

