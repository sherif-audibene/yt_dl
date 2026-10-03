const { spawn } = require('child_process');
const path = require('path');
const { DOWNLOADS_DIR, FIREFOX_PROFILE } = require('../config');

// Env may set XDG_CACHE_HOME to an unwritable dir (e.g. /config/xdg/cache under Jenkins)
const CACHE_DIR = path.join(require('os').tmpdir(), 'yt-dlp-cache');

/**
 * Check if URL is a YouTube URL
 */
const isYouTubeUrl = (url) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
};

/**
 * Get cookies args for YouTube URLs (from Firefox)
 */
const getCookiesArgs = (url) => {
  const browser = FIREFOX_PROFILE ? `firefox:${FIREFOX_PROFILE}` : 'firefox';
  return isYouTubeUrl(url) ? ['--cookies-from-browser', browser] : [];
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
 * Builds a user-facing error from yt-dlp stderr: keeps only "ERROR:" lines
 * (stderr also carries warnings and tracebacks) and drops the "[extractor] id:" prefix
 */
const ytdlpError = (stderr, fallback) => {
  const messages = stderr.split('\n')
    .filter((line) => line.startsWith('ERROR:'))
    .map((line) => line.replace(/^ERROR:\s*(\[[^\]]+\]\s*([^:\s]+:\s*)?)?/, ''));
  return new Error(messages.join('\n') || fallback);
};

/**
 * Fetches video metadata from a URL
 */
const getVideoInfo = (url) => {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', '--remote-components', 'ejs:github', '--js-runtimes', 'node', '--cache-dir', CACHE_DIR, ...getCookiesArgs(url), url];
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
        return reject(ytdlpError(error, 'Failed to fetch video info'));
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
 * @param {number|null} maxHeight - Max video height (e.g. 720), null = best
 */
const downloadMedia = async (url, isAudio = false, onProgress = null, maxHeight = 720) => {
  // Print yt-dlp version before starting
  const version = await getVersion();
  console.log('yt-dlp version:', version);

  return new Promise((resolve, reject) => {
    // Default yt-dlp name: "<title> [<id>].<ext>"; the id keeps same-titled videos apart
    const args = [
      '-P', DOWNLOADS_DIR,
      '--no-playlist',
      '--newline', // Output progress on new lines for easier parsing
      '--progress', '--print', 'after_move:filepath', // final path is the last stdout line; --print would otherwise hide progress
      '--remote-components', 'ejs:github', '--js-runtimes', 'node', '--cache-dir', CACHE_DIR,
      ...getCookiesArgs(url),
    ];

    if (isAudio) {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      const h = maxHeight ? `[height<=${maxHeight}]` : '';
      args.push('-f', `bv*${h}+ba/b${h}`, '--merge-output-format', 'mp4');
    }

    args.push(url);

    console.log('Starting download:', args.join(' '));

    const ytdlp = spawn('yt-dlp', args);
    let errorOutput = '';
    let stdout = '';

    ytdlp.stdout.on('data', (chunk) => {
      const output = chunk.toString();
      stdout += output;
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
        return reject(ytdlpError(errorOutput, 'Download failed'));
      }

      const filePath = stdout.trim().split('\n').pop();

      if (!filePath || !path.isAbsolute(filePath)) {
        return reject(new Error('Download completed but file not found'));
      }

      resolve({ filePath, filename: path.basename(filePath) });
    });

    ytdlp.on('error', (err) => {
      reject(new Error('Failed to start download: ' + err.message));
    });
  });
};

module.exports = {
  ytdlpError,
  getVideoInfo,
  downloadMedia,
};

