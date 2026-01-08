const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DOWNLOADS_DIR: path.join(__dirname, '..', 'downloads'),
  FILE_CLEANUP_AGE_MS: 3600000, // 1 hour
};

