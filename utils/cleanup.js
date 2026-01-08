const fs = require('fs');
const path = require('path');
const { DOWNLOADS_DIR, FILE_CLEANUP_AGE_MS } = require('../config');

/**
 * Removes a specific file safely
 */
const removeFile = (filePath) => {
  try {
    fs.unlinkSync(filePath);
    console.log('Cleaned up:', filePath);
  } catch (e) {
    console.error('Failed to clean up:', e);
  }
};

/**
 * Removes files older than the configured age from downloads directory
 */
const cleanupOldFiles = () => {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();

    files.forEach((file) => {
      const filePath = path.join(DOWNLOADS_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > FILE_CLEANUP_AGE_MS) {
        fs.unlinkSync(filePath);
        console.log('Cleaned up old file:', file);
      }
    });
  } catch (e) {
    console.error('Cleanup error:', e);
  }
};

/**
 * Ensures downloads directory exists
 */
const ensureDownloadsDir = () => {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
};

module.exports = {
  removeFile,
  cleanupOldFiles,
  ensureDownloadsDir,
};

