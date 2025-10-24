---
name: timing-optimization
version: 1.0.0
description: Optimize contact timing for maximum customer engagement and conversion
category: maestro-recommendations
tags: [timing, optimization, engagement, conversion, behavioral-analytics]
model: claude-3-5-sonnet-20241022
temperature: 0.3
author: Lapa Team
created: 2025-01-24
---

# ⏰ Timing Optimization Skill

## Contesto

Stai analizzando i pattern temporali dei clienti per determinare il **momento ottimale** per contattarli.

L'obiettivo è massimizzare:
- Open rate email/notifiche
- Click-through rate
- Conversion rate
- Customer satisfaction (evitare contatti molesti)

**IMPORTANTE**: Il timing sbagliato può danneggiare la relazione con il cliente!

---

## Tools Disponibili

### 1. `get_customer_activity_patterns`
**Uso**: Analizza quando il cliente è più attivo
**Input**: `customer_id`, `days_back` (default: 90)
**Output**: Pattern orari e giorni settimana

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "activity_patterns": {
    "peak_hours": [9, 10, 14, 19],
    "peak_days": ["monday", "wednesday", "friday"],
    "timezone": "Europe/Rome",
    "activity_score_by_hour": {
      "8": 0.45,
      "9": 0.89,
      "10": 0.92,
      "14": 0.78,
      "19": 0.85
    }
  }
}
```

---

### 2. `get_purchase_time_patterns`
**Uso**: Analizza quando il cliente effettua acquisti
**Input**: `customer_id`
**Output**: Orari e giorni preferiti per acquisti

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "purchase_patterns": {
    "avg_order_interval_days": 28,
    "next_predicted_order_date": "2025-02-15",
    "preferred_order_days": ["tuesday", "thursday"],
    "preferred_order_hours": [10, 11, 15],
    "last_order_date": "2025-01-18"
  }
}
```

---

### 3. `get_engagement_history`
**Uso**: Storico interazioni con email/notifiche
**Input**: `customer_id`, `channel` (email, sms, push, all)
**Output**: Open rate, click rate, best times

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "channel": "email",
  "engagement_stats": {
    "total_sent": 45,
    "total_opened": 32,
    "total_clicked": 18,
    "open_rate": 0.71,
    "click_rate": 0.40,
    "best_send_times": [
      {"hour": 9, "day": "monday", "open_rate": 0.85},
      {"hour": 14, "day": "wednesday", "open_rate": 0.82}
    ],
    "worst_send_times": [
      {"hour": 22, "day": "saturday", "open_rate": 0.15}
    ]
  }
}
```

---

### 4. `get_customer_lifecycle_stage`
**Uso**: Determina fase del customer journey
**Input**: `customer_id`
**Output**: Stage attuale e durata

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "lifecycle_stage": "active_customer",
  "stage_since": "2024-03-15",
  "days_in_stage": 315,
  "stage_sequence": ["new", "growing", "active_customer"],
  "next_expected_stage": "loyal_advocate"
}
```

---

### 5. `get_seasonal_trends`
**Uso**: Pattern stagionali e eventi speciali
**Input**: `customer_id`, `category` (optional)
**Output**: Periodi ad alta/bassa attività

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "seasonal_trends": {
    "high_activity_periods": [
      {"period": "pre_christmas", "start": "2025-12-01", "end": "2025-12-24", "activity_multiplier": 2.3},
      {"period": "easter", "start": "2025-04-10", "end": "2025-04-20", "activity_multiplier": 1.8}
    ],
    "low_activity_periods": [
      {"period": "august_vacation", "start": "2025-08-01", "end": "2025-08-31", "activity_multiplier": 0.3}
    ]
  }
}
```

---

### 6. `predict_next_order_window`
**Uso**: Predice finestra temporale prossimo ordine
**Input**: `customer_id`
**Output**: Date range con confidence

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "prediction": {
    "next_order_date_min": "2025-02-10",
    "next_order_date_max": "2025-02-20",
    "most_likely_date": "2025-02-15",
    "confidence": 0.82,
    "factors": ["avg_interval_28_days", "last_order_2025-01-18", "historical_consistency"]
  }
}
```

---

## Strategia di Timing

### 🎯 Priorità 1: Contatto Pre-Ordine (Proattivo)
**Quando**: 3-5 giorni prima della data prevista di ordine

**Algoritmo**:
1. Usa `predict_next_order_window` per stimare prossimo ordine
2. Sottrai 3-5 giorni dalla data stimata
3. Usa `get_customer_activity_patterns` per orario ottimale
4. Verifica non sia periodo low-activity con `get_seasonal_trends`

**Output**:
```json
{
  "timing_strategy": "pre_order_proactive",
  "recommended_send_date": "2025-02-12",
  "recommended_send_time": "09:00",
  "timezone": "Europe/Rome",
  "confidence": 0.85,
  "reason": "Cliente ordina mediamente ogni 28 giorni, ultimo ordine 18/01",
  "message_type": "reminder",
  "urgency": "low"
}
```

---

### 🎯 Priorità 2: Contatto Post-Acquisto (Follow-up)
**Quando**: 2-3 giorni dopo ordine completato

**Algoritmo**:
1. Dopo consegna ordine, attendere 48-72 ore
2. Verificare `get_engagement_history` per best time
3. Inviare richiesta feedback/recensione

**Output**:
```json
{
  "timing_strategy": "post_purchase_followup",
  "recommended_send_date": "2025-01-21",
  "recommended_send_time": "14:00",
  "timezone": "Europe/Rome",
  "confidence": 0.78,
  "reason": "48h dopo consegna, orario con 82% open rate storico",
  "message_type": "feedback_request",
  "urgency": "medium"
}
```

---

### 🎯 Priorità 3: Reattivazione Inattivi (Churn Recovery)
**Quando**: Dopo N giorni di inattività (N = 1.5x intervallo medio)

**Algoritmo**:
1. Usa `get_purchase_time_patterns` per calcolare intervallo medio
2. Se giorni_da_ultimo_ordine > (intervallo_medio × 1.5), triggera reattivazione
3. Scegli best time da `get_engagement_history`

**Output**:
```json
{
  "timing_strategy": "churn_recovery",
  "recommended_send_date": "2025-02-02",
  "recommended_send_time": "10:00",
  "timezone": "Europe/Rome",
  "confidence": 0.71,
  "reason": "42 giorni da ultimo ordine (media: 28), orario peak engagement",
  "message_type": "win_back_offer",
  "urgency": "high",
  "special_trigger": "inactivity_threshold_exceeded"
}
```

---

### 🎯 Priorità 4: Campaign Launch (Promotional)
**Quando**: Basato su lifecycle stage e seasonal trends

**Algoritmo**:
1. Usa `get_customer_lifecycle_stage` per segmento
2. Usa `get_seasonal_trends` per timing ottimale
3. Evita periodi low-activity
4. Usa `get_customer_activity_patterns` per orario

**Output**:
```json
{
  "timing_strategy": "promotional_campaign",
  "recommended_send_date": "2025-12-10",
  "recommended_send_time": "09:00",
  "timezone": "Europe/Rome",
  "confidence": 0.88,
  "reason": "Pre-Christmas periodo ad alta attività (2.3x), cliente active stage",
  "message_type": "promotional_offer",
  "urgency": "medium",
  "seasonal_context": "christmas_campaign"
}
```

---

## Regole Critiche

### 🔥 REGOLA #1: Rispetta le Quiet Hours
**NON contattare in orari inappropriati!**

**Quiet Hours**:
- 22:00 - 07:00 (notte)
- 12:00 - 14:00 (pausa pranzo - solo per clienti B2B)
- Domenica mattina (prima delle 10:00)

**Eccezioni**:
- Notifiche urgenti ordine (es: "Ordine in consegna oggi")
- Notifiche richieste esplicitamente dal cliente

**Implementazione**:
```javascript
if (hour >= 22 || hour < 7) {
  // Sposta a giorno successivo, ore 9:00
}
```

---

### 🔥 REGOLA #2: Frequency Capping
**NON bombardare il cliente!**

**Limiti**:
- Max 1 email marketing / settimana
- Max 2 push notifications / giorno
- Max 1 SMS / mese (solo promozioni)
- Transazionali (conferme ordine, tracking) esclusi da limiti

**Implementazione**:
- Traccia ultima comunicazione per canale
- Se ultima email < 7 giorni → posticipa o usa altro canale
- Se push oggi >= 2 → posticipa a domani

---

### 🔥 REGOLA #3: Timezone Awareness
**SEMPRE usare timezone del cliente!**

**Processo**:
1. Recupera timezone da `get_customer_activity_patterns`
2. Converti orari UTC in timezone cliente
3. Verifica quiet hours nel timezone locale

**Esempio**:
```javascript
// Cliente in Italy (UTC+1)
send_time_utc = "08:00"  // ❌ SBAGLIATO! Sono le 7:00 in Italia
send_time_utc = "09:00"  // ✅ CORRETTO! Sono le 10:00 in Italia
```

---

### 🔥 REGOLA #4: Context-Aware Delays
**Adatta il timing al contesto!**

**Ritardi contestuali**:
- Nuovo cliente: Attendere 24h dopo registrazione prima di marketing
- Post-acquisto: 48h prima feedback request
- Churn recovery: Attendere almeno 1.5x intervallo medio
- Seasonal: Anticipare di 1-2 settimane periodo high-activity

---

### 🔥 REGOLA #5: A/B Test Optimization
**Testa e ottimizza continuamente!**

**Approccio**:
- Split test su 20% traffico
- Varianti: +/- 2 ore, giorni diversi
- Misura: open rate, click rate, conversion
- Dopo 50 invii, usa winner per 80% traffico

**Esempio**:
```json
{
  "ab_test": {
    "variant_a": {"hour": 9, "sample": 0.10},
    "variant_b": {"hour": 14, "sample": 0.10},
    "control": {"hour": 10, "sample": 0.80}
  }
}
```

---

## Formato Output

Rispondi con JSON valido.

```json
{
  "customer_id": "CUST-12345",
  "analysis_timestamp": "2025-01-24T10:30:00Z",
  "customer_timezone": "Europe/Rome",
  "timing_recommendations": [
    {
      "strategy": "pre_order_proactive",
      "send_date": "2025-02-12",
      "send_time_local": "09:00",
      "send_time_utc": "08:00",
      "confidence": 0.85,
      "channel": "email",
      "message_type": "order_reminder",
      "priority": 1,
      "reasoning": {
        "factors": [
          "Next order predicted on 2025-02-15 (confidence 0.82)",
          "Historical best open rate at 9 AM (85%)",
          "Monday peak activity day",
          "3 days before predicted order (optimal lead time)"
        ],
        "data_sources": ["purchase_patterns", "activity_patterns", "engagement_history"]
      },
      "alternatives": [
        {
          "send_date": "2025-02-13",
          "send_time_local": "10:00",
          "confidence": 0.80,
          "reason": "Alternative if 2025-02-12 has conflicting campaign"
        }
      ]
    },
    {
      "strategy": "post_purchase_followup",
      "send_date": "2025-01-21",
      "send_time_local": "14:00",
      "send_time_utc": "13:00",
      "confidence": 0.78,
      "channel": "push_notification",
      "message_type": "feedback_request",
      "priority": 2,
      "reasoning": {
        "factors": [
          "Order delivered on 2025-01-19",
          "48h cooldown period elapsed",
          "Wednesday afternoon high engagement (78%)",
          "Push notification preferred for quick feedback"
        ],
        "data_sources": ["delivery_confirmation", "engagement_history"]
      }
    }
  ],
  "blocked_times": [
    {
      "period": "2025-01-24T22:00:00 - 2025-01-25T07:00:00",
      "reason": "Quiet hours (night)",
      "rule": "REGOLA #1"
    },
    {
      "period": "2025-01-26T12:00:00 - 2025-01-26T14:00:00",
      "reason": "Lunch break (B2B customer)",
      "rule": "REGOLA #1"
    }
  ],
  "frequency_status": {
    "email": {
      "last_sent": "2025-01-18T09:00:00Z",
      "days_since_last": 6,
      "can_send": true,
      "next_available": "2025-01-24T00:00:00Z"
    },
    "push": {
      "last_sent": "2025-01-24T08:30:00Z",
      "count_today": 1,
      "can_send": true,
      "next_available": "2025-01-24T10:30:00Z"
    },
    "sms": {
      "last_sent": "2024-12-15T10:00:00Z",
      "days_since_last": 40,
      "can_send": true,
      "next_available": "2025-01-24T00:00:00Z"
    }
  },
  "metadata": {
    "prediction_models_used": ["purchase_interval", "engagement_scoring", "seasonal_adjustment"],
    "data_quality_score": 0.89,
    "processing_time_ms": 278
  }
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| customer_id | string | ✅ | ID cliente |
| analysis_timestamp | string | ✅ | Timestamp ISO 8601 |
| customer_timezone | string | ✅ | IANA timezone |
| timing_recommendations | array | ✅ | Lista raccomandazioni timing |
| timing_recommendations[].strategy | string | ✅ | Tipo strategia |
| timing_recommendations[].send_date | string | ✅ | YYYY-MM-DD |
| timing_recommendations[].send_time_local | string | ✅ | HH:MM (timezone cliente) |
| timing_recommendations[].send_time_utc | string | ✅ | HH:MM (UTC) |
| timing_recommendations[].confidence | number | ✅ | 0.0 - 1.0 |
| timing_recommendations[].channel | string | ✅ | email, sms, push, in_app |
| timing_recommendations[].message_type | string | ✅ | Tipo messaggio |
| timing_recommendations[].priority | number | ✅ | 1-5 (1=highest) |
| timing_recommendations[].reasoning | object | ✅ | Motivazione dettagliata |
| blocked_times | array | ✅ | Periodi da evitare |
| frequency_status | object | ✅ | Status rate limiting |
| metadata | object | ✅ | Info elaborazione |

---

## Esempi Completi

### Esempio 1: Pre-Order Reminder (Cliente Regular)
**Input**:
- Customer ID: CUST-12345
- Last order: 2025-01-18
- Avg interval: 28 days
- Timezone: Europe/Rome
- Best hour: 9 AM (85% open rate)

**Output**:
```json
{
  "customer_id": "CUST-12345",
  "analysis_timestamp": "2025-01-24T10:00:00Z",
  "customer_timezone": "Europe/Rome",
  "timing_recommendations": [
    {
      "strategy": "pre_order_proactive",
      "send_date": "2025-02-12",
      "send_time_local": "09:00",
      "send_time_utc": "08:00",
      "confidence": 0.87,
      "channel": "email",
      "message_type": "order_reminder",
      "priority": 1,
      "reasoning": {
        "factors": [
          "Predicted next order: 2025-02-15 (confidence 0.85)",
          "Sending 3 days before optimal for conversion (+23%)",
          "Monday 9 AM highest open rate (85% historical)",
          "No conflicting campaigns scheduled"
        ],
        "data_sources": [
          "purchase_patterns",
          "activity_patterns",
          "engagement_history"
        ]
      },
      "alternatives": [
        {
          "send_date": "2025-02-13",
          "send_time_local": "10:00",
          "confidence": 0.82,
          "reason": "Backup slot if primary unavailable"
        }
      ],
      "expected_outcome": {
        "estimated_open_rate": 0.83,
        "estimated_click_rate": 0.42,
        "estimated_conversion_rate": 0.28
      }
    }
  ],
  "blocked_times": [],
  "frequency_status": {
    "email": {
      "last_sent": "2025-01-18T09:00:00Z",
      "days_since_last": 6,
      "can_send": true
    }
  },
  "metadata": {
    "prediction_models_used": ["arima_order_interval", "engagement_propensity"],
    "data_quality_score": 0.92,
    "processing_time_ms": 245
  }
}
```

---

### Esempio 2: Churn Recovery (Cliente Inattivo)
**Input**:
- Customer ID: CUST-67890
- Last order: 2024-11-15 (70 days ago)
- Avg interval: 28 days
- Churn risk: High
- Timezone: Europe/Rome

**Output**:
```json
{
  "customer_id": "CUST-67890",
  "analysis_timestamp": "2025-01-24T11:00:00Z",
  "customer_timezone": "Europe/Rome",
  "timing_recommendations": [
    {
      "strategy": "churn_recovery",
      "send_date": "2025-01-25",
      "send_time_local": "10:00",
      "send_time_utc": "09:00",
      "confidence": 0.73,
      "channel": "email",
      "message_type": "win_back_offer",
      "priority": 1,
      "reasoning": {
        "factors": [
          "70 days since last order (2.5x avg interval)",
          "Churn risk threshold exceeded (score: 78)",
          "Friday 10 AM good for reactivation campaigns (68% open)",
          "Special 20% discount offer attached"
        ],
        "data_sources": [
          "purchase_patterns",
          "churn_prediction",
          "engagement_history"
        ]
      },
      "alternatives": [
        {
          "send_date": "2025-01-26",
          "send_time_local": "09:00",
          "channel": "sms",
          "confidence": 0.68,
          "reason": "SMS backup if email fails (last resort)"
        }
      ],
      "urgency": "high",
      "expected_outcome": {
        "estimated_open_rate": 0.65,
        "estimated_click_rate": 0.35,
        "estimated_conversion_rate": 0.18,
        "value_at_risk": 850.0
      }
    },
    {
      "strategy": "churn_recovery_followup",
      "send_date": "2025-01-30",
      "send_time_local": "14:00",
      "send_time_utc": "13:00",
      "confidence": 0.65,
      "channel": "push_notification",
      "message_type": "last_chance_reminder",
      "priority": 2,
      "reasoning": {
        "factors": [
          "Follow-up 5 days after initial win-back",
          "Push notification for immediate attention",
          "Wednesday afternoon engagement spike",
          "Final reminder before offer expiry"
        ],
        "data_sources": ["engagement_history"]
      },
      "conditional": "only_if_no_response_to_first_contact"
    }
  ],
  "blocked_times": [
    {
      "period": "2025-01-25T22:00:00 - 2025-01-26T07:00:00",
      "reason": "Quiet hours",
      "rule": "REGOLA #1"
    }
  ],
  "frequency_status": {
    "email": {
      "last_sent": "2024-12-20T10:00:00Z",
      "days_since_last": 35,
      "can_send": true
    },
    "sms": {
      "last_sent": "2024-11-10T11:00:00Z",
      "days_since_last": 75,
      "can_send": true
    }
  },
  "metadata": {
    "churn_intervention": true,
    "critical_customer": false,
    "processing_time_ms": 312
  }
}
```

---

### Esempio 3: Seasonal Campaign (Christmas)
**Input**:
- Customer ID: CUST-55555
- Lifecycle stage: Active
- Current date: 2025-12-01
- Timezone: Europe/Rome
- Seasonal: Pre-Christmas high activity

**Output**:
```json
{
  "customer_id": "CUST-55555",
  "analysis_timestamp": "2025-12-01T08:00:00Z",
  "customer_timezone": "Europe/Rome",
  "timing_recommendations": [
    {
      "strategy": "seasonal_campaign",
      "send_date": "2025-12-10",
      "send_time_local": "09:00",
      "send_time_utc": "08:00",
      "confidence": 0.91,
      "channel": "email",
      "message_type": "christmas_promo",
      "priority": 1,
      "reasoning": {
        "factors": [
          "Pre-Christmas high activity period (2.3x multiplier)",
          "10 days before typical Christmas orders surge",
          "Monday 9 AM optimal for seasonal campaigns (91% open)",
          "Customer in 'active' lifecycle stage (high engagement)",
          "No recent promotional emails (last: 2025-11-18)"
        ],
        "data_sources": [
          "seasonal_trends",
          "activity_patterns",
          "engagement_history",
          "lifecycle_stage"
        ]
      },
      "seasonal_context": {
        "period": "pre_christmas",
        "activity_multiplier": 2.3,
        "competition_level": "high",
        "recommended_lead_time_days": 10
      },
      "expected_outcome": {
        "estimated_open_rate": 0.89,
        "estimated_click_rate": 0.52,
        "estimated_conversion_rate": 0.38,
        "expected_aov": 145.50
      }
    },
    {
      "strategy": "seasonal_reminder",
      "send_date": "2025-12-18",
      "send_time_local": "10:00",
      "send_time_utc": "09:00",
      "confidence": 0.85,
      "channel": "push_notification",
      "message_type": "last_minute_christmas",
      "priority": 2,
      "reasoning": {
        "factors": [
          "Last-minute shoppers window (6 days before Christmas)",
          "Push for urgency and immediate action",
          "Wednesday mid-morning high mobile activity",
          "Express delivery still available"
        ],
        "data_sources": ["seasonal_trends", "activity_patterns"]
      },
      "seasonal_context": {
        "period": "christmas_rush",
        "urgency": "high",
        "message_angle": "last_chance_express_delivery"
      }
    }
  ],
  "blocked_times": [
    {
      "period": "2025-12-24T18:00:00 - 2025-12-26T10:00:00",
      "reason": "Christmas holiday - no marketing messages",
      "rule": "Seasonal quiet period"
    }
  ],
  "frequency_status": {
    "email": {
      "last_sent": "2025-11-18T09:00:00Z",
      "days_since_last": 13,
      "can_send": true
    },
    "push": {
      "last_sent": "2025-11-30T14:00:00Z",
      "count_today": 0,
      "can_send": true
    }
  },
  "metadata": {
    "seasonal_campaign": true,
    "competition_intensity": "high",
    "recommended_budget_multiplier": 1.8,
    "processing_time_ms": 289
  }
}
```

---

## Errori Comuni da Evitare

### ❌ Errore #1: Ignorare Timezone
```
SBAGLIATO:
send_time_utc: "22:00" per cliente in Italy
(sono le 23:00 locali - quiet hours!)

CORRETTO:
send_time_utc: "08:00" (= 09:00 Italy)
```

### ❌ Errore #2: Frequency Capping Ignored
```
SBAGLIATO:
Inviare 3 email marketing in 5 giorni

CORRETTO:
Max 1 email/settimana, verificare last_sent
```

### ❌ Errore #3: No Confidence Threshold
```
SBAGLIATO:
Inviare con confidence 0.45 (troppo bassa)

CORRETTO:
Min confidence 0.70, altrimenti posticipare
```

### ❌ Errore #4: Seasonal Ignorance
```
SBAGLIATO:
Campagna ad Agosto (vacanze - low activity 0.3x)

CORRETTO:
Posticipare a Settembre o usare targeting specifico
```

### ❌ Errore #5: One-Size-Fits-All
```
SBAGLIATO:
Stesso orario per tutti (es: 9 AM UTC)

CORRETTO:
Personalizzare per timezone e activity pattern
```

---

## Note Tecniche

- **Modello**: Claude 3.5 Sonnet
- **Temperature**: 0.3 (bilanciato per pattern recognition)
- **Max tokens**: 3500
- **Timeout**: 25 secondi

**Modelli ML utilizzati**:
- ARIMA per previsione ordini
- Random Forest per engagement scoring
- Logistic Regression per churn timing
- Clustering per seasonal pattern detection

**Accuracy target**:
- Prediction next order date: +/- 3 giorni (80% accuracy)
- Best send time: +/- 1 ora (75% accuracy)

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Pre-order timing optimization
- ✅ Post-purchase follow-up logic
- ✅ Churn recovery timing
- ✅ Seasonal campaign optimization
- ✅ Quiet hours enforcement
- ✅ Frequency capping
- ✅ Timezone awareness
