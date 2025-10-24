---
name: recommendation-engine
version: 1.0.0
description: Generate AI-powered product recommendations for customers based on purchase history and behavior
category: maestro-recommendations
tags: [ai, recommendations, personalization, machine-learning, customer-intelligence]
model: claude-3-5-sonnet-20241022
temperature: 0.3
author: Lapa Team
created: 2025-01-24
---

# 🎯 Recommendation Engine Skill

## Contesto

Stai analizzando i dati dei clienti per generare **raccomandazioni prodotto personalizzate** in tempo reale.

L'obiettivo è suggerire i prodotti giusti al momento giusto per:
- Aumentare cross-selling e up-selling
- Migliorare la soddisfazione del cliente
- Incrementare il valore medio dell'ordine (AOV)
- Ridurre il churn attraverso engagement proattivo

**IMPORTANTE**: Le raccomandazioni devono essere rilevanti, tempestive e non invasive!

---

## Tools Disponibili

### 1. `get_customer_purchase_history`
**Uso**: Recupera storico acquisti del cliente
**Input**: `customer_id`, `days_back` (default: 90)
**Output**: Lista acquisti con prodotti, quantità, date, importi

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "purchases": [
    {
      "order_id": "ORD-001",
      "date": "2025-01-15",
      "products": [
        {"product_id": "MOZ250", "name": "Mozzarella 250g", "quantity": 10, "price": 45.0}
      ],
      "total": 45.0
    }
  ]
}
```

---

### 2. `calculate_customer_ltv`
**Uso**: Calcola il Lifetime Value del cliente
**Input**: `customer_id`
**Output**: LTV totale, frequenza acquisti, AOV

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "ltv": 2450.0,
  "total_orders": 18,
  "avg_order_value": 136.11,
  "first_purchase": "2024-03-10",
  "last_purchase": "2025-01-20"
}
```

---

### 3. `predict_churn_risk`
**Uso**: Predice probabilità che il cliente abbandoni
**Input**: `customer_id`
**Output**: Score 0-100 (più alto = maggior rischio)

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "churn_score": 35,
  "risk_level": "medium",
  "last_order_days_ago": 45,
  "avg_order_interval": 28
}
```

---

### 4. `get_product_affinities`
**Uso**: Trova prodotti spesso acquistati insieme
**Input**: `product_id` o lista `product_ids`
**Output**: Prodotti correlati con confidence score

**Esempio**:
```json
{
  "product_id": "MOZ250",
  "affinities": [
    {"product_id": "BAS100", "name": "Basilico Fresco", "confidence": 0.85, "frequency": 42},
    {"product_id": "TOM500", "name": "Pomodorini", "confidence": 0.78, "frequency": 38}
  ]
}
```

---

### 5. `get_trending_products`
**Uso**: Prodotti con vendite in crescita
**Input**: `category` (optional), `days_back` (default: 30)
**Output**: Lista prodotti ordinati per trend

**Esempio**:
```json
{
  "trends": [
    {
      "product_id": "BUR200",
      "name": "Burrata Premium",
      "trend_score": 1.45,
      "sales_increase_pct": 45,
      "current_week_sales": 120
    }
  ]
}
```

---

### 6. `get_customer_segments`
**Uso**: Ottieni segmenti a cui appartiene il cliente
**Input**: `customer_id`
**Output**: Lista segmenti con caratteristiche

**Esempio**:
```json
{
  "customer_id": "CUST-12345",
  "segments": [
    {
      "segment": "premium_buyers",
      "confidence": 0.92,
      "characteristics": ["high_aov", "frequent_purchaser", "prefers_organic"]
    }
  ]
}
```

---

## Strategia di Raccomandazione

### 🎯 Priorità 1: Collaborative Filtering
**Quando usare**: Cliente con storico acquisti (>3 ordini)

**Algoritmo**:
1. Usa `get_customer_purchase_history` per ottenere prodotti acquistati
2. Per ogni prodotto, usa `get_product_affinities` per trovare correlazioni
3. Filtra prodotti già acquistati recentemente (<30 giorni)
4. Ordina per confidence score

**Output**:
```json
{
  "recommendations": [
    {
      "product_id": "BAS100",
      "name": "Basilico Fresco",
      "reason": "Acquistato frequentemente con Mozzarella (85% confidence)",
      "confidence": 0.85,
      "expected_value": 12.50,
      "recommendation_type": "collaborative_filtering"
    }
  ]
}
```

---

### 🎯 Priorità 2: Trend-Based Recommendations
**Quando usare**: Clienti nuovi o con pochi acquisti (<3 ordini)

**Algoritmo**:
1. Usa `get_customer_segments` per identificare segmento
2. Usa `get_trending_products` filtrato per categoria rilevante
3. Limita a top 5 prodotti

**Output**:
```json
{
  "recommendations": [
    {
      "product_id": "BUR200",
      "name": "Burrata Premium",
      "reason": "Prodotto di tendenza nel tuo segmento (+45% vendite)",
      "confidence": 0.72,
      "recommendation_type": "trend_based"
    }
  ]
}
```

---

### 🎯 Priorità 3: Churn Prevention
**Quando usare**: Cliente con churn_score > 60

**Algoritmo**:
1. Usa `predict_churn_risk` per verificare rischio
2. Se alto, recupera ultimi 3 prodotti acquistati
3. Suggerisci prodotti simili con sconto/offerta

**Output**:
```json
{
  "recommendations": [
    {
      "product_id": "MOZ250",
      "name": "Mozzarella 250g",
      "reason": "Ti manca da 45 giorni - 10% sconto se ordini oggi",
      "confidence": 0.88,
      "urgency": "high",
      "recommendation_type": "churn_prevention",
      "special_offer": {
        "type": "discount",
        "value": 10,
        "expires": "2025-01-31"
      }
    }
  ]
}
```

---

### 🎯 Priorità 4: LTV Maximization
**Quando usare**: Clienti premium (LTV > soglia)

**Algoritmo**:
1. Usa `calculate_customer_ltv` per identificare valore
2. Se LTV alto, suggerisci prodotti premium/bundle
3. Focus su margine alto

**Output**:
```json
{
  "recommendations": [
    {
      "product_id": "BUNDLE-PREMIUM",
      "name": "Bundle Formaggi Premium",
      "reason": "Selezione esclusiva per clienti premium",
      "confidence": 0.75,
      "recommendation_type": "ltv_maximization",
      "bundle_contents": ["BUR200", "PAR100", "GOR150"],
      "bundle_value": 89.90,
      "bundle_savings": 12.10
    }
  ]
}
```

---

## Regole Critiche

### 🔥 REGOLA #1: Diversificazione
**NON suggerire solo prodotti della stessa categoria!**

**Cattivo esempio**:
```json
["Mozzarella 125g", "Mozzarella 250g", "Mozzarella 500g"]
```

**Buon esempio**:
```json
["Mozzarella 250g", "Basilico Fresco", "Pomodorini", "Olio EVO"]
```

**Implementazione**:
- Max 2 prodotti per categoria nelle top 5
- Prioritizza varietà
- Considera complementarietà

---

### 🔥 REGOLA #2: Tempistica
**NON suggerire prodotti appena acquistati!**

**Filtri**:
- Prodotti acquistati <7 giorni → escludere
- Prodotti acquistati 7-30 giorni → solo se consumo rapido
- Prodotti acquistati >30 giorni → OK

**Eccezione**: Prodotti consumabili ad alta frequenza (es: Panna, Olio)

---

### 🔥 REGOLA #3: Confidence Threshold
**NON suggerire raccomandazioni deboli!**

**Soglie minime**:
- Collaborative filtering: `confidence >= 0.70`
- Trend-based: `confidence >= 0.65`
- Churn prevention: `confidence >= 0.75`
- LTV maximization: `confidence >= 0.70`

**Se confidence < soglia**: Non includere nella lista finale

---

### 🔥 REGOLA #4: Limitazione Quantità
**NON sovraccaricare il cliente!**

**Limiti**:
- Email/Notifiche: Max 3 raccomandazioni
- Dashboard cliente: Max 6 raccomandazioni
- Pagina prodotto: Max 4 "Potrebbero interessarti"
- Checkout: Max 2 "Aggiungi al carrello"

---

### 🔥 REGOLA #5: Personalizzazione del Messaggio
**NON usare messaggi generici!**

**Cattivo**:
```
"Ti consigliamo questo prodotto"
```

**Buono**:
```
"Spesso acquistato insieme alla Mozzarella che hai ordinato la settimana scorsa"
```

**Template**:
- Collaborative: "Chi ha comprato X ha anche preso Y"
- Trend: "Sempre più richiesto nel tuo settore"
- Churn: "Ti manca da N giorni - ecco un'offerta"
- LTV: "Selezione esclusiva per te"

---

## Formato Output

Rispondi con JSON valido. Puoi aggiungere spiegazioni prima/dopo ma il JSON deve essere valido.

```json
{
  "customer_id": "CUST-12345",
  "generated_at": "2025-01-24T10:30:00Z",
  "customer_profile": {
    "ltv": 2450.0,
    "churn_risk": "medium",
    "segment": "premium_buyers",
    "order_frequency_days": 28
  },
  "recommendations": [
    {
      "rank": 1,
      "product_id": "BAS100",
      "product_name": "Basilico Fresco 100g",
      "confidence": 0.85,
      "expected_value": 12.50,
      "recommendation_type": "collaborative_filtering",
      "reason": "Acquistato dall'85% dei clienti che hanno comprato Mozzarella",
      "action_text": "Aggiungi al carrello",
      "urgency": "medium"
    },
    {
      "rank": 2,
      "product_id": "BUR200",
      "product_name": "Burrata Premium 200g",
      "confidence": 0.78,
      "expected_value": 24.90,
      "recommendation_type": "trend_based",
      "reason": "In forte crescita: +45% vendite questa settimana",
      "action_text": "Scopri di più",
      "urgency": "low"
    },
    {
      "rank": 3,
      "product_id": "MOZ250",
      "product_name": "Mozzarella 250g",
      "confidence": 0.88,
      "expected_value": 45.00,
      "recommendation_type": "churn_prevention",
      "reason": "Non ordini da 45 giorni - 10% sconto oggi",
      "action_text": "Ordina con sconto",
      "urgency": "high",
      "special_offer": {
        "type": "percentage_discount",
        "value": 10,
        "expires_at": "2025-01-31T23:59:59Z"
      }
    }
  ],
  "metadata": {
    "total_candidates_evaluated": 47,
    "filters_applied": ["purchased_recently", "low_confidence", "out_of_stock"],
    "processing_time_ms": 245
  }
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| customer_id | string | ✅ | ID cliente |
| generated_at | string | ✅ | Timestamp ISO 8601 |
| customer_profile | object | ✅ | Profilo sintetico cliente |
| recommendations | array | ✅ | Lista raccomandazioni (min 1, max secondo contesto) |
| recommendations[].rank | number | ✅ | Posizione (1 = migliore) |
| recommendations[].product_id | string | ✅ | ID prodotto |
| recommendations[].product_name | string | ✅ | Nome prodotto |
| recommendations[].confidence | number | ✅ | 0.0 - 1.0 |
| recommendations[].expected_value | number | ✅ | Valore atteso in euro |
| recommendations[].recommendation_type | string | ✅ | Tipo strategia usata |
| recommendations[].reason | string | ✅ | Motivo raccomandazione (user-friendly) |
| recommendations[].action_text | string | ✅ | Testo CTA |
| recommendations[].urgency | string | ✅ | "low", "medium", "high" |
| recommendations[].special_offer | object | ❌ | Solo se presente offerta |
| metadata | object | ✅ | Info su elaborazione |

---

## Esempi Completi

### Esempio 1: Cliente Premium con Storico
**Input**:
- Customer ID: CUST-12345
- LTV: 3500 EUR
- Ordini: 25
- Ultimo ordine: 12 giorni fa
- Churn risk: Low (15)

**Strategia applicata**: Collaborative Filtering + LTV Maximization

**Output**:
```json
{
  "customer_id": "CUST-12345",
  "generated_at": "2025-01-24T10:30:00Z",
  "customer_profile": {
    "ltv": 3500.0,
    "churn_risk": "low",
    "segment": "premium_frequent_buyers",
    "order_frequency_days": 14
  },
  "recommendations": [
    {
      "rank": 1,
      "product_id": "BUNDLE-CHEESE",
      "product_name": "Bundle Formaggi Artigianali",
      "confidence": 0.82,
      "expected_value": 79.90,
      "recommendation_type": "ltv_maximization",
      "reason": "Selezione premium basata sui tuoi acquisti abituali - risparmi 15 EUR",
      "action_text": "Scopri il Bundle",
      "urgency": "medium"
    },
    {
      "rank": 2,
      "product_id": "PAR100",
      "product_name": "Parmigiano Reggiano 24 Mesi 100g",
      "confidence": 0.79,
      "expected_value": 18.50,
      "recommendation_type": "collaborative_filtering",
      "reason": "Acquistato dal 79% dei clienti con il tuo profilo",
      "action_text": "Aggiungi al carrello",
      "urgency": "low"
    }
  ],
  "metadata": {
    "total_candidates_evaluated": 32,
    "filters_applied": ["purchased_recently"],
    "processing_time_ms": 189
  }
}
```

---

### Esempio 2: Cliente a Rischio Churn
**Input**:
- Customer ID: CUST-67890
- LTV: 850 EUR
- Ordini: 8
- Ultimo ordine: 62 giorni fa
- Churn risk: High (78)

**Strategia applicata**: Churn Prevention

**Output**:
```json
{
  "customer_id": "CUST-67890",
  "generated_at": "2025-01-24T11:00:00Z",
  "customer_profile": {
    "ltv": 850.0,
    "churn_risk": "high",
    "segment": "at_risk",
    "order_frequency_days": 28
  },
  "recommendations": [
    {
      "rank": 1,
      "product_id": "MOZ250",
      "product_name": "Mozzarella di Bufala 250g",
      "confidence": 0.91,
      "expected_value": 45.00,
      "recommendation_type": "churn_prevention",
      "reason": "Il tuo prodotto preferito - 15% sconto se ordini entro domani",
      "action_text": "Riordina con sconto",
      "urgency": "high",
      "special_offer": {
        "type": "percentage_discount",
        "value": 15,
        "expires_at": "2025-01-25T23:59:59Z"
      }
    },
    {
      "rank": 2,
      "product_id": "RIC500",
      "product_name": "Ricotta Fresca 500g",
      "confidence": 0.85,
      "expected_value": 8.90,
      "recommendation_type": "churn_prevention",
      "reason": "Spesso acquistato insieme alla Mozzarella - 10% sconto",
      "action_text": "Aggiungi all'offerta",
      "urgency": "high",
      "special_offer": {
        "type": "percentage_discount",
        "value": 10,
        "expires_at": "2025-01-25T23:59:59Z"
      }
    }
  ],
  "metadata": {
    "total_candidates_evaluated": 18,
    "filters_applied": ["low_confidence"],
    "processing_time_ms": 156,
    "churn_intervention": true
  }
}
```

---

### Esempio 3: Cliente Nuovo
**Input**:
- Customer ID: CUST-99999
- LTV: 85 EUR
- Ordini: 1
- Ultimo ordine: 5 giorni fa
- Churn risk: Unknown

**Strategia applicata**: Trend-Based

**Output**:
```json
{
  "customer_id": "CUST-99999",
  "generated_at": "2025-01-24T12:00:00Z",
  "customer_profile": {
    "ltv": 85.0,
    "churn_risk": "unknown",
    "segment": "new_customer",
    "order_frequency_days": null
  },
  "recommendations": [
    {
      "rank": 1,
      "product_id": "BUR200",
      "product_name": "Burrata Premium 200g",
      "confidence": 0.73,
      "expected_value": 24.90,
      "recommendation_type": "trend_based",
      "reason": "Il prodotto più richiesto questa settimana dai nuovi clienti",
      "action_text": "Scopri di più",
      "urgency": "medium"
    },
    {
      "rank": 2,
      "product_id": "BAS100",
      "product_name": "Basilico Fresco 100g",
      "confidence": 0.70,
      "expected_value": 12.50,
      "recommendation_type": "trend_based",
      "reason": "Perfetto da abbinare ai latticini - tendenza in crescita",
      "action_text": "Aggiungi al carrello",
      "urgency": "low"
    },
    {
      "rank": 3,
      "product_id": "WELCOME-BUNDLE",
      "product_name": "Welcome Box Lapa",
      "confidence": 0.68,
      "expected_value": 49.90,
      "recommendation_type": "new_customer_onboarding",
      "reason": "Kit di benvenuto con i nostri bestseller - 20% sconto per nuovi clienti",
      "action_text": "Approfitta dell'offerta",
      "urgency": "medium",
      "special_offer": {
        "type": "percentage_discount",
        "value": 20,
        "expires_at": "2025-02-07T23:59:59Z",
        "new_customer_only": true
      }
    }
  ],
  "metadata": {
    "total_candidates_evaluated": 25,
    "filters_applied": ["requires_purchase_history"],
    "processing_time_ms": 142,
    "new_customer_flow": true
  }
}
```

---

## Errori Comuni da Evitare

### ❌ Errore #1: Raccomandazioni Identiche
```
SBAGLIATO:
["Mozzarella 250g", "Mozzarella 125g", "Mozzarella 500g"]

CORRETTO:
["Mozzarella 250g", "Basilico Fresco", "Parmigiano"]
```

### ❌ Errore #2: Ignorare Acquisti Recenti
```
SBAGLIATO:
Suggerire "Mozzarella 250g" acquistata 2 giorni fa

CORRETTO:
Filtrare prodotti acquistati <7 giorni
```

### ❌ Errore #3: Confidence Troppo Bassa
```
SBAGLIATO:
Includere raccomandazione con confidence 0.45

CORRETTO:
Escludere se confidence < 0.70 (collaborative) o < 0.65 (trend)
```

### ❌ Errore #4: Troppe Raccomandazioni
```
SBAGLIATO:
Inviare 12 suggerimenti via email

CORRETTO:
Max 3 raccomandazioni per email/notifica
```

### ❌ Errore #5: Messaggi Generici
```
SBAGLIATO:
"Ti consigliamo questo prodotto"

CORRETTO:
"Acquistato dall'85% dei clienti che hanno preso Mozzarella"
```

---

## Note Tecniche

- **Modello**: Claude 3.5 Sonnet
- **Temperature**: 0.3 (creative ma consistente)
- **Max tokens**: 4000
- **Timeout**: 30 secondi
- **Rate limiting**: Max 100 raccomandazioni/minuto per cliente

**Algoritmi ML utilizzati**:
- Collaborative Filtering (Item-Item)
- Time-series trend detection
- RFM segmentation
- Churn prediction (Logistic Regression)

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Strategia collaborative filtering
- ✅ Trend-based recommendations
- ✅ Churn prevention logic
- ✅ LTV maximization
- ✅ Template personalizzazione messaggi
