-- Schema per monitoring agenti (Neon Postgres)

CREATE TABLE IF NOT EXISTS agent_conversations (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  contact TEXT,
  platform TEXT,
  message_text TEXT,
  media_url TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_agconv_slug_ts ON agent_conversations (slug, ts DESC);
CREATE INDEX IF NOT EXISTS idx_agconv_contact ON agent_conversations (contact);

CREATE TABLE IF NOT EXISTS agent_errors (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('warn','error','fatal')),
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_agerr_slug_ts ON agent_errors (slug, ts DESC);

CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_pct NUMERIC,
  ram_mb NUMERIC,
  uptime_s BIGINT,
  queue_size INT,
  meta JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_aghb_slug_ts ON agent_heartbeats (slug, ts DESC);

CREATE TABLE IF NOT EXISTS agent_alert_state (
  slug TEXT PRIMARY KEY,
  online BOOLEAN,
  errors24h INT,
  last_alert_ts TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
