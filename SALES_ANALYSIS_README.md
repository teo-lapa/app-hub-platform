# LAPA Food Business - Sales Analysis Complete Package

## Overview

Questo package contiene un'analisi completa e dettagliata dei dati di vendita reali di LAPA degli ultimi 4 mesi (Giugno-Ottobre 2025), con tutto il necessario per implementare una dashboard intelligente di gestione inventario.

## Data di Analisi
**15 Ottobre 2025**

## Dati Analizzati
- **Periodo**: 17 Giugno 2025 - 15 Ottobre 2025 (120 giorni)
- **Righe Ordine**: 10,000
- **Prodotti Unici**: 1,193
- **Prodotti TOP**: 234 (con >10 ordini)
- **Database**: Odoo Staging lapadevadmin-lapa-v2-main-7268478

## File Generati

### 1. LAPA_SALES_ANALYSIS_REPORT.md (18 KB)
**Report dettagliato in formato Markdown**

Contiene:
- Executive Summary con insights chiave
- 7 prodotti CRITICI che richiedono ordine immediato
- 10 prodotti da ordinare questa settimana
- TOP 30 prodotti più venduti con metriche complete
- Pattern di vendita settimanali (Martedì = giorno chiave)
- Analisi trend (prodotti in crescita/declino)
- Raccomandazioni strategiche
- KPI e metriche business

**Uso**: Lettura per management e team, decisioni strategiche

### 2. sales-analysis-data.json (15 KB)
**Dati strutturati in formato JSON**

Contiene:
- Metadata dell'analisi
- Array prodotti critici con tutti i dettagli
- Array prodotti warning
- TOP products con ranking e metriche
- Pattern settimanali aggregati
- Trend analysis
- Categorie prodotti
- KPI strutturati

**Uso**: Consumo diretto da API/Frontend, pronto per dashboard

### 3. DASHBOARD_IMPLEMENTATION_GUIDE.md (30 KB)
**Guida tecnica completa per implementazione**

Contiene:
- Architettura della dashboard
- API endpoints da implementare (con esempi request/response)
- Componenti React completi e pronti all'uso
- Struttura file sistema
- Cron job per aggiornamento automatico
- Utility functions e formule di calcolo
- Piano di implementazione per fasi (15-23 giorni)
- Best practices e testing
- Performance optimization tips

**Uso**: Guida per sviluppatori, implementazione tecnica

### 4. sales-analysis-report.txt (9.5 KB)
**Output raw dello script di analisi**

Contiene:
- Log completo dell'esecuzione
- Tutte le tabelle e output console
- Utile per debug e verifica

**Uso**: Reference tecnico, debugging

### 5. scripts/analyze-sales-data.js (21 KB)
**Script Node.js per l'analisi**

Features:
- Connessione diretta a Odoo staging
- Autenticazione automatica
- Analisi completa degli ultimi 120 giorni
- Calcolo automatico di:
  - Media vendite giornaliere
  - Variabilità prodotti
  - Pattern settimanali
  - Giorni rimanenti di stock
  - Punti di riordino
  - Trend crescita/declino
- Output formattato per console e file

**Uso**:
```bash
node scripts/analyze-sales-data.js
```

Può essere schedulato per esecuzione giornaliera automatica.

## Quick Start

### Per Business/Management

1. Leggi **LAPA_SALES_ANALYSIS_REPORT.md** per capire:
   - Quali prodotti ordinare OGGI (7 critici)
   - Cosa ordinare questa settimana (10 prodotti)
   - Pattern chiave del business (Martedì = picco vendite)
   - Opportunità di miglioramento

2. Azioni immediate:
   ```
   🔴 URGENTE - Ordinare OGGI:
   - FUNGHI PORCINI (0 kg in stock)
   - TUORLO D'UOVO (0 kg in stock)
   - FARINA CAPUTO ROSSA (1.4 giorni rimasti)
   - FIORDILATTE BOCCONCINO (3 giorni rimasti)
   - SPAGHETTI CHITARRA (3.3 giorni rimasti)
   - BURRATA (3.7 giorni rimasti)
   ```

### Per Sviluppatori

1. Leggi **DASHBOARD_IMPLEMENTATION_GUIDE.md**

2. Setup iniziale:
   ```bash
   # Il progetto è già configurato con:
   # - Next.js 14
   # - Connessione Odoo
   # - Script di analisi funzionante

   # Per testare lo script:
   cd app-hub-platform
   node scripts/analyze-sales-data.js
   ```

3. Implementa la dashboard seguendo le priorità:
   - **Priority 1**: Alert Panel (prodotti critici)
   - **Priority 2**: Top Movers (prodotti più venduti)
   - **Priority 3**: Sales Patterns (heatmap settimanale)
   - **Priority 4**: Smart Ordering Assistant
   - **Priority 5-7**: Analytics, Categories, Settings

4. Usa i dati da **sales-analysis-data.json** come fonte dati iniziale

5. Setup cron job per aggiornamento giornaliero automatico

### Per Aggiornare i Dati

Esegui manualmente:
```bash
node scripts/analyze-sales-data.js > sales-analysis-report.txt
```

O configura cron job (vedi DASHBOARD_IMPLEMENTATION_GUIDE.md)

## Key Findings - Executive Summary

### ✅ Conferme Business Model

LAPA è **principalmente B2B** che rifornisce pizzerie professionali:
- 95% vendite nei giorni feriali
- Martedì = giorno di punta (35% volume settimanale)
- Rapporto settimana/weekend fino a 3700:1 su alcuni prodotti
- Weekend = minimo (8% volume combinato)

### 🚨 Criticità Immediate

**7 prodotti critici** (< 5 giorni di stock):
- 3 prodotti con ZERO stock (out of stock!)
- 4 prodotti con stock critico (1-4 giorni rimasti)
- **Azione**: Ordinare OGGI per evitare rotture

**10 prodotti warning** (5-10 giorni):
- Principalmente formaggi freschi ad alta rotazione
- **Azione**: Pianificare ordini questa settimana

### 📊 Top Insights

1. **CARTONI PIZZA dominano**: 14,000 pezzi in 4 mesi per un solo tipo
2. **Formaggi freschi critici**: Alta rotazione (6 giorni media)
3. **Martedì è TUTTO**: Assicurare stock pieno ogni lunedì sera
4. **3 prodotti in declino**: -20/-30% vendite richiede investigazione

### 💡 Opportunità

1. **Prevenire stockout formaggi**: Contratti settimanali con caseifici
2. **Ottimizzare cartoni pizza**: Alta variabilità = possibile sovra-stock
3. **Investigare decline**: Capire perché 3 prodotti TOP calano
4. **Seasonal analysis**: Analizzare 12+ mesi per pattern stagionali

### 📈 Pattern Scoperti

**Pattern Settimanale Chiaro:**
```
Lun: ████████░░  40%
Mar: ██████████ 100%  <- PICCO
Mer: ████░░░░░░  20%
Gio: ████░░░░░░  20%
Ven: ████████░░  40%
Sab: ██░░░░░░░░  10%
Dom: ██░░░░░░░░  10%
```

**Implicazioni Operative:**
- Stock massimo richiesto: Lunedì sera
- Consegne fornitori ideali: Lunedì/Martedì mattina
- Evitare rotture: Martedì critico

### 🎯 Prossimi Passi

**Immediati (oggi):**
- [ ] Ordinare 7 prodotti critici
- [ ] Pianificare ordini 10 prodotti warning
- [ ] Review con fornitori lead time

**Breve termine (1 mese):**
- [ ] Implementare dashboard alert panel
- [ ] Setup cron job aggiornamento giornaliero
- [ ] Configurare alert automatici

**Medio termine (2-3 mesi):**
- [ ] Dashboard completa con tutte le sezioni
- [ ] Forecasting automatico
- [ ] Ottimizzazione quantità ordine

**Lungo termine (6+ mesi):**
- [ ] Sistema demand planning integrato
- [ ] Predictive analytics
- [ ] Integration POS clienti

## Metriche Chiave (KPI)

| Metrica | Valore |
|---------|--------|
| Prodotti critici (< 5 giorni) | **7** |
| Prodotti warning (5-10 giorni) | **10** |
| Stock-out attuali | **3** |
| Prodotti analizzati | 1,193 |
| Prodotti attivi (>10 ordini) | 234 |
| Giorno picco vendite | **Martedì (35%)** |
| Ratio B2B | 95% |
| Weekday/Weekend ratio | 15.7:1 |

## Categorie Prodotto

| Categoria | % Volume | Rotazione Media | Strategia |
|-----------|----------|-----------------|-----------|
| Packaging Pizzeria | 35% | 10-14 giorni | Ordini bisettimanali |
| Formaggi Freschi | 28% | 5-7 giorni | **Ordini settimanali** |
| Conserve/Pomodori | 15% | 14-21 giorni | Ordini mensili |
| Farine/Cereali | 12% | 14 giorni | Ordini bisettimanali |
| Latticini | 10% | 12 giorni | Ordini bisettimanali |

## Formule Usate

```javascript
// Media vendite giornaliere
avgDailySales = totalQty / daysActive

// Giorni rimanenti
daysRemaining = currentStock / avgDailySales

// Punto di riordino (7 giorni buffer)
reorderPoint = avgDailySales × 7

// Variabilità (Coefficient of Variation)
variability = stdDev / mean

// Trend growth
growth = ((recentAvg - oldAvg) / oldAvg) × 100
```

## Credenziali e Connessione

**Odoo Staging:**
- URL: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
- Database: lapadevadmin-lapa-v2-main-7268478
- User: paul@lapa.ch
- (password nel .env.local)

**Script Location:**
- `app-hub-platform/scripts/analyze-sales-data.js`

**Data Files:**
- JSON cache: `app-hub-platform/sales-analysis-data.json`
- Report text: `app-hub-platform/sales-analysis-report.txt`

## Tech Stack

- **Backend**: Node.js + Odoo XML-RPC
- **Analysis**: Custom algorithms in JavaScript
- **Data Source**: Odoo `sale.order.line` model
- **Frontend (to implement)**: Next.js 14 + React + shadcn/ui
- **Charts**: Recharts
- **Scheduling**: Vercel Cron / node-cron

## Supporto

Per domande o issues:
1. Consulta i file di documentazione
2. Review lo script `analyze-sales-data.js`
3. Check i dati in `sales-analysis-data.json`

## License

Proprietario - LAPA finest italian food GmbH

---

## Files Overview

```
app-hub-platform/
├── LAPA_SALES_ANALYSIS_REPORT.md          ← 📄 Report completo (18KB)
├── sales-analysis-data.json               ← 📊 Dati strutturati (15KB)
├── DASHBOARD_IMPLEMENTATION_GUIDE.md      ← 🛠️  Guida tecnica (30KB)
├── sales-analysis-report.txt              ← 📋 Output raw (9.5KB)
├── SALES_ANALYSIS_README.md               ← 📖 Questo file
└── scripts/
    └── analyze-sales-data.js              ← ⚙️  Script analisi (21KB)
```

**Total Package Size:** ~93.5 KB di insights puri!

---

**Generato con** ❤️ **da Claude AI + LAPA Team**
**Data:** 15 Ottobre 2025
**Versione:** 1.0.0
