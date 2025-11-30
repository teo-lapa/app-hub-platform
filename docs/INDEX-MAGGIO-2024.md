# INDEX - ANALISI MAGGIO 2024

## START HERE

**Per iniziare subito**: Apri `MAGGIO-2024-QUICK-REFERENCE.md` per uno snapshot rapido

**Per analisi dettagliata**: Apri `REPORT-MAGGIO-2024-COMPLETO.md`

**Per lavoro interattivo**: Apri `REPORT-MAGGIO-2024.xlsx` (Excel)

---

## DELIVERABLES PRODOTTI

### Report Documentali

| File | Tipo | Scopo | Dimensione |
|------|------|-------|------------|
| `MAGGIO-2024-QUICK-REFERENCE.md` | Markdown | Snapshot rapido, flags, comandi | 1-pager |
| `REPORT-MAGGIO-2024-COMPLETO.md` | Markdown | Report executive dettagliato | 10+ pagine |
| `INDEX-MAGGIO-2024.md` | Markdown | Questo file - navigazione | Quick |

### Dati Strutturati

| File | Tipo | Scopo | Uso |
|------|------|-------|-----|
| `REPORT-MAGGIO-2024.json` | JSON | Dati completi strutturati | API, script, analisi |
| `REPORT-MAGGIO-2024.xlsx` | Excel | Report interattivo 4 fogli | Business analysis |

### Scripts Riutilizzabili

| File | Tipo | Scopo | Riutilizzo |
|------|------|-------|------------|
| `analizza-maggio-2024.py` | Python | Analisi transazioni | Modificabile per altri mesi |
| `genera-excel-maggio-2024.py` | Python | Excel generator | Template per altri report |
| `estrai-maggio-2024-odoo.py` | Python | Estrazione Odoo | Debug connessione richiesto |

---

## STRUTTURA REPORT

### REPORT-MAGGIO-2024-COMPLETO.md

**Sezioni**:
1. Executive Summary
2. Analisi Dettagliata Konto 1025
   - Verifica Saldi
   - Movimenti per Tipologia
   - Operazioni FX Forward
   - Top 10 Fornitori
   - Analisi Pattern Giornalieri
   - Movimenti Critici
   - Analisi Fornitori Principali
   - Saldo Progressivo
3. Pattern e Insights
4. Confronto con Odoo
5. Status Konto 1024 (UBS CHF)
6. Status Konto 1026 (Credit Suisse)
7. Raccomandazioni
8. Appendici (Query, Formule)

**Lunghezza**: ~10 pagine
**Tempo lettura**: 15-20 minuti
**Audience**: Management, Finance Team, Commercialista

### REPORT-MAGGIO-2024.xlsx

**Fogli**:
1. **Summary**: Overview, metriche chiave, movimenti per tipo
2. **Transazioni**: 70 righe dettagliate, filtri, conditional formatting
3. **Fornitori**: Ranking fornitori per importo, numero pagamenti, %
4. **Analisi Giornaliera**: Breakdown per giorno (entrate/uscite/netto)

**Features**:
- Tabelle Excel con filtri
- Conditional formatting (rosso/verde per +/-)
- Money format EUR
- Freeze panes per navigazione
- Auto-width colonne

**Audience**: Analisti, Controller, Team Finanza

### REPORT-MAGGIO-2024.json

**Struttura**:
```json
{
  "periodo": "Maggio 2024",
  "data_analisi": "ISO 8601 timestamp",
  "conti_analizzati": [
    {
      "codice": "1025",
      "descrizione": "UBS EUR",
      "iban": "...",
      "transazioni": 70,
      "totale_entrate_eur": 370000.0,
      "totale_uscite_eur": 363383.18,
      "saldo_netto_eur": 6616.82,
      ...
    }
  ],
  "movimenti_per_tipo": {
    "SEPA Batch Payment": {"count": 18, "total_eur": -149861.88},
    ...
  },
  "dettaglio_transazioni": [
    {
      "data": "2024-05-02",
      "partner": "...",
      "descrizione": "...",
      "importo_eur": -21383.65,
      "saldo_eur": -45690.57
    },
    ...
  ]
}
```

**Uso**: Importazione in altri tool, API, data analysis

---

## WORKFLOW CONSIGLIATO

### Per Executive Review (5 minuti)
```
1. Apri MAGGIO-2024-QUICK-REFERENCE.md
2. Leggi "Snapshot", "Top 5 Uscite", "Giorni Chiave"
3. Check "FLAGS & ALERTS" per anomalie
4. Review "PROSSIMI STEP"
```

### Per Analisi Approfondita (30 minuti)
```
1. Apri REPORT-MAGGIO-2024-COMPLETO.md
2. Leggi Executive Summary
3. Studia "Analisi Dettagliata Konto 1025"
4. Check "Movimenti Critici Identificati"
5. Review "Raccomandazioni"
6. Apri Excel per drill-down interattivo
```

### Per Data Analysis (1 ora+)
```
1. Carica REPORT-MAGGIO-2024.json in Python/R
2. Crea grafici personalizzati
3. Analizza pattern temporali
4. Confronta con altri mesi
5. Genera insights aggiuntivi
```

### Per Commercialista
```
1. Apri REPORT-MAGGIO-2024.xlsx
2. Foglio "Transazioni": Esporta CSV per import contabilità
3. Foglio "Fornitori": Verifica partite aperte
4. Foglio "Analisi Giornaliera": Riconciliazione estratto conto
```

---

## METRICHE CHIAVE (KONTO 1025)

### Financial Snapshot
```
Saldo Inizio:     EUR -24,306.92  (overdraft)
Saldo Fine:       EUR  -5,388.97  (overdraft ridotto)
Variazione:       EUR +18,917.95  (+77.8%)

Entrate:          EUR +370,000.00 (3 FX Forward)
Uscite:           EUR -363,383.18 (64 pagamenti)
Netto:            EUR  +6,616.82
```

### Operations
```
Transazioni:      70
Fornitori unici:  ~35
Batch SEPA:       6 operazioni
FX Forward:       3 operazioni (EUR 370K)
```

### Top Suppliers
```
1. DISCEFA:                  -32,321.77 EUR
2. FERRAIUOLO FOODS:         -31,709.65 EUR (11 fatture)
3. PEREIRA PRODUCTOS:        -31,449.60 EUR
4. DAYSEADAY FROZEN:         -30,213.35 EUR
5. LATTICINI MOLISANI:       -27,940.36 EUR (9 fatture)
```

---

## FLAGS & ACTION ITEMS

### RED FLAGS (Immediate Action)
```
1. Pagamento carta EUR 5,000 (Laura Teodorescu)
   → AZIONE: Verificare autorizzazione e scopo pagamento
   → DEADLINE: ASAP

2. Commissioni UBS EUR 794.36 (elevate)
   → AZIONE: Richiedere breakdown a UBS
   → DEADLINE: 1 settimana

3. DISCEFA EUR -32,321 (pagamento elevato)
   → AZIONE: Verificare contratto e termini
   → DEADLINE: 1 settimana
```

### YELLOW FLAGS (Review Required)
```
1. Overdraft persistente
   → AZIONE: Verificare linea di credito autorizzata
   → DEADLINE: 2 settimane

2. Termini pagamento 60-90gg
   → AZIONE: Negoziare sconto pronto cassa
   → DEADLINE: Prossimo rinnovo contratti

3. SEPA Costs EUR ~77K
   → AZIONE: Analizzare costi commissioni, ottimizzare batch
   → DEADLINE: 1 mese
```

### DATA GAPS (Completion Required)
```
1. Konto 1024 (UBS CHF)
   → AZIONE: Recuperare CSV Q2 2024
   → DEADLINE: 1 settimana

2. Konto 1026 (Credit Suisse)
   → AZIONE: OCR su PDF estratti conto
   → DEADLINE: 2 settimane

3. Validazione Odoo
   → AZIONE: Fix connessione, estrazione account.move.line
   → DEADLINE: 1 settimana
```

---

## QUERY RAPIDE

### Python - Analizza JSON
```python
import json

# Carica report
with open('REPORT-MAGGIO-2024.json') as f:
    data = json.load(f)

# Transazioni per fornitore
def by_partner(partner_name):
    return [tx for tx in data['dettaglio_transazioni']
            if partner_name.upper() in tx['partner'].upper()]

# Es: Latticini Molisani
latticini = by_partner('LATTICINI MOLISANI')
print(f"Transazioni: {len(latticini)}")
print(f"Totale: {sum(tx['importo_eur'] for tx in latticini):,.2f} EUR")
```

### SQL - Se importato in DB
```sql
-- Top 10 fornitori
SELECT
  partner,
  COUNT(*) AS num_pagamenti,
  SUM(ABS(importo_eur)) AS totale_eur
FROM transazioni_maggio_2024
WHERE importo_eur < 0
GROUP BY partner
ORDER BY totale_eur DESC
LIMIT 10;

-- Analisi per giorno
SELECT
  DATE(data) AS giorno,
  COUNT(*) AS num_transazioni,
  SUM(CASE WHEN importo_eur > 0 THEN importo_eur ELSE 0 END) AS entrate,
  SUM(CASE WHEN importo_eur < 0 THEN ABS(importo_eur) ELSE 0 END) AS uscite
FROM transazioni_maggio_2024
GROUP BY giorno
ORDER BY giorno;
```

---

## VERSIONING

| Versione | Data | Modifiche | Status |
|----------|------|-----------|--------|
| 1.0 | 16/11/2025 17:10 | Release iniziale - Solo Konto 1025 | PARZIALE |
| 1.1 | TBD | + Konto 1024 (UBS CHF) | PIANIFICATO |
| 1.2 | TBD | + Konto 1026 (Credit Suisse) | PIANIFICATO |
| 2.0 | TBD | Report consolidato 3 conti + Odoo validation | PIANIFICATO |

---

## SUPPORTO

**Generato da**: Backend Specialist Agent (Claude Code)
**Modello**: Claude Sonnet 4.5
**Data**: 16 Novembre 2025, 17:15 CET
**Workspace**: c:\Users\lapa\Desktop\Claude Code\app-hub-platform

**File sorgenti**:
- `data-estratti/UBS-EUR-2024-TRANSACTIONS.json` (487 transazioni 2024)
- `data-estratti/UBS-EUR-2024-CLEAN.json` (saldi mensili)
- `data-estratti/UBS-CHF-2024-CLEAN.json` (saldi mensili, no transazioni)
- `data-estratti/CREDIT-SUISSE-2024-CLEAN.json` (solo saldo finale)

**Scripts utilizzati**:
- `analizza-maggio-2024.py` - Analisi transazioni
- `genera-excel-maggio-2024.py` - Excel generator
- `estrai-maggio-2024-odoo.py` - Odoo extractor (non funzionante)

**Dipendenze**:
- Python 3.x
- openpyxl (per Excel)
- json, datetime, pathlib (standard library)

---

## NEXT ACTIONS

1. Review `MAGGIO-2024-QUICK-REFERENCE.md` per snapshot
2. Leggi `REPORT-MAGGIO-2024-COMPLETO.md` per dettagli
3. Apri `REPORT-MAGGIO-2024.xlsx` per analisi interattiva
4. Check FLAGS e action items
5. Pianifica estrazione Konto 1024 e 1026

**Buona analisi!**
