# VERIFICA COMPLETA LUGLIO 2024

**Periodo:** 01/07/2024 - 31/07/2024
**Conti bancari:** 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)
**Status:** PRONTO PER VERIFICA IN ODOO
**Report JSON:** `REPORT-LUGLIO-2024.json`

---

## EXECUTIVE SUMMARY

### Saldi Attesi (da estratti bancari)

| Konto | Banca | Valuta | Saldo 30/06 | Saldo 31/07 | Variazione | Alert |
|-------|-------|--------|-------------|-------------|------------|-------|
| **1024** | UBS CHF | CHF | 142,785.59 | 345,760.44 | **+202,974.85** | Movimento grande |
| **1025** | UBS EUR | EUR | **-50,573.62** | 14,702.54 | **+65,276.16** | Saldo negativo → positivo |
| **1026** | Credit Suisse | CHF | N/A | N/A | N/A | Dati mensili non disponibili |

### Anomalie Identificate (da verificare)

1. **PRIORITA ALTA**: UBS EUR (1025) inizia con saldo **negativo** -50,573.62 EUR
2. **PRIORITA ALTA**: UBS EUR variazione **+65K EUR** in un mese (verificare transazione specifica)
3. **PRIORITA ALTA**: UBS CHF variazione **+202K CHF** in un mese (analizzare flussi)
4. **PRIORITA MEDIA**: Credit Suisse senza dettaglio mensile (usare dati Odoo)

---

## PROCEDURA DI VERIFICA

### Step 1: Connessione Odoo

```bash
URL: https://erp.alpenpur.ch
Database: alpenpur
User: apphubplatform@lapa.ch
```

Accedi a: **Contabilita** > **Primanota** > **Filtri personalizzati**

---

### Step 2: Query 1 - Saldi Apertura (01/07/2024)

**Obiettivo:** Verificare saldo al 30/06/2024 per ogni conto

**Query Odoo:**
```python
Modello: account.move.line
Dominio:
  - account_id.code IN ['1024', '1025', '1026']
  - date < '2024-07-01'
  - parent_state = 'posted'
Campi: account_id, debit, credit
Aggregazione: SUM(debit) - SUM(credit) GROUP BY account_id
```

**Risultati attesi:**
- Konto 1024: CHF **142,785.59**
- Konto 1025: EUR **-50,573.62** (NEGATIVO!)
- Konto 1026: Da determinare

**Tolleranza:** ±0.01 (1 centesimo)

**Azione se differenze:**
- Se differenza > 0.01: INVESTIGARE cause
- Possibili cause: movimenti non riconciliati giugno, errori apertura

---

### Step 3: Query 2 - Movimenti Luglio

**Obiettivo:** Estrarre TUTTI i movimenti luglio 2024 riga per riga

**Query Odoo:**
```python
Modello: account.move.line
Dominio:
  - account_id.code IN ['1024', '1025', '1026']
  - date >= '2024-07-01'
  - date <= '2024-07-31'
  - parent_state = 'posted'
Campi: id, date, name, ref, debit, credit, balance, move_id, partner_id, journal_id
Ordinamento: date ASC, id ASC
```

**Esporta in:** `movimenti-luglio-2024.csv`

**Analisi da fare:**
1. Conta transazioni per account
2. Somma DARE (debit) totale
3. Somma AVERE (credit) totale
4. Calcola: DARE - AVERE = Variazione
5. Confronta con variazione attesa

---

### Step 4: Query 3 - Saldi Chiusura (31/07/2024)

**Obiettivo:** Verificare saldo finale luglio

**Query Odoo:**
```python
Modello: account.move.line
Dominio:
  - account_id.code IN ['1024', '1025', '1026']
  - date <= '2024-07-31'
  - parent_state = 'posted'
Campi: account_id, debit, credit
Aggregazione: SUM(debit) - SUM(credit) GROUP BY account_id
```

**Risultati attesi:**
- Konto 1024: CHF **345,760.44**
- Konto 1025: EUR **14,702.54**
- Konto 1026: Da confrontare con estratto

**Validation:**
```
Saldo Chiusura = Saldo Apertura + Variazione

1024: 142,785.59 + 202,974.85 = 345,760.44 ✓
1025: -50,573.62 + 65,276.16 = 14,702.54 ✓
```

---

### Step 5: Query 4 - Cerca Duplicati

**Obiettivo:** Trova possibili movimenti duplicati

**Query Odoo:**
```python
Modello: account.move.line
Dominio:
  - account_id.code IN ['1024', '1025', '1026']
  - date >= '2024-07-01'
  - date <= '2024-07-31'
Campi: date, debit, credit, name
Aggregazione: GROUP BY date, debit, credit HAVING COUNT(*) > 1
```

**Azione se trovati:**
- Verifica se sono effettivamente duplicati
- Se si: marca uno come da eliminare
- Se no: documenta perche legittimi

---

### Step 6: Query 5 - Movimenti Grandi (>50K)

**Obiettivo:** Identifica transazioni significative da controllare

**Query Odoo:**
```python
Modello: account.move.line
Dominio:
  - account_id.code IN ['1024', '1025', '1026']
  - date >= '2024-07-01'
  - date <= '2024-07-31'
  - (debit > 50000) OR (credit > 50000)
Campi: date, name, debit, credit, partner_id, ref
Ordinamento: debit DESC, credit DESC
```

**Per ogni movimento trovato:**
1. Verifica corrispondenza con estratto bancario
2. Verifica partner corretto
3. Verifica descrizione chiara
4. Verifica causale/riferimento
5. Marca come verificato

---

## CHECKLIST DI VERIFICA

### Konto 1024 - UBS CHF

- [ ] Saldo apertura 01/07/2024 = CHF 142,785.59
- [ ] Saldo chiusura 31/07/2024 = CHF 345,760.44
- [ ] Totale DARE (entrate) calcolato
- [ ] Totale AVERE (uscite) calcolato
- [ ] DARE - AVERE = CHF 202,974.85
- [ ] Nessun duplicato trovato
- [ ] Tutti i movimenti hanno partner
- [ ] Movimenti >50K verificati
- [ ] Riconciliazione bancaria 100%

### Konto 1025 - UBS EUR

- [ ] Saldo apertura 01/07/2024 = EUR -50,573.62 (NEGATIVO)
- [ ] Saldo chiusura 31/07/2024 = EUR 14,702.54
- [ ] Movimento che riporta in positivo identificato
- [ ] Totale DARE (entrate) calcolato
- [ ] Totale AVERE (uscite) calcolato
- [ ] DARE - AVERE = EUR 65,276.16
- [ ] Differenze cambio verificate
- [ ] Nessun duplicato trovato
- [ ] Riconciliazione bancaria 100%

**ALERT:** Indagare perche saldo negativo giugno. Verificare scoperto autorizzato.

### Konto 1026 - Credit Suisse CHF

- [ ] Estratto mensile luglio richiesto/ottenuto
- [ ] Se non disponibile: movimenti estratti da Odoo
- [ ] Saldo calcolato manualmente
- [ ] Confrontato con saldo annuale (24,897.72)
- [ ] Completezza registrazioni verificata

---

## CONTROLLI QUALITA

Per ogni movimento verificare:

1. **Data corretta**: dentro periodo luglio 2024
2. **Partner assegnato**: no movimenti senza partner
3. **Descrizione chiara**: no descrizioni vuote o "/"
4. **Importo non zero**: no movimenti con debit=0 e credit=0
5. **Solo debit O credit**: no movimenti con entrambi
6. **Match con estratto**: corrispondenza con documento bancario
7. **Riconciliato**: flag riconciliazione attivo

---

## OUTPUT ATTESO

Al termine della verifica generare:

1. **Excel riepilogativo** con:
   - Tab 1: Saldi apertura/chiusura
   - Tab 2: Movimenti luglio per account
   - Tab 3: Duplicati trovati
   - Tab 4: Movimenti grandi (>50K)
   - Tab 5: Anomalie e note

2. **Report verifica** con:
   - % riconciliazione per account
   - Lista anomalie trovate
   - Azioni correttive necessarie
   - Firma e data verifica

3. **Files CSV**:
   - `movimenti-luglio-2024-konto-1024.csv`
   - `movimenti-luglio-2024-konto-1025.csv`
   - `movimenti-luglio-2024-konto-1026.csv`
   - `duplicati-luglio-2024.csv`
   - `movimenti-grandi-luglio-2024.csv`

---

## ANOMALIE PRIORITA ALTA

### 1. UBS EUR Saldo Negativo (1025)

**Problema:** Saldo 30/06/2024 = EUR **-50,573.62**

**Domande:**
- Esiste scoperto autorizzato su questo conto?
- Qual e il limite dello scoperto?
- Ci sono interessi passivi da registrare?
- Quando e tornato in positivo? (durante luglio)

**Azione:** Verificare contratto bancario UBS EUR e limite fido.

---

### 2. Movimento Grande UBS EUR +65K

**Problema:** Variazione **+EUR 65,276.16** in un mese

**Domande:**
- Qual e la transazione specifica?
- E una singola entrata o somma di piu movimenti?
- Da dove arriva questo denaro?
- E collegato a vendite, finanziamento, o altro?

**Azione:** Identificare riga per riga le entrate principali luglio EUR.

---

### 3. Movimento Grande UBS CHF +202K

**Problema:** Variazione **+CHF 202,974.85** in un mese

**Domande:**
- Quali sono le entrate/uscite principali?
- Flusso normale o evento straordinario?
- Corrispondenza con vendite o altro?

**Azione:** Analisi dettagliata flussi CHF luglio.

---

## FILE DISPONIBILI

- **Report JSON:** `REPORT-LUGLIO-2024.json` (questo documento strutturato)
- **Estratti bancari:**
  - `data-estratti/UBS-CHF-2024-CLEAN.json`
  - `data-estratti/UBS-EUR-2024-CLEAN.json`
  - `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`
- **Script verifica:** `scripts/verifica-luglio-2024-completa.py`
- **Script report:** `scripts/report-luglio-2024-manual.py`

---

## PROSSIMI STEP

1. **ORA:** Connetti a Odoo e esegui le 5 query
2. **OGGI:** Esporta risultati e genera CSV
3. **DOMANI:** Analisi riga per riga e checklist
4. **DOPODOMANI:** Report finale e presentazione

---

## SUPPORTO

Per domande o problemi:
- Consulta `REPORT-LUGLIO-2024.json` per dettagli tecnici
- Verifica query Odoo nel report JSON sezione `odoo_queries_required`
- Usa script Python per automazione se necessario

---

**Data creazione:** 2025-11-16
**Versione:** 1.0
**Backend Specialist:** Odoo Integration Master
