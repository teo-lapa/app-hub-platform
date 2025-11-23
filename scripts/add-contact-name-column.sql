-- Migration: Aggiunge colonna contact_name alla tabella ta_time_entries
-- Questa colonna salva il nome del contatto al momento della timbratura
-- per evitare lookup Odoo nell'export e risolvere il problema "Contatto ID X"

-- Aggiungi la colonna contact_name se non esiste
ALTER TABLE ta_time_entries
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Commento sulla colonna
COMMENT ON COLUMN ta_time_entries.contact_name IS 'Nome del contatto salvato al momento della timbratura per export';

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ta_time_entries'
AND column_name = 'contact_name';
