const { query } = require('./db');

/**
 * Create a new download log entry
 */
const logDownloadStart = async ({ videoUrl, videoInfo, format, ipAddress, userAgent }) => {
  const result = await query(
    `INSERT INTO download_logs 
      (video_url, video_title, video_uploader, video_duration, format, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      videoUrl,
      videoInfo?.title || null,
      videoInfo?.uploader || null,
      videoInfo?.duration || null,
      format,
      ipAddress,
      userAgent,
    ]
  );
  return result.insertId;
};

/**
 * Mark a download as completed
 */
const logDownloadComplete = async (logId) => {
  await query(
    `UPDATE download_logs SET status = 'completed', completed_at = NOW() WHERE id = ?`,
    [logId]
  );
};

/**
 * Mark a download as failed
 */
const logDownloadFailed = async (logId, errorMessage) => {
  await query(
    `UPDATE download_logs SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
    [errorMessage, logId]
  );
};

/**
 * Get download statistics
 */
const getStats = async () => {
  const [totals] = await query(`
    SELECT 
      COUNT(*) as total_downloads,
      SUM(CASE WHEN format = 'video' THEN 1 ELSE 0 END) as video_downloads,
      SUM(CASE WHEN format = 'audio' THEN 1 ELSE 0 END) as audio_downloads,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      COUNT(DISTINCT ip_address) as unique_users
    FROM download_logs
  `);

  const todayStats = await query(`
    SELECT 
      COUNT(*) as downloads,
      COUNT(DISTINCT ip_address) as unique_users
    FROM download_logs
    WHERE DATE(created_at) = CURDATE()
  `);

  const recentDownloads = await query(`
    SELECT video_title, video_uploader, format, status, ip_address, created_at
    FROM download_logs
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const topVideos = await query(`
    SELECT video_title, video_uploader, COUNT(*) as download_count
    FROM download_logs
    WHERE video_title IS NOT NULL
    GROUP BY video_title, video_uploader
    ORDER BY download_count DESC
    LIMIT 10
  `);

  const dailyTrend = await query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as downloads
    FROM download_logs
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  return {
    totals: totals || {},
    today: todayStats[0] || {},
    recentDownloads,
    topVideos,
    dailyTrend,
  };
};

module.exports = {
  logDownloadStart,
  logDownloadComplete,
  logDownloadFailed,
  getStats,
};

