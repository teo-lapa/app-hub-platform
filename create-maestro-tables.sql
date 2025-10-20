-- Create missing Maestro Chat tables
-- Run this on Neon DB: https://console.neon.tech/app/projects/bold-heart-09831315

-- Rate limiting table
CREATE TABLE IF NOT EXISTS maestro_chat_rate_limits (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maestro_rate_limits_user_id ON maestro_chat_rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_maestro_rate_limits_window ON maestro_chat_rate_limits(window_start);

-- Conversations table
CREATE TABLE IF NOT EXISTS maestro_conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(500),
  context JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maestro_conversations_user_id ON maestro_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_maestro_conversations_created_at ON maestro_conversations(created_at DESC);

-- Messages/interactions table
CREATE TABLE IF NOT EXISTS maestro_interactions (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES maestro_conversations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maestro_interactions_conversation ON maestro_interactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_maestro_interactions_user_id ON maestro_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_maestro_interactions_created_at ON maestro_interactions(created_at DESC);

-- Grant permissions (adjust user if needed)
GRANT ALL PRIVILEGES ON TABLE maestro_chat_rate_limits TO neondb_owner;
GRANT ALL PRIVILEGES ON TABLE maestro_conversations TO neondb_owner;
GRANT ALL PRIVILEGES ON TABLE maestro_interactions TO neondb_owner;
GRANT USAGE, SELECT ON SEQUENCE maestro_chat_rate_limits_id_seq TO neondb_owner;
GRANT USAGE, SELECT ON SEQUENCE maestro_conversations_id_seq TO neondb_owner;
GRANT USAGE, SELECT ON SEQUENCE maestro_interactions_id_seq TO neondb_owner;
