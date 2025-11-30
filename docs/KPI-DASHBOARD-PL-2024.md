# KPI DASHBOARD - P&L 2024

```
================================================================================
                        LAPA - PROFIT & LOSS 2024
================================================================================
Periodo: Gennaio - Dicembre 2024
Data Report: 2025-11-16
Conti Analizzati: 168
================================================================================
```

## INCOME STATEMENT (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                         RICAVI                                  │
├─────────────────────────────────────────────────────────────────┤
│  Sales of Goods (310100, 3000, 3200)              5,984,522 EUR │
│  Services (3400)                                         ... EUR │
│  Other Revenues (3600, 320100)                           ... EUR │
│  ─────────────────────────────────────────────────────────────  │
│  TOTALE RICAVI                                     5,984,522 EUR │
├─────────────────────────────────────────────────────────────────┤
│                    COSTO DEL VENDUTO                            │
├─────────────────────────────────────────────────────────────────┤
│  Purchase of Goods (410100, 4000, 4200)           3,874,148 EUR │
│  Ammortamenti (45xxxx, 46xxxx)                           ... EUR │
│  Svalutazioni (47xxxx)                                   ... EUR │
│  ─────────────────────────────────────────────────────────────  │
│  TOTALE COGS                                       3,874,148 EUR │
├─────────────────────────────────────────────────────────────────┤
│  GROSS PROFIT                                     -2,110,374 EUR │ ⚠️
│  Gross Margin %                                          35.3%   │ ⚠️
├─────────────────────────────────────────────────────────────────┤
│                    SPESE OPERATIVE                              │
├─────────────────────────────────────────────────────────────────┤
│  Salari (5000, 440100)                               953,084 EUR │
│  Affitti (6000, 430100)                                  ... EUR │
│  Manutenzione (6100, 421100)                             ... EUR │
│  Veicoli (6200, 420110, 421000)                          ... EUR │
│  Energia (6400, 420200)                                  ... EUR │
│  Marketing (6600, 6720, 420300)                          ... EUR │
│  Altro (6500, 6700)                                      ... EUR │
│  ─────────────────────────────────────────────────────────────  │
│  TOTALE OPEX                                         953,084 EUR │
├─────────────────────────────────────────────────────────────────┤
│                    SPESE PERSONALE                              │
├─────────────────────────────────────────────────────────────────┤
│  Personnel Costs (5700, 5800, 440200, 440300)       828,040 EUR │
│  ─────────────────────────────────────────────────────────────  │
│  TOTALE PERSONNEL                                    828,040 EUR │
├─────────────────────────────────────────────────────────────────┤
│  EBITDA (stimato)                                 -3,891,498 EUR │ 🚨
├─────────────────────────────────────────────────────────────────┤
│  Ammortamenti (6800, 45xxxx, 46xxxx)                     ... EUR │
│  ─────────────────────────────────────────────────────────────  │
│  EBIT (stimato)                                   -3,891,498 EUR │ 🚨
├─────────────────────────────────────────────────────────────────┤
│                   PROVENTI/ONERI FINANZIARI                     │
├─────────────────────────────────────────────────────────────────┤
│  Interessi Attivi (511xxx)                                 0 EUR │
│  Interessi Passivi (520xxx)                                0 EUR │
│  ─────────────────────────────────────────────────────────────  │
│  TOTALE FINANZIARI                                         0 EUR │ ⚠️
├─────────────────────────────────────────────────────────────────┤
│  EBT (Earnings Before Tax)                        -3,891,498 EUR │ 🚨
├─────────────────────────────────────────────────────────────────┤
│  Imposte (810100, 8900)                                    0 EUR │ ⚠️
│  ─────────────────────────────────────────────────────────────  │
│  NET INCOME                                       -3,891,498 EUR │ 🚨
└─────────────────────────────────────────────────────────────────┘
```

## KEY PERFORMANCE INDICATORS

### Redditività

```
┌──────────────────────────────┬──────────────┬──────────┐
│ KPI                          │ Valore       │ Status   │
├──────────────────────────────┼──────────────┼──────────┤
│ Revenue                      │ 5,984,522 EUR│    ✅    │
│ Gross Margin                 │-2,110,374 EUR│    🚨    │
│ Gross Margin %               │        35.3% │    ⚠️    │
│ EBITDA                       │-3,891,498 EUR│    🚨    │
│ EBITDA Margin %              │       -65.0% │    🚨    │
│ Net Income                   │-3,891,498 EUR│    🚨    │
│ Net Margin %                 │       -65.0% │    🚨    │
└──────────────────────────────┴──────────────┴──────────┘

Legend:
✅ Good    ⚠️  Warning    🚨 Critical
```

### Efficienza Costi

```
┌──────────────────────────────┬──────────────┬──────────┐
│ Cost Ratio                   │ % Revenue    │ Status   │
├──────────────────────────────┼──────────────┼──────────┤
│ COGS / Revenue               │        64.7% │    ⚠️    │
│ OPEX / Revenue               │        15.9% │    ✅    │
│ Personnel / Revenue          │        13.8% │    ✅    │
│ Total Costs / Revenue        │       165.0% │    🚨    │
└──────────────────────────────┴──────────────┴──────────┘

Target COGS / Revenue: < 60%
Target OPEX / Revenue: < 20%
Target Total Costs: < 80%
```

### Breakdown Costi per Euro di Ricavo

```
Per ogni 1.00 EUR di ricavo:

COGS:       0.65 EUR  ████████████████████████████████▌ (64.7%)
OPEX:       0.16 EUR  ████████ (15.9%)
Personnel:  0.14 EUR  ███████ (13.8%)
           ─────────
TOTALE:     0.95 EUR  ███████████████████████████████████████████████▌
           ─────────
MARGINE:   -0.65 EUR  (PERDITA!)
```

## ANALISI MENSILE (Trend)

```
Mese       Ricavi (k€)  COGS (k€)  GM (k€)   GM %
─────────  ───────────  ─────────  ────────  ─────
2024-01        ???        ???        ???      ???
2024-02        ???        ???        ???      ???
2024-03        ???        ???        ???      ???
2024-04        ???        ???        ???      ???
2024-05        ???        ???        ???      ???
2024-06        ???        ???        ???      ???
2024-07        ???        ???        ???      ???
2024-08        ???        ???        ???      ???
2024-09        ???        ???        ???      ???
2024-10        ???        ???        ???      ???
2024-11        ???        ???        ???      ???
2024-12        ???        ???        ???      ???
─────────  ───────────  ─────────  ────────  ─────
TOTALE      5,984.5     3,874.1   -2,110.4   35.3%

(Vedere foglio MENSILE e PIVOT MENSILE in Excel per dati dettagliati)
```

## TOP ACCOUNTS (by Volume)

### Top 10 Revenue Accounts

```
Rank  Codice   Nome                               Saldo (EUR)
─────────────────────────────────────────────────────────────
 1.   310100   Merci c/vendite                        ???
 2.   3000     Sales of products                      ???
 3.   3200     Sales of goods                         ???
 4.   3400     Revenues from services                 ???
 5.   ...      ...                                    ...
                                                  ────────────
                                         TOTALE  -5,984,522
```

### Top 10 COGS Accounts

```
Rank  Codice   Nome                               Saldo (EUR)
─────────────────────────────────────────────────────────────
 1.   410100   Merci c/acquisti                       ???
 2.   4000     Cost of raw materials                  ???
 3.   4200     Cost of materials                      ???
 4.   44xxxx   Ammortamenti                           ???
 5.   ...      ...                                    ...
                                                  ────────────
                                         TOTALE   3,874,148
```

## ANOMALIES & ALERTS

```
🚨 CRITICAL ALERTS

1. Gross Margin NEGATIVO: -2,110,374 EUR
   → Costi superano ricavi del 35%!
   → AZIONE: Verifica urgente pricing e costi

2. EBITDA NEGATIVO: -3,891,498 EUR
   → Perdita operativa significativa
   → AZIONE: Revisione strategica necessaria

3. Conti Finanziari a ZERO
   → Nessun interesse registrato?
   → AZIONE: Verificare estratti conto bancari

4. Imposte a ZERO (810100, 8900)
   → Nessuna imposta registrata?
   → AZIONE: Verificare dichiarazioni fiscali

⚠️  WARNING ALERTS

1. Storni Ricavi: 445,066 EUR in Dare
   → Possibili resi o rettifiche
   → AZIONE: Verificare causali

2. Rettifiche COGS: 3,316,599 EUR in Avere
   → Storni significativi
   → AZIONE: Analizzare movimenti

3. Conti con nomi sospetti:
   - 5574880538714338 (CARTA ANNULLATA)
   - 6710 (Altri costi copia)
   - 4210 (Storno fine anno)
   → AZIONE: Pulizia piano conti
```

## RECOMMENDATIONS

```
┌─────────────────────────────────────────────────────────────┐
│                    IMMEDIATE ACTIONS                        │
├─────────────────────────────────────────────────────────────┤
│ 1. ⚡ Meeting urgente con CFO/Commercialista               │
│    → Analizzare GM negativo                                │
│    → Verificare classificazione conti                      │
│                                                             │
│ 2. 🔍 Deep Dive COGS                                       │
│    → Analizzare 3.3M EUR storni                            │
│    → Verificare singoli acquisti                           │
│                                                             │
│ 3. 💰 Analisi Pricing                                      │
│    → Verificare margini prodotto                           │
│    → Ricalcolare listini                                   │
│                                                             │
│ 4. 📊 Audit Contabile                                      │
│    → Verificare partita doppia                             │
│    → Riconciliare con estratti conto                       │
└─────────────────────────────────────────────────────────────┘
```

## COMPARISON (if available)

```
                        2024         2023      Variance    Var %
                    ─────────    ─────────    ─────────    ─────
Revenue             5,984,522          ???          ???      ???
COGS                3,874,148          ???          ???      ???
Gross Margin       -2,110,374          ???          ???      ???
GM %                    35.3%          ???          ???      ???
OPEX                  953,084          ???          ???      ???
Personnel             828,040          ???          ???      ???
EBITDA             -3,891,498          ???          ???      ???
Net Income         -3,891,498          ???          ???      ???

(Dati 2023 non disponibili - da integrare manualmente)
```

## NEXT ANALYSIS

```
□ Analisi per Prodotto/Servizio
□ Analisi per Cliente (Top Customers)
□ Analisi per Fornitore (Top Suppliers)
□ Analisi per Centro di Costo
□ Break-even Analysis
□ Cash Flow Analysis
□ Working Capital Analysis
```

---

```
================================================================================
Report generato da: Business Analyst Agent
Timestamp: 2025-11-16 09:42 CET
Fonte Dati: Odoo 17 (lapadevadmin-lapa-v2-staging-2406-25408900)
File Excel: RICONCILIAZIONE-PL-2024.xlsx
================================================================================

⚠️  ATTENZIONE: I dati indicano una situazione finanziaria critica.
    Richiede intervento immediato e verifica con commercialista.

📧 Per domande: Business Analyst Agent
📁 Documentazione: QUICK-START-ANALISI-PL-2024.md
📋 Executive Summary: REPORT-PL-2024-EXECUTIVE-SUMMARY.md
================================================================================
```
