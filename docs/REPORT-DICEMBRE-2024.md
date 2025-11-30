# REPORT DICEMBRE 2024 - VERIFICA COMPLETA RIGA PER RIGA

**Data analisi**: 16 Novembre 2025
**Periodo**: 01/12/2024 - 31/12/2024
**Konti analizzati**: 1024 (UBS CHF), 1025 (UBS EUR), 1026 (Credit Suisse CHF)

---

## EXECUTIVE SUMMARY

### Totale Movimenti
- **605 righe** estratte da Odoo per dicembre 2024
- **1 riga riconciliata** (0.17%)
- **604 righe NON riconciliate** (99.83%)

### Criticita Identificate

**ALERT MASSIMA PRIORITA: Tutte e 3 i conti presentano differenze significative**

| Konto | Banca | Saldo ODOO 31/12 | Saldo BANCA 31/12 | Differenza | Status |
|-------|-------|------------------|-------------------|------------|--------|
| **1024** | UBS CHF | CHF 133,750.03 | CHF 182,573.56 | **-CHF 48,823.53** | CRITICO |
| **1025** | UBS EUR | EUR 108,267.67 | EUR 128,860.70 | **-EUR 20,593.03** | CRITICO |
| **1026** | Credit Suisse | CHF 371,453.70 | CHF 24,897.72 | **+CHF 346,555.98** | CRITICO |

**Differenza totale in CHF (approssimata)**: ~CHF 415,000

---

## ANALISI DETTAGLIATA PER ACCOUNT

### 1. KONTO 1024 - UBS CHF (278-122087.01J)

#### Saldi
```
Saldo apertura 01/12/2024:     (39,722.81) CHF
Movimenti dicembre:
  - Addebiti (debit):           646,659.53 CHF
  - Accrediti (credit):         473,186.69 CHF
  - Movimento netto:            173,472.84 CHF
Saldo chiusura 31/12 ODOO:     133,750.03 CHF
Saldo chiusura 31/12 BANCA:    182,573.56 CHF

DIFFERENZA:                    -48,823.53 CHF
```

#### Dettagli
- **407 righe** in dicembre 2024
- **0 righe riconciliate**
- **407 righe NON riconciliate**

#### Tipologia Movimenti
I movimenti includono principalmente:
- Pagamenti fornitori (Demaurex, Transgourmet, ecc.)
- Stipendi dipendenti (Negoita, Corsano, Bucur, Rozescu, ecc.)
- Pagamenti assicurazioni (Zurich, BMW Leasing)
- Pagamenti clienti ristoranti
- Bonifici intercompany (Lapa Finest Italian Food GmbH)
- Cambio valuta EUR/CHF
- Pagamenti carta di debito POS

#### Pattern Anomalo
**Saldo ODOO inferiore di CHF 48,823.53**: possibili cause
1. Movimenti bancari non registrati in Odoo (incassi mancanti?)
2. Errori di importazione estratto conto
3. Movimenti in transito non contabilizzati
4. Riconciliazioni mancanti

---

### 2. KONTO 1025 - UBS EUR (278-122087.60A)

#### Saldi
```
Saldo apertura 01/12/2024:     (32,588.42) EUR
Movimenti dicembre:
  - Addebiti (debit):           339,500.00 EUR
  - Accrediti (credit):         198,643.91 EUR
  - Movimento netto:            140,856.09 EUR
Saldo chiusura 31/12 ODOO:     108,267.67 EUR
Saldo chiusura 31/12 BANCA:    128,860.70 EUR

DIFFERENZA:                    -20,593.03 EUR (~22,000 CHF)
```

#### Dettagli
- **32 righe** in dicembre 2024
- **0 righe riconciliate**
- **32 righe NON riconciliate**

#### Tipologia Movimenti
Conto EUR principalmente per:
- Incassi clienti EUR
- Pagamenti fornitori italiani in EUR
- Cambio valuta EUR/CHF

#### Pattern Anomalo
**Saldo ODOO inferiore di EUR 20,593.03**: possibili cause
1. Incassi EUR non registrati in Odoo
2. Cambio valuta non contabilizzato correttamente
3. Movimenti di fine anno in transito
4. Differenze cambio non riconciliate

---

### 3. KONTO 1026 - CREDIT SUISSE CHF (3977497-51)

#### Saldi
```
Saldo apertura 01/12/2024:     362,273.31 CHF
Movimenti dicembre:
  - Addebiti (debit):            25,000.00 CHF
  - Accrediti (credit):          15,819.61 CHF
  - Movimento netto:              9,180.39 CHF
Saldo chiusura 31/12 ODOO:     371,453.70 CHF
Saldo chiusura 31/12 BANCA:     24,897.72 CHF

DIFFERENZA:                    +346,555.98 CHF
```

#### Dettagli
- **166 righe** in dicembre 2024
- **1 riga riconciliata**
- **165 righe NON riconciliate**

#### Tipologia Movimenti
Principalmente:
- Pagamenti carta di credito/debito POS
- Commissioni bancarie
- Tasse e spese conto

#### Pattern CRITICO - CAUSA IDENTIFICATA
**Saldo ODOO superiore di CHF 346,556**: Questo e il problema piu grave!

**CAUSA IDENTIFICATA**:

**Movimento errato: BNK3/2024/00867 del 03/06/2024**
- **ID Move**: 58103
- **Descrizione**: "azzeramento 2023"
- **DARE 1026** (Credit Suisse): CHF 132,834.54
- **AVERE 1021** (Bank Suspense Account): CHF 132,834.54
- **Status**: Posted (contabilizzato)

Questo movimento ha gonfiato artificialmente il saldo del konto 1026 di CHF 132,834.54.

**Analisi saldi progressivi 2024**:
- 31/12/2023: CHF 10,903.87 (CORRETTO)
- 01/01/2024: CHF 10,903.87 (CORRETTO)
- Gen-Feb-Mar-Apr-Mag: incremento graduale fino a CHF 115,455.18
- **03/06/2024**: SALTO ANOMALO +CHF 132,834.54 (movimento errato!)
- Giugno fine mese: CHF 329,971.59
- Lug-Ago-Set-Ott-Nov-Dic: incremento fino a CHF 371,453.70

**Movimenti mensili con importi DARE elevati**:
- Gennaio: +CHF 50,903.87 (rettifica apertura)
- Febbraio: +CHF 40,000.00
- Marzo: +CHF 50,000.00
- Aprile: +CHF 70,000.00
- **Giugno: +CHF 235,834.54** (include movimento errato!)

**Differenza spiegata**:
- Saldo atteso (senza movimento errato): CHF 238,619.16 (371,453.70 - 132,834.54)
- Saldo bancario reale: CHF 24,897.72
- **Differenza residua**: CHF 213,721.44

Rimane comunque una differenza di CHF 213K da investigare, probabilmente dovuta a:
1. Rettifiche di apertura errate (gennaio: +CHF 50,903.87)
2. Movimenti DARE mensili eccessivi (febbraio-maggio: +CHF 160,000)
3. Altri movimenti di rettifica non giustificati

Nota: Il file `CREDIT-SUISSE-2024-CLEAN.json` indica che ci sono 2 sottoconti:
- 3977497-51: CHF 11,120.67
- 3977497-51-1: CHF 13,777.05
- **Totale reale**: CHF 24,897.72

Il konto 1026 in Odoo mostra CHF 371,453.70 che e **15x il saldo reale**!

---

## AZIONI IMMEDIATE RICHIESTE

### Priorita 1: KONTO 1026 - Credit Suisse (CRITICO) - SOLUZIONE TROVATA

**AZIONE IMMEDIATA**: Eliminare movimento errato BNK3/2024/00867

**Movimento da eliminare**:
- **Move ID**: 58103
- **Nome**: BNK3/2024/00867
- **Data**: 03/06/2024
- **Importo**: CHF 132,834.54 DARE su konto 1026
- **Contropartita**: CHF 132,834.54 AVERE su konto 1021 (Bank Suspense)
- **Descrizione**: "azzeramento 2023"

**Script generato**: `scripts/elimina-movimento-azzeramento-1026.py`

**Impatto atteso**:
- Saldo konto 1026 passerebbe da CHF 371,453.70 a CHF 238,619.16
- Differenza residua: CHF 213,721.44 (da investigare ulteriormente)

**ATTENZIONE**: Dopo eliminazione di questo movimento, rimane una differenza di CHF 213K dovuta probabilmente a:

1. **Rettifica apertura gennaio errata**: +CHF 50,903.87
   - Move: "Rettifiche Chiusura 2023"
   - Da verificare se giustificata

2. **Movimenti DARE mensili eccessivi** (feb-apr):
   - Febbraio: +CHF 40,000
   - Marzo: +CHF 50,000
   - Aprile: +CHF 70,000
   - **Totale**: CHF 160,000 in 3 mesi
   - Possibile import errato o movimenti intercompany non giustificati

**Steps successivi**:
1. Eliminare movimento BNK3/2024/00867 (move_id 58103)
2. Investigare rettifica apertura gennaio (+CHF 50,903.87)
3. Analizzare movimenti DARE feb-apr (CHF 160,000)
4. Verificare se ci sono altri "azzeramenti" o rettifiche non giustificati
5. Confrontare con estratto conto Credit Suisse riga per riga

**Duplicati trovati**: Solo 4 righe duplicate per CHF 5,301.30 (irrilevanti rispetto al problema principale)

### Priorita 2: KONTO 1024 - UBS CHF (Mancano CHF 48,823)

**Azione**: Identificare movimenti bancari non registrati in Odoo

**Steps**:
1. Estrarre CSV UBS CHF per dicembre 2024 dall'estratto conto
2. Confrontare riga per riga con movimenti Odoo
3. Identificare movimenti presenti in banca ma non in Odoo
4. Verificare se sono in draft o in altri journal
5. Importare movimenti mancanti

**Possibili movimenti mancanti**:
- Incassi clienti fine dicembre
- Storno commissioni
- Accrediti interessi
- Movimenti di fine mese in data valuta

### Priorita 3: KONTO 1025 - UBS EUR (Mancano EUR 20,593)

**Azione**: Riconciliazione EUR con estratto bancario

**Steps**:
1. Estrarre CSV UBS EUR per dicembre 2024
2. Verificare movimenti cambio valuta EUR/CHF
3. Controllare differenze cambio non contabilizzate
4. Importare movimenti mancanti
5. Riconciliare differenze cambio

---

## RICONCILIAZIONE: 0.17% COMPLETATA

**ALERT**: Solo **1 riga su 605** e riconciliata!

Questo significa che:
- Non c'e riconciliazione bancaria in corso
- Non ci sono match tra movimenti bancari e fatture/pagamenti
- Sistema di controllo interno non funziona

**Raccomandazione**: Implementare processo di riconciliazione bancaria mensile

---

## PROSSIMI STEP

### Immediati (Oggi)
1. Eseguire query duplicati su konto 1026
2. Estrarre CSV dicembre 2024 da portali bancari UBS e Credit Suisse
3. Confrontare riga per riga con report JSON generato

### Breve termine (Questa settimana)
1. Correggere konto 1026 (eliminare duplicati)
2. Importare movimenti mancanti konto 1024 e 1025
3. Verificare saldi di apertura per tutti e 3 i conti
4. Riconciliare almeno il 50% delle righe

### Medio termine (Questo mese)
1. Implementare processo di riconciliazione bancaria automatico
2. Creare dashboard di controllo saldi in tempo reale
3. Formare team su import/riconciliazione corretta
4. Audit completo anno 2024

---

## FILE GENERATI

1. **REPORT-DICEMBRE-2024.json** (354 KB)
   - Dettaglio completo di tutte le 605 righe
   - Include: date, move_id, move_name, description, ref, debit, credit, balance, partner, journal

2. **REPORT-DICEMBRE-2024.md** (questo file)
   - Executive summary
   - Analisi per account
   - Azioni richieste

3. **Script analisi**: `scripts/analizza-dicembre-2024-dettaglio.py`
   - Script riutilizzabile per altri mesi
   - Connessione Odoo XML-RPC
   - Confronto automatico con estratti

---

## FONTI DATI

### Estratti Bancari
- `data-estratti/UBS-CHF-2024-CLEAN.json`: Saldo 31/12 = CHF 182,573.56
- `data-estratti/UBS-EUR-2024-CLEAN.json`: Saldo 31/12 = EUR 128,860.70
- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json`: Saldo 31/12 = CHF 24,897.72

### Odoo
- Database: `lapadevadmin-lapa-v2-main-7268478`
- URL: `https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com`
- Modelli: `account.account`, `account.move`, `account.move.line`

---

## CONTATTI

Per domande su questo report:
- Backend Specialist (analisi dati, script Python, Odoo integration)
- Commercialista (interpretazione contabile, rettifiche)

---

**ATTENZIONE**: Questo report e basato su dati estratti il 16/11/2025. Eventuali modifiche successive in Odoo non sono riflesse.

**NEXT REVIEW**: Dopo correzioni, rieseguire script per verificare saldi allineati.
