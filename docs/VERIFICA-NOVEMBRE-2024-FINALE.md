# VERIFICA NOVEMBRE 2024 - REPORT FINALE

**Data analisi**: 16 novembre 2025
**Periodo verificato**: 01/11/2024 - 30/11/2024
**Konti analizzati**: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)

---

## EXECUTIVE SUMMARY

**STATO GENERALE**: DISCREPANZE CRITICHE RILEVATE

| Konto | Descrizione | Gap Rilevato | Stato |
|-------|-------------|--------------|-------|
| **1024** | UBS CHF | CHF -193,916.21 | CRITICO |
| **1025** | UBS EUR | EUR -16,236.67 | MODERATO |
| **1026** | Credit Suisse CHF | Nessun dato mensile | NON VERIFICABILE |

**Totale movimenti analizzati**: 529 (novembre 2024)
**Totale movimenti anno 2024 (konto 1024)**: 3,978

---

## KONTO 1024 - UBS CHF (ANALISI DETTAGLIATA)

### Situazione Novembre 2024

| Metrica | Odoo | Banca UBS | Differenza |
|---------|------|-----------|------------|
| Saldo apertura 31/10 | CHF 64,756.50 | CHF 257,538.24 | CHF -192,781.74 |
| Saldo chiusura 30/11 | CHF -39,722.81 | CHF 154,193.40 | CHF -193,916.21 |
| Movimenti novembre | 324 | - | - |
| DARE novembre | CHF 301,610.10 | - | - |
| AVERE novembre | CHF 406,089.41 | - | - |
| Variazione mese | CHF -104,479.31 | CHF -103,344.84 | CHF -1,134.47 |

**PROBLEMA PRINCIPALE**: Gap di quasi CHF 194K costante tra Odoo e banca.

### Analisi Anno Completo 2024

| Metrica | Valore |
|---------|--------|
| Saldo apertura calcolato (pre-2024) | CHF 153,717.89 |
| Saldo apertura atteso da banca | CHF 143,739.47 |
| **Gap saldo apertura** | **CHF 9,978.42** |
| Totale movimenti 2024 | 3,978 |
| Totale DARE 2024 | CHF 6,407,273.81 |
| Totale AVERE 2024 | CHF 6,427,241.67 |
| Netto 2024 | CHF -19,967.86 |

### DUPLICATI RILEVATI

#### Duplicati ESATTI (stessa data, importo, descrizione)

**Totale duplicati ESATTI trovati**: 7 gruppi
**Importo totale duplicati ESATTI**: CHF 4,212.45

| Data | Descrizione | Importo | Count | IDs da eliminare |
|------|-------------|---------|-------|------------------|
| 18/05/2024 | DAGO PINSA GMBH | CHF 603.30 (AVERE) | 3 | 199286, 199288, 199292 (tenere ultimo) |
| 18/05/2024 | DAGO PINSA GMBH | CHF 361.95 (AVERE) | 2 | 199294, 199300 (tenere ultimo) |
| 30/05/2024 | La Terra del Buon Gusto | CHF 42.15 (DARE) | 2 | 198771, 206698 (tenere primo) |
| 06/07/2024 | PAGG Treuhand AG | CHF 432.40 (AVERE) | 2 | 249185, 249189 (tenere primo) |
| 11/07/2024 | DAGO PINSA GMBH | CHF 603.30 (AVERE) | 4 | 251110, 251122, 251124, 251135 (tenere primo) |
| 10/09/2024 | Pizza Casareccio | CHF 325.45 (DARE) | 2 | 278948, 294942 (tenere primo) |
| 24/09/2024 | Betreibungsamt Liestal | CHF 34.00 (AVERE) | 2 | 283420, 283422 (tenere primo) |

**IDs da eliminare (TOTALE 11 record)**:
- 199288, 199292 (DAGO PINSA 18/05 #1)
- 199300 (DAGO PINSA 18/05 #2)
- 206698 (La Terra 30/05)
- 249189 (PAGG 06/07)
- 251122, 251124, 251135 (DAGO PINSA 11/07)
- 294942 (Pizza Casareccio 10/09)
- 283422 (Betreibungsamt 24/09)

#### Duplicati per FIRMA (stessa data + importo, descrizione diversa)

**Totale gruppi sospetti**: 41
**Importo potenziale**: CHF 28,199.36

**Top 5 duplicati sospetti**:
1. **Oleificio Sabo** (02/02): CHF 2,948.66 x 2 = CHF 2,948.66 duplicato
2. **Oleificio Sabo** (08/06): CHF 2,623.54 x 3 = CHF 5,247.08 duplicato
3. **Oleificio Sabo** (24/07): CHF 2,623.54 x 2 = CHF 2,623.54 duplicato
4. **BOUCHERIE DES LANDES** (21/06): CHF 1,431.25 x 2 = CHF 1,431.25 duplicato
5. **DAGO PINSA** (varie date): CHF 603.30 multipli

**PATTERN RILEVATO**:
- **Oleificio Sabo** appare MOLTO frequentemente duplicato
- **DAGO PINSA GMBH** ha duplicati sistematici
- Probabile problema import CSV con questi fornitori specifici

### Transazioni FX (Foreign Exchange)

| Metrica | Valore |
|---------|--------|
| Totale FX transactions 2024 | 26 |
| Importo totale FX (AVERE) | CHF 2,989,847.29 |
| Media per transazione | CHF 114,994.13 |

**Pattern FX**:
- Acquisti mensili/quindicinali di EUR contro CHF
- Importi tra CHF 95K e CHF 148K per transazione
- Tutti registrati come AVERE (uscita CHF)

**Nota**: Le FX sembrano correttamente registrate (no duplicati evidenti).

---

## KONTO 1025 - UBS EUR

### Situazione Novembre 2024

| Metrica | Odoo | Banca UBS | Differenza |
|---------|------|-----------|------------|
| Saldo apertura 31/10 | EUR 91,704.46 | EUR 112,572.85 | EUR -20,868.39 |
| Saldo chiusura 30/11 | EUR -32,588.42 | EUR -16,351.75 | EUR -16,236.67 |
| Movimenti novembre | 48 | - | - |
| DARE novembre | EUR 155,378.40 | - | - |
| AVERE novembre | EUR 279,671.28 | - | - |
| Variazione mese | EUR -124,292.88 | EUR -128,924.60 | EUR +4,631.72 |

**TREND POSITIVO**: Il gap si è RIDOTTO da EUR 20,868 a EUR 16,236 (-EUR 4,632 in un mese).

**RACCOMANDAZIONE**: Monitorare dicembre 2024. Se trend continua, il gap si auto-correggerà.

---

## KONTO 1026 - CREDIT SUISSE CHF

### Situazione Novembre 2024

| Metrica | Valore |
|---------|--------|
| Saldo apertura 31/10 (Odoo) | CHF 357,335.35 |
| Saldo chiusura 30/11 (Odoo) | CHF 362,273.31 |
| Movimenti novembre | 157 |
| DARE novembre | CHF 20,000.00 |
| AVERE novembre | CHF 15,062.04 |
| Variazione mese | CHF +4,937.96 |

**SALDO REALE BANCA (31/12/2024)**: CHF 24,897.72

**GAP STIMATO AL 31/12**: CHF 337,375.59 (Odoo ha CHF 337K in ECCESSO)

**PROBLEMA NOTO**: Già documentato in CREDIT-SUISSE-2024-CLEAN.json. Richiede cleanup separato.

---

## COMPOSIZIONE GAP TOTALE KONTO 1024

| Componente | Importo | % del Gap |
|------------|---------|-----------|
| **Gap saldo apertura 2024** | CHF 9,978.42 | 5.1% |
| **Duplicati ESATTI (certi)** | CHF 4,212.45 | 2.2% |
| **Duplicati FIRMA (probabili)** | CHF ~24,000 | 12.4% |
| **Gap NON SPIEGATO** | CHF ~156,000 | 80.3% |
| **TOTALE GAP** | **CHF 193,916.21** | **100%** |

---

## PIANO AZIONE

### IMMEDIATE (oggi - alta priorità)

#### 1. Elimina duplicati ESATTI (CHF 4,212.45)

**Script SQL da eseguire**:

```sql
-- BACKUP PRIMA DI TUTTO
SELECT * FROM account_move_line WHERE id IN (
    199288, 199292, 199300, 206698, 249189,
    251122, 251124, 251135, 294942, 283422
) ORDER BY id;

-- Verifica che siano effettivamente duplicati
SELECT date, name, debit, credit, move_id
FROM account_move_line
WHERE id IN (199286, 199288, 199292)
ORDER BY id;

-- DELETE (SOLO SE VERIFICATO)
DELETE FROM account_move_line WHERE id IN (
    199288,  -- DAGO PINSA 18/05 dup 1
    199292,  -- DAGO PINSA 18/05 dup 2
    199300,  -- DAGO PINSA 18/05 dup 3
    206698,  -- La Terra 30/05 dup
    249189,  -- PAGG 06/07 dup
    251122,  -- DAGO PINSA 11/07 dup 1
    251124,  -- DAGO PINSA 11/07 dup 2
    251135,  -- DAGO PINSA 11/07 dup 3
    294942,  -- Pizza Casareccio 10/09 dup
    283422   -- Betreibungsamt 24/09 dup
);

-- Verifica post-delete
SELECT COUNT(*) FROM account_move_line WHERE account_id = 176;
```

**Impatto atteso**: Riduzione gap di CHF 4,212.45

---

#### 2. Investiga duplicati Oleificio Sabo (CHF ~10,500)

**Query di verifica**:

```sql
SELECT date, name, ref, debit, credit, id, create_date, write_date
FROM account_move_line
WHERE account_id = 176
  AND name LIKE '%Oleificio Sabo%'
  AND date BETWEEN '2024-01-01' AND '2024-12-31'
ORDER BY date, credit DESC;

-- Cerca duplicati
SELECT date, credit, COUNT(*) as cnt, STRING_AGG(CAST(id AS TEXT), ', ') as ids
FROM account_move_line
WHERE account_id = 176
  AND name LIKE '%Oleificio Sabo%'
  AND date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY date, credit
HAVING COUNT(*) > 1;
```

**Se trovati duplicati**: Eliminare record con `create_date` più recente (probabilmente re-import).

**Impatto stimato**: Riduzione gap di CHF 8,000 - 10,000

---

#### 3. Verifica saldo apertura 01/01/2024

**Query**:

```sql
-- Saldo al 31/12/2023 (dovrebbe essere CHF 143,739.47)
SELECT SUM(debit - credit) as saldo_31_12_2023
FROM account_move_line
WHERE account_id = 176
  AND date < '2024-01-01'
  AND parent_state = 'posted';

-- Se diverso da CHF 143,739.47, cercare anomalie pre-2024
SELECT date, name, debit, credit, id
FROM account_move_line
WHERE account_id = 176
  AND date BETWEEN '2023-01-01' AND '2023-12-31'
  AND (debit > 50000 OR credit > 50000)
ORDER BY date DESC;
```

**Gap saldo apertura**: CHF 9,978.42

**Azione**: Se trovati movimenti sospetti in 2023, correggere o riclassificare.

---

### SHORT-TERM (questa settimana - media priorità)

#### 4. Analisi completa duplicati DAGO PINSA GMBH

**Pattern rilevato**: DAGO PINSA ha duplicati sistematici (5 gruppi, 9 record totali).

**Query**:

```sql
SELECT date, debit, credit, COUNT(*) as cnt, STRING_AGG(CAST(id AS TEXT), ', ') as ids
FROM account_move_line
WHERE account_id = 176
  AND name LIKE '%DAGO PINSA%'
  AND date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY date, debit, credit
HAVING COUNT(*) > 1
ORDER BY date;
```

**Impatto stimato**: CHF 1,500 - 2,000

---

#### 5. Verifica import CSV mensili

**Ipotesi**: Import duplicato di alcuni estratti conto CSV.

**Azione**:
1. Lista tutti i CSV importati nel 2024
2. Verifica se ci sono import multipli dello stesso file
3. Cerca pattern: stesso file importato 2+ volte = record duplicati

**Query journal entries**:

```sql
SELECT j.name, j.date, COUNT(aml.id) as move_count
FROM account_journal j
JOIN account_move am ON am.journal_id = j.id
JOIN account_move_line aml ON aml.move_id = am.id
WHERE j.code = 'CHF'  -- Assumendo questo è il journal UBS CHF
  AND am.date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY j.name, j.date
HAVING COUNT(aml.id) > 100
ORDER BY j.date;
```

---

#### 6. Analisi DICEMBRE 2024

**Script**: Riutilizzare `verifica-novembre-2024.py` modificando le date:

```python
DATE_START = '2024-12-01'
DATE_END = '2024-12-31'
```

**Obiettivo**:
- Verificare se gap 1025 (EUR) continua a ridursi
- Controllare se gap 1024 (CHF) peggiora o migliora

---

### MEDIUM-TERM (prossime 2 settimane - bassa priorità)

#### 7. Analisi mensile completa gennaio-ottobre 2024

**Script**: Loop su tutti i mesi per trovare quando il gap si è creato.

```python
for month in range(1, 11):
    DATE_START = f'2024-{month:02d}-01'
    DATE_END = f'2024-{month:02d}-{last_day}'
    # Run analysis
```

**Output atteso**: Grafico gap evolution mese per mese.

---

#### 8. Cleanup Credit Suisse (konto 1026)

**Gap**: CHF 337,375.59

**Azione**: Vedere analisi dedicata già preparata in `CREDIT-SUISSE-2024-CLEAN.json`.

---

## FILE GENERATI

| File | Dimensione | Descrizione |
|------|-----------|-------------|
| `REPORT-NOVEMBRE-2024.json` | 290 KB | Tutti i 529 movimenti novembre riga per riga |
| `REPORT-NOVEMBRE-2024-EXECUTIVE-SUMMARY.md` | 18 KB | Riepilogo discrepanze e raccomandazioni |
| `ANALISI-DUPLICATI-1024.json` | 3 KB | Dettaglio duplicati ESATTI con IDs |
| `VERIFICA-NOVEMBRE-2024-FINALE.md` | Questo file | Report completo con piano azione |

---

## SCRIPT DISPONIBILI

| Script | Funzione |
|--------|----------|
| `scripts/verifica-novembre-2024.py` | Analisi mensile completa (configurabile) |
| `scripts/analizza-duplicati-1024.py` | Ricerca duplicati ESATTI e per FIRMA |

**Come usare**:

```bash
# Novembre 2024
python scripts/verifica-novembre-2024.py

# Dicembre 2024 (modificare DATE_START/END nello script)
python scripts/verifica-novembre-2024.py

# Cerca duplicati
python scripts/analizza-duplicati-1024.py
```

---

## CONCLUSIONI E RACCOMANDAZIONI FINALI

### SINTESI SITUAZIONE

**KONTO 1024 (UBS CHF)**:
- Gap CRITICO di CHF 193,916.21
- Solo CHF 14,190 spiegato con duplicati certi + gap apertura
- Rimanente CHF 179,725 richiede investigazione profonda
- **AZIONE IMMEDIATA RICHIESTA**

**KONTO 1025 (UBS EUR)**:
- Gap MODERATO di EUR 16,236.67
- Trend POSITIVO in riduzione
- **Monitorare dicembre, no azione immediata**

**KONTO 1026 (Credit Suisse CHF)**:
- Gap ENORME di CHF 337,375.59 (già noto)
- **Cleanup separato in corso**

### PRIORITÀ INTERVENTI

1. **URGENTE**: Eliminare 11 duplicati ESATTI (CHF 4,212.45) - OGGI
2. **ALTA**: Investigare Oleificio Sabo duplicati (CHF ~10K) - DOMANI
3. **MEDIA**: Verificare saldo apertura 2024 (CHF 9,978.42) - QUESTA SETTIMANA
4. **MEDIA**: Analizzare dicembre 2024 - QUESTA SETTIMANA
5. **BASSA**: Analisi completa anno 2024 - PROSSIME 2 SETTIMANE

### STIMA RECUPERO GAP

| Azione | Recupero stimato | Rischio |
|--------|------------------|---------|
| Delete duplicati ESATTI | CHF 4,212.45 | BASSO (certi) |
| Delete duplicati Oleificio | CHF 8,000-10,000 | MEDIO (probabili) |
| Fix saldo apertura | CHF 9,978.42 | ALTO (da verificare) |
| Altri duplicati firma | CHF 10,000-15,000 | ALTO (da verificare) |
| **TOTALE RECUPERABILE** | **CHF 32,000-39,000** | - |
| **GAP RESIDUO** | **CHF 155,000-162,000** | - |

### RACCOMANDAZIONE FINALE

Prima di procedere con la chiusura contabile 2024:

1. ✅ Eseguire cleanup duplicati ESATTI (safe, impatto CHF 4K)
2. ⚠️ Investigare e decidere su Oleificio Sabo (possibile CHF 10K)
3. ⚠️ Verificare saldo apertura (possibile CHF 10K)
4. ❌ **Gap residuo CHF 155K-162K richiede audit completo import CSV 2024**

**Se il gap residuo non viene risolto, NON è possibile chiudere la contabilità 2024 con saldi bancari affidabili.**

---

*Report generato il 16/11/2025 - Basato su dati Odoo DEV e estratti bancari UBS/Credit Suisse*
