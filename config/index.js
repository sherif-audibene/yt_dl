const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DOWNLOADS_DIR: process.env.DOWNLOADS_DIR || path.join(__dirname, '..', 'downloads'),
  // Firefox profile dir for yt-dlp cookies; empty = default profile of the app's user
  FIREFOX_PROFILE: process.env.FIREFOX_PROFILE || '',

  // HTTP Basic Auth credentials (required)
  AUTH_USER: process.env.AUTH_USER,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
};

