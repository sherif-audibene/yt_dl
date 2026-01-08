const express = require('express');
const path = require('path');

const { PORT } = require('./config');
const downloadRoutes = require('./routes/download');
const { ensureDownloadsDir, cleanupOldFiles } = require('./utils/cleanup');

const app = express();

// Ensure downloads directory exists
ensureDownloadsDir();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', downloadRoutes);

// Clean up old files on startup
cleanupOldFiles();

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
