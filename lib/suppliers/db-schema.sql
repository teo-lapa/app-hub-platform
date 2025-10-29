-- ============================================================================
-- SUPPLIER MANAGEMENT - Database Schema
-- ============================================================================
--
-- Questo file contiene gli script SQL per creare la tabella supplier_avatars
-- per gestire le cadenze di riordino dei fornitori su Vercel Postgres.
--
-- Ispirato alla struttura di customer_avatars di Maestro AI
--
-- ============================================================================

-- Drop table if exists (use carefully in production!)
-- DROP TABLE IF EXISTS supplier_avatars CASCADE;

-- ============================================================================
-- TABLE: supplier_avatars
-- ============================================================================
-- Rappresenta il "Digital Twin" di ogni fornitore con cadenze di riordino

CREATE TABLE IF NOT EXISTS supplier_avatars (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Odoo Integration
  odoo_supplier_id INTEGER UNIQUE NOT NULL,

  -- Dati Anagrafici
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(100),
  country VARCHAR(100),

  -- Metriche Transazionali
  first_order_date TIMESTAMP,
  last_order_date TIMESTAMP,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  avg_order_value NUMERIC(12, 2) DEFAULT 0.00,

  -- Lead Time
  average_lead_time_days INTEGER DEFAULT 3,
  min_lead_time_days INTEGER,
  max_lead_time_days INTEGER,

  -- Cadence Settings
  cadence_type VARCHAR(20) DEFAULT 'fixed_days' CHECK (
    cadence_type IN ('fixed_days', 'weekly', 'biweekly', 'monthly', 'custom')
  ),
  cadence_value INTEGER NOT NULL DEFAULT 7, -- Giorni tra ordini

  -- Next Order Calculation
  next_order_date DATE,
  days_until_next_order INTEGER,
  last_cadence_order_date DATE,

  -- Prodotti e Categorie (JSONB for flexibility)
  top_products JSONB DEFAULT '[]'::jsonb,
  product_categories JSONB DEFAULT '{}'::jsonb,

  -- Supplier Scores (0-100)
  reliability_score INTEGER DEFAULT 80 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  quality_score INTEGER DEFAULT 80 CHECK (quality_score >= 0 AND quality_score <= 100),
  price_competitiveness_score INTEGER DEFAULT 70 CHECK (price_competitiveness_score >= 0 AND price_competitiveness_score <= 100),
  delivery_performance_score INTEGER DEFAULT 80 CHECK (delivery_performance_score >= 0 AND delivery_performance_score <= 100),

  -- Critical Products Count
  critical_products_count INTEGER DEFAULT 0,
  high_urgency_products_count INTEGER DEFAULT 0,
  medium_urgency_products_count INTEGER DEFAULT 0,

  -- Assignment
  assigned_buyer_id INTEGER,
  assigned_buyer_name VARCHAR(255),

  -- Status & Metadata
  is_active BOOLEAN DEFAULT true,
  is_preferred BOOLEAN DEFAULT false,
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_next_order ON supplier_avatars(next_order_date ASC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_days_until ON supplier_avatars(days_until_next_order ASC) WHERE is_active = true AND days_until_next_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_buyer ON supplier_avatars(assigned_buyer_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_odoo ON supplier_avatars(odoo_supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_reliability ON supplier_avatars(reliability_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_supplier_avatars_active ON supplier_avatars(is_active, next_order_date);

-- ============================================================================
-- TABLE: supplier_order_history
-- ============================================================================
-- Storico ordini ai fornitori (per analytics)

CREATE TABLE IF NOT EXISTS supplier_order_history (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  supplier_avatar_id UUID NOT NULL REFERENCES supplier_avatars(id) ON DELETE CASCADE,

  -- Odoo Integration
  odoo_purchase_order_id INTEGER,

  -- Order Data
  order_date DATE NOT NULL,
  order_value NUMERIC(12, 2) DEFAULT 0.00,
  products_count INTEGER DEFAULT 0,

  -- Delivery Info
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  delivery_delay_days INTEGER,

  -- Status
  order_status VARCHAR(30) CHECK (
    order_status IN ('draft', 'sent', 'confirmed', 'received', 'cancelled')
  ),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_history_supplier ON supplier_order_history(supplier_avatar_id);
CREATE INDEX IF NOT EXISTS idx_order_history_date ON supplier_order_history(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_odoo ON supplier_order_history(odoo_purchase_order_id);

-- ============================================================================
-- VIEWS (for analytics)
-- ============================================================================

-- View: Urgent Orders Today
CREATE OR REPLACE VIEW v_urgent_orders_today AS
SELECT
  id,
  odoo_supplier_id,
  name,
  cadence_type,
  cadence_value,
  next_order_date,
  days_until_next_order,
  critical_products_count,
  average_lead_time_days,
  assigned_buyer_id,
  assigned_buyer_name
FROM supplier_avatars
WHERE is_active = true
  AND days_until_next_order = 0
ORDER BY critical_products_count DESC, name ASC;

-- View: Orders Tomorrow
CREATE OR REPLACE VIEW v_orders_tomorrow AS
SELECT
  id,
  odoo_supplier_id,
  name,
  cadence_type,
  cadence_value,
  next_order_date,
  days_until_next_order,
  critical_products_count,
  average_lead_time_days,
  assigned_buyer_id,
  assigned_buyer_name
FROM supplier_avatars
WHERE is_active = true
  AND days_until_next_order = 1
ORDER BY critical_products_count DESC, name ASC;

-- View: Upcoming Orders (next 7 days)
CREATE OR REPLACE VIEW v_upcoming_orders AS
SELECT
  id,
  odoo_supplier_id,
  name,
  cadence_type,
  cadence_value,
  next_order_date,
  days_until_next_order,
  critical_products_count,
  average_lead_time_days,
  assigned_buyer_id,
  assigned_buyer_name
FROM supplier_avatars
WHERE is_active = true
  AND days_until_next_order BETWEEN 0 AND 7
ORDER BY days_until_next_order ASC, critical_products_count DESC;

-- ============================================================================
-- FUNCTIONS (for auto-update)
-- ============================================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supplier_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: supplier_avatars updated_at
DROP TRIGGER IF EXISTS trigger_supplier_avatars_updated_at ON supplier_avatars;
CREATE TRIGGER trigger_supplier_avatars_updated_at
  BEFORE UPDATE ON supplier_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_updated_at();

-- Trigger: supplier_order_history updated_at
DROP TRIGGER IF EXISTS trigger_supplier_order_history_updated_at ON supplier_order_history;
CREATE TRIGGER trigger_supplier_order_history_updated_at
  BEFORE UPDATE ON supplier_order_history
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_updated_at();

-- Function: Calculate next order date and days until
CREATE OR REPLACE FUNCTION calculate_next_order_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate next order date based on last_cadence_order_date + cadence_value
  IF NEW.last_cadence_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
    NEW.next_order_date := NEW.last_cadence_order_date + (NEW.cadence_value || ' days')::INTERVAL;
  ELSIF NEW.last_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
    -- Fallback to last_order_date if last_cadence_order_date not set
    NEW.next_order_date := NEW.last_order_date + (NEW.cadence_value || ' days')::INTERVAL;
  END IF;

  -- Calculate days until next order
  IF NEW.next_order_date IS NOT NULL THEN
    NEW.days_until_next_order := (NEW.next_order_date - CURRENT_DATE);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-calculate next order date
DROP TRIGGER IF EXISTS trigger_calculate_next_order ON supplier_avatars;
CREATE TRIGGER trigger_calculate_next_order
  BEFORE INSERT OR UPDATE OF cadence_value, last_cadence_order_date, last_order_date
  ON supplier_avatars
  FOR EACH ROW
  EXECUTE FUNCTION calculate_next_order_date();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check tables exist
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('supplier_avatars', 'supplier_order_history')
ORDER BY table_name;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('supplier_avatars', 'supplier_order_history')
ORDER BY tablename, indexname;

-- ============================================================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================================================

-- Get all suppliers with orders due today or tomorrow
-- SELECT * FROM supplier_avatars WHERE is_active = true AND days_until_next_order <= 1 ORDER BY days_until_next_order;

-- Get supplier by Odoo ID
-- SELECT * FROM supplier_avatars WHERE odoo_supplier_id = 123;

-- Update cadence for a supplier
-- UPDATE supplier_avatars SET cadence_value = 7, last_cadence_order_date = CURRENT_DATE WHERE odoo_supplier_id = 123;

-- Get upcoming orders view
-- SELECT * FROM v_upcoming_orders;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
