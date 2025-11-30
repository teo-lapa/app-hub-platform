-- VERIFICA KONTO 1025 (UBS EUR) - GIUGNO 2024
-- Query per analizzare discrepanze trovate

-- ============================================================================
-- 1. OVERVIEW: Tutti i movimenti giugno 2024
-- ============================================================================

SELECT
    aml.date AS data_movimento,
    am.name AS numero_registrazione,
    aml.ref AS riferimento,
    aml.name AS descrizione,
    rp.name AS partner,
    aml.debit AS dare,
    aml.credit AS avere,
    (aml.debit - aml.credit) AS saldo_movimento,
    am.state AS stato,
    aml.amount_currency AS importo_valuta,
    rc.name AS valuta,
    aml.id AS move_line_id,
    am.id AS move_id
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
    LEFT JOIN res_partner rp ON aml.partner_id = rp.id
    LEFT JOIN res_currency rc ON aml.currency_id = rc.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
ORDER BY
    aml.date ASC,
    aml.id ASC;

-- ============================================================================
-- 2. RIEPILOGO: Totali giugno 2024
-- ============================================================================

SELECT
    COUNT(*) AS numero_movimenti,
    SUM(aml.debit) AS totale_dare,
    SUM(aml.credit) AS totale_avere,
    SUM(aml.debit - aml.credit) AS variazione_netta,
    MIN(aml.date) AS prima_data,
    MAX(aml.date) AS ultima_data
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted';

-- ============================================================================
-- 3. SALDI: Apertura e chiusura giugno 2024
-- ============================================================================

-- Saldo al 31/05/2024 (apertura giugno)
SELECT
    '2024-05-31' AS data,
    'Saldo apertura giugno' AS descrizione,
    SUM(aml.debit - aml.credit) AS saldo
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date <= '2024-05-31'
    AND am.state = 'posted'

UNION ALL

-- Saldo al 30/06/2024 (chiusura giugno)
SELECT
    '2024-06-30' AS data,
    'Saldo chiusura giugno' AS descrizione,
    SUM(aml.debit - aml.credit) AS saldo
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'

UNION ALL

-- Variazione giugno
SELECT
    '2024-06-01 to 2024-06-30' AS data,
    'Variazione giugno' AS descrizione,
    SUM(aml.debit - aml.credit) AS saldo
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted';

-- ============================================================================
-- 4. DUPLICATI: Cerca possibili duplicati per data e importo
-- ============================================================================

SELECT
    aml.date,
    aml.debit,
    aml.credit,
    COUNT(*) AS numero_occorrenze,
    STRING_AGG(CAST(aml.id AS TEXT), ', ') AS move_line_ids,
    STRING_AGG(am.name, ', ') AS registrazioni
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
GROUP BY
    aml.date,
    aml.debit,
    aml.credit
HAVING
    COUNT(*) > 1
ORDER BY
    numero_occorrenze DESC,
    aml.date ASC;

-- ============================================================================
-- 5. FORNITORI: Top 20 per importo giugno 2024
-- ============================================================================

SELECT
    rp.name AS fornitore,
    COUNT(*) AS numero_transazioni,
    SUM(aml.debit) AS totale_dare,
    SUM(aml.credit) AS totale_avere,
    SUM(aml.debit - aml.credit) AS saldo_netto
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
    LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
    AND rp.id IS NOT NULL
GROUP BY
    rp.name
ORDER BY
    ABS(SUM(aml.debit - aml.credit)) DESC
LIMIT 20;

-- ============================================================================
-- 6. MOVIMENTI SENZA PARTNER: Potrebbero essere batch o commissioni
-- ============================================================================

SELECT
    aml.date,
    am.name AS registrazione,
    aml.ref AS riferimento,
    aml.name AS descrizione,
    aml.debit AS dare,
    aml.credit AS avere,
    aml.id AS move_line_id
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
    AND aml.partner_id IS NULL
ORDER BY
    aml.date ASC;

-- ============================================================================
-- 7. FX TRANSACTIONS: Movimenti di cambio valuta
-- ============================================================================

SELECT
    aml.date,
    am.name AS registrazione,
    aml.ref AS riferimento,
    aml.name AS descrizione,
    aml.debit AS dare_eur,
    aml.credit AS avere_eur,
    aml.amount_currency AS importo_valuta_originale,
    rc.name AS valuta_originale,
    aml.id AS move_line_id
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
    LEFT JOIN res_currency rc ON aml.currency_id = rc.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
    AND (
        aml.name ILIKE '%FX%' OR
        aml.name ILIKE '%cambio%' OR
        aml.name ILIKE '%exchange%' OR
        aml.ref ILIKE '%FX%'
    )
ORDER BY
    aml.date ASC;

-- ============================================================================
-- 8. DISTRIBUZIONE PER DATA: Quanti movimenti per giorno
-- ============================================================================

SELECT
    aml.date,
    COUNT(*) AS numero_movimenti,
    SUM(aml.debit) AS totale_dare,
    SUM(aml.credit) AS totale_avere,
    SUM(aml.debit - aml.credit) AS variazione_giornaliera
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
GROUP BY
    aml.date
ORDER BY
    aml.date ASC;

-- ============================================================================
-- 9. MOVIMENTI SOPRA EUR 10,000: Transazioni rilevanti
-- ============================================================================

SELECT
    aml.date,
    am.name AS registrazione,
    rp.name AS partner,
    aml.name AS descrizione,
    aml.debit AS dare,
    aml.credit AS avere,
    (aml.debit - aml.credit) AS saldo,
    aml.id AS move_line_id,
    am.id AS move_id
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
    LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
    AND (ABS(aml.debit) > 10000 OR ABS(aml.credit) > 10000)
ORDER BY
    ABS(aml.debit - aml.credit) DESC;

-- ============================================================================
-- 10. VERIFICA STATO RICONCILIAZIONE
-- ============================================================================

SELECT
    CASE
        WHEN aml.full_reconcile_id IS NOT NULL THEN 'Riconciliato'
        WHEN aml.matched_debit_ids IS NOT NULL OR aml.matched_credit_ids IS NOT NULL THEN 'Parzialmente riconciliato'
        ELSE 'Non riconciliato'
    END AS stato_riconciliazione,
    COUNT(*) AS numero_movimenti,
    SUM(ABS(aml.debit - aml.credit)) AS importo_totale
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
GROUP BY
    stato_riconciliazione
ORDER BY
    numero_movimenti DESC;

-- ============================================================================
-- 11. MOVIMENTI PER JOURNAL: Da quale journal provengono
-- ============================================================================

SELECT
    aj.name AS journal,
    aj.code AS codice_journal,
    COUNT(*) AS numero_movimenti,
    SUM(aml.debit) AS totale_dare,
    SUM(aml.credit) AS totale_avere
FROM
    account_move_line aml
    INNER JOIN account_account aa ON aml.account_id = aa.id
    INNER JOIN account_move am ON aml.move_id = am.id
    INNER JOIN account_journal aj ON am.journal_id = aj.id
WHERE
    aa.code = '1025'
    AND aml.date >= '2024-06-01'
    AND aml.date <= '2024-06-30'
    AND am.state = 'posted'
GROUP BY
    aj.name,
    aj.code
ORDER BY
    numero_movimenti DESC;

-- ============================================================================
-- EXPORT CSV: Per analisi esterna
-- ============================================================================

-- Copia il risultato di questa query in CSV per Excel/Python
\COPY (
    SELECT
        aml.date,
        am.name AS registrazione,
        aml.ref,
        rp.name AS partner,
        aml.name AS descrizione,
        aml.debit,
        aml.credit,
        (aml.debit - aml.credit) AS saldo,
        am.state,
        aml.amount_currency,
        rc.name AS valuta,
        CASE
            WHEN aml.full_reconcile_id IS NOT NULL THEN 'SI'
            ELSE 'NO'
        END AS riconciliato,
        aml.id AS move_line_id,
        am.id AS move_id
    FROM
        account_move_line aml
        INNER JOIN account_account aa ON aml.account_id = aa.id
        INNER JOIN account_move am ON aml.move_id = am.id
        LEFT JOIN res_partner rp ON aml.partner_id = rp.id
        LEFT JOIN res_currency rc ON aml.currency_id = rc.id
    WHERE
        aa.code = '1025'
        AND aml.date >= '2024-06-01'
        AND aml.date <= '2024-06-30'
        AND am.state = 'posted'
    ORDER BY
        aml.date ASC,
        aml.id ASC
) TO 'konto_1025_giugno_2024.csv' WITH CSV HEADER DELIMITER ',';
