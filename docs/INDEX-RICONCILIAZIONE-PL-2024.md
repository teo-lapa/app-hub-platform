# INDEX - RICONCILIAZIONE CONTI ECONOMICI (P&L) 2024

## DOCUMENTAZIONE COMPLETA

Questa cartella contiene l'analisi completa dei conti economici (P&L) 2024 di Lapa.

---

## FILE PRINCIPALI

### 1. RICONCILIAZIONE-PL-2024.xlsx (64 KB)
**Report Excel completo con dati estratti da Odoo**

**Fogli**:
- `SUMMARY`: Tutti i 168 conti con totali 2024
- `MENSILE`: Saldi mensili Gen-Dic per ogni conto
- `KPI`: KPI aggregati per categoria
- `PIVOT MENSILE`: Pivot table Categoria x Mese

**Quando usarlo**: Analisi dettagliata, export dati, grafici

---

### 2. REPORT-PL-2024-EXECUTIVE-SUMMARY.md
**Executive Summary per Management/CFO**

**Contenuto**:
- Executive Summary
- Riepilogo Finanziario 2024
- Analisi Dettagliata per categoria
- Anomalie Identificate (CRITICAL + WARNING)
- Azioni Raccomandate
- Conclusioni

**Quando usarlo**: Meeting con CFO, Board, Commercialista

---

### 3. QUICK-START-ANALISI-PL-2024.md
**Guida Pratica per usare il Report Excel**

**Contenuto**:
- Come usare i 4 fogli Excel
- Analisi suggerite (GM, Stagionalità, Anomalie, etc.)
- Confronto con altri dati (Fatture, Budget)
- Riesecuzione script
- FAQ

**Quando usarlo**: Prima volta che usi il report, per capire come analizzare i dati

---

### 4. KPI-DASHBOARD-PL-2024.md
**Dashboard Visuale con KPI**

**Contenuto**:
- Income Statement (simplified)
- KPI Dashboard (Redditività, Efficienza, etc.)
- Breakdown Costi
- Anomalies & Alerts
- Recommendations

**Quando usarlo**: Vista veloce della situazione, presentazioni, report settimanali

---

### 5. INDEX-RICONCILIAZIONE-PL-2024.md (questo file)
**Indice navigabile di tutta la documentazione**

---

## SCRIPT PYTHON

### scripts/riconcilia-pl-2024-fast.py
**Script veloce per generare report (1 minuto)**

**Esecuzione**:
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/riconcilia-pl-2024-fast.py
```

**Output**: RICONCILIAZIONE-PL-2024.xlsx

**Caratteristiche**:
- Veloce (usa `read_group` di Odoo)
- Genera saldi aggregati annuali e mensili
- Non analizza anomalie dettagliate

---

### scripts/riconcilia-pl-2024.py
**Script completo con anomalie (20+ minuti)**

**Esecuzione**:
```bash
cd "c:\Users\lapa\Desktop\Claude Code\app-hub-platform"
python scripts/riconcilia-pl-2024.py
```

**Output**: RICONCILIAZIONE-PL-2024.xlsx + foglio ANOMALIE

**Caratteristiche**:
- Lento (scarica tutti i movimenti)
- Verifica partita doppia per ogni movimento
- Identifica duplicati, importi sospetti, etc.

**Quando usarlo**: Audit contabile completo, troubleshooting

---

## QUICK NAVIGATION

### Voglio...

**...vedere i numeri chiave**
→ Apri `KPI-DASHBOARD-PL-2024.md`

**...analizzare i dati in Excel**
→ Apri `RICONCILIAZIONE-PL-2024.xlsx`
→ Leggi `QUICK-START-ANALISI-PL-2024.md` per guide

**...presentare al CFO**
→ Apri `REPORT-PL-2024-EXECUTIVE-SUMMARY.md`
→ Porta anche `RICONCILIAZIONE-PL-2024.xlsx`

**...capire le anomalie**
→ Leggi sezione "ANOMALIE IDENTIFICATE" in `REPORT-PL-2024-EXECUTIVE-SUMMARY.md`
→ Esegui `scripts/riconcilia-pl-2024.py` per dettagli

**...rieseguire l'analisi**
→ Esegui `scripts/riconcilia-pl-2024-fast.py`
→ Vedi `QUICK-START-ANALISI-PL-2024.md` sezione "Riesecuzione Script"

**...confrontare con budget**
→ Aggiungi colonna Budget in `RICONCILIAZIONE-PL-2024.xlsx` foglio SUMMARY
→ Vedi `QUICK-START-ANALISI-PL-2024.md` sezione "vs Budget"

---

## RIEPILOGO SITUAZIONE

### DATI CHIAVE

```
Periodo Analizzato:  Gen-Dic 2024
Conti Analizzati:    168 conti economici
Data Estrazione:     2025-11-16

RICAVI:              5,984,522 EUR
COGS:                3,874,148 EUR
GROSS MARGIN:       -2,110,374 EUR (35.3%) 🚨
OPEX:                  953,084 EUR
PERSONNEL:             828,040 EUR
EBITDA (stimato):   -3,891,498 EUR 🚨
```

### STATUS

| Categoria | Status | Note |
|-----------|--------|------|
| Ricavi | ✅ Good | 6M EUR volume buono |
| COGS | 🚨 Critical | GM NEGATIVO! |
| OPEX | ✅ Good | 16% revenue (sotto 20%) |
| Personnel | ✅ Good | 14% revenue (sotto 20%) |
| Finanziari | ⚠️ Warning | Conti a zero (verificare) |
| Straordinari | ⚠️ Warning | Conti a zero (verificare) |

### TOP PRIORITIES

1. 🔥 **URGENTE**: Analizzare Gross Margin negativo
2. 🔍 **IMPORTANTE**: Verificare storni 3.3M EUR in COGS
3. 💰 **IMPORTANTE**: Controllare pricing prodotti
4. 📊 **MEDIO**: Verificare conti finanziari a zero
5. 🧹 **BASSO**: Pulizia piano conti (duplicati, annullati)

---

## WORKFLOW RACCOMANDATO

### 1. Prima Lettura (10 min)

1. Apri `KPI-DASHBOARD-PL-2024.md`
2. Leggi Executive Summary in `REPORT-PL-2024-EXECUTIVE-SUMMARY.md`
3. Identifica top priorities

### 2. Analisi Dettagliata (1-2 ore)

1. Apri `RICONCILIAZIONE-PL-2024.xlsx`
2. Segui guide in `QUICK-START-ANALISI-PL-2024.md`:
   - Analisi Gross Margin
   - Analisi Stagionalità
   - Trova Anomalie
3. Crea note e domande per commercialista

### 3. Meeting Preparazione (30 min)

1. Stampa `REPORT-PL-2024-EXECUTIVE-SUMMARY.md`
2. Prepara slides da Excel (grafici trend mensili)
3. Lista azioni immediate

### 4. Post-Meeting Follow-up

1. Aggiorna Excel con note meeting
2. Esegui script dettagliato se servono anomalie: `python scripts/riconcilia-pl-2024.py`
3. Implementa azioni correttive
4. Riesegui analisi mese prossimo

---

## SUPPORTO

### Domande?

1. Leggi `QUICK-START-ANALISI-PL-2024.md` sezione FAQ
2. Cerca in `REPORT-PL-2024-EXECUTIVE-SUMMARY.md`
3. Contatta Business Analyst Agent

### Problemi Script?

**Errore "No module xlsxwriter"**:
```bash
pip install xlsxwriter openpyxl pandas
```

**Errore connessione Odoo**:
- Verifica credenziali in script Python
- Controlla connessione internet
- Verifica URL Odoo corretto

**Script troppo lento**:
- Usa `riconcilia-pl-2024-fast.py` invece di `.py`
- Tempo atteso: 1 min (fast) vs 20+ min (completo)

---

## ROADMAP FUTURE

### Prossimi Sviluppi

- [ ] Automazione mensile (cron job)
- [ ] Dashboard web interattiva
- [ ] Alert automatici su KPI critici
- [ ] Confronto Budget vs Actual automatico
- [ ] Analisi per Centro di Costo
- [ ] Forecasting con ML

### Integrazioni Possibili

- [ ] Export automatico a Google Sheets
- [ ] Integrazione con Power BI
- [ ] API per real-time KPI
- [ ] Email report automatici CFO

---

## CHANGE LOG

### 2025-11-16 - Initial Release

**Created**:
- Script Python veloce (`riconcilia-pl-2024-fast.py`)
- Script Python completo (`riconcilia-pl-2024.py`)
- Report Excel con 4 fogli
- Executive Summary (MD)
- Quick Start Guide (MD)
- KPI Dashboard (MD)
- Index (questo file)

**Analisi**:
- 168 conti economici 2024
- Dati aggregati annuali
- Dati mensili Gen-Dic
- KPI per categoria
- Identificate anomalie critiche

**Findings**:
- Gross Margin NEGATIVO -2.1M EUR
- EBITDA NEGATIVO -3.9M EUR
- Conti finanziari/straordinari a zero
- Storni significativi da verificare

---

## CONTATTI

**Business Analyst Agent**
- Ruolo: Analista Business & KPI
- Expertise: Metriche, Report, Insights

**Per Supporto**:
1. Review documentazione in questo folder
2. Esegui script con parametri corretti
3. Contatta team IT se problemi tecnici

---

```
================================================================================
                     LAPA - P&L ANALYSIS 2024
                    Documentation Index v1.0
                    Generated: 2025-11-16
================================================================================
```

**File Count**: 7 file totali (4 documentazione + 2 script + 1 Excel)
**Total Size**: ~70 KB documentazione + 64 KB Excel
**Last Updated**: 2025-11-16 09:42 CET

---

**START HERE** → `KPI-DASHBOARD-PL-2024.md` (per vista veloce)
**or** → `QUICK-START-ANALISI-PL-2024.md` (per guide pratiche)
