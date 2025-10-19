-- ============================================================================
-- MAESTRO AI - Database Schema
-- ============================================================================
--
-- Questo file contiene gli script SQL per creare tutte le tabelle necessarie
-- al sistema MAESTRO AI su Vercel Postgres.
--
-- Esegui questo script SOLO se le tabelle non esistono già.
--
-- ============================================================================

-- Drop tables if exists (use carefully in production!)
-- DROP TABLE IF EXISTS maestro_interactions CASCADE;
-- DROP TABLE IF EXISTS maestro_recommendations CASCADE;
-- DROP TABLE IF EXISTS customer_avatars CASCADE;

-- ============================================================================
-- TABLE: customer_avatars
-- ============================================================================
-- Rappresenta il "Digital Twin" di ogni cliente, arricchito con AI scores

CREATE TABLE IF NOT EXISTS customer_avatars (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Odoo Integration
  odoo_partner_id INTEGER UNIQUE NOT NULL,

  -- Dati Anagrafici
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),

  -- Metriche Transazionali
  first_order_date TIMESTAMP,
  last_order_date TIMESTAMP,
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(12, 2) DEFAULT 0.00,
  avg_order_value NUMERIC(12, 2) DEFAULT 0.00,
  order_frequency_days INTEGER, -- Giorni medi tra ordini
  days_since_last_order INTEGER DEFAULT 0,

  -- Prodotti e Categorie (JSONB for flexibility)
  top_products JSONB DEFAULT '[]'::jsonb,
  product_categories JSONB DEFAULT '{}'::jsonb,

  -- AI Scores (0-100)
  health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100),
  churn_risk_score INTEGER DEFAULT 0 CHECK (churn_risk_score >= 0 AND churn_risk_score <= 100),
  upsell_potential_score INTEGER DEFAULT 0 CHECK (upsell_potential_score >= 0 AND upsell_potential_score <= 100),
  engagement_score INTEGER DEFAULT 50 CHECK (engagement_score >= 0 AND engagement_score <= 100),

  -- Assignment
  assigned_salesperson_id INTEGER,
  assigned_salesperson_name VARCHAR(255),

  -- Status & Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_avatars_salesperson ON customer_avatars(assigned_salesperson_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_avatars_churn_risk ON customer_avatars(churn_risk_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_avatars_health_score ON customer_avatars(health_score ASC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_avatars_last_order ON customer_avatars(last_order_date DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_avatars_odoo_partner ON customer_avatars(odoo_partner_id);

-- ============================================================================
-- TABLE: maestro_recommendations
-- ============================================================================
-- Raccomandazioni AI per venditori

CREATE TABLE IF NOT EXISTS maestro_recommendations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  customer_avatar_id UUID NOT NULL REFERENCES customer_avatars(id) ON DELETE CASCADE,

  -- Recommendation Data
  recommendation_type VARCHAR(50) NOT NULL CHECK (
    recommendation_type IN ('churn_prevention', 'upsell', 'cross_sell', 'reactivation', 'routine_followup')
  ),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  suggested_actions JSONB DEFAULT '[]'::jsonb,
  suggested_products JSONB, -- Array di product IDs (nullable)

  reasoning TEXT NOT NULL, -- AI explanation
  expected_impact VARCHAR(255),

  -- Status & Outcome
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  outcome VARCHAR(50) CHECK (outcome IN ('success', 'partial_success', 'failed') OR outcome IS NULL),
  outcome_notes TEXT,

  -- AI Metadata
  created_by VARCHAR(20) DEFAULT 'ai' CHECK (created_by IN ('ai', 'manual')),
  ai_confidence INTEGER DEFAULT 70 CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  estimated_effort_minutes INTEGER DEFAULT 30,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recommendations_customer ON maestro_recommendations(customer_avatar_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON maestro_recommendations(status) WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON maestro_recommendations(priority) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON maestro_recommendations(created_at DESC);

-- ============================================================================
-- TABLE: maestro_interactions
-- ============================================================================
-- Tracking interazioni venditori con clienti

CREATE TABLE IF NOT EXISTS maestro_interactions (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  customer_avatar_id UUID NOT NULL REFERENCES customer_avatars(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES maestro_recommendations(id) ON DELETE SET NULL,

  -- Salesperson Info
  salesperson_id INTEGER NOT NULL,
  salesperson_name VARCHAR(255) NOT NULL,

  -- Interaction Data
  interaction_type VARCHAR(20) NOT NULL CHECK (
    interaction_type IN ('visit', 'call', 'email', 'whatsapp', 'other')
  ),
  interaction_date TIMESTAMP DEFAULT NOW(),

  outcome VARCHAR(30) NOT NULL CHECK (
    outcome IN ('successful', 'unsuccessful', 'neutral', 'follow_up_needed')
  ),
  notes TEXT,

  -- Order Info
  order_placed BOOLEAN DEFAULT false,
  order_value NUMERIC(12, 2),
  samples_given JSONB, -- Array of {product_id, product_name, quantity}

  next_follow_up_date DATE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interactions_customer ON maestro_interactions(customer_avatar_id);
CREATE INDEX IF NOT EXISTS idx_interactions_salesperson ON maestro_interactions(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON maestro_interactions(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_recommendation ON maestro_interactions(recommendation_id) WHERE recommendation_id IS NOT NULL;

-- ============================================================================
-- VIEWS (Optional - for analytics)
-- ============================================================================

-- View: High Risk Customers (Churn Risk >= 70)
CREATE OR REPLACE VIEW v_high_risk_customers AS
SELECT
  id,
  odoo_partner_id,
  name,
  city,
  total_orders,
  total_revenue,
  days_since_last_order,
  churn_risk_score,
  health_score,
  assigned_salesperson_id,
  assigned_salesperson_name
FROM customer_avatars
WHERE is_active = true
  AND churn_risk_score >= 70
ORDER BY churn_risk_score DESC;

-- View: Upsell Opportunities
CREATE OR REPLACE VIEW v_upsell_opportunities AS
SELECT
  id,
  odoo_partner_id,
  name,
  city,
  total_orders,
  total_revenue,
  avg_order_value,
  upsell_potential_score,
  assigned_salesperson_id,
  assigned_salesperson_name
FROM customer_avatars
WHERE is_active = true
  AND upsell_potential_score >= 60
  AND churn_risk_score < 50
ORDER BY upsell_potential_score DESC;

-- View: Pending Recommendations by Priority
CREATE OR REPLACE VIEW v_pending_recommendations AS
SELECT
  r.id,
  r.customer_avatar_id,
  ca.name AS customer_name,
  ca.assigned_salesperson_id,
  ca.assigned_salesperson_name,
  r.recommendation_type,
  r.priority,
  r.title,
  r.expected_impact,
  r.estimated_effort_minutes,
  r.created_at
FROM maestro_recommendations r
JOIN customer_avatars ca ON r.customer_avatar_id = ca.id
WHERE r.status = 'pending'
ORDER BY
  CASE r.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  r.created_at ASC;

-- ============================================================================
-- FUNCTIONS (Optional - for auto-update)
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: customer_avatars updated_at
DROP TRIGGER IF EXISTS trigger_avatars_updated_at ON customer_avatars;
CREATE TRIGGER trigger_avatars_updated_at
  BEFORE UPDATE ON customer_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: maestro_recommendations updated_at
DROP TRIGGER IF EXISTS trigger_recommendations_updated_at ON maestro_recommendations;
CREATE TRIGGER trigger_recommendations_updated_at
  BEFORE UPDATE ON maestro_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: maestro_interactions updated_at
DROP TRIGGER IF EXISTS trigger_interactions_updated_at ON maestro_interactions;
CREATE TRIGGER trigger_interactions_updated_at
  BEFORE UPDATE ON maestro_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample data for testing
/*
INSERT INTO customer_avatars (
  odoo_partner_id,
  name,
  email,
  phone,
  city,
  total_orders,
  total_revenue,
  avg_order_value,
  days_since_last_order,
  churn_risk_score,
  health_score,
  upsell_potential_score,
  engagement_score,
  assigned_salesperson_id,
  assigned_salesperson_name
) VALUES
  (1001, 'Ristorante Da Mario', 'mario@example.com', '+41 91 123 4567', 'Lugano', 25, 7500.00, 300.00, 45, 65, 55, 40, 60, 5, 'Luca Rossi'),
  (1002, 'Pizzeria Bella Napoli', 'napoli@example.com', '+41 91 234 5678', 'Bellinzona', 42, 12500.00, 297.62, 15, 25, 75, 65, 80, 5, 'Luca Rossi'),
  (1003, 'Trattoria Il Gabbiano', 'gabbiano@example.com', '+41 91 345 6789', 'Locarno', 8, 2400.00, 300.00, 90, 85, 30, 20, 35, 7, 'Maria Bianchi');
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('customer_avatars', 'maestro_recommendations', 'maestro_interactions')
ORDER BY table_name;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('customer_avatars', 'maestro_recommendations', 'maestro_interactions')
ORDER BY tablename, indexname;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
