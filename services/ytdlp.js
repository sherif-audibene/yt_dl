const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DOWNLOADS_DIR } = require('../config');

/**
 * Fetches video metadata from a URL
 */
const getVideoInfo = (url) => {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', ['--dump-json', '--no-playlist', url]);

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
 */
const downloadMedia = (url, isAudio = false) => {
  return new Promise((resolve, reject) => {
    const sessionId = crypto.randomBytes(8).toString('hex');
    const outputTemplate = path.join(DOWNLOADS_DIR, `${sessionId}_%(title)s.%(ext)s`);

    const args = [
      '-o', outputTemplate,
      '--no-playlist',
      '--restrict-filenames',
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
      console.log('yt-dlp:', chunk.toString());
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

