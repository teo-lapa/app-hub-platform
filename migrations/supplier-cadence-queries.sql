-- ============================================================================
-- SUPPLIER ORDER CADENCE - USEFUL SQL QUERIES
-- ============================================================================
--
-- Collezione di query SQL utili per debugging, monitoring e manutenzione
-- del sistema di cadenze ordini fornitori.
--
-- Categorie:
-- 1. Monitoring & Analytics
-- 2. Data Exploration
-- 3. Maintenance & Cleanup
-- 4. Performance Analysis
-- 5. Testing & Validation
--
-- ============================================================================

-- ============================================================================
-- 1. MONITORING & ANALYTICS
-- ============================================================================

-- Vista generale: Fornitori da ordinare oggi con dettagli
SELECT
  soc.supplier_id,
  soc.supplier_name,
  soc.cadence_type,
  soc.next_order_date,
  soc.last_order_date,
  CURRENT_DATE - soc.last_order_date as days_since_last,
  CURRENT_DATE - soc.next_order_date as days_overdue,
  soc.average_lead_time_days
FROM supplier_order_cadence soc
WHERE soc.is_active = true
  AND soc.next_order_date <= CURRENT_DATE
ORDER BY soc.next_order_date ASC;

-- Statistiche generali cadenze
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  COUNT(*) FILTER (WHERE is_active = false) as inactive,
  COUNT(*) FILTER (WHERE is_active = true AND next_order_date <= CURRENT_DATE) as due_today,
  COUNT(*) FILTER (WHERE is_active = true AND next_order_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as due_this_week,
  COUNT(*) FILTER (WHERE is_active = true AND next_order_date < CURRENT_DATE) as overdue
FROM supplier_order_cadence;

-- Breakdown per tipo cadenza
SELECT
  cadence_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  AVG(calculated_cadence_days) as avg_cadence_days,
  AVG(average_lead_time_days) as avg_lead_time
FROM supplier_order_cadence
GROUP BY cadence_type
ORDER BY total DESC;

-- Top 10 fornitori per frequenza ordini (cadenza più corta)
SELECT
  supplier_name,
  cadence_type,
  cadence_value,
  calculated_cadence_days,
  last_order_date,
  next_order_date
FROM supplier_order_cadence
WHERE is_active = true
  AND calculated_cadence_days IS NOT NULL
ORDER BY calculated_cadence_days ASC
LIMIT 10;

-- Fornitori con cadenza pianificata vs reale divergente
-- (pianificato vs effettivo hanno differenza > 20%)
SELECT
  supplier_name,
  cadence_type,
  cadence_value as planned_days,
  calculated_cadence_days as actual_days,
  ROUND(
    ABS(cadence_value - calculated_cadence_days) / NULLIF(cadence_value, 0)::DECIMAL * 100,
    2
  ) as divergence_pct
FROM supplier_order_cadence
WHERE is_active = true
  AND cadence_type = 'fixed_days'
  AND calculated_cadence_days IS NOT NULL
  AND ABS(cadence_value - calculated_cadence_days) / NULLIF(cadence_value, 0)::DECIMAL > 0.2
ORDER BY divergence_pct DESC;

-- ============================================================================
-- 2. DATA EXPLORATION
-- ============================================================================

-- Tutti i fornitori con cadenza attiva
SELECT
  id,
  supplier_id,
  supplier_name,
  cadence_type,
  CASE
    WHEN cadence_type = 'fixed_days' THEN CONCAT('Ogni ', cadence_value, ' giorni')
    WHEN cadence_type = 'weekly' THEN CONCAT('Settimanale: ', weekdays::TEXT)
    WHEN cadence_type = 'biweekly' THEN CONCAT('Bisettimanale: ', weekdays::TEXT)
    WHEN cadence_type = 'monthly' THEN CONCAT('Giorno ', cadence_value, ' del mese')
  END as cadence_description,
  next_order_date,
  last_order_date,
  is_active
FROM supplier_order_cadence
WHERE is_active = true
ORDER BY next_order_date ASC NULLS LAST;

-- Fornitori senza ordini recenti (last_order_date > 90 giorni fa)
SELECT
  supplier_name,
  last_order_date,
  CURRENT_DATE - last_order_date as days_since_last_order,
  next_order_date,
  is_active
FROM supplier_order_cadence
WHERE last_order_date < CURRENT_DATE - INTERVAL '90 days'
  OR last_order_date IS NULL
ORDER BY last_order_date ASC NULLS LAST;

-- Fornitori con cadenza settimanale/bisettimanale e loro giorni
SELECT
  supplier_name,
  cadence_type,
  weekdays,
  jsonb_array_length(weekdays) as num_days_per_week,
  next_order_date
FROM supplier_order_cadence
WHERE cadence_type IN ('weekly', 'biweekly')
  AND is_active = true
ORDER BY supplier_name;

-- Storico modifiche per un fornitore specifico
SELECT
  h.id,
  h.changed_at,
  h.changed_by,
  h.change_reason,
  h.previous_cadence_type,
  h.new_cadence_type,
  h.previous_cadence_value,
  h.new_cadence_value,
  h.previous_next_order_date,
  h.new_next_order_date
FROM supplier_order_cadence_history h
JOIN supplier_order_cadence c ON c.id = h.cadence_id
WHERE c.supplier_id = 123 -- REPLACE con supplier_id reale
ORDER BY h.changed_at DESC;

-- ============================================================================
-- 3. MAINTENANCE & CLEANUP
-- ============================================================================

-- Trova cadenze duplicate (non dovrebbero esistere per UNIQUE constraint)
SELECT
  supplier_id,
  COUNT(*) as count
FROM supplier_order_cadence
GROUP BY supplier_id
HAVING COUNT(*) > 1;

-- Trova cadenze con configurazione invalida
SELECT
  id,
  supplier_name,
  cadence_type,
  cadence_value,
  weekdays,
  CASE
    WHEN cadence_type = 'fixed_days' AND (cadence_value IS NULL OR cadence_value < 1) THEN 'Missing/invalid cadence_value'
    WHEN cadence_type IN ('weekly', 'biweekly') AND (weekdays IS NULL OR jsonb_array_length(weekdays) = 0) THEN 'Missing weekdays'
    WHEN cadence_type = 'monthly' AND (cadence_value IS NULL OR cadence_value < 1 OR cadence_value > 31) THEN 'Invalid monthly day'
    ELSE 'Unknown error'
  END as validation_error
FROM supplier_order_cadence
WHERE
  (cadence_type = 'fixed_days' AND (cadence_value IS NULL OR cadence_value < 1))
  OR (cadence_type IN ('weekly', 'biweekly') AND (weekdays IS NULL OR jsonb_array_length(weekdays) = 0))
  OR (cadence_type = 'monthly' AND (cadence_value IS NULL OR cadence_value < 1 OR cadence_value > 31));

-- Trova cadenze attive senza next_order_date (invalid state)
SELECT
  id,
  supplier_name,
  cadence_type,
  is_active,
  next_order_date
FROM supplier_order_cadence
WHERE is_active = true
  AND next_order_date IS NULL;

-- Disattiva cadenze senza ordini da >180 giorni
UPDATE supplier_order_cadence
SET is_active = false,
    updated_at = NOW(),
    updated_by = 'auto_cleanup'
WHERE is_active = true
  AND (
    last_order_date < CURRENT_DATE - INTERVAL '180 days'
    OR (last_order_date IS NULL AND created_at < NOW() - INTERVAL '180 days')
  );
-- NOTA: Decommentare solo dopo verifica manuale!

-- Pulisci storico modifiche vecchio (> 2 anni)
DELETE FROM supplier_order_cadence_history
WHERE changed_at < NOW() - INTERVAL '2 years';
-- NOTA: Esegui con cautela, backup consigliato!

-- ============================================================================
-- 4. PERFORMANCE ANALYSIS
-- ============================================================================

-- Verifica utilizzo indici (PostgreSQL)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'supplier_order_cadence'
ORDER BY idx_scan DESC;

-- Query plan per query frequenti
EXPLAIN ANALYZE
SELECT * FROM supplier_order_cadence
WHERE supplier_id = 123;
-- Dovrebbe usare idx_supplier_cadence_supplier (Index Scan)

EXPLAIN ANALYZE
SELECT * FROM suppliers_to_order_today;
-- Dovrebbe usare idx_supplier_cadence_next_order (Index Scan su partial index)

-- Table size e index sizes
SELECT
  pg_size_pretty(pg_total_relation_size('supplier_order_cadence')) as total_size,
  pg_size_pretty(pg_relation_size('supplier_order_cadence')) as table_size,
  pg_size_pretty(pg_total_relation_size('supplier_order_cadence') - pg_relation_size('supplier_order_cadence')) as indexes_size;

-- Slow queries correlate (se pg_stat_statements è abilitato)
SELECT
  substring(query, 1, 100) as short_query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%supplier_order_cadence%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- ============================================================================
-- 5. TESTING & VALIDATION
-- ============================================================================

-- Test INSERT: Crea cadenza di test
INSERT INTO supplier_order_cadence (
  supplier_id,
  supplier_name,
  cadence_type,
  cadence_value,
  next_order_date,
  updated_by
) VALUES (
  999999, -- ID fornitore test
  'TEST SUPPLIER - DELETE ME',
  'fixed_days',
  7,
  CURRENT_DATE + INTERVAL '3 days',
  'test_user'
) RETURNING *;

-- Test UPDATE: Modifica cadenza di test
UPDATE supplier_order_cadence
SET cadence_value = 14,
    next_order_date = CURRENT_DATE + INTERVAL '7 days'
WHERE supplier_id = 999999
RETURNING *;

-- Test VIEW: Verifica view funzionanti
SELECT * FROM suppliers_to_order_today LIMIT 5;
SELECT * FROM upcoming_supplier_orders LIMIT 5;

-- Test FUNCTION: Calcola prossima data ordine
SELECT calculate_next_order_date(
  'fixed_days',    -- cadence_type
  7,               -- cadence_value
  NULL,            -- weekdays
  CURRENT_DATE     -- last_order_date
) as next_order_date;

SELECT calculate_next_order_date(
  'monthly',
  15,              -- Giorno 15 del mese
  NULL,
  CURRENT_DATE
) as next_order_date;

-- Cleanup test data
DELETE FROM supplier_order_cadence
WHERE supplier_id = 999999;

-- ============================================================================
-- 6. REPORTING QUERIES
-- ============================================================================

-- Report: Ordini pianificati per settimana (prossimi 30 giorni)
SELECT
  DATE_TRUNC('week', next_order_date)::DATE as week_start,
  COUNT(*) as num_orders,
  STRING_AGG(supplier_name, ', ' ORDER BY supplier_name) as suppliers
FROM supplier_order_cadence
WHERE is_active = true
  AND next_order_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', next_order_date)
ORDER BY week_start ASC;

-- Report: Lead time medio per tipo cadenza
SELECT
  cadence_type,
  COUNT(*) as num_suppliers,
  ROUND(AVG(average_lead_time_days)::NUMERIC, 2) as avg_lead_time,
  MIN(average_lead_time_days) as min_lead_time,
  MAX(average_lead_time_days) as max_lead_time
FROM supplier_order_cadence
WHERE is_active = true
  AND average_lead_time_days > 0
GROUP BY cadence_type
ORDER BY avg_lead_time DESC;

-- Report: Fornitori con ordini più frequenti (top 20)
SELECT
  supplier_name,
  cadence_type,
  calculated_cadence_days,
  total_orders_last_6m,
  ROUND(180.0 / NULLIF(calculated_cadence_days, 0), 1) as projected_orders_6m
FROM supplier_order_cadence
WHERE is_active = true
  AND calculated_cadence_days IS NOT NULL
  AND calculated_cadence_days > 0
ORDER BY calculated_cadence_days ASC
LIMIT 20;

-- Report: Compliance cadenza pianificata (% ordini on-time)
-- TODO: Richiede integrazione con purchase.order Odoo per dati reali
SELECT
  supplier_name,
  cadence_type,
  cadence_value as planned_days,
  calculated_cadence_days as actual_days,
  total_orders_last_6m,
  CASE
    WHEN calculated_cadence_days IS NULL THEN 'N/A'
    WHEN ABS(cadence_value - calculated_cadence_days) / NULLIF(cadence_value, 0)::DECIMAL < 0.1 THEN 'Excellent (<10%)'
    WHEN ABS(cadence_value - calculated_cadence_days) / NULLIF(cadence_value, 0)::DECIMAL < 0.2 THEN 'Good (<20%)'
    ELSE 'Needs Review (>20%)'
  END as compliance_rating
FROM supplier_order_cadence
WHERE is_active = true
  AND cadence_type = 'fixed_days'
  AND calculated_cadence_days IS NOT NULL
ORDER BY
  CASE
    WHEN calculated_cadence_days IS NULL THEN 999
    ELSE ABS(cadence_value - calculated_cadence_days) / NULLIF(cadence_value, 0)::DECIMAL
  END DESC;

-- ============================================================================
-- 7. BACKUP & EXPORT
-- ============================================================================

-- Export configurazioni cadenze (per backup o migration)
COPY (
  SELECT
    supplier_id,
    supplier_name,
    cadence_type,
    cadence_value,
    weekdays,
    is_active,
    next_order_date,
    last_order_date,
    average_lead_time_days,
    notes
  FROM supplier_order_cadence
  WHERE is_active = true
) TO '/tmp/supplier_cadences_backup.csv' WITH CSV HEADER;
-- NOTA: Adatta path per Windows se necessario

-- ============================================================================
-- END OF QUERIES
-- ============================================================================
