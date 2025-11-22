-- ============================================
-- TIME & ATTENDANCE - Database Schema
-- PostgreSQL schema per gestione presenze dipendenti
-- Versione 2.0 - Integrato con Odoo res.partner
-- ============================================

-- ============================================
-- NUOVE TABELLE - Integrazione Odoo
-- ============================================

-- Table: Time Entries con Odoo contact_id
-- Questa è la tabella principale per le timbrature
-- Usa contact_id e company_id da Odoo (res.partner)
CREATE TABLE IF NOT EXISTS ta_time_entries (
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

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_time_entries_contact ON ta_time_entries(contact_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ta_time_entries_company ON ta_time_entries(company_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ta_time_entries_date ON ta_time_entries(DATE(timestamp));

-- Table: GDPR Consent per contatti Odoo
CREATE TABLE IF NOT EXISTS ta_odoo_consents (
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

CREATE INDEX IF NOT EXISTS idx_ta_odoo_consents_contact ON ta_odoo_consents(contact_id);

-- Table: Locations (sedi di lavoro per geofencing)
CREATE TABLE IF NOT EXISTS ta_locations (
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

CREATE INDEX IF NOT EXISTS idx_ta_locations_company ON ta_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_ta_locations_qr ON ta_locations(qr_secret);

-- Aggiorna ta_time_entries per riferimento location
ALTER TABLE ta_time_entries ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES ta_locations(id);

-- View: Riepilogo giornaliero per contatto Odoo
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

-- ============================================
-- LEGACY TABLES - Manteniamo per compatibilità
-- ============================================

-- Table 1: Organizations (aziende clienti - multi-tenant)
CREATE TABLE IF NOT EXISTS ta_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- usato per URL/subdomain
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  logo_url TEXT,

  -- Piano e limiti
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  max_employees INT DEFAULT 5,

  -- Features abilitate
  geofencing_enabled BOOLEAN DEFAULT false,
  auto_clock_enabled BOOLEAN DEFAULT false, -- clock automatico via geofence
  photo_required BOOLEAN DEFAULT false, -- richiedi foto alla timbratura

  -- Impostazioni
  timezone VARCHAR(50) DEFAULT 'Europe/Rome',
  settings JSONB DEFAULT '{}'::jsonb,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_organizations_slug ON ta_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_ta_organizations_active ON ta_organizations(is_active);

-- Table 2: Employees (dipendenti)
CREATE TABLE IF NOT EXISTS ta_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES ta_organizations(id) ON DELETE CASCADE,

  -- Dati personali
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  avatar_url TEXT,

  -- Autenticazione
  password_hash TEXT NOT NULL,
  pin VARCHAR(6), -- PIN per timbratura veloce da kiosk

  -- Ruolo e permessi
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),

  -- Contratto
  hourly_rate DECIMAL(10,2),
  contract_hours_per_week DECIMAL(4,1), -- ore settimanali da contratto

  -- Stato
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,

  -- GDPR Consent
  gps_consent BOOLEAN DEFAULT false,
  gps_consent_at TIMESTAMP,
  notifications_consent BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ta_employees_org ON ta_employees(org_id);
CREATE INDEX IF NOT EXISTS idx_ta_employees_email ON ta_employees(email);
CREATE INDEX IF NOT EXISTS idx_ta_employees_active ON ta_employees(org_id, is_active);

-- Table 3: Work Locations (sedi di lavoro - per geofencing)
CREATE TABLE IF NOT EXISTS ta_work_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES ta_organizations(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  address TEXT,

  -- Coordinate GPS
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  radius_meters INT DEFAULT 100, -- raggio geofence

  -- Impostazioni
  timezone VARCHAR(50) DEFAULT 'Europe/Rome',
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_work_locations_org ON ta_work_locations(org_id);

-- Table 4: Shifts (turni di lavoro template)
CREATE TABLE IF NOT EXISTS ta_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES ta_organizations(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL, -- es: "Mattina", "Pomeriggio", "Sera"
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT DEFAULT 0,

  -- Giorni della settimana (1=Lun, 2=Mar, ..., 7=Dom)
  days_of_week INT[] DEFAULT '{1,2,3,4,5}',

  color VARCHAR(7) DEFAULT '#3B82F6', -- colore per UI
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_shifts_org ON ta_shifts(org_id);

-- Table 5: Employee Shift Assignments (assegnazione turni)
CREATE TABLE IF NOT EXISTS ta_employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES ta_employees(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES ta_shifts(id) ON DELETE CASCADE,
  location_id UUID REFERENCES ta_work_locations(id),

  valid_from DATE NOT NULL,
  valid_to DATE, -- NULL = indefinito

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_employee_shifts_employee ON ta_employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_ta_employee_shifts_dates ON ta_employee_shifts(valid_from, valid_to);

-- Table 6: Time Entries (timbrature - CORE TABLE)
CREATE TABLE IF NOT EXISTS ta_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES ta_organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES ta_employees(id) ON DELETE CASCADE,
  location_id UUID REFERENCES ta_work_locations(id),

  -- Tipo di evento
  entry_type TEXT NOT NULL CHECK (entry_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),

  -- Timestamp della timbratura
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Geolocalizzazione (opzionale)
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  accuracy_meters DECIMAL(6,2),
  is_within_geofence BOOLEAN,

  -- Metodo di timbratura
  clock_method TEXT DEFAULT 'manual' CHECK (clock_method IN ('manual', 'geofence_auto', 'kiosk', 'nfc', 'qr')),
  device_info JSONB DEFAULT '{}'::jsonb, -- user agent, device ID, etc.

  -- Modifiche manuali (audit trail)
  is_edited BOOLEAN DEFAULT false,
  edited_by UUID REFERENCES ta_employees(id),
  edited_at TIMESTAMP,
  edit_reason TEXT,
  original_timestamp TIMESTAMP,

  -- Extra
  note TEXT,
  photo_url TEXT, -- se richiesta foto

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_time_entries_org_employee ON ta_time_entries(org_id, employee_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ta_time_entries_date ON ta_time_entries(DATE(timestamp));
CREATE INDEX IF NOT EXISTS idx_ta_time_entries_type ON ta_time_entries(entry_type);

-- Table 7: Time Entry Requests (richieste correzione/modifica)
CREATE TABLE IF NOT EXISTS ta_time_entry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES ta_organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES ta_employees(id) ON DELETE CASCADE,

  request_type TEXT NOT NULL CHECK (request_type IN ('add_entry', 'edit_entry', 'delete_entry')),
  target_entry_id UUID REFERENCES ta_time_entries(id),

  -- Dati richiesti
  requested_data JSONB NOT NULL, -- {entry_type, timestamp, note, ...}
  reason TEXT NOT NULL,

  -- Stato approvazione
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES ta_employees(id),
  reviewed_at TIMESTAMP,
  review_note TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_time_entry_requests_org ON ta_time_entry_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_ta_time_entry_requests_employee ON ta_time_entry_requests(employee_id);

-- Table 8: GDPR Consent Log (audit trail consensi)
CREATE TABLE IF NOT EXISTS ta_gdpr_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES ta_employees(id) ON DELETE CASCADE,

  consent_type TEXT NOT NULL CHECK (consent_type IN ('gps_tracking', 'auto_clock', 'notifications', 'data_processing')),
  is_granted BOOLEAN NOT NULL,

  granted_at TIMESTAMP,
  revoked_at TIMESTAMP,

  consent_version VARCHAR(10) DEFAULT '1.0',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ta_gdpr_consents_employee ON ta_gdpr_consents(employee_id);

-- ============================================
-- VIEWS
-- ============================================

-- View: Riepilogo giornaliero ore lavorate
CREATE OR REPLACE VIEW ta_daily_work_summary AS
SELECT
  te.org_id,
  te.employee_id,
  e.name as employee_name,
  DATE(te.timestamp AT TIME ZONE 'Europe/Rome') as work_date,
  MIN(CASE WHEN te.entry_type = 'clock_in' THEN te.timestamp END) as first_clock_in,
  MAX(CASE WHEN te.entry_type = 'clock_out' THEN te.timestamp END) as last_clock_out,
  COUNT(CASE WHEN te.entry_type = 'clock_in' THEN 1 END) as clock_in_count,
  COUNT(CASE WHEN te.entry_type = 'clock_out' THEN 1 END) as clock_out_count
FROM ta_time_entries te
JOIN ta_employees e ON e.id = te.employee_id
GROUP BY te.org_id, te.employee_id, e.name, DATE(te.timestamp AT TIME ZONE 'Europe/Rome');

-- View: Dipendenti attualmente in servizio
CREATE OR REPLACE VIEW ta_employees_on_duty AS
WITH latest_entries AS (
  SELECT DISTINCT ON (employee_id)
    employee_id,
    entry_type,
    timestamp,
    location_id
  FROM ta_time_entries
  WHERE timestamp >= NOW() - INTERVAL '24 hours'
  ORDER BY employee_id, timestamp DESC
)
SELECT
  e.id as employee_id,
  e.org_id,
  e.name,
  e.avatar_url,
  le.entry_type as last_entry_type,
  le.timestamp as last_entry_time,
  CASE WHEN le.entry_type = 'clock_in' THEN true ELSE false END as is_on_duty,
  wl.name as location_name
FROM ta_employees e
LEFT JOIN latest_entries le ON le.employee_id = e.id
LEFT JOIN ta_work_locations wl ON wl.id = le.location_id
WHERE e.is_active = true;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger per auto-update updated_at
CREATE OR REPLACE FUNCTION ta_update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ta_organizations_updated_at
  BEFORE UPDATE ON ta_organizations
  FOR EACH ROW EXECUTE FUNCTION ta_update_updated_at_column();

CREATE TRIGGER update_ta_employees_updated_at
  BEFORE UPDATE ON ta_employees
  FOR EACH ROW EXECUTE FUNCTION ta_update_updated_at_column();

CREATE TRIGGER update_ta_work_locations_updated_at
  BEFORE UPDATE ON ta_work_locations
  FOR EACH ROW EXECUTE FUNCTION ta_update_updated_at_column();

CREATE TRIGGER update_ta_shifts_updated_at
  BEFORE UPDATE ON ta_shifts
  FOR EACH ROW EXECUTE FUNCTION ta_update_updated_at_column();
