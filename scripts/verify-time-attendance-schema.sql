-- ============================================
-- VERIFICA SCHEMA TIME & ATTENDANCE
-- ============================================
-- Esegui questo script per verificare quale schema hai nel database

-- 1. Controlla se la tabella ta_time_entries esiste
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = 'ta_time_entries'
    ) THEN '✅ Tabella ta_time_entries ESISTE'
    ELSE '❌ Tabella ta_time_entries NON ESISTE'
  END as tabella_status;

-- 2. Mostra le colonne della tabella ta_time_entries
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'ta_time_entries'
ORDER BY ordinal_position;

-- 3. Verifica quale schema hai (Odoo o Legacy)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'ta_time_entries'
      AND column_name = 'contact_id'
    ) THEN '✅ SCHEMA ODOO CORRETTO (contact_id presente)'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'ta_time_entries'
      AND column_name = 'employee_id'
    ) THEN '❌ SCHEMA LEGACY ERRATO (employee_id presente) - DEVI RICREARE!'
    ELSE '⚠️ Tabella non trovata o schema sconosciuto'
  END as schema_check;

-- 4. Conta quanti record hai (per sicurezza prima di DROP)
SELECT
  COUNT(*) as numero_timbrature_salvate,
  CASE
    WHEN COUNT(*) > 0 THEN '⚠️ HAI DATI! Fai backup prima di DROP TABLE'
    ELSE '✅ Tabella vuota, safe to DROP'
  END as backup_warning
FROM ta_time_entries;

-- 5. Verifica tabelle correlate
SELECT
  table_name,
  CASE
    WHEN table_name = 'ta_locations' THEN '✅ Necessaria per QR e geofencing'
    WHEN table_name = 'ta_odoo_consents' THEN '✅ Necessaria per GDPR'
    ELSE '✅ Presente'
  END as descrizione
FROM information_schema.tables
WHERE table_name IN ('ta_locations', 'ta_odoo_consents', 'ta_employees', 'ta_organizations')
ORDER BY table_name;
