# REPORT COMMERCIALISTA - VERIFICA KONTO 1025 UBS EUR

**Data verifica:** 16 novembre 2025, ore 17:46
**Commercialista:** Backend Specialist (Precision Mode)
**Odoo Environment:** Staging
**Database:** lapadevadmin-lapa-v2-staging-2406-25408900

---

## EXECUTIVE SUMMARY

Il conto 1025 UBS EUR presenta **GRAVI ANOMALIE** che richiedono intervento immediato.

### SALDI RILEVATI

| Metrica | Valore | Status |
|---------|--------|--------|
| **Saldo CHF** | -125,719.47 | NEGATIVO (atteso positivo) |
| **Saldo EUR** | -124,678.58 | NEGATIVO (atteso +128,860.70) |
| **GAP EUR** | **-253,539.28** | CRITICO |
| **Righe analizzate** | 1,323 | - |
| **Periodo** | Giugno 2023 - Novembre 2025 | 30 mesi |

---

## ANALISI CRITICA

### 1. PROBLEMA PRINCIPALE: SALDO NEGATIVO

Il conto 1025 UBS EUR, che dovrebbe essere un **asset** (conto corrente bancario in EUR),
presenta un saldo NEGATIVO di EUR -124,678.58 invece del saldo atteso positivo di EUR +128,860.70.

**Gap totale:** EUR -253,539.28

Questo indica:
- Movimenti bancari non registrati in contabilità
- Registrazioni contabili errate (dare/avere invertiti)
- Pagamenti duplicati o fittizi
- Mancata riconciliazione bancaria

### 2. EVOLUZIONE TEMPORALE DEL PROBLEMA

Analisi mese per mese del saldo cumulativo:

```
2023-06:      -10,390.61 CHF
2023-09:     +113,343.08 CHF  (picco positivo - ok)
2023-10:     +167,146.80 CHF  (massimo storico)
2023-12:      +86,770.98 CHF

2024-06:      -78,135.92 CHF  (prima crisi - giu 2024)
2024-07:       -3,714.14 CHF
2024-10:      +91,704.46 CHF  (recupero temporaneo)
2024-11:     -32,588.42 CHF  (ricaduta)
2024-12:     +108,267.67 CHF

2025-02:     -51,475.15 CHF  (seconda crisi - feb 2025)
2025-05:     -87,064.72 CHF  (peggioramento)
2025-06:    -129,385.78 CHF  (minimo storico)
2025-08:    -163,956.96 CHF  (peggioramento critico)
2025-11:    -125,719.47 CHF  (stato attuale)
```

**PATTERN IDENTIFICATO:**
- Giugno 2024: primo crollo (-246k CHF in un mese)
- Febbraio 2025: secondo crollo (-156k CHF in un mese)
- Agosto 2025: terzo crollo (-173k CHF in un mese)

Questi crolli coincidono con periodi di alta movimentazione (57-65 righe/mese).

### 3. TOP FORNITORI CON MAGGIORI MOVIMENTI

| Partner | Righe | Movimenti CHF |
|---------|-------|---------------|
| FERRAIUOLO FOODS SRL | 40 | 665,177.66 |
| LATTICINI MOLISANI TAMBURRO SRL | 32 | 618,762.06 |
| LATTERIA SOCIALE MANTOVA | 38 | 390,934.68 |
| RISTORIS SRL | 47 | 369,060.90 |
| ItaEmpire S.r.l. | 39 | 350,996.23 |
| GENNARO AURICCHIO S.P.A. | 38 | 237,574.30 |
| LDF SRL | 39 | 185,395.91 |

**NOTA:** Verificare se questi fornitori sono stati effettivamente pagati in EUR da UBS.

### 4. ANOMALIE RILEVATE

#### CRITICHE (1)
- **Saldo fuori range:** -125,719.47 CHF invece di range atteso 135,000-140,000 CHF

#### ALTE (5)
- **Possibili duplicati:**
  - 2 righe da CHF -471.42 il 11/10/2023
  - 2 righe da CHF -244.44 il 16/08/2024
  - 2 righe da CHF -1,940.00 il 12/02/2025
  - 2 righe da CHF -3,880.00 il 08/05/2025
  - 3 righe da CHF -2,233.91 il 16/10/2025

#### MEDIE (59)
- 3 righe con importo zero (anomalie tecniche)
- 56 importi elevati > CHF 50,000 (bonifici, trasferimenti)

### 5. VERSAMENTI RICORRENTI

Pattern versamenti mensili EUR 150,000:
- Agosto 2023: +150,000 EUR
- Settembre 2023: +150,000 EUR
- Ottobre 2023: +150,000 EUR
- Dicembre 2023: +150,000 EUR
- Gennaio 2024: +300,000 EUR (doppio!)
- Dicembre 2024: +100,000 EUR
- E altri...

**TOTALE VERSAMENTI:** ~6,308,328 CHF (dare)
**TOTALE PAGAMENTI:** ~6,434,048 CHF (avere)

**Differenza:** -125,720 CHF → Pagato più di quanto versato!

---

## RACCOMANDAZIONI OPERATIVE

### IMMEDIATE (entro 48h)

1. **Scaricare estratti conto UBS EUR** per periodo:
   - Giugno 2023 - Novembre 2025
   - Formato PDF + CSV se disponibile

2. **Riconciliare manualmente** i 3 mesi critici:
   - Giugno 2024 (-168k CHF)
   - Febbraio 2025 (-156k CHF)
   - Agosto 2025 (-173k CHF)

3. **Verificare duplicati** (5 gruppi identificati):
   - Controllare fatture/bonifici sottostanti
   - Stornare se duplicati confermati

### BREVE TERMINE (entro 1 settimana)

4. **Riconciliazione sistematica:**
   - Importare estratti conto in Odoo
   - Match automatico righe bancarie vs contabili
   - Identificare righe non matchate

5. **Analisi fornitori top 10:**
   - Verificare contratti di pagamento (valuta EUR?)
   - Confermare importi pagati vs fatturato
   - Identificare eventuali overpayment

6. **Correzioni contabili:**
   - Stornare registrazioni errate (dare/avere invertito?)
   - Registrare movimenti bancari mancanti
   - Ri-calcolare saldo finale

### MEDIO TERMINE (entro 1 mese)

7. **Implementare riconciliazione automatica:**
   - Setup bank feeds UBS → Odoo
   - Regole automatiche di matching
   - Alert su discrepanze > 1,000 EUR

8. **Audit completo:**
   - Revisione tutti i conti UBS (1020, 1025, etc.)
   - Verifica coerenza multi-currency
   - Chiusura gap contabili

---

## IMPATTO BUSINESS

### IMPATTO FINANZIARIO
- **Liquidità sovrastimata:** ~EUR 253,539
- **Asset overvaluation:** Bilancio potenzialmente sovrastimato
- **Rischio audit:** Gravi discrepanze contabili

### IMPATTO OPERATIVO
- **Pagamenti duplicati?** Possibile cash loss
- **Mancata riconciliazione:** Impossibile chiudere 2024 correttamente
- **Compliance:** Violazione principi contabili svizzeri

---

## PROSSIMI PASSI

### Step 1: VALIDAZIONE
Confermare con Paul/Lapa:
- Saldo bancario effettivo UBS EUR al 16/11/2025
- Estratti conto disponibili per periodo 2023-2025
- Autorizzazione a procedere con correzioni

### Step 2: RICONCILIAZIONE
- Eseguire riconciliazione bancaria completa
- Identificare ogni singola discrepanza
- Documentare correzioni necessarie

### Step 3: CORREZIONE
- Preparare scritture di rettifica
- Approvazione commercialista
- Esecuzione correzioni in staging
- Validazione finale

### Step 4: PREVENZIONE
- Setup automazione riconciliazione
- Monitoring mensile saldi
- Alert su anomalie

---

## ALLEGATI

- **report-verifica-1025-ubs-eur-20251116-174603.json** - Dati completi analisi (1323 righe)
- **verifica-konto-1025-ubs-eur.py** - Script di verifica utilizzato

---

## CONCLUSIONE

Il konto 1025 UBS EUR richiede **intervento immediato**. Il gap di EUR -253,539.28 è
**INACCETTABILE** per un conto corrente bancario e indica gravi problemi di:

1. Registrazione contabile (dare/avere errati?)
2. Riconciliazione bancaria (movimenti non registrati?)
3. Possibili duplicazioni (5 gruppi identificati)

**RACCOMANDAZIONE FINALE:**
Bloccare chiusura contabile 2024 fino a risoluzione completa discrepanze konto 1025.

---

**Report generato da:** Backend Specialist - Commercialista Mode
**Timestamp:** 2025-11-16 17:50:00 CET
**Versione:** 1.0
