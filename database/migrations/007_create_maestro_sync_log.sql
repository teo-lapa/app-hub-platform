-- MAESTRO AI - Sync Log
-- Tracking sincronizzazioni Odoo -> PostgreSQL

CREATE TABLE IF NOT EXISTS maestro_sync_log (
  id SERIAL PRIMARY KEY,

  -- Sync info
  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'customer', 'orders'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'success', 'error', 'partial'

  -- Statistics
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,

  -- Details
  error_details TEXT,
  sync_details JSONB, -- Dettagli sync per debug

  -- Trigger
  triggered_by VARCHAR(50) DEFAULT 'manual', -- 'cron', 'manual', 'api_request'

  -- Performance
  duration_seconds INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON maestro_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON maestro_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON maestro_sync_log(started_at DESC);

COMMENT ON TABLE maestro_sync_log IS 'Log sincronizzazioni Odoo per monitoring e debug';
