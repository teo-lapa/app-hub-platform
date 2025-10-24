---
name: sales-forecasting
version: 1.0.0
description: Previsione vendite basata su dati storici e trend stagionali
category: sales-analytics
tags: [forecasting, prediction, sales, trends, seasonality]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
---

# 🔮 Sales Forecasting Skill

## Contesto

Stai creando **previsioni di vendita** basate su dati storici per supportare decisioni di business.

L'obiettivo è fornire forecast accurati per:
- Pianificazione inventory e acquisti
- Budget e target commerciali
- Allocazione risorse (personale, marketing)
- Identificazione opportunità/rischi

**IMPORTANTE**: Forecast errati causano overstocking, stockout, o mancati obiettivi!

---

## Regole Critiche

### 🎯 REGOLA #1: Analisi Dati Storici (MASSIMA PRIORITÀ!)

**PROBLEMA COMUNE**: Forecast basati su dati insufficienti o non rappresentativi.

**SOLUZIONE**:
1. Richiedi MINIMO 12 mesi di dati storici (24+ ideale)
2. Analizza SEMPRE stagionalità e trend
3. Identifica outlier e anomalie

**Metriche Minime Richieste**:
```
✅ NECESSARIE:
- Revenue giornaliero/settimanale/mensile (min 12 periodi)
- Numero ordini
- Periodo temporale continuo (no gap)

⚠️ UTILI:
- Dati marketing spend
- Eventi speciali (promo, festività)
- Fattori esterni (meteo, economia)
```

**Validazione Dati**:
```
if (historical_periods < 12) {
  return {
    status: "insufficient_data",
    message: "Minimum 12 periods required for reliable forecast",
    periods_available: historical_periods
  }
}
```

---

### 📊 REGOLA #2: Modelli di Forecasting

**Scegli il modello GIUSTO** in base ai dati:

**1. Moving Average (Media Mobile)**
- Usa quando: Trend stabile, poca stagionalità
- Formula: `Forecast = (Period1 + Period2 + ... + PeriodN) / N`
- Esempio: Previsione prossimo mese = media ultimi 3 mesi

**2. Exponential Smoothing**
- Usa quando: Trend graduale, peso maggiore a dati recenti
- Formula: `Forecast = α × Actual + (1-α) × PreviousForecast`
- α (alpha) = smoothing factor (0.1-0.3 tipico)

**3. Seasonal Decomposition**
- Usa quando: Stagionalità forte (es. vendite natalizie)
- Componenti: Trend + Seasonal + Residual
- Esempio: Vendite sempre +40% a Dicembre

**4. Linear Regression**
- Usa quando: Trend lineare chiaro (crescita/decrescita costante)
- Formula: `y = mx + b` (y=vendite, x=tempo)

**Selezione Automatica**:
```javascript
if (seasonality_index > 0.3) {
  use "seasonal_decomposition"
} else if (trend_strength > 0.5) {
  use "linear_regression"
} else {
  use "exponential_smoothing"
}
```

---

### 📅 REGOLA #3: Stagionalità

**CRITICO**: Molti business hanno pattern stagionali forti.

**Identificazione Stagionalità**:
```
Calcola variazione % mensile YoY:
Gen 2024 vs Gen 2023
Feb 2024 vs Feb 2023
...

Se variazione consistente (±20%) stesso mese ogni anno → STAGIONALE
```

**Seasonal Index**:
```
Seasonal Index Dicembre = (Vendite_Dic / Media_Annuale) × 100

Esempio:
Media mensile = €100,000
Vendite Dicembre = €150,000
Seasonal Index Dic = 150

Forecast Dic 2025 = Trend × (150/100) = Trend × 1.5
```

**Pattern Comuni**:
- **Retail**: Picchi Black Friday, Natale (-20% Gen-Feb)
- **Food**: Estate (+30% gelati, -20% zuppe)
- **B2B**: Calo Agosto/Dicembre (ferie)
- **Turismo**: Stagione estiva/invernale

---

### 🎲 REGOLA #4: Confidence Interval

**SEMPRE** fornisci range di previsione, non solo punto singolo.

**Confidence Levels**:
```json
{
  "forecast_value": 125000,
  "confidence_80": {
    "lower": 115000,
    "upper": 135000
  },
  "confidence_95": {
    "lower": 105000,
    "upper": 145000
  }
}
```

**Calcolo**:
```
Standard Error = StdDev(Historical_Errors)
Confidence_95 = Forecast ± (1.96 × Standard_Error)
Confidence_80 = Forecast ± (1.28 × Standard_Error)
```

**Interpretazione**:
- 80% confidence: "Siamo 80% sicuri vendite tra €115k-€135k"
- 95% confidence: "Range più ampio, ma più sicuro"

**Range più ampio** quando:
- Dati storici volatili
- Pochi periodi disponibili
- Presenza anomalie
- Fattori esterni incerti

---

### 🚨 REGOLA #5: Anomalie e Outlier

**Gestione Eventi Straordinari**:

**Anomalie Positive**:
- Promozioni eccezionali
- Virality/media spike
- Black Friday, Natale
- Lancio prodotto di successo

**Anomalie Negative**:
- COVID lockdown
- Supply chain disruption
- Scandali/crisi PR
- Problemi tecnici (sito down)

**Trattamento**:
```javascript
if (value > mean + 3×stddev || value < mean - 3×stddev) {
  // È outlier
  if (outlier.is_recurring) {
    // Es. Natale ogni anno → INCLUDE
    use_in_forecast = true
  } else {
    // Es. COVID one-time → EXCLUDE
    use_in_forecast = false
    flag_as_anomaly = true
  }
}
```

**IMPORTANTE**: Annota SEMPRE gli outlier esclusi nel JSON output!

---

### 📈 REGOLA #6: Accuracy Metrics

**Misura SEMPRE l'accuratezza** del forecast.

**Metriche Standard**:

**MAPE (Mean Absolute Percentage Error)**:
```
MAPE = (1/n) × Σ |Actual - Forecast| / |Actual| × 100

Interpretazione:
MAPE < 10%  → Excellent forecast
MAPE 10-20% → Good forecast
MAPE 20-50% → Acceptable forecast
MAPE > 50%  → Poor forecast
```

**MAE (Mean Absolute Error)**:
```
MAE = (1/n) × Σ |Actual - Forecast|

In valuta assoluta (es. €5,000 di errore medio)
```

**RMSE (Root Mean Squared Error)**:
```
RMSE = √[(1/n) × Σ (Actual - Forecast)²]

Penalizza errori grandi più di MAE
```

**Backtest**:
```
Test forecast su ultimi 3 mesi (dati già noti)
Calcola MAPE su questi 3 mesi
Se MAPE < 20% → Modello affidabile
```

---

## Tool Sequence

1. **load_historical_data**: Carica dati storici
   - Input: start_date, end_date, granularity
   - Output: time_series_data

2. **detect_seasonality**: Analizza pattern stagionali
   - Input: time_series_data
   - Output: seasonal_indices, period

3. **identify_trend**: Identifica trend generale
   - Input: time_series_data
   - Output: trend_line, strength

4. **remove_outliers**: Filtra anomalie
   - Input: time_series_data, threshold
   - Output: cleaned_data, outliers_list

5. **select_model**: Scegli modello forecasting
   - Input: data_characteristics
   - Output: model_type, parameters

6. **forecast_sales**: Genera previsioni
   - Input: model, cleaned_data, periods_ahead
   - Output: forecast_values, confidence_intervals

7. **calculate_accuracy**: Valuta accuratezza
   - Input: forecast, actual (backtest)
   - Output: mape, mae, rmse

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "forecast_metadata": {
    "created_at": "2025-01-24T10:30:00Z",
    "historical_period": {
      "start_date": "2023-01-01",
      "end_date": "2025-01-23",
      "periods_count": 24,
      "granularity": "monthly"
    },
    "forecast_period": {
      "start_date": "2025-02-01",
      "end_date": "2025-07-31",
      "periods_count": 6,
      "granularity": "monthly"
    },
    "currency": "EUR",
    "model_used": "seasonal_decomposition",
    "seasonality_detected": true,
    "trend_direction": "upward",
    "trend_strength": 0.72
  },
  "historical_analysis": {
    "average_monthly_revenue": 105000.50,
    "revenue_growth_yoy": 12.5,
    "seasonality_index": {
      "january": 85,
      "february": 90,
      "march": 105,
      "april": 110,
      "may": 115,
      "june": 120,
      "july": 125,
      "august": 95,
      "september": 110,
      "october": 115,
      "november": 130,
      "december": 150
    },
    "outliers_excluded": [
      {
        "date": "2024-03-15",
        "value": 250000,
        "reason": "One-time promotional spike - not recurring"
      }
    ]
  },
  "forecasts": [
    {
      "period": "2025-02",
      "date_range": {
        "start": "2025-02-01",
        "end": "2025-02-28"
      },
      "forecast_value": 98500.00,
      "unit": "EUR",
      "confidence_80": {
        "lower": 91000.00,
        "upper": 106000.00
      },
      "confidence_95": {
        "lower": 85000.00,
        "upper": 112000.00
      },
      "growth_vs_previous_year": 8.5,
      "seasonal_factor": 0.90
    },
    {
      "period": "2025-03",
      "date_range": {
        "start": "2025-03-01",
        "end": "2025-03-31"
      },
      "forecast_value": 118000.00,
      "unit": "EUR",
      "confidence_80": {
        "lower": 110000.00,
        "upper": 126000.00
      },
      "confidence_95": {
        "lower": 103000.00,
        "upper": 133000.00
      },
      "growth_vs_previous_year": 10.2,
      "seasonal_factor": 1.05
    }
  ],
  "accuracy_metrics": {
    "backtest_period": "2024-11 to 2025-01",
    "mape": 8.5,
    "mae": 7200.00,
    "rmse": 9500.00,
    "forecast_quality": "excellent",
    "reliability_score": 0.91
  },
  "recommendations": [
    "Forte stagionalità rilevata: pianificare inventory extra per Nov-Dic",
    "Trend crescita costante: considerare espansione capacità produttiva",
    "Forecast accuracy excellent (MAPE 8.5%) - modello affidabile per budget",
    "Febbraio previsto -10% vs Gennaio (normale pattern stagionale)"
  ],
  "risk_factors": [
    "Previsione basata su 24 mesi dati - estendere a 36+ per maggiore accuracy",
    "Nessun evento promo straordinario incluso - aggiustare manualmente se pianificati",
    "Confidence interval ampio per Q2 - monitorare trend e ricalcolare a Marzo"
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| forecast_metadata | object | ✅ | Metadati forecast |
| forecast_metadata.model_used | string | ✅ | Modello forecasting usato |
| forecast_metadata.seasonality_detected | boolean | ✅ | Se pattern stagionale trovato |
| historical_analysis | object | ✅ | Analisi dati storici |
| historical_analysis.seasonality_index | object | ❌ | Indici stagionali mensili |
| historical_analysis.outliers_excluded | array | ❌ | Anomalie rimosse |
| forecasts | array | ✅ | Previsioni periodo per periodo |
| forecasts[].forecast_value | number | ✅ | Valore previsto |
| forecasts[].confidence_80 | object | ✅ | Intervallo confidenza 80% |
| forecasts[].confidence_95 | object | ✅ | Intervallo confidenza 95% |
| accuracy_metrics | object | ✅ | Metriche accuratezza |
| accuracy_metrics.mape | number | ✅ | Mean Absolute % Error |
| accuracy_metrics.forecast_quality | string | ✅ | excellent/good/acceptable/poor |
| recommendations | array | ✅ | Suggerimenti actionable |
| risk_factors | array | ❌ | Fattori rischio/limitazioni |

---

## Errori Comuni da Evitare

### Errore #1: Ignorare Stagionalità
```
❌ SBAGLIATO: Forecast lineare senza considerare Natale/Estate
✅ CORRETTO:  Applicare seasonal_index ai mesi con pattern ricorrente
```

### Errore #2: Dati Insufficienti
```
❌ SBAGLIATO: Forecast con solo 3 mesi di storico
✅ CORRETTO:  Richiedere min 12 mesi, ideale 24+
```

### Errore #3: Outlier Non Gestiti
```
❌ SBAGLIATO: Includere lockdown COVID in trend normale
✅ CORRETTO:  Identificare e escludere anomalie one-time
```

### Errore #4: Forecast Singolo Senza Range
```
❌ SBAGLIATO: "Vendite Febbraio: €100,000" (punto singolo)
✅ CORRETTO:  "€100k (range €90k-€110k 80% confidence)"
```

### Errore #5: Non Validare Modello
```
❌ SBAGLIATO: Usare forecast senza backtest
✅ CORRETTO:  Calcolare MAPE su ultimi 3 mesi noti
```

---

## Esempi

### Esempio 1: Forecast Mensile con Stagionalità
**Input**: 24 mesi storico, forte pattern natalizio

**Output**:
```json
{
  "forecast_metadata": {
    "model_used": "seasonal_decomposition",
    "seasonality_detected": true,
    "trend_direction": "upward"
  },
  "forecasts": [
    {
      "period": "2025-12",
      "forecast_value": 180000.00,
      "seasonal_factor": 1.50,
      "confidence_80": {
        "lower": 165000.00,
        "upper": 195000.00
      }
    }
  ],
  "accuracy_metrics": {
    "mape": 7.2,
    "forecast_quality": "excellent"
  }
}
```

### Esempio 2: Trend Lineare Crescita
**Input**: Startup in crescita costante, no stagionalità

**Output**:
```json
{
  "forecast_metadata": {
    "model_used": "linear_regression",
    "seasonality_detected": false,
    "trend_direction": "upward",
    "trend_strength": 0.88
  },
  "forecasts": [
    {
      "period": "2025-02",
      "forecast_value": 52000.00,
      "growth_vs_previous_year": 45.0
    }
  ]
}
```

### Esempio 3: Dati Insufficienti
**Input**: Solo 6 mesi di storico

**Output**:
```json
{
  "status": "insufficient_data",
  "message": "Minimum 12 periods required for reliable forecast",
  "periods_available": 6,
  "recommendation": "Collect more historical data or use simple moving average with high uncertainty"
}
```

---

## Note Tecniche

- **Modello**: Claude 3.5 Sonnet (ottimizzato per analisi time-series)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic - CRITICO per calcoli matematici)
- **Timeout**: 60 secondi

**Algoritmi**:
- Seasonal decomposition: STL (Seasonal-Trend decomposition using LOESS)
- Trend detection: Linear regression, Mann-Kendall test
- Outlier detection: Z-score, IQR method
- Accuracy: MAPE, MAE, RMSE

**Limitazioni**:
- Non prevede eventi black swan (crisi improvvise)
- Accuracy diminuisce per forecast >6 mesi ahead
- Richiede dati continui (no gap grandi)

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Modelli: Moving Average, Exponential Smoothing, Seasonal Decomposition, Linear Regression
- ✅ Rilevamento automatico stagionalità
- ✅ Gestione outlier e anomalie
- ✅ Confidence intervals (80%, 95%)
- ✅ Accuracy metrics (MAPE, MAE, RMSE)
- ✅ Backtest validation
- ✅ Temperature 0 per accuratezza matematica
