const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DOWNLOADS_DIR: path.join(__dirname, '..', 'downloads'),
  COOKIES_FILE: process.env.COOKIES_FILE || '/storage/cookies.txt',
  FILE_CLEANUP_AGE_MS: 3600000, // 1 hour

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};

