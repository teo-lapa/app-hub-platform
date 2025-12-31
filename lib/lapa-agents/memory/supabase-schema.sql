-- ============================================================================
-- LAPA AI - Conversation Memory Schema
--
-- Esegui questo SQL nel tuo progetto Supabase:
-- 1. Vai su https://supabase.com/dashboard
-- 2. Seleziona il tuo progetto
-- 3. Vai su SQL Editor
-- 4. Incolla e esegui questo script
-- ============================================================================

-- Tabella principale per la memoria delle conversazioni
CREATE TABLE IF NOT EXISTS customer_memories (
  -- Primary key: Odoo customer ID
  customer_id BIGINT PRIMARY KEY,

  -- Customer info
  customer_name TEXT NOT NULL,
  customer_type TEXT NOT NULL CHECK (customer_type IN ('b2b', 'b2c', 'anonymous')),

  -- Session tracking
  current_session_id TEXT,
  total_sessions INTEGER DEFAULT 1,

  -- Conversation data (JSONB for flexibility)
  messages JSONB DEFAULT '[]'::jsonb,

  -- AI-generated summary of past conversations
  conversation_summary TEXT DEFAULT '',

  -- Facts learned about the customer
  customer_facts TEXT[] DEFAULT '{}',

  -- Products the customer has shown interest in
  favorite_products TEXT[] DEFAULT '{}',

  -- Timestamps
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_memories_last_interaction
  ON customer_memories(last_interaction DESC);

-- Index for customer type filtering
CREATE INDEX IF NOT EXISTS idx_customer_memories_type
  ON customer_memories(customer_type);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for auto-update
DROP TRIGGER IF EXISTS update_customer_memories_updated_at ON customer_memories;
CREATE TRIGGER update_customer_memories_updated_at
  BEFORE UPDATE ON customer_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) - Opzionale ma consigliato
-- ============================================================================

-- Enable RLS
ALTER TABLE customer_memories ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON customer_memories
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Anon key can also access (for API calls)
CREATE POLICY "Anon key full access" ON customer_memories
  FOR ALL
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

-- ============================================================================
-- Utility Views
-- ============================================================================

-- View per statistiche memoria
CREATE OR REPLACE VIEW memory_stats AS
SELECT
  customer_type,
  COUNT(*) as total_customers,
  AVG(total_sessions) as avg_sessions,
  AVG(jsonb_array_length(messages)) as avg_messages,
  AVG(array_length(customer_facts, 1)) as avg_facts,
  MAX(last_interaction) as most_recent
FROM customer_memories
GROUP BY customer_type;

-- ============================================================================
-- Sample Queries
-- ============================================================================

-- Get customer memory
-- SELECT * FROM customer_memories WHERE customer_id = 123;

-- Get top customers by interaction
-- SELECT customer_id, customer_name, total_sessions, last_interaction
-- FROM customer_memories
-- ORDER BY total_sessions DESC
-- LIMIT 10;

-- Clean old memories (over 90 days)
-- DELETE FROM customer_memories
-- WHERE last_interaction < NOW() - INTERVAL '90 days';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant access to anon and authenticated users
GRANT ALL ON customer_memories TO anon;
GRANT ALL ON customer_memories TO authenticated;
GRANT ALL ON customer_memories TO service_role;
