-- ==========================================
-- SETUP CONTROL LOGS - VERCEL POSTGRES
-- ==========================================
-- Esegui questo script nella Vercel Postgres Dashboard
-- Storage → Database → Query → Incolla e Run
-- ==========================================

-- 1. Crea tabella control_logs
CREATE TABLE IF NOT EXISTS control_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Riferimenti Odoo
  batch_id INTEGER NOT NULL,
  batch_name TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,

  -- Prodotto
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  qty_requested DECIMAL(10, 2) NOT NULL,
  qty_picked DECIMAL(10, 2) NOT NULL,

  -- Stato controllo
  status TEXT NOT NULL CHECK (status IN ('ok', 'error_qty', 'missing', 'damaged', 'lot_error', 'location_error', 'note')),
  note TEXT,

  -- Chi ha controllato
  controlled_by_user_id INTEGER NOT NULL,
  controlled_by_name TEXT NOT NULL,
  controlled_at TIMESTAMP DEFAULT NOW(),

  -- Metadata batch
  driver_name TEXT,
  vehicle_name TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_control_logs_batch ON control_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_zone ON control_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_product ON control_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_status ON control_logs(status);
CREATE INDEX IF NOT EXISTS idx_control_logs_user ON control_logs(controlled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_date ON control_logs(controlled_at DESC);
CREATE INDEX IF NOT EXISTS idx_control_logs_batch_zone ON control_logs(batch_id, zone_id);

-- 3. View: Riepilogo controlli per batch/zona
CREATE OR REPLACE VIEW control_summary AS
SELECT
  batch_id,
  batch_name,
  zone_id,
  zone_name,
  controlled_by_name,
  DATE(controlled_at) as control_date,
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE status = 'ok') as ok_count,
  COUNT(*) FILTER (WHERE status LIKE 'error%' OR status = 'damaged') as error_count,
  COUNT(*) FILTER (WHERE status = 'missing') as missing_count,
  COUNT(*) FILTER (WHERE status = 'note') as note_count,
  MIN(controlled_at) as first_control,
  MAX(controlled_at) as last_control
FROM control_logs
GROUP BY batch_id, batch_name, zone_id, zone_name, controlled_by_name, DATE(controlled_at)
ORDER BY MAX(controlled_at) DESC;

-- 4. View: Solo errori (per dashboard)
CREATE OR REPLACE VIEW control_errors AS
SELECT
  cl.*,
  CASE
    WHEN status = 'error_qty' THEN '⚠️ Errore Quantità'
    WHEN status = 'missing' THEN '❌ Mancante'
    WHEN status = 'damaged' THEN '🔧 Danneggiato'
    WHEN status = 'lot_error' THEN '📅 Lotto Errato'
    WHEN status = 'location_error' THEN '📍 Ubicazione Errata'
    ELSE '📝 Nota'
  END as status_label
FROM control_logs cl
WHERE status != 'ok'
ORDER BY controlled_at DESC;

-- ==========================================
-- VERIFICA SETUP
-- ==========================================

-- Controlla tabella
SELECT 'Tabella control_logs creata con ' || COUNT(*) || ' colonne' as status
FROM information_schema.columns
WHERE table_name = 'control_logs';

-- Controlla indici
SELECT 'Creati ' || COUNT(*) || ' indici' as status
FROM pg_indexes
WHERE tablename = 'control_logs';

-- Controlla views
SELECT 'Creata view: ' || table_name as status
FROM information_schema.views
WHERE table_name IN ('control_summary', 'control_errors');

-- ==========================================
-- FINE SETUP
-- ==========================================
