# SQL QUERIES - VERIFICA KONTO 10901

Quick reference per verifiche future sul Konto 10901 e conti collegati.

**IMPORTANTE:** Queste query sono per PostgreSQL (database Odoo).

---

## 1. VERIFICA SALDO KONTO 10901

### Query saldo corrente
```sql
-- Saldo Konto 10901 (dovrebbe essere CHF 0.00)
SELECT
  acc.code AS konto_code,
  acc.name AS konto_name,
  SUM(aml.debit) AS total_debit,
  SUM(aml.credit) AS total_credit,
  SUM(aml.debit) - SUM(aml.credit) AS balance
FROM account_move_line aml
JOIN account_account acc ON aml.account_id = acc.id
WHERE acc.id = 1  -- Konto 10901
GROUP BY acc.id, acc.code, acc.name;
```

**Risultato atteso:**
```
konto_code | konto_name        | total_debit   | total_credit  | balance
-----------|-------------------|---------------|---------------|--------
10901      | Clearing account  | 10,308,836.52 | 10,308,836.52 | 0.00
```

---

## 2. ULTIMI MOVIMENTI KONTO 10901

### Query ultimi 20 movimenti
```sql
-- Ultimi 20 movimenti su Konto 10901
SELECT
  aml.id AS line_id,
  am.id AS move_id,
  am.name AS move_name,
  am.date AS move_date,
  aj.name AS journal_name,
  aml.name AS description,
  aml.debit,
  aml.credit,
  CASE
    WHEN aml.debit > 0 THEN aml.debit
    ELSE -aml.credit
  END AS amount_signed,
  am.state AS move_state
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_journal aj ON aml.journal_id = aj.id
WHERE aml.account_id = 1  -- Konto 10901
ORDER BY am.date DESC, aml.id DESC
LIMIT 20;
```

---

## 3. ANALISI RICLASSIFICAZIONI

### Query tutte le riclassifiche
```sql
-- Tutte le registrazioni di riclassifica
SELECT
  am.id AS move_id,
  am.name AS move_name,
  am.ref AS reference,
  am.date,
  am.state,
  aj.name AS journal_name,
  COUNT(aml.id) AS num_lines,
  SUM(aml.debit) AS total_debit,
  SUM(aml.credit) AS total_credit
FROM account_move am
JOIN account_journal aj ON am.journal_id = aj.id
LEFT JOIN account_move_line aml ON am.id = aml.move_id
WHERE am.ref ILIKE '%RICLASS%'
GROUP BY am.id, am.name, am.ref, am.date, am.state, aj.name
ORDER BY am.date DESC;
```

### Query riclassifiche per categoria
```sql
-- Riclassifiche per categoria
SELECT
  CASE
    WHEN am.ref ILIKE '%CASH%' THEN 'Cash Deposits'
    WHEN am.ref ILIKE '%BANK%' THEN 'Bank Transfers'
    WHEN am.ref ILIKE '%FX%' THEN 'FX Operations'
    WHEN am.ref ILIKE '%CREDITCARD%' THEN 'Credit Card'
    ELSE 'Other'
  END AS category,
  COUNT(DISTINCT am.id) AS num_moves,
  COUNT(aml.id) AS num_lines,
  SUM(CASE WHEN aml.account_id = 1 AND aml.debit > 0 THEN aml.debit ELSE 0 END) AS debit_10901,
  SUM(CASE WHEN aml.account_id = 1 AND aml.credit > 0 THEN aml.credit ELSE 0 END) AS credit_10901
FROM account_move am
LEFT JOIN account_move_line aml ON am.id = aml.move_id
WHERE am.ref ILIKE '%RICLASS%'
GROUP BY category
ORDER BY num_moves DESC;
```

---

## 4. VERIFICA CHIUSURA FINALE

### Query registrazione di chiusura
```sql
-- Registrazione chiusura finale
SELECT
  am.id AS move_id,
  am.name AS move_name,
  am.ref,
  am.date,
  am.state,
  aml.id AS line_id,
  acc.code AS account_code,
  acc.name AS account_name,
  aml.name AS line_description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
JOIN account_account acc ON aml.account_id = acc.id
WHERE am.ref ILIKE '%CHIUSURA-KONTO-10901%'
   OR (aml.account_id = 1 AND aml.name ILIKE '%Chiusura finale%')
ORDER BY am.date DESC, aml.id;
```

**Move ID atteso:** 97144 (15/11/2025)

---

## 5. VERIFICA CONTI DESTINAZIONE

### Konto 1001 (Cash) - Movimenti da riclassifica
```sql
-- Cash deposits riclassificati su Konto 1001
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  aml.name AS description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
WHERE aml.account_id = 175  -- Konto 1001 Cash
  AND am.ref ILIKE '%RICLASS-CASH%'
ORDER BY am.date DESC;
```

**Importo totale atteso:** CHF 87,570.00

### Konto 176 (UBS CHF 701J) - Bank transfers
```sql
-- Bank transfers riclassificati su UBS 701J
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  aml.name AS description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
WHERE aml.account_id = 176  -- UBS CHF 701J
  AND am.ref ILIKE '%RICLASS-BANK%'
ORDER BY am.date DESC;
```

### Konto 182 (CS 751000) - Bank transfers
```sql
-- Bank transfers riclassificati su CS 751000
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  aml.name AS description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
WHERE aml.account_id = 182  -- CS 751000
  AND am.ref ILIKE '%RICLASS-BANK%'
ORDER BY am.date DESC;
```

### Konto 183 (CS 751001) - Bank transfers
```sql
-- Bank transfers riclassificati su CS 751001
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  aml.name AS description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
WHERE aml.account_id = 183  -- CS 751001
  AND am.ref ILIKE '%RICLASS-BANK%'
ORDER BY am.date DESC;
```

### Konto 4906 (Differenze cambio) - FX operations
```sql
-- FX operations riclassificate su Konto 4906
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  aml.name AS description,
  aml.debit,
  aml.credit
FROM account_move am
JOIN account_move_line aml ON am.id = aml.move_id
WHERE aml.account_id = 4906  -- Konto differenze cambio (verificare ID!)
  AND am.ref ILIKE '%RICLASS-FX%'
ORDER BY am.date DESC;
```

**Importo totale atteso:** CHF 6,097,589.76

---

## 6. MONITORING CONTINUATIVO

### Query per alert - Nuovi movimenti su 10901
```sql
-- ALERT: Nuovi movimenti su Konto 10901 (dopo chiusura)
SELECT
  aml.id AS line_id,
  am.id AS move_id,
  am.name AS move_name,
  am.date AS move_date,
  aj.name AS journal_name,
  aml.name AS description,
  aml.debit,
  aml.credit,
  am.state,
  am.create_date
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_journal aj ON aml.journal_id = aj.id
WHERE aml.account_id = 1  -- Konto 10901
  AND am.date > '2025-11-15'  -- Dopo chiusura finale
  AND am.ref NOT ILIKE '%RICLASS%'  -- Escludi riclassifiche
ORDER BY am.date DESC, aml.id DESC;
```

**Risultato atteso:** 0 righe (se ci sono movimenti, richiedono attenzione!)

### Query saldi tutti i clearing accounts
```sql
-- Verifica saldi di tutti i conti transitori/clearing
SELECT
  acc.code,
  acc.name,
  SUM(aml.debit) AS total_debit,
  SUM(aml.credit) AS total_credit,
  SUM(aml.debit) - SUM(aml.credit) AS balance,
  CASE
    WHEN ABS(SUM(aml.debit) - SUM(aml.credit)) < 0.01 THEN '✅ OK'
    WHEN ABS(SUM(aml.debit) - SUM(aml.credit)) < 100 THEN '⚠️ Small'
    ELSE '🔴 Review'
  END AS status
FROM account_move_line aml
JOIN account_account acc ON aml.account_id = acc.id
WHERE acc.code LIKE '109%'  -- Tutti i conti 109xx (transitori)
GROUP BY acc.id, acc.code, acc.name
HAVING ABS(SUM(aml.debit) - SUM(aml.credit)) > 0.01
ORDER BY ABS(SUM(aml.debit) - SUM(aml.credit)) DESC;
```

---

## 7. TRIAL BALANCE VERIFICHE

### Trial Balance completo
```sql
-- Trial Balance con evidenza sbilanciamenti
SELECT
  acc.code,
  acc.name,
  acc.account_type,
  SUM(aml.debit) AS debit,
  SUM(aml.credit) AS credit,
  SUM(aml.debit) - SUM(aml.credit) AS balance
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
JOIN account_account acc ON aml.account_id = acc.id
WHERE am.state = 'posted'
  AND am.date <= '2025-12-31'  -- Anno fiscale 2025
GROUP BY acc.id, acc.code, acc.name, acc.account_type
HAVING ABS(SUM(aml.debit) - SUM(aml.credit)) > 0.01
ORDER BY acc.code;
```

### Verifica totali DARE/AVERE
```sql
-- Totali globali (devono essere uguali)
SELECT
  SUM(aml.debit) AS total_debit,
  SUM(aml.credit) AS total_credit,
  SUM(aml.debit) - SUM(aml.credit) AS difference,
  CASE
    WHEN ABS(SUM(aml.debit) - SUM(aml.credit)) < 0.01 THEN '✅ BALANCED'
    ELSE '🔴 UNBALANCED'
  END AS status
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
WHERE am.state = 'posted';
```

**Risultato atteso:** difference = 0.00, status = BALANCED

---

## 8. AUDIT TRAIL

### Query per audit - Tutti i move IDs riclassifiche
```sql
-- Lista completa Move IDs riclassifiche per audit
SELECT
  am.id AS move_id,
  am.name,
  am.ref,
  am.date,
  am.state,
  am.create_uid,
  ru.login AS created_by,
  am.create_date,
  am.write_date
FROM account_move am
LEFT JOIN res_users ru ON am.create_uid = ru.id
WHERE am.ref ILIKE '%RICLASS%'
   OR am.ref ILIKE '%CHIUSURA-KONTO-10901%'
ORDER BY am.date, am.id;
```

### Query move lines dettagliate per singolo move
```sql
-- Dettaglio completo di un move (esempio: Move 97144)
SELECT
  aml.id AS line_id,
  acc.code AS account_code,
  acc.name AS account_name,
  aml.name AS description,
  aml.debit,
  aml.credit,
  aml.date,
  aml.partner_id,
  rp.name AS partner_name
FROM account_move_line aml
JOIN account_account acc ON aml.account_id = acc.id
LEFT JOIN res_partner rp ON aml.partner_id = rp.id
WHERE aml.move_id = 97144  -- Move ID chiusura finale
ORDER BY aml.id;
```

---

## 9. PERFORMANCE QUERIES

### Query più pesanti (slow queries)
```sql
-- Identifica query lente su account_move_line
SELECT
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows
FROM pg_stat_statements
WHERE query ILIKE '%account_move_line%'
  AND mean_time > 100  -- > 100ms
ORDER BY mean_time DESC
LIMIT 10;
```

### Indici su account_move_line
```sql
-- Verifica indici esistenti
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'account_move_line'
  AND schemaname = 'public'
ORDER BY indexname;
```

---

## 10. QUICK CHECKS

### One-liner: Verifica Konto 10901
```sql
-- Quick check saldo 10901
SELECT 'Konto 10901 Balance: CHF ' ||
       ROUND(SUM(debit) - SUM(credit), 2) ||
       CASE
         WHEN ABS(SUM(debit) - SUM(credit)) < 0.01 THEN ' ✅ OK'
         ELSE ' 🔴 CHECK NEEDED'
       END AS status
FROM account_move_line
WHERE account_id = 1;
```

### One-liner: Conta riclassifiche
```sql
-- Conta riclassifiche totali
SELECT COUNT(*) AS total_reclassifications
FROM account_move
WHERE ref ILIKE '%RICLASS%';
```

**Risultato atteso:** 81

### One-liner: Ultimo movimento 10901
```sql
-- Ultimo movimento su Konto 10901
SELECT
  am.date AS last_move_date,
  am.id AS move_id,
  am.name AS move_name,
  aml.name AS description
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
WHERE aml.account_id = 1
ORDER BY am.date DESC, aml.id DESC
LIMIT 1;
```

**Risultato atteso:** Move 97144, 15/11/2025

---

## 11. EXPORT DATI

### Export CSV riclassifiche
```sql
-- Export dati riclassifiche (copy to CSV)
COPY (
  SELECT
    am.id AS move_id,
    am.name AS move_name,
    am.ref AS reference,
    am.date,
    acc.code AS account_code,
    acc.name AS account_name,
    aml.name AS description,
    aml.debit,
    aml.credit
  FROM account_move am
  JOIN account_move_line aml ON am.id = aml.move_id
  JOIN account_account acc ON aml.account_id = acc.id
  WHERE am.ref ILIKE '%RICLASS%'
  ORDER BY am.date, am.id, aml.id
) TO '/tmp/riclassifiche_10901.csv' WITH CSV HEADER;
```

---

## NOTE IMPORTANTI

1. **Account IDs verificati:**
   - Konto 10901: ID = 1
   - Konto 1001 (Cash): ID = 175
   - Konto 176 (UBS CHF 701J): ID = 176
   - Konto 182 (CS 751000): ID = 182
   - Konto 183 (CS 751001): ID = 183

2. **IDs da verificare:**
   - Konto 4906 (Differenze cambio): verificare ID esatto

3. **Date chiave:**
   - Chiusura finale: 15/11/2025 (Move 97144)
   - Range riclassifiche: 06/10/2025 - 15/11/2025

4. **Reference patterns:**
   - Cash: `RICLASS-CASH-{original_move_id}`
   - Bank: `RICLASS-BANK-{original_move_id}`
   - FX: `RICLASS-FX-{original_move_id}`
   - Chiusura: `CHIUSURA-KONTO-10901`

---

## UTILIZZO

Per eseguire queste query:

1. **Via Odoo shell:**
```bash
odoo-bin shell -d database_name
```

```python
>>> from odoo import api, SUPERUSER_ID
>>> env = api.Environment(cr, SUPERUSER_ID, {})
>>> env.cr.execute("SELECT ...");
>>> results = env.cr.fetchall()
```

2. **Via psql:**
```bash
psql -h host -U user -d database_name -f query.sql
```

3. **Via pgAdmin:**
   - Aprire Query Tool
   - Copiare query
   - Eseguire

---

*SQL Queries Reference - Aggiornato al 16 Novembre 2025*
