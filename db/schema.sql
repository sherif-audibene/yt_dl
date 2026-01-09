-- Download logs table
CREATE TABLE IF NOT EXISTS download_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Video info
  video_url VARCHAR(2048) NOT NULL,
  video_title VARCHAR(500),
  video_uploader VARCHAR(255),
  video_duration VARCHAR(50),
  
  -- Download info
  format ENUM('video', 'audio') NOT NULL,
  status ENUM('started', 'completed', 'failed') DEFAULT 'started',
  error_message TEXT,
  
  -- User info
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  
  INDEX idx_created_at (created_at),
  INDEX idx_status (status),
  INDEX idx_ip_address (ip_address)
);

-- Daily stats view (optional - for quick stats queries)
CREATE OR REPLACE VIEW daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_downloads,
  SUM(CASE WHEN format = 'video' THEN 1 ELSE 0 END) as video_downloads,
  SUM(CASE WHEN format = 'audio' THEN 1 ELSE 0 END) as audio_downloads,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  COUNT(DISTINCT ip_address) as unique_users
FROM download_logs
GROUP BY DATE(created_at);

