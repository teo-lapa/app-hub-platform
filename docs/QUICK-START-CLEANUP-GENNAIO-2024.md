# QUICK START - Pulizia Duplicati Gennaio 2024

**OBIETTIVO**: Eliminare 129 duplicati da konto 1024 (UBS CHF) gennaio 2024

**TEMPO STIMATO**: 30 minuti

**PREREQUISITI**:
- [ ] Accesso a database Odoo STAGING
- [ ] Permessi DBA per DELETE
- [ ] Backup database completo

---

## CHECKLIST PRE-INTERVENTO

- [ ] Backup database completo eseguito
- [ ] Snapshot VM/container (se disponibile)
- [ ] Notifica team: "Manutenzione STAGING in corso"
- [ ] File SQL pronti: `CLEANUP-DUPLICATI-GENNAIO-2024.sql`

---

## STEP 1: VERIFICA INIZIALE (5 min)

Connettiti al database e verifica lo stato attuale:

```bash
# Connessione database
psql -h ep-late-sea-agaxz6l9-pooler.c-2.eu-central-1.aws.neon.tech \
     -U neondb_owner \
     -d neondb
```

```sql
-- Quanti duplicati ci sono?
SELECT COUNT(*) as duplicate_groups
FROM (
  SELECT
    date,
    ROUND((debit - credit)::numeric, 2) as amount,
    COUNT(*) as cnt
  FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
    AND date >= '2024-01-01'
    AND date <= '2024-01-31'
    AND parent_state = 'posted'
  GROUP BY date, ROUND((debit - credit)::numeric, 2)
  HAVING COUNT(*) > 1
) as duplicates;
```

**RISULTATO ATTESO**: `129`

Se diverso, **STOP** e verifica con team.

---

## STEP 2: BACKUP DUPLICATI (2 min)

Crea tabella di backup con i record che verranno eliminati:

```sql
CREATE TABLE IF NOT EXISTS backup_duplicati_gennaio_2024 AS
SELECT
  aml.*,
  am.name as move_name,
  am.date as move_date,
  am.state as move_state,
  NOW() as backup_timestamp
FROM account_move_line aml
JOIN account_move am ON aml.move_id = am.id
WHERE aml.id IN (
  SELECT MAX(id)
  FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
    AND date >= '2024-01-01'
    AND date <= '2024-01-31'
    AND parent_state = 'posted'
  GROUP BY date, ROUND((debit - credit)::numeric, 2)
  HAVING COUNT(*) > 1
);

-- Verifica backup
SELECT COUNT(*) FROM backup_duplicati_gennaio_2024;
```

**RISULTATO ATTESO**: `129` record in backup

---

## STEP 3: ELIMINAZIONE (5 min)

**ATTENZIONE**: Operazione irreversibile (senza ROLLBACK)

```sql
-- Inizia transazione
BEGIN;

-- Preview di cosa verrà eliminato (SAFE)
SELECT
  COUNT(*) as will_delete,
  SUM(debit) as total_debit,
  SUM(credit) as total_credit
FROM account_move_line
WHERE id IN (
  SELECT MAX(id)
  FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
    AND date >= '2024-01-01'
    AND date <= '2024-01-31'
    AND parent_state = 'posted'
  GROUP BY date, ROUND((debit - credit)::numeric, 2)
  HAVING COUNT(*) > 1
);

-- Se i numeri sono OK, esegui:
DELETE FROM account_move_line
WHERE id IN (
  SELECT MAX(id)
  FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
    AND date >= '2024-01-01'
    AND date <= '2024-01-31'
    AND parent_state = 'posted'
  GROUP BY date, ROUND((debit - credit)::numeric, 2)
  HAVING COUNT(*) > 1
);

-- Verifica immediata
SELECT
  date,
  ROUND((debit - credit)::numeric, 2) as amount,
  COUNT(*) as occurrences
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
  AND date >= '2024-01-01'
  AND date <= '2024-01-31'
  AND parent_state = 'posted'
GROUP BY date, ROUND((debit - credit)::numeric, 2)
HAVING COUNT(*) > 1;
```

**RISULTATO ATTESO**: `0 rows` (nessun duplicato)

Se OK:
```sql
COMMIT;
```

Se NON OK:
```sql
ROLLBACK;
```

---

## STEP 4: VERIFICA POST-PULIZIA (3 min)

```sql
-- 1. Conta transazioni rimanenti
SELECT COUNT(*) as remaining_transactions
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
  AND date >= '2024-01-01'
  AND date <= '2024-01-31'
  AND parent_state = 'posted';
```

**RISULTATO ATTESO**: `310` (439 - 129)

```sql
-- 2. Saldo finale gennaio
SELECT
  date,
  balance
FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
  AND date <= '2024-01-31'
  AND parent_state = 'posted'
ORDER BY date DESC, id DESC
LIMIT 1;
```

**RISULTATO ATTESO**: Balance ~ `373,948.51 CHF`

```sql
-- 3. Verifica ZERO duplicati
SELECT COUNT(*) as duplicates_remaining
FROM (
  SELECT
    date,
    ROUND((debit - credit)::numeric, 2) as amount,
    COUNT(*) as cnt
  FROM account_move_line
  WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
    AND date >= '2024-01-01'
    AND date <= '2024-01-31'
    AND parent_state = 'posted'
  GROUP BY date, ROUND((debit - credit)::numeric, 2)
  HAVING COUNT(*) > 1
) as dup;
```

**RISULTATO ATTESO**: `0`

---

## STEP 5: TEST FUNZIONALE (5 min)

1. Login Odoo STAGING
2. Vai a: **Contabilità** → **Contabilità** → **Piano dei conti**
3. Cerca konto `1024`
4. Clicca su "Estratto conto"
5. Filtra: gennaio 2024 (01/01 - 31/01)
6. Verifica:
   - [ ] Nessuna transazione duplicata visibile
   - [ ] Saldo finale: 373,948.51 CHF
   - [ ] ~310 movimenti visualizzati

---

## ROLLBACK (Solo se necessario)

Se qualcosa va storto DOPO il COMMIT:

```sql
-- Ripristina da backup
INSERT INTO account_move_line
SELECT
  id, create_uid, create_date, write_uid, write_date,
  move_id, journal_id, company_id, company_currency_id, sequence,
  account_id, currency_id, partner_id, date, date_maturity,
  name, quantity, price_unit, discount, debit, credit, balance,
  amount_currency, price_subtotal, price_total, reconciled,
  blocked, tax_line_id, analytic_account_id, product_id,
  product_uom_id, amount_residual, amount_residual_currency,
  tax_tag_ids, matching_number, ref, payment_id,
  statement_line_id, statement_id, full_reconcile_id,
  reconcile_model_id, parent_state
FROM backup_duplicati_gennaio_2024;

-- Verifica restore
SELECT COUNT(*) FROM account_move_line
WHERE account_id = (SELECT id FROM account_account WHERE code = '1024')
  AND date >= '2024-01-01'
  AND date <= '2024-01-31';
```

**RISULTATO ATTESO**: Ritorno a `439` transazioni

---

## TROUBLESHOOTING

### Errore: "duplicate key value violates unique constraint"

**Causa**: ID già esistente
**Soluzione**: Usare `ON CONFLICT DO NOTHING` nel restore

```sql
INSERT INTO account_move_line
SELECT * FROM backup_duplicati_gennaio_2024
ON CONFLICT (id) DO NOTHING;
```

### Errore: "permission denied for table account_move_line"

**Causa**: Utente senza permessi DELETE
**Soluzione**: Usare superuser o chiedere a DBA

### Saldo post-pulizia diverso da atteso

**Causa**: Eliminati record sbagliati
**Soluzione**: ROLLBACK immediato + restore da backup

---

## CHECKLIST POST-INTERVENTO

- [ ] Duplicati eliminati: 129 ✅
- [ ] Transazioni rimanenti: 310 ✅
- [ ] Saldo corretto: 373,948.51 CHF ✅
- [ ] Test funzionale Odoo OK ✅
- [ ] Backup tabella mantenuto ✅
- [ ] Notifica team: "Manutenzione completata" ✅
- [ ] Update documentazione ✅

---

## PROSSIMI PASSI

1. Eseguire stessa pulizia su altri mesi (febbraio-dicembre 2024)
2. Importare transazioni EUR mancanti (37 record)
3. Implementare controllo anti-duplicati pre-import
4. Pianificare riconciliazione completa anno 2024

---

## FILE DI RIFERIMENTO

- `REPORT-GENNAIO-2024-SUMMARY.md` - Analisi completa problema
- `CLEANUP-DUPLICATI-GENNAIO-2024.sql` - Query SQL dettagliate
- `REPORT-GENNAIO-2024.json` - Report tecnico completo (337KB)
- `scripts/verifica-gennaio-2024.py` - Script Python di analisi

---

**Data creazione**: 2025-11-16
**Autore**: AGENTE GENNAIO 2024
**Versione**: 1.0
**Testato su**: STAGING
