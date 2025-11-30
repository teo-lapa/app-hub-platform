-- ================================================================
-- VERIFICA AGOSTO 2024 - QUERY ODOO
-- ================================================================
-- Eseguire su database Odoo per verificare presenza transazioni
-- Konto: 1025 (UBS EUR - 0278 00122087.60)
-- Periodo: 01/08/2024 - 31/08/2024
-- ================================================================

-- 1. Trova account_id per konto 1025
SELECT id, code, name, currency_id
FROM account_account
WHERE code = '1025';

-- 2. Count movimenti agosto 2024 su konto 1025
SELECT COUNT(*) as total_moves
FROM account_move_line
WHERE account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND date >= '2024-08-01'
  AND date <= '2024-08-31';

-- 3. Lista completa movimenti agosto 2024 konto 1025
SELECT
    aml.id,
    aml.date,
    aml.name as description,
    aml.ref,
    aml.debit,
    aml.credit,
    aml.balance,
    aml.amount_currency,
    am.name as move_name,
    am.state as move_state,
    rp.name as partner_name
FROM account_move_line aml
LEFT JOIN account_move am ON aml.move_id = am.id
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date >= '2024-08-01'
  AND aml.date <= '2024-08-31'
ORDER BY aml.date, aml.id;

-- 4. Somma movimenti per giorno
SELECT
    aml.date,
    COUNT(*) as num_lines,
    SUM(aml.debit) as total_debit,
    SUM(aml.credit) as total_credit,
    SUM(aml.debit - aml.credit) as net_amount
FROM account_move_line aml
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date >= '2024-08-01'
  AND aml.date <= '2024-08-31'
GROUP BY aml.date
ORDER BY aml.date;

-- 5. Verifica FX Forward transactions (180K e 80K EUR)
SELECT
    aml.date,
    aml.name,
    aml.ref,
    aml.credit,
    am.name as move_name,
    rp.name as partner_name
FROM account_move_line aml
LEFT JOIN account_move am ON aml.move_id = am.id
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date IN ('2024-08-06', '2024-08-28')
  AND aml.credit > 50000
ORDER BY aml.date;

-- 6. Verifica batch payment 15 agosto (100K EUR uscita)
SELECT
    aml.date,
    aml.name,
    aml.debit,
    am.name as move_name,
    rp.name as partner_name
FROM account_move_line aml
LEFT JOIN account_move am ON aml.move_id = am.id
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date = '2024-08-15'
  AND aml.debit > 0
ORDER BY aml.debit DESC;

-- 7. Cerca fornitori top agosto 2024
SELECT
    rp.name as partner_name,
    COUNT(*) as num_payments,
    SUM(aml.debit) as total_paid
FROM account_move_line aml
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date >= '2024-08-01'
  AND aml.date <= '2024-08-31'
  AND aml.debit > 0
GROUP BY rp.name
ORDER BY total_paid DESC
LIMIT 10;

-- 8. Verifica saldo finale agosto 2024
SELECT
    SUM(debit - credit) as balance
FROM account_move_line
WHERE account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND date <= '2024-08-31';

-- 9. Cerca transazioni con riferimenti specifici
-- (Esempi di ref bancari da cercare)
SELECT
    aml.date,
    aml.name,
    aml.ref,
    aml.debit,
    aml.credit,
    rp.name as partner_name
FROM account_move_line aml
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND aml.date >= '2024-08-01'
  AND aml.date <= '2024-08-31'
  AND (
    aml.name ILIKE '%CJ-M5VH7%' OR  -- FX Forward 06/08
    aml.name ILIKE '%CJ-WYRQF%' OR  -- FX Forward 28/08
    aml.ref ILIKE '%TAMBURRO%' OR   -- Latticini Molisani
    aml.ref ILIKE '%FERRAIUOLO%' OR -- Ferraiuolo Foods
    aml.ref ILIKE '%RISTORIS%'      -- Ristoris
  );

-- 10. Statistiche generali konto 1025 anno 2024
SELECT
    EXTRACT(MONTH FROM date) as month,
    COUNT(*) as num_lines,
    SUM(debit) as total_debit,
    SUM(credit) as total_credit,
    SUM(debit - credit) as net_movement
FROM account_move_line
WHERE account_id IN (SELECT id FROM account_account WHERE code = '1025')
  AND date >= '2024-01-01'
  AND date <= '2024-12-31'
GROUP BY EXTRACT(MONTH FROM date)
ORDER BY month;

-- ================================================================
-- EXPECTED RESULTS (se import corretto):
-- ================================================================
-- Query 2: total_moves = 35
-- Query 8: balance = 41,130.47 EUR (saldo cumulativo al 31/08)
-- Query 5: 2 righe con 180,000 e 80,000 EUR
-- Query 6: ~10 righe con vari importi fornitori
-- ================================================================
