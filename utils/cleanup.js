const fs = require('fs');
const path = require('path');
const { DOWNLOADS_DIR } = require('../config');

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
 * Ensures downloads directory exists
 */
const ensureDownloadsDir = () => {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
};

module.exports = {
  removeFile,
  ensureDownloadsDir,
};

