-- ============================================================================
-- MIGRATION: Crea tabella supplier_order_cadence
-- ============================================================================
--
-- Sistema di pianificazione ordini ricorrenti ai fornitori.
-- Permette di configurare cadenze automatiche e tracciare prossimi ordini previsti.
--
-- Performance considerations:
-- - Indici ottimizzati per query frequenti (next_order_date, supplier_id)
-- - Partial index su is_active per ridurre index size
-- - JSONB per weekdays (flessibile ma con operatori GIN se necessario in futuro)
-- - Trigger per auto-update di updated_at
--
-- ============================================================================

-- Tabella principale per cadenze ordini fornitori
CREATE TABLE IF NOT EXISTS supplier_order_cadence (
  id SERIAL PRIMARY KEY,

  -- Identificazione fornitore (da Odoo res.partner)
  supplier_id INTEGER NOT NULL UNIQUE, -- UNIQUE: una sola cadenza per fornitore
  supplier_name VARCHAR(255) NOT NULL,

  -- Configurazione cadenza
  -- Tipi supportati:
  --   'fixed_days': ordine ogni N giorni (cadence_value)
  --   'weekly': ordine settimanale (weekdays specifici)
  --   'biweekly': ordine ogni 2 settimane (weekdays specifici)
  --   'monthly': ordine mensile (giorno fisso del mese in cadence_value)
  cadence_type VARCHAR(50) NOT NULL CHECK (
    cadence_type IN ('fixed_days', 'weekly', 'biweekly', 'monthly')
  ),

  -- Valore numerico cadenza (semantica dipende da cadence_type)
  -- fixed_days: numero giorni tra ordini (es: 3, 7, 15, 30)
  -- monthly: giorno del mese (1-31)
  -- weekly/biweekly: non usato (usa weekdays)
  cadence_value INTEGER,

  -- Giorni settimana per ordini (JSON array)
  -- Esempio: ["Monday", "Thursday"] oppure [1, 4] (0=Domenica, 6=Sabato)
  -- Usato solo per cadence_type: 'weekly', 'biweekly'
  weekdays JSONB DEFAULT NULL,

  -- Pianificazione e tracking
  is_active BOOLEAN DEFAULT true NOT NULL,
  next_order_date DATE, -- Prossimo ordine previsto
  last_order_date DATE, -- Ultimo ordine effettuato

  -- Statistiche e metadata (calcolate da Odoo o analytics)
  average_lead_time_days INTEGER DEFAULT 0, -- Lead time medio fornitore
  total_orders_last_6m INTEGER DEFAULT 0, -- Numero ordini ultimi 6 mesi
  calculated_cadence_days DECIMAL(5,2), -- Cadenza reale calcolata da storico

  -- Note e configurazione aggiuntiva
  notes TEXT, -- Note libere sulla cadenza

  -- Audit trail
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_by VARCHAR(100) -- Username/ID utente che ha modificato
);

-- ============================================================================
-- INDICI OTTIMIZZATI PER PERFORMANCE
-- ============================================================================

-- Index primario per lookup veloce per supplier_id
-- Query tipo: "SELECT * FROM supplier_order_cadence WHERE supplier_id = ?"
CREATE INDEX IF NOT EXISTS idx_supplier_cadence_supplier
ON supplier_order_cadence(supplier_id);

-- Partial index per query su prossimi ordini attivi
-- Query tipo: "SELECT * FROM supplier_order_cadence WHERE is_active = true AND next_order_date <= ?"
-- Partial index riduce size (solo record attivi) e migliora performance
CREATE INDEX IF NOT EXISTS idx_supplier_cadence_next_order
ON supplier_order_cadence(next_order_date)
WHERE is_active = true;

-- Index per query range su next_order_date
-- Query tipo: "SELECT * FROM supplier_order_cadence WHERE next_order_date BETWEEN ? AND ?"
CREATE INDEX IF NOT EXISTS idx_supplier_cadence_active_next_order
ON supplier_order_cadence(is_active, next_order_date)
WHERE is_active = true;

-- Index per ricerca full-text su supplier_name (opzionale, se necessario)
-- Decommentare se serve ricerca testuale veloce
-- CREATE INDEX IF NOT EXISTS idx_supplier_cadence_name_gin
-- ON supplier_order_cadence USING gin(to_tsvector('italian', supplier_name));

-- ============================================================================
-- TRIGGER PER AUTO-UPDATE DI updated_at
-- ============================================================================

-- Riusa funzione esistente o crea se non esiste
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger per auto-update updated_at su UPDATE
CREATE TRIGGER update_supplier_cadence_updated_at
BEFORE UPDATE ON supplier_order_cadence
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABELLA STORICO MODIFICHE CADENZA (opzionale ma raccomandato)
-- ============================================================================

-- Storico modifiche cadenza per audit e analytics
CREATE TABLE IF NOT EXISTS supplier_order_cadence_history (
  id SERIAL PRIMARY KEY,
  cadence_id INTEGER NOT NULL REFERENCES supplier_order_cadence(id) ON DELETE CASCADE,

  -- Snapshot configurazione precedente
  previous_cadence_type VARCHAR(50),
  previous_cadence_value INTEGER,
  previous_weekdays JSONB,
  previous_next_order_date DATE,

  -- Nuova configurazione
  new_cadence_type VARCHAR(50),
  new_cadence_value INTEGER,
  new_weekdays JSONB,
  new_next_order_date DATE,

  -- Motivo modifica
  change_reason TEXT,

  -- Audit
  changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  changed_by VARCHAR(100)
);

-- Index per query storico per cadence_id
CREATE INDEX IF NOT EXISTS idx_cadence_history_cadence
ON supplier_order_cadence_history(cadence_id, changed_at DESC);

-- ============================================================================
-- VIEW: Fornitori da ordinare oggi
-- ============================================================================

-- View ottimizzata per dashboard "ordini da fare oggi"
CREATE OR REPLACE VIEW suppliers_to_order_today AS
SELECT
  soc.id,
  soc.supplier_id,
  soc.supplier_name,
  soc.cadence_type,
  soc.next_order_date,
  soc.last_order_date,
  soc.average_lead_time_days,
  -- Calcola giorni dall'ultimo ordine
  COALESCE(CURRENT_DATE - soc.last_order_date, 0) as days_since_last_order,
  -- Calcola giorni in ritardo (negativo = in anticipo)
  CASE
    WHEN soc.next_order_date < CURRENT_DATE THEN CURRENT_DATE - soc.next_order_date
    ELSE 0
  END as days_overdue
FROM supplier_order_cadence soc
WHERE soc.is_active = true
  AND soc.next_order_date <= CURRENT_DATE
ORDER BY soc.next_order_date ASC;

-- ============================================================================
-- VIEW: Prossimi ordini pianificati (prossimi 30 giorni)
-- ============================================================================

CREATE OR REPLACE VIEW upcoming_supplier_orders AS
SELECT
  soc.id,
  soc.supplier_id,
  soc.supplier_name,
  soc.cadence_type,
  soc.cadence_value,
  soc.next_order_date,
  soc.last_order_date,
  soc.average_lead_time_days,
  -- Calcola giorni rimanenti
  soc.next_order_date - CURRENT_DATE as days_until_order,
  -- Suggerisci data ordine considerando lead time
  soc.next_order_date - (soc.average_lead_time_days * INTERVAL '1 day') as suggested_order_date
FROM supplier_order_cadence soc
WHERE soc.is_active = true
  AND soc.next_order_date > CURRENT_DATE
  AND soc.next_order_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY soc.next_order_date ASC;

-- ============================================================================
-- FUNZIONE: Calcola prossima data ordine
-- ============================================================================

-- Funzione helper per calcolare next_order_date basato su cadence_type
-- Utile per trigger automatici o aggiornamenti batch
CREATE OR REPLACE FUNCTION calculate_next_order_date(
  p_cadence_type VARCHAR(50),
  p_cadence_value INTEGER,
  p_weekdays JSONB,
  p_last_order_date DATE
) RETURNS DATE AS $$
DECLARE
  v_next_date DATE;
  v_day_of_week INTEGER;
BEGIN
  -- Default: usa last_order_date o oggi
  v_next_date := COALESCE(p_last_order_date, CURRENT_DATE);

  CASE p_cadence_type
    -- Fixed days: aggiungi N giorni
    WHEN 'fixed_days' THEN
      v_next_date := v_next_date + (p_cadence_value * INTERVAL '1 day');

    -- Weekly: prossimo giorno nella settimana
    WHEN 'weekly' THEN
      -- TODO: implementare logica per trovare prossimo weekday in weekdays array
      -- Per ora usa +7 giorni come fallback
      v_next_date := v_next_date + INTERVAL '7 days';

    -- Biweekly: come weekly ma +14 giorni
    WHEN 'biweekly' THEN
      v_next_date := v_next_date + INTERVAL '14 days';

    -- Monthly: stesso giorno del mese successivo
    WHEN 'monthly' THEN
      v_next_date := (date_trunc('month', v_next_date) + INTERVAL '1 month' +
                     ((p_cadence_value - 1) * INTERVAL '1 day'))::DATE;

    ELSE
      -- Default: +7 giorni
      v_next_date := v_next_date + INTERVAL '7 days';
  END CASE;

  RETURN v_next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- COMMENTI PER DOCUMENTAZIONE SCHEMA
-- ============================================================================

COMMENT ON TABLE supplier_order_cadence IS
'Configurazione cadenze ordini ricorrenti ai fornitori. Una cadenza per fornitore.';

COMMENT ON COLUMN supplier_order_cadence.supplier_id IS
'ID fornitore in Odoo (res.partner). UNIQUE constraint.';

COMMENT ON COLUMN supplier_order_cadence.cadence_type IS
'Tipo cadenza: fixed_days, weekly, biweekly, monthly';

COMMENT ON COLUMN supplier_order_cadence.cadence_value IS
'Valore numerico cadenza (giorni tra ordini o giorno del mese)';

COMMENT ON COLUMN supplier_order_cadence.weekdays IS
'Array JSON giorni settimana per ordini settimanali/bisettimanali';

COMMENT ON COLUMN supplier_order_cadence.next_order_date IS
'Prossimo ordine pianificato. Aggiornato dopo ogni ordine effettuato.';

COMMENT ON COLUMN supplier_order_cadence.calculated_cadence_days IS
'Cadenza reale calcolata da storico ordini Odoo (analytics)';

-- ============================================================================
-- ESEMPIO DATI DI TEST (opzionale - commentato)
-- ============================================================================

-- Fornitore con cadenza fissa ogni 7 giorni
/*
INSERT INTO supplier_order_cadence (
  supplier_id, supplier_name, cadence_type, cadence_value,
  next_order_date, last_order_date, average_lead_time_days
) VALUES (
  123, 'Fornitore Alfa SRL', 'fixed_days', 7,
  CURRENT_DATE + INTERVAL '3 days', CURRENT_DATE - INTERVAL '4 days', 2
);
*/

-- Fornitore con cadenza settimanale (Lunedì e Giovedì)
/*
INSERT INTO supplier_order_cadence (
  supplier_id, supplier_name, cadence_type, weekdays,
  next_order_date, last_order_date, average_lead_time_days
) VALUES (
  456, 'Fornitore Beta SPA', 'weekly', '["Monday", "Thursday"]'::jsonb,
  CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE - INTERVAL '2 days', 1
);
*/

-- Fornitore con cadenza mensile (giorno 15 del mese)
/*
INSERT INTO supplier_order_cadence (
  supplier_id, supplier_name, cadence_type, cadence_value,
  next_order_date, average_lead_time_days
) VALUES (
  789, 'Fornitore Gamma SRL', 'monthly', 15,
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '14 days', 3
);
*/

-- ============================================================================
-- VERIFICA INSTALLAZIONE
-- ============================================================================

-- Verifica tabella creata
-- SELECT COUNT(*) FROM supplier_order_cadence;

-- Verifica indici creati
-- SELECT indexname FROM pg_indexes WHERE tablename = 'supplier_order_cadence';

-- Verifica view funzionanti
-- SELECT * FROM suppliers_to_order_today;
-- SELECT * FROM upcoming_supplier_orders;

-- Test funzione calculate_next_order_date
-- SELECT calculate_next_order_date('fixed_days', 7, NULL, CURRENT_DATE);
