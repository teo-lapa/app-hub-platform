-- Control Logs Database Schema
-- Schema per tracciare i controlli qualità dei prelievi

-- Table: Control Logs (controlli effettuati)
CREATE TABLE IF NOT EXISTS control_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Riferimenti Odoo
  batch_id INTEGER NOT NULL,
  batch_name TEXT NOT NULL,
  zone_id TEXT NOT NULL, -- 'secco', 'frigo', 'pingu', 'secco_sopra'
  zone_name TEXT NOT NULL,

  -- Prodotto
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  qty_requested DECIMAL(10, 2) NOT NULL,
  qty_picked DECIMAL(10, 2) NOT NULL,

  -- Stato controllo
  status TEXT NOT NULL CHECK (status IN ('ok', 'error_qty', 'missing', 'damaged', 'lot_error', 'location_error', 'note')),
  note TEXT, -- Dettagli del problema o nota generica

  -- Chi ha controllato
  controlled_by_user_id INTEGER NOT NULL, -- ID utente Odoo
  controlled_by_name TEXT NOT NULL,
  controlled_at TIMESTAMP DEFAULT NOW(),

  -- Metadata batch (per context)
  driver_name TEXT,
  vehicle_name TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_control_logs_batch ON control_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_zone ON control_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_product ON control_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_status ON control_logs(status);
CREATE INDEX IF NOT EXISTS idx_control_logs_user ON control_logs(controlled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_control_logs_date ON control_logs(controlled_at DESC);

-- Index composto per recupero veloce controlli per batch+zona
CREATE INDEX IF NOT EXISTS idx_control_logs_batch_zone ON control_logs(batch_id, zone_id);

-- View: Control Summary (riepilogo controlli per batch)
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
ORDER BY controlled_at DESC;

-- View: Error Details (solo i prodotti con errori)
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
