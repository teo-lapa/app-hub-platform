-- ============================================================================
-- MIGRATION: Aggiunge odoo_employee_id alla tabella users
-- ============================================================================
--
-- Questo campo collega un utente della piattaforma al suo profilo hr.employee
-- in Odoo, permettendo il sistema di permessi di Maestro AI.
--
-- Eseguire SOLO quando la tabella users sarà migrata da in-memory a PostgreSQL
--
-- ============================================================================

-- Aggiungi colonna odoo_employee_id
ALTER TABLE users ADD COLUMN IF NOT EXISTS odoo_employee_id INTEGER;

-- Crea indice per performance (molte query filtreranno su questo campo)
CREATE INDEX IF NOT EXISTS idx_users_odoo_employee ON users(odoo_employee_id);

-- ============================================================================
-- POPOLAMENTO DATI (Esempi - da personalizzare con IDs reali)
-- ============================================================================

-- NOTA: Gli employee_id devono corrispondere agli ID reali di hr.employee in Odoo
-- Questi sono esempi da sostituire con i valori reali dopo aver interrogato Odoo

-- Super users (possono vedere tutti i venditori)
-- UPDATE users SET odoo_employee_id = 5 WHERE email = 'paul@lapa.com';
-- UPDATE users SET odoo_employee_id = 7 WHERE email = 'laura@lapa.com';
-- UPDATE users SET odoo_employee_id = 12 WHERE email = 'gregorio@lapa.com';

-- Altri venditori (vedranno solo i propri clienti)
-- UPDATE users SET odoo_employee_id = 15 WHERE email = 'mario.rossi@lapa.com';
-- UPDATE users SET odoo_employee_id = 18 WHERE email = 'lucia.verdi@lapa.com';

-- ============================================================================
-- VERIFICA
-- ============================================================================

-- Verifica utenti con employee_id assegnato
-- SELECT id, email, name, role, odoo_employee_id FROM users WHERE odoo_employee_id IS NOT NULL;

-- Verifica super users
-- SELECT email, odoo_employee_id FROM users WHERE email IN ('paul@lapa.com', 'laura@lapa.com', 'gregorio@lapa.com');
