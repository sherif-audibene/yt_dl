const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DOWNLOADS_DIR, COOKIES_FILE } = require('../config');

/**
 * Check if URL is a YouTube URL
 */
const isYouTubeUrl = (url) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
};

/**
 * Get cookies args if YouTube URL and cookies file exists
 */
const getCookiesArgs = (url) => {
  if (isYouTubeUrl(url) && fs.existsSync(COOKIES_FILE)) {
    return ['--cookies', COOKIES_FILE];
  }
  return [];
};

/**
 * Get yt-dlp version
 */
const getVersion = () => {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', ['--version']);
    let version = '';

    ytdlp.stdout.on('data', (chunk) => {
      version += chunk.toString().trim();
    });

    ytdlp.on('close', () => {
      resolve(version || 'unknown');
    });

    ytdlp.on('error', () => {
      resolve('unknown');
    });
  });
};

/**
 * Fetches video metadata from a URL
 */
const getVideoInfo = (url) => {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', ...getCookiesArgs(url), url];
    const ytdlp = spawn('yt-dlp', args);

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
        return reject(new Error(error || 'Failed to fetch video info'));
      }

      try {
        const info = JSON.parse(data);
        resolve({
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration_string,
          uploader: info.uploader,
        });
      } catch (e) {
        reject(new Error('Failed to parse video info'));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error('Failed to start yt-dlp: ' + err.message));
    });
  });
};

/**
 * Downloads video/audio and returns the file path
 * @param {string} url - Video URL
 * @param {boolean} isAudio - Download audio only
 * @param {function} onProgress - Progress callback (percentage)
 */
const downloadMedia = async (url, isAudio = false, onProgress = null) => {
  // Print yt-dlp version before starting
  const version = await getVersion();
  console.log('yt-dlp version:', version);

  return new Promise((resolve, reject) => {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const outputTemplate = path.join(DOWNLOADS_DIR, `${sessionId}_%(title)s.%(ext)s`);

    const args = [
      '-o', outputTemplate,
      '--no-playlist',
      '--restrict-filenames',
      '--newline', // Output progress on new lines for easier parsing
      ...getCookiesArgs(url),
    ];

    if (isAudio) {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--recode-video', 'mp4');
    }

    args.push(url);

    console.log('Starting download:', args.join(' '));

    const ytdlp = spawn('yt-dlp', args);
    let errorOutput = '';

    ytdlp.stdout.on('data', (chunk) => {
      const output = chunk.toString();
      console.log('yt-dlp:', output);
      
      // Parse progress percentage from yt-dlp output
      // Format: [download]  45.2% of 10.00MiB at 1.00MiB/s ETA 00:05
      if (onProgress) {
        const match = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (match) {
          onProgress(parseFloat(match[1]));
        }
      }
    });

    ytdlp.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
      console.error('yt-dlp stderr:', chunk.toString());
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp failed with code:', code);
        return reject(new Error(errorOutput || 'Download failed'));
      }

      const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(sessionId));

      if (files.length === 0) {
        return reject(new Error('Download completed but file not found'));
      }

      const downloadedFile = path.join(DOWNLOADS_DIR, files[0]);
      const originalFilename = files[0].replace(`${sessionId}_`, '');

      resolve({ filePath: downloadedFile, filename: originalFilename });
    });

    ytdlp.on('error', (err) => {
      reject(new Error('Failed to start download: ' + err.message));
    });
  });
};

module.exports = {
  getVideoInfo,
  downloadMedia,
};

