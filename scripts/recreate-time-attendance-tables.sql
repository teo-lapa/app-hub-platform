-- ============================================
-- RICREA TABELLE TIME & ATTENDANCE
-- ============================================
-- ⚠️ ATTENZIONE: Questo script CANCELLA i dati esistenti!
-- Esegui solo se:
-- 1. Hai verificato con verify-time-attendance-schema.sql che lo schema è errato
-- 2. Hai fatto backup dei dati (se necessario)
-- 3. Sei sicuro di voler procedere

-- STEP 1: Drop tabelle nell'ordine corretto (rispettando foreign keys)
DROP TABLE IF EXISTS ta_time_entries CASCADE;
DROP TABLE IF EXISTS ta_odoo_consents CASCADE;
DROP TABLE IF EXISTS ta_locations CASCADE;

-- STEP 2: Ricrea tabella ta_time_entries (versione Odoo corretta)
CREATE TABLE ta_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Riferimenti Odoo
  contact_id INTEGER NOT NULL, -- res.partner.id del dipendente
  company_id INTEGER, -- res.partner.id dell'azienda (parent_id)

  -- Tipo di evento
  entry_type TEXT NOT NULL CHECK (entry_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),

  -- Timestamp della timbratura
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Geolocalizzazione
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),

  -- Verifica QR Code (sicurezza)
  qr_code_verified BOOLEAN DEFAULT false,

  -- Nome location (opzionale)
  location_name TEXT,

  -- Extra
  note TEXT,

  -- Tipo di pausa (per break_start/break_end)
  break_type TEXT CHECK (break_type IS NULL OR break_type IN ('coffee_break', 'lunch_break')),
  break_max_minutes INTEGER, -- durata massima consentita in minuti

  -- Nome contatto salvato localmente per export (evita lookup Odoo)
  contact_name TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_ta_time_entries_contact ON ta_time_entries(contact_id, timestamp DESC);
CREATE INDEX idx_ta_time_entries_company ON ta_time_entries(company_id, timestamp DESC);
CREATE INDEX idx_ta_time_entries_date ON ta_time_entries(DATE(timestamp));

-- STEP 3: Ricrea tabella ta_locations
CREATE TABLE ta_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id INTEGER NOT NULL, -- res.partner.id dell'azienda

  -- Info sede
  name VARCHAR(255) NOT NULL,
  address TEXT,

  -- Coordinate GPS per geofencing
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  radius_meters INTEGER DEFAULT 100, -- raggio geofence in metri

  -- Codice segreto per QR Code
  qr_secret VARCHAR(64) NOT NULL UNIQUE,

  -- Stato
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ta_locations_company ON ta_locations(company_id);
CREATE INDEX idx_ta_locations_qr ON ta_locations(qr_secret);

-- STEP 4: Aggiungi foreign key location_id a ta_time_entries
ALTER TABLE ta_time_entries ADD COLUMN location_id UUID REFERENCES ta_locations(id);

-- STEP 5: Ricrea tabella GDPR consents
CREATE TABLE ta_odoo_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id INTEGER NOT NULL, -- res.partner.id

  consent_type TEXT NOT NULL CHECK (consent_type IN ('gps_tracking', 'data_processing', 'privacy_policy')),
  is_granted BOOLEAN NOT NULL,

  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,

  consent_version VARCHAR(10) DEFAULT '1.0',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ta_odoo_consents_contact ON ta_odoo_consents(contact_id);

-- STEP 6: Ricrea view per riepilogo giornaliero
CREATE OR REPLACE VIEW ta_contact_daily_summary AS
SELECT
  contact_id,
  company_id,
  DATE(timestamp AT TIME ZONE 'Europe/Rome') as work_date,
  MIN(CASE WHEN entry_type = 'clock_in' THEN timestamp END) as first_clock_in,
  MAX(CASE WHEN entry_type = 'clock_out' THEN timestamp END) as last_clock_out,
  COUNT(CASE WHEN entry_type = 'clock_in' THEN 1 END) as clock_in_count,
  COUNT(CASE WHEN entry_type = 'clock_out' THEN 1 END) as clock_out_count,
  COUNT(*) as total_entries
FROM ta_time_entries
GROUP BY contact_id, company_id, DATE(timestamp AT TIME ZONE 'Europe/Rome');

-- ✅ FATTO! Schema ricreato con successo
SELECT '✅ Schema Time & Attendance ricreato con successo!' as status;
