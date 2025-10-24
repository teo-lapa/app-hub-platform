---
name: purchase-pattern-analysis
version: 1.0.0
description: Analisi dei pattern di acquisto per predire comportamenti e ottimizzare offerte
tags: [patterns, behavior, forecasting]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
category: customer-intelligence
---

# Purchase Pattern Analysis - Behavioral Insights

## Contesto
Questa skill analizza i pattern di acquisto dei clienti per identificare comportamenti ricorrenti, preferenze di prodotto, tempistiche di acquisto e tendenze emergenti. L'analisi dei pattern consente di prevedere il prossimo acquisto, personalizzare le raccomandazioni, ottimizzare il timing delle comunicazioni marketing e identificare opportunità di cross-selling e up-selling.

## Regole Critiche

### Regola #1: Identificazione Pattern Temporali
Analizzare i pattern temporali su multiple dimensioni:
- **Day of Week**: Identificare giorni preferiti per acquisti (es. 60% ordini il sabato)
- **Time of Day**: Fascia oraria preferita (es. 18:00-21:00)
- **Monthly Pattern**: Giorno del mese (es. sempre dopo il 25, giorno di stipendio)
- **Seasonal Pattern**: Stagionalità (es. picco a novembre-dicembre)
- **Purchase Cycle**: Intervallo medio tra acquisti (es. ogni 32 giorni)

Esempio:
Se cliente ordina sempre tra il 1-5 del mese, tra le 19:00-21:00, inviare email promozionale il giorno 30 del mese precedente alle 18:00.

### Regola #2: Pattern Categorizzazione Prodotti
Classificare i pattern di acquisto per categoria:
- **Repeat Buyer**: Stesso prodotto ricorrente (es. caffè ogni mese)
- **Category Loyal**: Stessa categoria, prodotti diversi (es. vari cosmetici)
- **Explorer**: Categorie diverse, alto variety seeking
- **Seasonal Buyer**: Acquisti solo in periodi specifici
- **Bundle Buyer**: Tende ad acquistare prodotti complementari insieme

Esempio:
Cliente "Repeat Buyer" di carta igienica ogni 45 giorni → automatizzare reminder al giorno 40.

### Regola #3: Anomaly Detection
Identificare e segnalare deviazioni significative dai pattern stabiliti:
- Acquisto fuori dalla categoria abituale (possibile regalo o nuova necessità)
- Order value 2x superiore alla media (opportunity per upgrade permanente)
- Acquisto anticipato rispetto al ciclo normale (possibile stock-up)
- Acquisto ritardato >30% rispetto al ciclo (rischio churn o switch competitor)

Deviazioni devono essere flaggate per analisi e azione specifica.

## Tool Sequence

### Step 1: Fetch purchase history
Tool: `get_purchase_history`
Parameters: {
  customer_id,
  include_products: true,
  include_timestamps: true,
  include_categories: true,
  min_lookback_months: 6
}

### Step 2: Extract temporal patterns
Tool: `extract_temporal_patterns`
Parameters: {
  purchase_data,
  granularity: ["day_of_week", "hour_of_day", "day_of_month"],
  calculate_cycle: true
}

### Step 3: Analyze product patterns
Tool: `analyze_product_patterns`
Parameters: {
  purchase_data,
  categorize_by: ["product_id", "category", "brand"],
  identify_bundles: true,
  calculate_affinity: true
}

### Step 4: Detect anomalies
Tool: `detect_purchase_anomalies`
Parameters: {
  established_patterns,
  recent_purchases,
  sensitivity: "medium"
}

### Step 5: Generate predictions
Tool: `generate_purchase_predictions`
Parameters: {
  patterns,
  confidence_threshold: 0.70
}

### Step 6: Output
Return JSON with comprehensive pattern analysis

## Formato Output

```json
{
  "customer_id": "CUST54321",
  "pattern_analysis": {
    "temporal_patterns": {
      "purchase_cycle": {
        "avg_days_between_purchases": 28,
        "std_deviation": 4.2,
        "consistency_score": 0.88,
        "next_predicted_purchase": "2025-02-15",
        "confidence": 0.85
      },
      "day_of_week_preference": {
        "preferred_days": ["Saturday", "Sunday"],
        "distribution": {
          "Monday": 0.05,
          "Saturday": 0.45,
          "Sunday": 0.35
        }
      },
      "time_of_day_preference": {
        "peak_hours": ["19:00-21:00"],
        "distribution": {
          "morning": 0.10,
          "afternoon": 0.15,
          "evening": 0.65,
          "night": 0.10
        }
      },
      "seasonal_pattern": {
        "type": "moderate_seasonal",
        "peak_months": ["November", "December"],
        "low_months": ["January", "February"]
      }
    },
    "product_patterns": {
      "buyer_type": "Category Loyal",
      "favorite_categories": [
        {
          "category": "Electronics",
          "purchase_count": 15,
          "percentage": 0.60
        },
        {
          "category": "Home & Garden",
          "purchase_count": 7,
          "percentage": 0.28
        }
      ],
      "repeat_products": [
        {
          "product_id": "PROD123",
          "product_name": "Premium Coffee Beans 1kg",
          "purchase_count": 8,
          "avg_repurchase_days": 32,
          "next_predicted_date": "2025-02-20"
        }
      ],
      "common_bundles": [
        {
          "products": ["Coffee Maker", "Coffee Beans", "Filters"],
          "frequency": 3,
          "avg_bundle_value": 185.00
        }
      ],
      "product_affinity": [
        {
          "product_a": "Laptop",
          "product_b": "Laptop Bag",
          "affinity_score": 0.92
        }
      ]
    },
    "behavioral_insights": {
      "avg_order_value": 145.50,
      "order_value_trend": "increasing",
      "trend_percentage": 12.5,
      "variety_seeking_score": 0.35,
      "brand_loyalty_score": 0.72,
      "price_sensitivity": "medium",
      "discount_responsiveness": 0.68
    },
    "anomalies_detected": [
      {
        "type": "High Value Order",
        "date": "2025-01-15",
        "details": "Order value $450 vs avg $145",
        "deviation_percentage": 209,
        "possible_reason": "Gift purchase or special occasion"
      }
    ],
    "recommendations": {
      "next_best_action": "Send personalized email 3 days before predicted purchase date",
      "optimal_send_time": "2025-02-12T18:00:00Z",
      "recommended_products": [
        {
          "product_id": "PROD456",
          "reason": "Frequently bought with last purchase",
          "predicted_probability": 0.76
        }
      ],
      "cross_sell_opportunities": [
        {
          "category": "Coffee Accessories",
          "rationale": "High purchase frequency of coffee products",
          "estimated_success_rate": 0.58
        }
      ],
      "up_sell_opportunities": [
        {
          "current_product": "Premium Coffee Beans 1kg",
          "suggested_upgrade": "Premium Coffee Beans 2kg Bundle",
          "potential_value_increase": 18.50
        }
      ]
    }
  },
  "analysis_period": {
    "start_date": "2024-07-24",
    "end_date": "2025-01-24",
    "total_orders_analyzed": 25,
    "data_quality_score": 0.94
  },
  "generated_at": "2025-01-24T10:30:00Z"
}
```

## Schema

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| customer_id | string | ✅ | ID univoco cliente |
| pattern_analysis.temporal_patterns | object | ✅ | Pattern temporali |
| temporal_patterns.purchase_cycle | object | ✅ | Ciclo di acquisto |
| purchase_cycle.avg_days_between_purchases | integer | ✅ | Media giorni tra acquisti |
| purchase_cycle.next_predicted_purchase | ISO8601 date | ✅ | Data prossimo acquisto previsto |
| purchase_cycle.confidence | float (0-1) | ✅ | Affidabilità predizione |
| temporal_patterns.day_of_week_preference | object | ✅ | Preferenza giorni settimana |
| temporal_patterns.time_of_day_preference | object | ✅ | Preferenza orario |
| pattern_analysis.product_patterns | object | ✅ | Pattern prodotti |
| product_patterns.buyer_type | enum | ✅ | Tipo acquirente |
| product_patterns.favorite_categories | array | ✅ | Categorie preferite |
| product_patterns.repeat_products | array | ✅ | Prodotti ricorrenti |
| product_patterns.common_bundles | array | ❌ | Bundle comuni (se presenti) |
| pattern_analysis.behavioral_insights | object | ✅ | Insight comportamentali |
| behavioral_insights.avg_order_value | decimal | ✅ | Valore medio ordine |
| behavioral_insights.order_value_trend | enum | ✅ | increasing/stable/decreasing |
| pattern_analysis.anomalies_detected | array | ❌ | Anomalie (se presenti) |
| pattern_analysis.recommendations | object | ✅ | Raccomandazioni actionable |
| recommendations.next_best_action | string | ✅ | Prossima azione consigliata |
| recommendations.optimal_send_time | ISO8601 | ✅ | Timing ottimale comunicazione |
| analysis_period | object | ✅ | Periodo analizzato |
| data_quality_score | float (0-1) | ✅ | Qualità dati utilizzati |

## Errori Comuni

### Errore #1: Confondere Pattern con Coincidenze
❌ Wrong: Identificare pattern dopo solo 2-3 occorrenze
```javascript
if (purchases_on_saturday >= 2) {
  pattern = "Saturday buyer";
}
```

✅ Correct: Richiedere statistical significance
```javascript
const minSampleSize = 10;
const minPercentage = 0.40;
if (total_purchases >= minSampleSize &&
    saturday_percentage >= minPercentage) {
  pattern = "Saturday buyer";
}
```

### Errore #2: Ignorare Outliers nell'Analisi Ciclo
❌ Wrong: Calcolare media senza rimuovere outliers
```javascript
const avgCycle = sum(days_between_purchases) / count;
```

✅ Correct: Rimuovere outliers prima del calcolo
```javascript
const filtered = removeOutliers(days_between_purchases, 2); // 2 std dev
const avgCycle = median(filtered); // Usare mediana invece di media
```

### Errore #3: Non Considerare Contesto Esterno
❌ Wrong: Predire basandosi solo su dati storici
```json
{
  "next_purchase": "2025-12-25"
}
```

✅ Correct: Considerare eventi esterni
```json
{
  "next_purchase": "2025-12-25",
  "confidence": 0.45,
  "external_factors": ["Christmas Day - stores closed, delivery delayed"],
  "adjusted_prediction": "2025-12-20"
}
```

## Esempi

### Esempio 1: Repeat Buyer con Pattern Chiaro
Input:
```json
{
  "customer_id": "CUST222",
  "purchases": [
    {"date": "2024-08-01", "product": "Dog Food 10kg", "value": 45},
    {"date": "2024-09-02", "product": "Dog Food 10kg", "value": 45},
    {"date": "2024-10-01", "product": "Dog Food 10kg", "value": 45},
    {"date": "2024-11-03", "product": "Dog Food 10kg", "value": 45},
    {"date": "2024-12-01", "product": "Dog Food 10kg", "value": 45},
    {"date": "2025-01-02", "product": "Dog Food 10kg", "value": 45}
  ]
}
```

Output:
```json
{
  "customer_id": "CUST222",
  "pattern_analysis": {
    "temporal_patterns": {
      "purchase_cycle": {
        "avg_days_between_purchases": 31,
        "std_deviation": 1.5,
        "consistency_score": 0.97,
        "next_predicted_purchase": "2025-02-02",
        "confidence": 0.95
      }
    },
    "product_patterns": {
      "buyer_type": "Repeat Buyer",
      "repeat_products": [
        {
          "product_id": "DOGFOOD001",
          "product_name": "Dog Food 10kg",
          "purchase_count": 6,
          "avg_repurchase_days": 31,
          "consistency": "Very High"
        }
      ]
    },
    "recommendations": {
      "next_best_action": "Offer subscription service with 10% discount",
      "optimal_send_time": "2025-01-28T10:00:00Z",
      "cross_sell_opportunities": [
        {
          "category": "Pet Treats",
          "rationale": "Regular dog food buyer",
          "estimated_success_rate": 0.72
        }
      ]
    }
  }
}
```

### Esempio 2: Explorer Buyer con Anomalia
Input:
```json
{
  "customer_id": "CUST333",
  "purchases": [
    {"date": "2024-08-15", "category": "Books", "value": 25},
    {"date": "2024-09-10", "category": "Electronics", "value": 350},
    {"date": "2024-10-05", "category": "Clothing", "value": 120},
    {"date": "2024-11-20", "category": "Home Decor", "value": 80},
    {"date": "2025-01-18", "category": "Electronics", "value": 1200}
  ]
}
```

Output:
```json
{
  "customer_id": "CUST333",
  "pattern_analysis": {
    "product_patterns": {
      "buyer_type": "Explorer",
      "variety_seeking_score": 0.85,
      "favorite_categories": [
        {"category": "Electronics", "percentage": 0.40}
      ]
    },
    "behavioral_insights": {
      "avg_order_value": 155.00,
      "order_value_trend": "volatile"
    },
    "anomalies_detected": [
      {
        "type": "High Value Order",
        "date": "2025-01-18",
        "details": "Order value $1200 vs avg $155",
        "deviation_percentage": 674,
        "possible_reason": "Major electronics purchase - monitor for category shift"
      }
    ],
    "recommendations": {
      "next_best_action": "Follow-up survey to understand purchase occasion",
      "cross_sell_opportunities": [
        {
          "category": "Electronics Accessories",
          "rationale": "Recent high-value electronics purchase",
          "optimal_timing": "7-14 days post-purchase"
        }
      ]
    }
  }
}
```

## Note Tecniche
- Model: Claude 3.5 Sonnet
- Max tokens: 4096
- Temperature: 0
- Statistical methods: median, IQR, standard deviation, percentiles
- Outlier detection: IQR method (1.5x IQR threshold)
- Minimum data requirements: 5 purchases per 6 months per pattern affidabile
- Pattern confidence decreases con data quality score <0.70
- Seasonal adjustment using seasonal decomposition
- Bundle detection: Apriori algorithm with min support 0.30

## Changelog
### v1.0.0 (2025-01-24)
- Prima versione
- Pattern temporali multi-dimensionali
- Classificazione buyer types (5 categorie)
- Anomaly detection integrato
- Predizione next purchase con confidence scoring
- Raccomandazioni cross-sell e up-sell
