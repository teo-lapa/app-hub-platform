---
name: kpi-calculation
version: 1.1.0
description: Calcola KPI di vendita per analisi performance commerciale
category: sales-analytics
tags: [kpi, sales, analytics, metrics, performance]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
---

# 📊 KPI Calculation Skill

## Contesto

Stai analizzando **dati di vendita** per calcolare KPI (Key Performance Indicators) critici per il business.

L'obiettivo è fornire metriche accurate e actionable per:
- Monitorare performance commerciali
- Identificare trend di vendita
- Supportare decisioni strategiche
- Valutare efficacia campagne

**IMPORTANTE**: Errori nei calcoli possono portare a decisioni sbagliate e perdite economiche!

---

## Regole Critiche

### 🎯 REGOLA #1: Accuratezza Matematica (MASSIMA PRIORITÀ!)

**PROBLEMA COMUNE**: Arrotondamenti errati o formule sbagliate portano a KPI fuorvianti.

**SOLUZIONE**:
1. Usa SEMPRE precisione decimale (min 2 cifre)
2. Calcola PRIMA i valori individuali, POI gli aggregati
3. Verifica formule prima di applicarle

**Formule Standard**:
```
Revenue Growth Rate = ((Revenue_Current - Revenue_Previous) / Revenue_Previous) × 100
Average Order Value (AOV) = Total_Revenue / Number_of_Orders
Customer Lifetime Value (CLV) = Avg_Purchase_Value × Avg_Purchase_Frequency × Avg_Customer_Lifespan
Conversion Rate = (Number_of_Conversions / Total_Visitors) × 100
Churn Rate = (Customers_Lost / Total_Customers_Start) × 100
```

**Esempi**:
```
Revenue: €50,000 (current), €45,000 (previous)
Growth Rate = ((50000 - 45000) / 45000) × 100 = 11.11%

Orders: 250, Total Revenue: €87,500
AOV = 87500 / 250 = €350.00
```

---

### 📅 REGOLA #2: Periodo di Riferimento

**ATTENZIONE**: I KPI dipendono dal periodo temporale analizzato.

**Periodi Standard**:
- Daily (giornaliero)
- Weekly (settimanale)
- Monthly (mensile)
- Quarterly (trimestrale)
- Yearly (annuale)

**Comparazioni**:
- MoM (Month-over-Month): Mese corrente vs mese precedente
- YoY (Year-over-Year): Anno corrente vs anno precedente
- QoQ (Quarter-over-Quarter): Trimestre corrente vs trimestre precedente

**Formato Date**:
- SEMPRE usare ISO 8601: YYYY-MM-DD
- Specificare timezone se rilevante
- Indicare chiaramente start_date e end_date

---

### 💰 REGOLA #3: Valute e Conversioni

**Keyword da gestire**:
- Currency symbol (€, $, £, ¥)
- Conversione tassi di cambio
- Normalizzazione valori multi-currency

**Formato Output**:
```
€1,234.56  (NON 1234.56€ o €1234,56)
$10,000.00 (NON $10000 o 10000$)
```

**Conversioni**:
- Se multi-currency: specifica valuta base
- Applica tasso cambio corretto per data
- Indica se valori sono "converted" o "original"

---

### 📈 REGOLA #4: Segmentazione Dati

**Tipologie di Segmentazione**:

**Per Cliente**:
- Nuovi vs Ricorrenti
- B2B vs B2C
- Per area geografica
- Per fascia di spesa

**Per Prodotto**:
- Per categoria
- Per brand
- Per prezzo
- Per margine

**Per Canale**:
- Online vs Offline
- Per marketplace
- Per store fisico
- Per agente/venditore

**Output**: Ogni KPI può essere segmentato. Indica chiaramente il segment nel JSON.

---

### 🔢 REGOLA #5: Gestione Valori Nulli/Zero

**Casi Speciali**:

**Division by Zero**:
```
Orders = 0, Revenue = €0
AOV = null (NON 0, NON infinity)
Indica: "no_data" o "insufficient_data"
```

**Missing Data**:
```
Se dati mancanti per calcolo:
→ kpi_value: null
→ status: "incomplete"
→ missing_fields: ["campo1", "campo2"]
```

**Zero Revenue**:
```
Revenue = €0 (valido se periodo senza vendite)
Growth Rate = -100% (se previous > 0)
```

---

### 🎨 REGOLA #6: Benchmark e Threshold

**Definisci SEMPRE soglie di valutazione**:

**Performance Indicators**:
```json
{
  "kpi_value": 15.5,
  "benchmark": 12.0,
  "threshold": {
    "critical_low": 5.0,
    "warning_low": 10.0,
    "target": 12.0,
    "excellent": 20.0
  },
  "status": "above_target"
}
```

**Status possibili**:
- `critical`: Sotto soglia critica
- `warning`: Sotto target ma sopra critica
- `on_target`: Vicino al target (±5%)
- `above_target`: Sopra target
- `excellent`: Performance eccellente

---

## Tool Sequence

1. **get_sales_data**: Recupera dati di vendita dal database
   - Input: date_range, filters, segment
   - Output: raw sales data

2. **calculate_statistics**: Calcola statistiche base
   - Input: sales_data
   - Output: sum, avg, median, std_dev

3. **compute_kpis**: Applica formule KPI
   - Input: statistics, formulas
   - Output: kpi_values

4. **compare_periods**: Confronta periodi
   - Input: current_kpis, previous_kpis
   - Output: growth_rates, trends

5. **evaluate_performance**: Valuta vs benchmark
   - Input: kpis, benchmarks
   - Output: status, recommendations

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "analysis_period": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "period_type": "monthly",
    "timezone": "Europe/Rome"
  },
  "comparison_period": {
    "start_date": "2024-12-01",
    "end_date": "2024-12-31",
    "period_type": "monthly"
  },
  "currency": "EUR",
  "segment": {
    "type": "customer_type",
    "value": "B2B"
  },
  "kpis": [
    {
      "name": "total_revenue",
      "display_name": "Fatturato Totale",
      "value": 125000.50,
      "unit": "EUR",
      "format": "currency",
      "previous_value": 110000.00,
      "change": 15000.50,
      "change_percentage": 13.64,
      "trend": "up",
      "status": "above_target",
      "benchmark": 120000.00,
      "threshold": {
        "critical_low": 80000.00,
        "warning_low": 100000.00,
        "target": 120000.00,
        "excellent": 150000.00
      }
    },
    {
      "name": "average_order_value",
      "display_name": "Valore Medio Ordine",
      "value": 450.25,
      "unit": "EUR",
      "format": "currency",
      "previous_value": 425.00,
      "change": 25.25,
      "change_percentage": 5.94,
      "trend": "up",
      "status": "on_target",
      "benchmark": 450.00
    },
    {
      "name": "conversion_rate",
      "display_name": "Tasso di Conversione",
      "value": 3.85,
      "unit": "%",
      "format": "percentage",
      "previous_value": 3.20,
      "change": 0.65,
      "change_percentage": 20.31,
      "trend": "up",
      "status": "excellent",
      "benchmark": 3.50
    }
  ],
  "summary": {
    "total_kpis": 3,
    "kpis_improving": 3,
    "kpis_declining": 0,
    "kpis_critical": 0,
    "overall_health": "excellent"
  },
  "recommendations": [
    "Il fatturato è cresciuto del 13.64%, mantenere le strategie attuali",
    "La conversione è sopra benchmark, considerare espansione campagne",
    "AOV stabile, valutare upselling per aumentarlo ulteriormente"
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| analysis_period | object | ✅ | Periodo analizzato |
| analysis_period.start_date | string | ✅ | YYYY-MM-DD |
| analysis_period.end_date | string | ✅ | YYYY-MM-DD |
| comparison_period | object | ❌ | Periodo di confronto |
| currency | string | ✅ | ISO 4217 (EUR, USD, GBP) |
| segment | object | ❌ | Segmentazione dati |
| kpis | array | ✅ | Lista KPI calcolati (min 1) |
| kpis[].name | string | ✅ | Identificatore KPI |
| kpis[].value | number | ✅ | Valore KPI |
| kpis[].unit | string | ✅ | Unità misura |
| kpis[].previous_value | number | ❌ | Valore periodo precedente |
| kpis[].change_percentage | number | ❌ | Variazione % |
| kpis[].status | string | ✅ | critical/warning/on_target/above_target/excellent |
| summary | object | ✅ | Riepilogo generale |
| recommendations | array | ❌ | Suggerimenti actionable |

---

## Errori Comuni da Evitare

### Errore #1: Percentuali Calcolate Male
```
❌ SBAGLIATO: Change% = (Current - Previous) / Current
✅ CORRETTO:  Change% = ((Current - Previous) / Previous) × 100
```

### Errore #2: Arrotondamenti Prematuri
```
❌ SBAGLIATO: Arrotondare ogni step intermedio
✅ CORRETTO:  Arrotondare SOLO il risultato finale
```

### Errore #3: Ignorare Division by Zero
```
❌ SBAGLIATO: AOV = Revenue / 0 = Infinity
✅ CORRETTO:  AOV = null, status: "no_orders"
```

### Errore #4: Periodi Non Comparabili
```
❌ SBAGLIATO: Confrontare Gennaio (31gg) con Febbraio (28gg) senza normalizzare
✅ CORRETTO:  Normalizzare per numero giorni o usare rate giornaliero
```

### Errore #5: Valute Miste Senza Conversione
```
❌ SBAGLIATO: Sommare €100 + $100 = 200
✅ CORRETTO:  Convertire prima: €100 + $100(→€92) = €192
```

---

## Esempi

### Esempio 1: KPI Mensile Semplice
**Input**: Vendite Gennaio 2025

**Output**:
```json
{
  "analysis_period": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "period_type": "monthly"
  },
  "currency": "EUR",
  "kpis": [
    {
      "name": "total_revenue",
      "display_name": "Fatturato Totale",
      "value": 85600.00,
      "unit": "EUR",
      "format": "currency",
      "status": "on_target",
      "benchmark": 85000.00
    },
    {
      "name": "number_of_orders",
      "display_name": "Numero Ordini",
      "value": 245,
      "unit": "count",
      "format": "integer",
      "status": "above_target",
      "benchmark": 220
    }
  ]
}
```

### Esempio 2: Comparazione MoM
**Input**: Confronto Gen 2025 vs Dic 2024

**Output**:
```json
{
  "kpis": [
    {
      "name": "total_revenue",
      "value": 85600.00,
      "previous_value": 78500.00,
      "change": 7100.00,
      "change_percentage": 9.04,
      "trend": "up",
      "status": "above_target"
    }
  ]
}
```

### Esempio 3: KPI con Segmentazione
**Input**: Revenue per categoria prodotto

**Output**:
```json
{
  "segment": {
    "type": "product_category",
    "value": "Formaggi"
  },
  "kpis": [
    {
      "name": "category_revenue",
      "display_name": "Fatturato Formaggi",
      "value": 25400.00,
      "unit": "EUR",
      "previous_value": 22000.00,
      "change_percentage": 15.45,
      "status": "excellent"
    }
  ]
}
```

---

## Note Tecniche

- **Modello**: Claude 3.5 Sonnet (ottimizzato per calcoli analitici)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic - CRITICO per accuratezza matematica)
- **Timeout**: 45 secondi

**Precisione Calcoli**:
- Decimali: 2 per currency, 4 per percentuali
- Arrotondamento: half-up (standard commerciale)
- Overflow: gestire numeri grandi (>1M)

**Performance**:
- Batch processing per dataset >1000 record
- Caching per KPI ricorrenti
- Parallel computing per segmenti multipli

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ KPI standard: Revenue, AOV, Conversion Rate, Churn
- ✅ Comparazioni periodo su periodo
- ✅ Segmentazione multi-dimensionale
- ✅ Sistema benchmark e threshold
- ✅ Validazione division-by-zero
- ✅ Temperature 0 per accuratezza matematica
