# GIUGNO 2024 - QUICK START GUIDE

**Obiettivo**: Riconciliare konto 1025 (UBS EUR) per giugno 2024
**Tempo stimato**: 14 ore
**Tasso riconciliazione attuale**: 0% → Target: ≥95%

---

## STEP 1: VERIFICA SITUAZIONE ATTUALE (5 min)

```bash
# Rigenera report
cd /path/to/app-hub-platform
python scripts/verifica-giugno-2024.py

# Output:
# - REPORT-GIUGNO-2024.json
# - report-giugno-2024-output.txt
# - Console: tasso riconciliazione, gap movimenti
```

**Cosa verificare**:
- [ ] Script si connette a Odoo (UID 430)
- [ ] Trova 44 transazioni banca
- [ ] Trova 57 movimenti Odoo
- [ ] Match = 0%

---

## STEP 2: ANALISI ODOO VIA SQL (15 min)

```bash
# Connetti al database Odoo
psql -h lapadevadmin-lapa-v2-main-7268478.dev.odoo.com \
     -U odoo \
     -d lapadevadmin-lapa-v2-main-7268478

# Esegui query di verifica
\i scripts/verifica-konto-1025-giugno.sql
```

**Query da eseguire** (in ordine):

### 2.1 Overview movimenti
```sql
-- Query #1: Tutti i movimenti giugno
SELECT date, debit, credit, name, partner
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1025'
  AND date >= '2024-06-01'
  AND date <= '2024-06-30'
ORDER BY date;
```

### 2.2 Totali
```sql
-- Query #2: Riepilogo
SELECT
    COUNT(*) AS num_movimenti,
    SUM(debit) AS totale_dare,
    SUM(credit) AS totale_avere
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1025'
  AND date >= '2024-06-01'
  AND date <= '2024-06-30';
```

**Risultato atteso**:
```
num_movimenti | totale_dare | totale_avere
--------------|-------------|-------------
     57       |  223,100.00 |  392,079.02
```

### 2.3 Cerca duplicati
```sql
-- Query #4: Duplicati
SELECT date, debit, credit, COUNT(*) as occorrenze
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1025'
  AND date >= '2024-06-01'
  AND date <= '2024-06-30'
GROUP BY date, debit, credit
HAVING COUNT(*) > 1;
```

**Se trova duplicati**:
- Annotare move_line_ids
- Verificare quale è corretto
- Preparare DELETE statement

---

## STEP 3: IMPORT MOVIMENTI MANCANTI (4h)

### 3.1 Scarica estratto conto

**Fonte**: UBS E-Banking
**File**: UBS_EUR_Q2_2024.csv (già disponibile?)

**Oppure**:
Usa il file esistente: `data-estratti/UBS-EUR-2024-TRANSACTIONS.json`

### 3.2 Filtra solo 01-14 giugno

```bash
# Script Python per estrarre movimenti
python scripts/extract-june-first-half.py
```

**Script da creare** (se non esiste):
```python
import json
from datetime import datetime

# Carica transazioni
with open('data-estratti/UBS-EUR-2024-TRANSACTIONS.json', 'r') as f:
    data = json.load(f)

# Filtra 01-14 giugno
june_first_half = [
    tx for tx in data['transactions']
    if '2024-06-01' <= tx['date'] <= '2024-06-14'
]

print(f"Trovate {len(june_first_half)} transazioni")
# Output: Trovate 30 transazioni

# Salva in formato Odoo-ready
with open('june-first-half-import.json', 'w') as f:
    json.dump(june_first_half, f, indent=2)
```

### 3.3 Import in Odoo

**Opzione A: Import automatico**
```bash
python odoo_ubs_banking/ubs_csv_importer.py \
    --file june-first-half-import.json \
    --account 1025 \
    --dry-run  # Prima verifica

# Se OK, import reale
python odoo_ubs_banking/ubs_csv_importer.py \
    --file june-first-half-import.json \
    --account 1025
```

**Opzione B: Import manuale Odoo UI**
1. Vai a Accounting > Bank Statements
2. Crea nuovo statement per konto 1025
3. Date: 01/06/2024 - 14/06/2024
4. Import da file CSV/JSON
5. Verifica preview
6. Conferma import

### 3.4 Verifica post-import

```bash
# Ri-esegui verifica
python scripts/verifica-giugno-2024.py

# Dovrebbe mostrare:
# - Movimenti Odoo: 87 (57 + 30)
# - Match esatti: ~30
# - Tasso riconciliazione: ~68%
```

---

## STEP 4: CLEANUP DUPLICATI (2h)

### 4.1 Identifica duplicati esatti

```sql
-- Trova duplicati per data/importo
WITH duplicates AS (
    SELECT
        aml.date,
        aml.debit,
        aml.credit,
        ARRAY_AGG(aml.id) AS ids,
        COUNT(*) as cnt
    FROM account_move_line aml
    JOIN account_account aa ON aml.account_id = aa.id
    WHERE aa.code = '1025'
      AND date >= '2024-06-01'
      AND date <= '2024-06-30'
    GROUP BY date, debit, credit
    HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;
```

### 4.2 DELETE duplicati

**ATTENZIONE**: Backup prima!

```sql
-- Esempio: se IDs duplicati sono 12345 e 12346
-- Tieni il primo, cancella il secondo

DELETE FROM account_move_line
WHERE id = 12346;

-- Verifica impatto
SELECT COUNT(*) FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1025'
  AND date >= '2024-06-01'
  AND date <= '2024-06-30';
-- Dovrebbe essere 87 - 1 = 86
```

### 4.3 Verifica saldo

```bash
python scripts/verifica-giugno-2024.py
# Match rate dovrebbe salire a ~75%
```

---

## STEP 5: RICONCILIAZIONE MANUALE (7h)

### 5.1 Top 10 transazioni (3h)

**Lista prioritaria**:

| # | Data Banca | Importo | Data Odoo | Importo Odoo | Partner |
|---|------------|---------|-----------|--------------|---------|
| 1 | 11/06 | -170,000.00 | ? | ? | FX Spot EUR→CHF |
| 2 | 11/06 | +170,000.00 | ? | ? | FX Spot storno |
| 3 | 20/06 | -38,797.33 | 21/06 | -37,633.41 | LATTICINI MOLISANI |
| 4 | 20/06 | -32,879.18 | 21/06 | -31,892.80 | FERRAIUOLO FOODS |
| 5 | 28/06 | -11,468.46 | 29/06 | -11,124.41 | LATTERIA MANTOVA |
| ... | ... | ... | ... | ... | ... |

**Per ogni transazione**:

1. **Verifica in Odoo**:
   ```sql
   SELECT * FROM account_move_line aml
   JOIN account_account aa ON aml.account_id = aa.id
   LEFT JOIN res_partner rp ON aml.partner_id = rp.id
   WHERE aa.code = '1025'
     AND aml.date BETWEEN '2024-06-20' AND '2024-06-22'
     AND (aml.debit > 37000 OR aml.credit > 37000)
     AND rp.name ILIKE '%LATTICINI%';
   ```

2. **Se trovato con importo diverso**:
   - Calcola differenza
   - Verifica se è tasso cambio o commissione
   - Decide se accettabile (<2%)

3. **Se accettabile**:
   - Marca come "matched" nel report
   - Annota differenza in note

4. **Se NON accettabile**:
   - Crea rettifica manuale
   - Registra in Odoo

### 5.2 Restanti 34 transazioni (4h)

**Approccio batch**:

```python
# Script semi-automatico
python scripts/reconcile-remaining-june.py \
    --tolerance 0.02  # 2% tolleranza
    --date-range 2    # ±2 giorni

# Output:
# - 20 match automatici (entro tolleranza)
# - 14 richiedono verifica manuale
```

**Verifica manuale per i 14 rimasti**:
- Controllare partner name (potrebbero essere scritti diversamente)
- Verificare descrizione/ref
- Match per prossimità (data ±3gg, importo ±5%)

---

## STEP 6: VERIFICA FINALE (1h)

### 6.1 Run final check

```bash
python scripts/verifica-giugno-2024.py

# Target:
# ✓ Match esatti: ≥42 (su 44)
# ✓ Tasso riconciliazione: ≥95%
# ✓ Differenza saldo: <EUR 100
```

### 6.2 Report finale

```bash
# Genera report Excel
python scripts/genera-report-finale-giugno.py

# Output:
# - giugno-2024-finale.xlsx
#   - Sheet 1: Summary
#   - Sheet 2: Matched transactions
#   - Sheet 3: Unmatched bank
#   - Sheet 4: Unmatched Odoo
#   - Sheet 5: Adjustments made
```

### 6.3 Saldo di controllo

```sql
-- Saldo Odoo al 30/06
SELECT SUM(debit - credit) AS saldo_odoo
FROM account_move_line aml
JOIN account_account aa ON aml.account_id = aa.id
WHERE aa.code = '1025'
  AND date <= '2024-06-30';
```

**Confronta con**:
- Saldo banca: EUR -50,573.62
- Differenza accettabile: <EUR 100

---

## CHECKLIST FINALE

### Dati
- [ ] Importati 30 movimenti mancanti (01-14 giugno)
- [ ] Cancellati 13 duplicati
- [ ] Riconciliati 42+ movimenti su 44
- [ ] Tasso riconciliazione ≥95%

### Documentazione
- [ ] Report finale Excel generato
- [ ] Note su transazioni non matchate
- [ ] Spiegazione differenze importi
- [ ] Approvazione commercialista

### Sistema
- [ ] Saldo Odoo allineato con banca (±EUR 100)
- [ ] Tutti movimenti in stato "posted"
- [ ] Nessun duplicato residuo
- [ ] Backup database pre-modifiche

---

## TROUBLESHOOTING

### "Script non si connette a Odoo"
```bash
# Verifica credenziali
export ODOO_USERNAME="apphubplatform@lapa.ch"
export ODOO_PASSWORD="apphubplatform2025"
export ODOO_URL="https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
export ODOO_DB="lapadevadmin-lapa-v2-main-7268478"

# Ri-prova
python scripts/verifica-giugno-2024.py
```

### "Import fallisce"
```bash
# Verifica formato file
head -20 june-first-half-import.json

# Verifica account esiste
psql -c "SELECT * FROM account_account WHERE code = '1025';"
```

### "Duplicati non si cancellano"
```sql
-- Verifica vincoli
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'account_move_line';

-- Potrebbe servire cancellare anche in account_move
DELETE FROM account_move WHERE id IN (
    SELECT move_id FROM account_move_line WHERE id = 12346
);
```

---

## NEXT STEPS

Dopo giugno 2024:
1. **Luglio 2024**: Stesso processo
2. **Agosto 2024**: Idem
3. ... fino a Dicembre 2024

**Automatizzazione**:
- Crea script mensile di import UBS EUR
- Schedule verifica automatica ogni mese
- Alert se riconciliazione <95%

---

**Domande?** Consulta:
- `REPORT-GIUGNO-2024.md` - Dettagli completi
- `REPORT-GIUGNO-2024-SUMMARY.md` - Executive summary
- `scripts/verifica-konto-1025-giugno.sql` - Query SQL

**Supporto**: Backend Specialist / API Architect
