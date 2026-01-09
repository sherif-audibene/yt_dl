const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { DOWNLOADS_DIR } = require('../config');

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DOWNLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Trimmer page
router.get('/trimmer', (req, res) => {
  res.render('trimmer');
});

// Trim audio endpoint
router.post('/trimmer/trim', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const { start, end } = req.body;
  const startTime = parseFloat(start);
  const endTime = parseFloat(end);

  if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime <= startTime) {
    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid start or end time' });
  }

  const duration = endTime - startTime;
  const inputPath = req.file.path;
  const outputFilename = `trimmed-${Date.now()}.mp3`;
  const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .output(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });

    // Clean up original uploaded file
    fs.unlink(inputPath, () => {});

    // Get original filename without extension for the download name
    const originalName = path.parse(req.file.originalname).name;
    const downloadFilename = `${originalName}_trimmed.mp3`;

    // Send the trimmed file
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);

    // Clean up output file after sending
    readStream.on('close', () => {
      setTimeout(() => {
        fs.unlink(outputPath, () => {});
      }, 1000);
    });

  } catch (error) {
    console.error('Trim error:', error);
    // Clean up files
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
    res.status(500).json({ error: 'Failed to trim audio: ' + error.message });
  }
});

module.exports = router;

