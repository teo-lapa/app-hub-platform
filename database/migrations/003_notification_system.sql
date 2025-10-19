-- =====================================================
-- MAESTRO AI - Notification System Schema
-- =====================================================
-- Migration: 003_notification_system
-- Created: 2025-01-19
-- Description: Tables for notification preferences and logs
-- =====================================================

-- =====================================================
-- 1. NOTIFICATION PREFERENCES
-- =====================================================
-- Stores notification preferences for each salesperson

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  salesperson_id INTEGER NOT NULL,

  -- Email preferences
  email_enabled BOOLEAN DEFAULT true,

  -- Telegram preferences
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_chat_id TEXT,

  -- Notification thresholds
  churn_threshold INTEGER DEFAULT 70,  -- Min churn score to trigger alert

  -- Daily summary preferences
  daily_summary_enabled BOOLEAN DEFAULT true,
  daily_summary_time TIME DEFAULT '08:00:00',  -- When to send daily summary

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_salesperson
    FOREIGN KEY (salesperson_id)
    REFERENCES salespeople(id)
    ON DELETE CASCADE,

  -- Unique constraint: one preference per salesperson
  CONSTRAINT unique_salesperson_preferences
    UNIQUE (salesperson_id),

  -- Check constraints
  CONSTRAINT valid_churn_threshold
    CHECK (churn_threshold >= 0 AND churn_threshold <= 100),

  CONSTRAINT telegram_chat_id_required_if_enabled
    CHECK (
      telegram_enabled = false
      OR (telegram_enabled = true AND telegram_chat_id IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_prefs_salesperson
  ON notification_preferences(salesperson_id);

-- Comments
COMMENT ON TABLE notification_preferences IS 'Notification preferences for salespeople';
COMMENT ON COLUMN notification_preferences.churn_threshold IS 'Minimum churn risk score to trigger alert (0-100)';
COMMENT ON COLUMN notification_preferences.telegram_chat_id IS 'Telegram chat ID for sending notifications';
COMMENT ON COLUMN notification_preferences.daily_summary_time IS 'Time of day to send daily summary (in user timezone)';

-- =====================================================
-- 2. NOTIFICATION LOGS
-- =====================================================
-- Tracks all sent notifications for throttling and audit

CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,

  -- What was notified
  customer_id INTEGER,  -- Can be NULL for daily summaries
  rule_name TEXT NOT NULL,  -- e.g., 'CHURN_CRITICAL', 'DAILY_SUMMARY'

  -- Notification details
  channels JSONB,  -- Array of channels used: ['email', 'telegram']
  priority TEXT,  -- 'urgent', 'high', 'medium', 'low'

  -- Metadata
  salesperson_id INTEGER,
  sent_at TIMESTAMP DEFAULT NOW(),

  -- Delivery status (for future tracking)
  status TEXT DEFAULT 'sent',  -- 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,

  -- Constraints
  CONSTRAINT fk_customer
    FOREIGN KEY (customer_id)
    REFERENCES customer_avatars(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_salesperson_log
    FOREIGN KEY (salesperson_id)
    REFERENCES salespeople(id)
    ON DELETE SET NULL,

  CONSTRAINT valid_status
    CHECK (status IN ('sent', 'delivered', 'failed', 'bounced'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_customer
  ON notification_logs(customer_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_salesperson
  ON notification_logs(salesperson_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at
  ON notification_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_rule
  ON notification_logs(rule_name);

-- Index for throttling checks (most common query)
CREATE INDEX IF NOT EXISTS idx_notification_logs_throttle
  ON notification_logs(customer_id, rule_name, sent_at DESC);

-- Comments
COMMENT ON TABLE notification_logs IS 'Audit log of all sent notifications';
COMMENT ON COLUMN notification_logs.rule_name IS 'Notification rule that triggered the alert';
COMMENT ON COLUMN notification_logs.channels IS 'JSON array of delivery channels used';
COMMENT ON COLUMN notification_logs.status IS 'Delivery status tracking';

-- =====================================================
-- 3. CUSTOMER VISITS (if not exists)
-- =====================================================
-- Referenced by daily summary, create if missing

CREATE TABLE IF NOT EXISTS customer_visits (
  id SERIAL PRIMARY KEY,

  -- Visit details
  customer_id INTEGER NOT NULL,
  salesperson_id INTEGER NOT NULL,

  -- Schedule
  visit_date DATE NOT NULL,
  visit_time TIME,

  -- Status
  status TEXT DEFAULT 'pending',  -- 'pending', 'completed', 'cancelled'

  -- Notes
  notes TEXT,
  outcome TEXT,  -- Notes after visit completion

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Constraints
  CONSTRAINT fk_customer_visit
    FOREIGN KEY (customer_id)
    REFERENCES customer_avatars(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_salesperson_visit
    FOREIGN KEY (salesperson_id)
    REFERENCES salespeople(id)
    ON DELETE CASCADE,

  CONSTRAINT valid_visit_status
    CHECK (status IN ('pending', 'completed', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_visits_customer
  ON customer_visits(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_visits_salesperson
  ON customer_visits(salesperson_id);

CREATE INDEX IF NOT EXISTS idx_customer_visits_date
  ON customer_visits(visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_visits_status
  ON customer_visits(status);

-- Comments
COMMENT ON TABLE customer_visits IS 'Customer visit tracking and scheduling';

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for notification_preferences
DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for customer_visits
DROP TRIGGER IF EXISTS update_customer_visits_updated_at ON customer_visits;
CREATE TRIGGER update_customer_visits_updated_at
  BEFORE UPDATE ON customer_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. DEFAULT NOTIFICATION PREFERENCES
-- =====================================================
-- Create default preferences for existing salespeople

INSERT INTO notification_preferences (
  salesperson_id,
  email_enabled,
  telegram_enabled,
  churn_threshold,
  daily_summary_enabled
)
SELECT
  id,
  true,  -- Email enabled by default
  false, -- Telegram disabled by default
  70,    -- Alert for churn >= 70
  true   -- Daily summary enabled
FROM salespeople
WHERE id NOT IN (
  SELECT salesperson_id FROM notification_preferences
)
ON CONFLICT (salesperson_id) DO NOTHING;

-- =====================================================
-- 6. VIEWS FOR ANALYTICS
-- =====================================================

-- View: Notification statistics by salesperson
CREATE OR REPLACE VIEW notification_stats_by_salesperson AS
SELECT
  sp.id as salesperson_id,
  sp.name as salesperson_name,
  sp.email as salesperson_email,
  COUNT(nl.id) as total_notifications,
  COUNT(nl.id) FILTER (WHERE nl.sent_at >= NOW() - INTERVAL '7 days') as notifications_last_7_days,
  COUNT(nl.id) FILTER (WHERE nl.sent_at >= NOW() - INTERVAL '30 days') as notifications_last_30_days,
  COUNT(DISTINCT nl.customer_id) as unique_customers_notified,
  MAX(nl.sent_at) as last_notification_sent
FROM salespeople sp
LEFT JOIN notification_logs nl ON nl.salesperson_id = sp.id
GROUP BY sp.id, sp.name, sp.email;

COMMENT ON VIEW notification_stats_by_salesperson IS 'Notification statistics aggregated by salesperson';

-- View: Notification effectiveness (customers notified vs actions taken)
CREATE OR REPLACE VIEW notification_effectiveness AS
SELECT
  nl.customer_id,
  ca.name as customer_name,
  nl.rule_name,
  nl.sent_at,
  ca.churn_risk_score as churn_score_at_notification,
  COUNT(cv.id) as visits_after_notification
FROM notification_logs nl
JOIN customer_avatars ca ON ca.id = nl.customer_id
LEFT JOIN customer_visits cv ON
  cv.customer_id = nl.customer_id
  AND cv.created_at > nl.sent_at
  AND cv.created_at < nl.sent_at + INTERVAL '14 days'
WHERE nl.sent_at >= NOW() - INTERVAL '90 days'
GROUP BY nl.id, nl.customer_id, ca.name, nl.rule_name, nl.sent_at, ca.churn_risk_score
ORDER BY nl.sent_at DESC;

COMMENT ON VIEW notification_effectiveness IS 'Track if notifications led to customer visits';

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================
-- Adjust based on your database user setup

-- GRANT ALL ON notification_preferences TO your_app_user;
-- GRANT ALL ON notification_logs TO your_app_user;
-- GRANT ALL ON customer_visits TO your_app_user;
-- GRANT SELECT ON notification_stats_by_salesperson TO your_app_user;
-- GRANT SELECT ON notification_effectiveness TO your_app_user;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT 'Notification system schema created successfully' as status;
