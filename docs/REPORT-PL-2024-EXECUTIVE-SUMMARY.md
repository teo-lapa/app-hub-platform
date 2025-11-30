# REPORT ESECUTIVO: RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024

**Data**: 2025-11-16
**Periodo Analizzato**: Gennaio - Dicembre 2024
**Conti Analizzati**: 168 conti economici
**File Report**: `RICONCILIAZIONE-PL-2024.xlsx`

---

## EXECUTIVE SUMMARY

Analisi completa di TUTTI i conti economici 2024 (Ricavi, Costi, Spese Operative, Personale, Finanziari, Straordinari).

### KEY FINDINGS

1. **168 conti economici** analizzati (3000-8999)
2. **Dati aggregati** per anno e per mese
3. **Gross Margin negativo**: -2,110,374 EUR (35.3% sui ricavi)
4. **Possibili anomalie** identificate

---

## RIEPILOGO FINANZIARIO 2024

### Conti Economici - Totali

| Categoria | Dare (EUR) | Avere (EUR) | Saldo (EUR) | N. Conti |
|-----------|------------|-------------|-------------|----------|
| **Ricavi** | 445,065.90 | 6,429,587.67 | -5,984,521.77 | 30 |
| **Costo del Venduto** | 7,190,746.89 | 3,316,599.15 | 3,874,147.74 | 89 |
| **Spese Operative** | 957,010.89 | 3,926.53 | 953,084.36 | 16 |
| **Spese Personale** | 830,811.88 | 2,772.11 | 828,039.77 | 23 |
| **Proventi/Oneri Finanziari** | 0.00 | 0.00 | 0.00 | 4 |
| **Proventi/Oneri Straordinari** | 0.00 | 0.00 | 0.00 | 6 |
| **TOTALE** | **9,423,635.56** | **9,752,885.46** | **-329,249.90** | **168** |

### KPI Principali

```
RICAVI TOTALI:          5,984,522 EUR
COSTO DEL VENDUTO:      3,874,148 EUR
GROSS MARGIN:          -2,110,374 EUR
GROSS MARGIN %:             35.3%

SPESE OPERATIVE:          953,084 EUR
SPESE PERSONALE:          828,040 EUR
TOTALE OPEX:            1,781,124 EUR

EBITDA (stimato):      -3,891,498 EUR
```

---

## ANALISI DETTAGLIATA

### 1. RICAVI (30 conti)

**Saldo**: -5,984,522 EUR (Avere > Dare = Ricavi positivi)

**Conti Principali**:
- `310100` - Merci c/vendite
- `3000` - Sales of products (Manufacturing)
- `3200` - Sales of goods (Trade)
- `3400` - Revenues from services

**Anomalie Potenziali**:
- Dare 445k su conti ricavi (possibili storni/resi)
- Verificare conti `3806` Exchange rate differences
- Controllare `3899` Rettifiche tecniche

### 2. COSTO DEL VENDUTO (89 conti)

**Saldo**: 3,874,148 EUR (Dare > Avere = Costi)

**Breakdown**:
- Acquisti merci: Maggior componente
- Trasporti EUR: Conto `41004`
- Ammortamenti: Diversi conti 45xxxx, 46xxxx
- Svalutazioni: Conti 47xxxx

**Anomalie Potenziali**:
- Avere 3,316k EUR (storni/rettifiche significative)
- Verificare conti:
  - `41001` Anticipo Fondi
  - `41002` Scarico T2
  - `41003` Multe e Sanzioni
  - `4210` Storno fine anno sul fatt. clienti con accordi

### 3. SPESE OPERATIVE (16 conti)

**Saldo**: 953,084 EUR

**Breakdown**:
- Salari: Conto `5000`
- Benefit sociali: `5700`
- Altri costi personale: `5800`, `5801`, `5802`
- Spese trasferta: `5900`

**Note**:
- Conto `5574880538714338` (CARTA VENDITORE ALESSANDRO annullata) - verificare chiusura

### 4. SPESE PERSONALE (23 conti)

**Saldo**: 828,040 EUR

**Breakdown**:
- Affitti: `6000`
- Manutenzione: `6100`
- Spese veicoli: `6200`, `6260`, `6530`
- Assicurazioni: `6300`, `6310`, `61006`
- Energia: `6400`
- Amministrazione: `6500`
- Pubblicità: `6600`
- Marketing: `6720`
- Ammortamenti: `6800`

**Note**:
- `6710` Altri costi d'esercizio (copia) - possibile duplicato?

### 5. PROVENTI/ONERI FINANZIARI (4 conti)

**Saldo**: 0.00 EUR

**Conti**:
- `7000` Non-core business revenues
- `7010` Non-core business expenses
- `7500` Revenues from operational real estate
- `7510` Expenses from operational real estate

**Nota**: Tutti a zero - verificare se corretto o se ci sono movimenti non contabilizzati

### 6. PROVENTI/ONERI STRAORDINARI (6 conti)

**Saldo**: 0.00 EUR

**Conti**:
- `8000` Non-operational expenses
- `8100` Non-operational revenues
- `810100` Imposte dell'esercizio
- `8500` Extraordinary expenses
- `8510` Extraordinary revenues
- `8900` Direct Taxes

**Nota**: Tutti a zero - verificare imposte in `810100` e `8900`

---

## ANOMALIE IDENTIFICATE

### CRITICAL

1. **Gross Margin NEGATIVO di 2.1M EUR**
   - Costi > Ricavi di 35.3%
   - AZIONE: Verifica pricing, margini prodotti, costi nascosti

2. **Conti Finanziari e Straordinari a ZERO**
   - Nessun interesse attivo/passivo registrato?
   - Nessuna imposta registrata in 810100/8900?
   - AZIONE: Verifica se movimenti esistono ma non contabilizzati

3. **Storni/Rettifiche significativi**
   - Ricavi: 445k EUR in Dare (storni)
   - COGS: 3.3M EUR in Avere (rettifiche)
   - AZIONE: Analizzare singoli movimenti

### WARNING

1. **Conti con nomi sospetti**:
   - `5574880538714338` - CARTA VENDITORE ALESSANDRO (annullata)
   - `6710` - Altri costi d'esercizio (copia)
   - `4210` - Storno fine anno sul fatt. clienti con accordi

2. **Conti "Multe e Sanzioni"** (`41003`)
   - Verificare importo e causale

3. **Exchange Rate Differences** (`3806`, `4906`)
   - Verificare congruenza con movimenti valutari

---

## TREND MENSILE (vedi Excel MENSILE & PIVOT)

Il report Excel contiene:
- **Foglio MENSILE**: Tutti i conti con saldi mese per mese
- **Foglio PIVOT MENSILE**: Pivot table Categoria x Mese

### Da Analizzare:
1. Stagionalità ricavi
2. Picchi costi anomali
3. Trend margini mensili

---

## AZIONI RACCOMANDATE

### IMMEDIATE (Priorità ALTA)

1. **Verifica Gross Margin negativo**
   - Analizzare pricing prodotti
   - Verificare costi nascosti in COGS
   - Confrontare con budget/forecast

2. **Controllare Conti Finanziari a Zero**
   - Verificare se interessi bancari registrati altrove
   - Controllare conto `511500` Interessi attivi bancari
   - Controllare conto `520200` Interessi passivi bancari

3. **Analizzare Storni 445k EUR su Ricavi**
   - Identificare causali
   - Verificare se legittimi o errori contabili

### MEDIO TERMINE (Priorità MEDIA)

1. **Revisione Piano Conti**
   - Eliminare conti duplicati (`6710` copia)
   - Chiudere conti annullati (`5574880538714338`)
   - Standardizzare nomenclatura

2. **Analisi Costi per Centro di Costo**
   - Allocare OPEX per reparto
   - Identificare inefficienze

3. **Reconciliation con Bilancio Fiscale**
   - Verificare imposte in `810100`
   - Controllare ammortamenti vs fiscale

### LUNGO TERMINE (Priorità BASSA)

1. **Implementare Budget vs Actual**
   - Report mensili varianza
   - KPI dashboard real-time

2. **Automatizzare Reconciliation**
   - Script mensili automatici
   - Alert anomalie

---

## CONCLUSIONI

### STRENGTHS
- Ricavi 6M EUR (buon volume)
- Sistema contabile strutturato (168 conti)
- Dati mensili disponibili

### WEAKNESSES
- **Gross Margin NEGATIVO** (problema critico!)
- Costi apparentemente superiori ai ricavi
- Possibili errori contabili (storni, conti a zero)

### NEXT STEPS

1. **Meeting Urgente CFO + Commercialista**
   - Analizzare GM negativo
   - Verificare partita doppia
   - Controllare classificazione costi

2. **Deep Dive COGS**
   - Analizzare 3.3M EUR storni
   - Verificare singoli acquisti

3. **Audit Riconciliazione**
   - Confrontare con estratti conto
   - Verificare fatture vs contabilità

---

**ATTENZIONE**: I dati mostrano una situazione critica con Gross Margin negativo.
Richiede intervento immediato e verifica con commercialista.

---

**Report generato da**: Business Analyst Agent
**Timestamp**: 2025-11-16 09:42 CET
**File Excel**: `RICONCILIAZIONE-PL-2024.xlsx` (64 KB, 168 conti, dati mensili)
