const express = require('express');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Create downloads directory
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home page
app.get('/', (req, res) => {
  res.render('index');
});

// Get video info
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const ytdlp = spawn('yt-dlp', [
    '--dump-json',
    '--no-playlist',
    url
  ]);

  let data = '';
  let error = '';

  ytdlp.stdout.on('data', (chunk) => {
    data += chunk.toString();
  });

  ytdlp.stderr.on('data', (chunk) => {
    error += chunk.toString();
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(400).json({ error: error || 'Failed to fetch video info' });
    }
    
    try {
      const info = JSON.parse(data);
      res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration_string,
        uploader: info.uploader
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse video info' });
    }
  });
});

// Download endpoint - now downloads to server first, then serves file
app.get('/download', async (req, res) => {
  const { url, format } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const isAudio = format === 'audio';
  const sessionId = crypto.randomBytes(8).toString('hex');
  const outputTemplate = path.join(DOWNLOADS_DIR, `${sessionId}_%(title)s.%(ext)s`);

  // Build yt-dlp arguments
  const args = [
    '-o', outputTemplate,
    '--no-playlist',
    '--restrict-filenames',
  ];

  if (isAudio) {
    args.push('-x');
    args.push('--audio-format', 'mp3');
    args.push('--audio-quality', '0');
  } else {
    // Download best quality and convert to mp4
    args.push('--recode-video', 'mp4');
  }

  args.push(url);

  console.log('Starting download:', args.join(' '));

  const ytdlp = spawn('yt-dlp', args);

  let errorOutput = '';

  ytdlp.stdout.on('data', (chunk) => {
    console.log('yt-dlp:', chunk.toString());
  });

  ytdlp.stderr.on('data', (chunk) => {
    errorOutput += chunk.toString();
    console.error('yt-dlp stderr:', chunk.toString());
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      console.error('yt-dlp failed with code:', code);
      return res.status(500).json({ error: errorOutput || 'Download failed' });
    }

    // Find the downloaded file
    const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(sessionId));
    
    if (files.length === 0) {
      return res.status(500).json({ error: 'Download completed but file not found' });
    }

    const downloadedFile = path.join(DOWNLOADS_DIR, files[0]);
    const originalFilename = files[0].replace(`${sessionId}_`, '');

    console.log('Serving file:', downloadedFile);

    // Send the file to the user
    res.download(downloadedFile, originalFilename, (err) => {
      // Clean up the file after download (or on error)
      try {
        fs.unlinkSync(downloadedFile);
        console.log('Cleaned up:', downloadedFile);
      } catch (e) {
        console.error('Failed to clean up:', e);
      }

      if (err && !res.headersSent) {
        console.error('Download send error:', err);
        res.status(500).json({ error: 'Failed to send file' });
      }
    });
  });

  ytdlp.on('error', (err) => {
    console.error('yt-dlp spawn error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start download: ' + err.message });
    }
  });
});

// Clean up old files on startup
const cleanupOldFiles = () => {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stats = fs.statSync(filePath);
      // Remove files older than 1 hour
      if (now - stats.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up old file:', file);
      }
    });
  } catch (e) {
    console.error('Cleanup error:', e);
  }
};

cleanupOldFiles();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
