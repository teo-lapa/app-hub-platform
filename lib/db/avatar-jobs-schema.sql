-- Avatar Video Generation Jobs Table
-- Stores the state of video generation jobs for persistence across serverless invocations

CREATE TABLE IF NOT EXISTS avatar_video_jobs (
  job_id VARCHAR(100) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  step TEXT,
  video_url TEXT,
  error TEXT,
  provider VARCHAR(10),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,

  CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  CHECK (provider IS NULL OR provider IN ('sora', 'veo'))
);

-- Index for faster lookups by creation time
CREATE INDEX IF NOT EXISTS idx_avatar_jobs_created_at ON avatar_video_jobs(created_at DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_avatar_jobs_status ON avatar_video_jobs(status);
