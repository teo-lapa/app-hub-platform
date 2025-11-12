-- ============================================================================
-- DATABASE SCHEMA: Pre-Order Customer Assignments
-- ============================================================================
-- Tabella per gestire le assegnazioni di clienti ai prodotti in pre-ordine
-- Usata dall'API /api/smart-ordering-v2/pre-orders-summary
-- ============================================================================

-- Drop tabella se esiste (solo per testing/reset)
-- DROP TABLE IF EXISTS preorder_customer_assignments;

-- Crea tabella principale
CREATE TABLE IF NOT EXISTS preorder_customer_assignments (
  -- Primary key auto-incrementale
  id SERIAL PRIMARY KEY,

  -- ID prodotto da Odoo (product.product)
  product_id INTEGER NOT NULL,

  -- ID cliente da Odoo (res.partner)
  customer_id INTEGER NOT NULL,

  -- Quantità prenotata dal cliente
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),

  -- Note opzionali (es. "Urgente", "Da confermare", etc.)
  notes TEXT,

  -- Timestamp creazione record
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Timestamp ultimo aggiornamento
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraint: Un cliente può avere solo UNA assegnazione per prodotto
  UNIQUE(product_id, customer_id)
);

-- ============================================================================
-- INDICI per performance
-- ============================================================================

-- Indice su product_id (query più frequenti)
CREATE INDEX IF NOT EXISTS idx_preorder_assignments_product
ON preorder_customer_assignments(product_id);

-- Indice su customer_id (ricerche per cliente)
CREATE INDEX IF NOT EXISTS idx_preorder_assignments_customer
ON preorder_customer_assignments(customer_id);

-- Indice composito product_id + customer_id (lookup veloce)
CREATE INDEX IF NOT EXISTS idx_preorder_assignments_product_customer
ON preorder_customer_assignments(product_id, customer_id);

-- Indice su created_at (ordinamenti temporali)
CREATE INDEX IF NOT EXISTS idx_preorder_assignments_created
ON preorder_customer_assignments(created_at DESC);

-- ============================================================================
-- TRIGGERS per updated_at automatico
-- ============================================================================

-- Function per aggiornare timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger su UPDATE
DROP TRIGGER IF EXISTS update_preorder_assignments_updated_at ON preorder_customer_assignments;
CREATE TRIGGER update_preorder_assignments_updated_at
  BEFORE UPDATE ON preorder_customer_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS utili
-- ============================================================================

-- View: Statistiche per prodotto
CREATE OR REPLACE VIEW preorder_product_stats AS
SELECT
  product_id,
  COUNT(DISTINCT customer_id) AS customer_count,
  SUM(quantity) AS total_quantity,
  AVG(quantity) AS avg_quantity,
  MIN(quantity) AS min_quantity,
  MAX(quantity) AS max_quantity,
  MIN(created_at) AS first_assignment,
  MAX(created_at) AS last_assignment
FROM preorder_customer_assignments
GROUP BY product_id;

-- View: Statistiche per cliente
CREATE OR REPLACE VIEW preorder_customer_stats AS
SELECT
  customer_id,
  COUNT(DISTINCT product_id) AS product_count,
  SUM(quantity) AS total_quantity,
  MIN(created_at) AS first_assignment,
  MAX(created_at) AS last_assignment
FROM preorder_customer_assignments
GROUP BY customer_id;

-- View: Assegnazioni recenti (ultimi 30 giorni)
CREATE OR REPLACE VIEW preorder_recent_assignments AS
SELECT *
FROM preorder_customer_assignments
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY created_at DESC;

-- ============================================================================
-- ESEMPI DI DATI (per testing)
-- ============================================================================

-- Esempio: Inserimento manuale
-- INSERT INTO preorder_customer_assignments (product_id, customer_id, quantity, notes)
-- VALUES
--   (12345, 789, 10.00, 'Cliente premium - urgente'),
--   (12345, 790, 5.00, NULL),
--   (12346, 789, 20.00, 'Da confermare'),
--   (12347, 791, 15.50, NULL);

-- ============================================================================
-- QUERY UTILI
-- ============================================================================

-- 1. Totale assegnazioni per prodotto
-- SELECT
--   product_id,
--   COUNT(*) AS assignments,
--   SUM(quantity) AS total_quantity
-- FROM preorder_customer_assignments
-- GROUP BY product_id
-- ORDER BY total_quantity DESC;

-- 2. Clienti con più assegnazioni
-- SELECT
--   customer_id,
--   COUNT(*) AS products_count,
--   SUM(quantity) AS total_quantity
-- FROM preorder_customer_assignments
-- GROUP BY customer_id
-- ORDER BY products_count DESC;

-- 3. Assegnazioni recenti (ultimi 7 giorni)
-- SELECT *
-- FROM preorder_customer_assignments
-- WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
-- ORDER BY created_at DESC;

-- 4. Prodotti con più di 5 clienti
-- SELECT product_id, COUNT(DISTINCT customer_id) AS customer_count
-- FROM preorder_customer_assignments
-- GROUP BY product_id
-- HAVING COUNT(DISTINCT customer_id) > 5
-- ORDER BY customer_count DESC;

-- 5. Cancellazione assegnazioni per prodotto
-- DELETE FROM preorder_customer_assignments WHERE product_id = 12345;

-- 6. Cancellazione assegnazioni per cliente
-- DELETE FROM preorder_customer_assignments WHERE customer_id = 789;

-- 7. Aggiornamento quantità
-- UPDATE preorder_customer_assignments
-- SET quantity = 20.00, notes = 'Quantità aggiornata'
-- WHERE product_id = 12345 AND customer_id = 789;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Vacuum per ottimizzare performance
-- VACUUM ANALYZE preorder_customer_assignments;

-- Rebuild indici se necessario
-- REINDEX TABLE preorder_customer_assignments;

-- Check dimensione tabella
-- SELECT
--   pg_size_pretty(pg_total_relation_size('preorder_customer_assignments')) AS total_size,
--   pg_size_pretty(pg_relation_size('preorder_customer_assignments')) AS table_size,
--   pg_size_pretty(pg_total_relation_size('preorder_customer_assignments') - pg_relation_size('preorder_customer_assignments')) AS indexes_size;

-- Check numero record
-- SELECT COUNT(*) FROM preorder_customer_assignments;

-- ============================================================================
-- BACKUP & RESTORE
-- ============================================================================

-- Export dati in CSV
-- COPY preorder_customer_assignments TO '/tmp/preorder_backup.csv' CSV HEADER;

-- Import dati da CSV
-- COPY preorder_customer_assignments(product_id, customer_id, quantity, notes)
-- FROM '/tmp/preorder_backup.csv' CSV HEADER;

-- ============================================================================
-- PERMISSIONS (se necessario)
-- ============================================================================

-- Grant permessi a utente specifico
-- GRANT SELECT, INSERT, UPDATE, DELETE ON preorder_customer_assignments TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE preorder_customer_assignments_id_seq TO your_app_user;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. La constraint UNIQUE(product_id, customer_id) previene duplicati
-- 2. Il CHECK quantity > 0 assicura quantità valide
-- 3. Gli indici migliorano performance per query frequenti
-- 4. Le views forniscono statistiche pre-calcolate
-- 5. Il trigger updated_at aggiorna automaticamente il timestamp
-- ============================================================================

-- Fine schema
