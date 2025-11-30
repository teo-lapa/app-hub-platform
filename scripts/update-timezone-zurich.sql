-- Aggiorna timezone da Europe/Rome a Europe/Zurich
-- Esegui questo script una sola volta dopo il deploy

-- Ricrea VIEW con timezone Zurich
DROP VIEW IF EXISTS ta_contact_daily_summary CASCADE;

CREATE OR REPLACE VIEW ta_contact_daily_summary AS
SELECT
  contact_id,
  company_id,
  DATE(timestamp AT TIME ZONE 'Europe/Zurich') as work_date,
  MIN(CASE WHEN entry_type = 'clock_in' THEN timestamp END) as first_clock_in,
  MAX(CASE WHEN entry_type = 'clock_out' THEN timestamp END) as last_clock_out,
  COUNT(CASE WHEN entry_type = 'clock_in' THEN 1 END) as clock_in_count,
  COUNT(CASE WHEN entry_type = 'clock_out' THEN 1 END) as clock_out_count,
  COUNT(*) as total_entries
FROM ta_time_entries
GROUP BY contact_id, company_id, DATE(timestamp AT TIME ZONE 'Europe/Zurich');

-- Verifica
SELECT 'VIEW aggiornata con timezone Europe/Zurich' as status;
