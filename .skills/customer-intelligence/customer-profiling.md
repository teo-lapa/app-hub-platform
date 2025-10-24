---
name: customer-profiling
version: 1.0.0
description: Analisi RFM e segmentazione clienti per profilazione avanzata
tags: [rfm, segmentation, profiling]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
category: customer-intelligence
---

# Customer Profiling - RFM Analysis

## Contesto
Questa skill esegue l'analisi RFM (Recency, Frequency, Monetary) per segmentare i clienti in base al loro comportamento d'acquisto. L'analisi RFM è fondamentale per identificare i clienti più preziosi, quelli a rischio di abbandono e quelli con potenziale di crescita. La segmentazione permette di personalizzare le strategie di marketing e retention.

## Regole Critiche

### Regola #1: Calcolo Score RFM
Gli score RFM devono essere calcolati su scala 1-5 dove:
- **Recency**: 5 = acquisto recente (migliore), 1 = acquisto remoto (peggiore)
- **Frequency**: 5 = molti acquisti, 1 = pochi acquisti
- **Monetary**: 5 = alto valore speso, 1 = basso valore speso

Esempio:
- Cliente con ultimo acquisto 5 giorni fa: Recency = 5
- Cliente con ultimo acquisto 180 giorni fa: Recency = 1
- Cliente con 20 ordini: Frequency = 5
- Cliente con 1 ordine: Frequency = 1

### Regola #2: Segmentazione Clienti
Basandosi sul punteggio RFM combinato (R+F+M), segmentare i clienti in:
- **Champions** (RFM: 13-15): Clienti migliori, acquistano spesso e di recente
- **Loyal Customers** (RFM: 10-12): Clienti fedeli, buona frequenza
- **Potential Loyalists** (RFM: 8-9): Clienti promettenti
- **At Risk** (RFM: 5-7): Clienti che stavano spendendo bene ma non acquistano da tempo
- **Lost** (RFM: 3-4): Clienti persi, non acquistano da molto tempo

### Regola #3: Periodo di Analisi
Utilizzare sempre gli ultimi 12 mesi di dati per l'analisi RFM, a meno che non sia specificato diversamente. Questo garantisce una vista completa del comportamento cliente senza includere dati troppo datati.

## Tool Sequence

### Step 1: Fetch customer data
Tool: `get_customer_orders`
Parameters: { customer_id, date_from: "last_12_months", include_details: true }

### Step 2: Calculate RFM metrics
Tool: `calculate_rfm_score`
Parameters: {
  orders: [orders_array],
  recency_weights: [0-30, 31-60, 61-90, 91-180, 181+],
  frequency_quartiles: true,
  monetary_quartiles: true
}

### Step 3: Assign segment
Tool: `assign_customer_segment`
Parameters: { rfm_score, custom_rules: optional }

### Step 4: Output
Return JSON with complete profile

## Formato Output

```json
{
  "customer_id": "CUST12345",
  "profile": {
    "rfm_scores": {
      "recency": 4,
      "frequency": 5,
      "monetary": 4,
      "total": 13
    },
    "segment": "Champions",
    "segment_description": "Best customers who buy often and recently",
    "metrics": {
      "last_purchase_days": 12,
      "total_orders": 24,
      "total_spent": 4580.50,
      "average_order_value": 190.85,
      "purchase_frequency_days": 15.2
    },
    "recommendations": [
      "Offer VIP program enrollment",
      "Send exclusive early access to new products",
      "Request product reviews and referrals"
    ]
  },
  "analysis_period": "2024-01-24 to 2025-01-24",
  "generated_at": "2025-01-24T10:30:00Z"
}
```

## Schema

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| customer_id | string | ✅ | ID univoco cliente |
| profile.rfm_scores.recency | integer (1-5) | ✅ | Score recency |
| profile.rfm_scores.frequency | integer (1-5) | ✅ | Score frequency |
| profile.rfm_scores.monetary | integer (1-5) | ✅ | Score monetary |
| profile.rfm_scores.total | integer (3-15) | ✅ | Somma R+F+M |
| profile.segment | string | ✅ | Nome segmento |
| profile.segment_description | string | ✅ | Descrizione segmento |
| profile.metrics | object | ✅ | Metriche dettagliate |
| profile.recommendations | array | ✅ | Azioni raccomandate |
| analysis_period | string | ✅ | Periodo analizzato |
| generated_at | ISO8601 | ✅ | Timestamp generazione |

## Errori Comuni

### Errore #1: Periodo di Analisi Troppo Breve
❌ Wrong: Analizzare solo 1-2 mesi di dati
```json
{
  "date_from": "2024-12-01"
}
```

✅ Correct: Utilizzare almeno 12 mesi
```json
{
  "date_from": "2024-01-24",
  "date_to": "2025-01-24"
}
```

### Errore #2: Score RFM Invertiti
❌ Wrong: Assegnare Recency=1 a cliente con acquisto recente
```javascript
if (days_since_purchase < 30) recency_score = 1; // SBAGLIATO
```

✅ Correct: Score alti per valori migliori
```javascript
if (days_since_purchase < 30) recency_score = 5; // CORRETTO
```

### Errore #3: Ignorare Ordini Annullati
❌ Wrong: Includere tutti gli ordini indipendentemente dallo stato
```sql
SELECT * FROM orders WHERE customer_id = ?
```

✅ Correct: Filtrare solo ordini completati
```sql
SELECT * FROM orders WHERE customer_id = ? AND status = 'completed'
```

## Esempi

### Esempio 1: Cliente Champion
Input:
```json
{
  "customer_id": "CUST001",
  "orders": [
    {"date": "2025-01-20", "total": 250},
    {"date": "2025-01-05", "total": 180},
    {"date": "2024-12-15", "total": 320}
  ]
}
```

Output:
```json
{
  "customer_id": "CUST001",
  "profile": {
    "rfm_scores": {
      "recency": 5,
      "frequency": 5,
      "monetary": 5,
      "total": 15
    },
    "segment": "Champions",
    "metrics": {
      "last_purchase_days": 4,
      "total_orders": 18,
      "total_spent": 5240.00
    }
  }
}
```

### Esempio 2: Cliente At Risk
Input:
```json
{
  "customer_id": "CUST002",
  "orders": [
    {"date": "2024-06-10", "total": 450},
    {"date": "2024-05-20", "total": 380}
  ]
}
```

Output:
```json
{
  "customer_id": "CUST002",
  "profile": {
    "rfm_scores": {
      "recency": 1,
      "frequency": 3,
      "monetary": 4,
      "total": 8
    },
    "segment": "At Risk",
    "recommendations": [
      "Send win-back email campaign",
      "Offer personalized discount",
      "Survey to understand reasons for inactivity"
    ]
  }
}
```

## Note Tecniche
- Model: Claude 3.5 Sonnet
- Max tokens: 4096
- Temperature: 0
- Richiede accesso a database ordini clienti
- Calcoli statistici basati su quartili per normalizzazione
- Cache analysis results per 24h per performance

## Changelog
### v1.0.0 (2025-01-24)
- Prima versione
- Implementazione analisi RFM base
- Segmentazione in 5 categorie principali
- Raccomandazioni automatiche per segmento
