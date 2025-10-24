---
name: churn-prediction
version: 1.0.0
description: Predizione del rischio di abbandono clienti con scoring e early warning
tags: [churn, retention, prediction]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
category: customer-intelligence
---

# Churn Prediction - Customer Retention Analysis

## Contesto
Questa skill identifica i clienti a rischio di abbandono (churn) analizzando pattern comportamentali, metriche di engagement e segnali di disinteresse. La predizione precoce del churn permette di implementare strategie di retention mirate prima che il cliente sia definitivamente perso. Utilizza un sistema di scoring multi-dimensionale per valutare il rischio su una scala 0-100.

## Regole Critiche

### Regola #1: Indicatori di Churn
I seguenti segnali devono incrementare il churn score:
- **Inattività prolungata**: Nessun acquisto negli ultimi 90+ giorni (+30 punti)
- **Riduzione frequenza**: Ordini diminuiti >50% rispetto al periodo precedente (+25 punti)
- **Diminuzione valore ordini**: AOV ridotto >30% (+20 punti)
- **Mancata apertura email**: <10% open rate ultimi 3 mesi (+15 punti)
- **Supporto negativo**: Ticket di reclamo o review <3 stelle (+20 punti)
- **Carrelli abbandonati**: 3+ carrelli abbandonati consecutivi (+10 punti)

Esempio:
Cliente con 120 giorni di inattività + 2 reclami recenti = 30 + 20 = 50 punti (rischio medio-alto)

### Regola #2: Classificazione Rischio
Basandosi sul churn score totale (0-100):
- **Critical (80-100)**: Intervento immediato richiesto, cliente quasi perso
- **High (60-79)**: Alto rischio, azioni urgenti necessarie
- **Medium (40-59)**: Rischio moderato, monitoraggio attivo
- **Low (20-39)**: Basso rischio, engagement preventivo
- **Minimal (0-19)**: Cliente stabile, nessuna azione immediata

### Regola #3: Esclusioni e Falsi Positivi
NON considerare a rischio churn:
- Clienti nuovi (<3 mesi dalla prima transazione) - pattern non stabilizzato
- Clienti seasonali con pattern ciclici documentati (es. acquisti solo natalizi)
- Clienti in periodo di pausa dichiarata (es. vacanza, maternità)
- Clienti con ordini pending o subscription attive

## Tool Sequence

### Step 1: Fetch customer activity
Tool: `get_customer_activity`
Parameters: {
  customer_id,
  lookback_period: "6_months",
  include_orders: true,
  include_engagement: true,
  include_support_tickets: true
}

### Step 2: Calculate behavioral metrics
Tool: `calculate_behavior_metrics`
Parameters: {
  activity_data,
  compare_periods: true,
  engagement_channels: ["email", "web", "app"]
}

### Step 3: Compute churn score
Tool: `compute_churn_score`
Parameters: {
  metrics,
  weights: {
    inactivity: 0.30,
    frequency_decline: 0.25,
    value_decline: 0.20,
    engagement: 0.15,
    support_sentiment: 0.10
  }
}

### Step 4: Generate retention strategy
Tool: `generate_retention_plan`
Parameters: { churn_score, risk_level, customer_profile }

### Step 5: Output
Return JSON with prediction and action plan

## Formato Output

```json
{
  "customer_id": "CUST67890",
  "churn_analysis": {
    "risk_score": 72,
    "risk_level": "High",
    "confidence": 0.85,
    "days_to_predicted_churn": 45,
    "contributing_factors": [
      {
        "factor": "Inactivity",
        "score_impact": 30,
        "details": "No purchases in last 95 days"
      },
      {
        "factor": "Engagement Decline",
        "score_impact": 15,
        "details": "Email open rate dropped from 45% to 8%"
      },
      {
        "factor": "Support Issues",
        "score_impact": 20,
        "details": "2 unresolved complaints in last 60 days"
      }
    ],
    "historical_metrics": {
      "avg_order_frequency_days": 25,
      "current_days_since_last_order": 95,
      "avg_order_value": 185.50,
      "last_order_value": 95.00,
      "lifetime_value": 2240.00
    },
    "retention_plan": {
      "urgency": "Immediate action required",
      "recommended_actions": [
        "Personal outreach from account manager within 48h",
        "Offer 25% discount on next order",
        "Address unresolved support tickets immediately",
        "Send product recommendation based on past purchases"
      ],
      "estimated_win_back_probability": 0.42,
      "estimated_retention_cost": 55.00,
      "potential_lost_ltv": 1200.00
    }
  },
  "analysis_date": "2025-01-24T10:30:00Z",
  "next_review_date": "2025-02-07T10:30:00Z"
}
```

## Schema

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| customer_id | string | ✅ | ID univoco cliente |
| churn_analysis.risk_score | integer (0-100) | ✅ | Score rischio churn |
| churn_analysis.risk_level | enum | ✅ | Critical/High/Medium/Low/Minimal |
| churn_analysis.confidence | float (0-1) | ✅ | Affidabilità predizione |
| churn_analysis.days_to_predicted_churn | integer | ✅ | Giorni stimati prima del churn |
| churn_analysis.contributing_factors | array | ✅ | Fattori di rischio |
| churn_analysis.historical_metrics | object | ✅ | Metriche storiche cliente |
| churn_analysis.retention_plan | object | ✅ | Piano di retention |
| retention_plan.recommended_actions | array | ✅ | Azioni specifiche da intraprendere |
| retention_plan.estimated_win_back_probability | float (0-1) | ✅ | Probabilità recupero |
| retention_plan.potential_lost_ltv | decimal | ✅ | Valore potenziale perso |
| analysis_date | ISO8601 | ✅ | Data analisi |
| next_review_date | ISO8601 | ✅ | Data prossima revisione |

## Errori Comuni

### Errore #1: Non Normalizzare per Seasonality
❌ Wrong: Flaggare cliente come high-risk senza considerare stagionalità
```javascript
if (days_since_purchase > 90) risk_score += 30;
```

✅ Correct: Verificare pattern storico del cliente
```javascript
const avgPeriod = calculateAveragePurchasePeriod(customer_history);
if (days_since_purchase > avgPeriod * 1.5) risk_score += 30;
```

### Errore #2: Ignorare Lifecycle Stage
❌ Wrong: Applicare stessi criteri a clienti nuovi e consolidati
```javascript
const churnScore = calculateChurnScore(customer);
```

✅ Correct: Adattare algoritmo al lifecycle stage
```javascript
const lifecycleStage = determineLifecycleStage(customer);
const churnScore = calculateChurnScore(customer, lifecycleStage);
```

### Errore #3: Score Senza Confidence Level
❌ Wrong: Fornire solo il churn score
```json
{
  "risk_score": 75
}
```

✅ Correct: Includere confidence e data quality
```json
{
  "risk_score": 75,
  "confidence": 0.82,
  "data_quality": "high",
  "sample_size": 24
}
```

## Esempi

### Esempio 1: Cliente Critical Risk
Input:
```json
{
  "customer_id": "CUST999",
  "last_order_date": "2024-07-15",
  "avg_order_frequency": 30,
  "recent_support_tickets": [
    {"type": "complaint", "sentiment": "negative", "resolved": false}
  ],
  "email_engagement": {"open_rate": 0.05}
}
```

Output:
```json
{
  "customer_id": "CUST999",
  "churn_analysis": {
    "risk_score": 85,
    "risk_level": "Critical",
    "confidence": 0.91,
    "days_to_predicted_churn": 15,
    "contributing_factors": [
      {"factor": "Inactivity", "score_impact": 30},
      {"factor": "Unresolved Complaint", "score_impact": 25},
      {"factor": "Email Disengagement", "score_impact": 15},
      {"factor": "Frequency Decline", "score_impact": 15}
    ],
    "retention_plan": {
      "urgency": "Critical - Act within 24h",
      "recommended_actions": [
        "Executive escalation for support issue",
        "Personal phone call from senior manager",
        "Offer significant goodwill gesture",
        "Express shipping on next order"
      ],
      "estimated_win_back_probability": 0.25,
      "potential_lost_ltv": 3500.00
    }
  }
}
```

### Esempio 2: Cliente Low Risk
Input:
```json
{
  "customer_id": "CUST111",
  "last_order_date": "2025-01-10",
  "avg_order_frequency": 45,
  "email_engagement": {"open_rate": 0.38}
}
```

Output:
```json
{
  "customer_id": "CUST111",
  "churn_analysis": {
    "risk_score": 15,
    "risk_level": "Minimal",
    "confidence": 0.78,
    "days_to_predicted_churn": 180,
    "retention_plan": {
      "urgency": "Standard nurturing",
      "recommended_actions": [
        "Include in regular newsletter campaign",
        "Send loyalty program updates"
      ]
    }
  }
}
```

## Note Tecniche
- Model: Claude 3.5 Sonnet
- Max tokens: 4096
- Temperature: 0
- Algoritmo di scoring weighted multi-factor
- Machine learning features: trend analysis, pattern recognition
- Richiede storico minimo di 3 mesi per predizioni affidabili
- Confidence score basato su data quality e sample size
- Re-calcolo consigliato ogni 14 giorni per high-risk customers

## Changelog
### v1.0.0 (2025-01-24)
- Prima versione
- Implementazione scoring system 0-100
- 5 livelli di rischio (Critical a Minimal)
- Retention plan automatico
- Confidence scoring integrato
