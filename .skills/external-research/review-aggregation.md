---
name: review-aggregation
version: 1.1.0
description: Aggrega e analizza recensioni da multiple fonti per generare insights su prodotti, servizi e sentiment
category: external-research
tags: [reviews, sentiment, aggregation, analysis, customers, feedback]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
---

# Review Aggregation Skill

## Contesto

Stai analizzando **recensioni di clienti** da multiple fonti (Google, Trustpilot, Amazon, Yelp, social media) per estrarre insights strutturati.

L'obiettivo è:
- Aggregare recensioni da diverse piattaforme
- Identificare temi ricorrenti (positivi e negativi)
- Analizzare sentiment generale
- Estrarre feature requests e bug reports
- Identificare trend temporali

Questi dati verranno usati per:
- Product improvement
- Customer service optimization
- Marketing messaging
- Competitive benchmarking

**IMPORTANTE**: Le recensioni possono essere in lingue diverse, con toni vari (formale, informale, sarcasmo), e qualità variabile.

---

## Regole Critiche

### REGOLA #1: Estrazione Dati Recensione

**Informazioni da estrarre per ogni recensione**:

1. **Metadata**:
   - Platform (Google, Trustpilot, Amazon, etc.)
   - Date (quando pubblicata)
   - Rating (stelle, punteggio)
   - Reviewer name/ID
   - Verified purchase (se applicabile)

2. **Content**:
   - Review title
   - Review body (testo completo)
   - Review language
   - Media attached (foto, video)

3. **Response**:
   - Company replied? (yes/no)
   - Response text
   - Response date

**Formato**:
```json
{
  "review_id": "unique_id",
  "platform": "google" | "trustpilot" | "amazon" | "yelp" | "facebook",
  "date": "2025-01-24",
  "rating": 4.5,
  "rating_scale": 5,
  "reviewer": {
    "name": "Mario R.",
    "verified_purchase": true,
    "total_reviews": 15
  },
  "content": {
    "title": "Ottimo prodotto!",
    "body": "Testo recensione completo...",
    "language": "it",
    "has_media": true
  },
  "company_response": {
    "replied": true,
    "response_text": "Grazie per la recensione!",
    "response_date": "2025-01-25"
  }
}
```

---

### REGOLA #2: Sentiment Analysis

**Classificazione sentiment**:

Per ogni recensione, determina il sentiment:
- **Positive**: Recensione generalmente positiva
- **Negative**: Recensione generalmente negativa
- **Neutral**: Recensione bilanciata o informativa
- **Mixed**: Contiene sia aspetti positivi che negativi

**Confidence score**: 0.0-1.0 indica quanto sei sicuro dell'analisi

**Aspetti specifici**:
Analizza sentiment per categoria:
```json
{
  "sentiment": {
    "overall": "positive",
    "confidence": 0.92,
    "aspects": {
      "product_quality": {
        "sentiment": "positive",
        "confidence": 0.95,
        "mentions": ["ottima qualità", "resistente", "ben fatto"]
      },
      "customer_service": {
        "sentiment": "negative",
        "confidence": 0.88,
        "mentions": ["lento", "non rispondono", "poco professionale"]
      },
      "price_value": {
        "sentiment": "neutral",
        "confidence": 0.75,
        "mentions": ["prezzo nella media"]
      }
    }
  }
}
```

**Categorie standard da analizzare**:
- Product/Service Quality
- Customer Service
- Price/Value for money
- Delivery/Shipping (se applicabile)
- Packaging
- User Experience
- Features/Functionality

---

### REGOLA #3: Temi Ricorrenti (Topic Extraction)

**PROBLEMA COMUNE**: Migliaia di recensioni con temi ripetuti.

**SOLUZIONE**: Identifica e raggruppa temi ricorrenti.

**Processo**:
1. Estrai tutti i concetti menzionati
2. Raggruppa concetti simili
3. Conta frequenza menzioni
4. Classifica per sentiment

**Output**:
```json
{
  "recurring_themes": [
    {
      "theme": "fast_delivery",
      "category": "delivery",
      "sentiment": "positive",
      "frequency": 234,
      "percentage": 45.2,
      "sample_quotes": [
        "Consegna velocissima, arrivato in 2 giorni",
        "Delivery was super fast",
        "Spedizione rapida come promesso"
      ]
    },
    {
      "theme": "poor_packaging",
      "category": "packaging",
      "sentiment": "negative",
      "frequency": 89,
      "percentage": 17.2,
      "sample_quotes": [
        "Imballaggio scadente, prodotto danneggiato",
        "Packaging could be better",
        "Arrivato con scatola rotta"
      ]
    }
  ]
}
```

**Tema naming**:
- Usa snake_case
- Sii specifico: "slow_delivery" non "delivery"
- Massimo 3 parole

---

### REGOLA #4: Rating Distribution

**Analisi distribuzione voti**:

Calcola distribuzione delle stelle per capire polarizzazione.

```json
{
  "rating_distribution": {
    "5_stars": {
      "count": 450,
      "percentage": 65.2
    },
    "4_stars": {
      "count": 120,
      "percentage": 17.4
    },
    "3_stars": {
      "count": 45,
      "percentage": 6.5
    },
    "2_stars": {
      "count": 30,
      "percentage": 4.3
    },
    "1_star": {
      "count": 45,
      "percentage": 6.5
    }
  },
  "average_rating": 4.3,
  "total_reviews": 690,
  "rating_trend": "improving" | "declining" | "stable"
}
```

**Calcola trend**:
- Confronta media ultimi 30gg vs 30gg precedenti
- Se delta > +0.3: "improving"
- Se delta < -0.3: "declining"
- Altrimenti: "stable"

---

### REGOLA #5: Feature Requests e Bug Reports

**Estrazione richieste**:

Identifica suggerimenti e problemi tecnici nelle recensioni.

**Feature Requests**:
```
"Sarebbe bello avere..."
"Mi piacerebbe se..."
"Would love to see..."
"Missing feature: ..."
```

**Bug Reports**:
```
"Non funziona..."
"Problema con..."
"Crashes when..."
"Error: ..."
```

**Output**:
```json
{
  "feature_requests": [
    {
      "request": "Dark mode option",
      "frequency": 23,
      "priority": "high",
      "sample_quotes": [
        "Would love a dark mode",
        "Please add dark theme",
        "Vorrei modalità scura"
      ]
    }
  ],
  "bug_reports": [
    {
      "issue": "App crashes on login",
      "severity": "critical",
      "frequency": 8,
      "affected_platforms": ["iOS"],
      "sample_quotes": [
        "App si blocca quando faccio login",
        "Crashes every time I try to log in"
      ]
    }
  ]
}
```

**Severity levels**:
- **Critical**: Blocca utilizzo (crash, login issues)
- **High**: Impatta funzionalità principali
- **Medium**: Impatta funzionalità secondarie
- **Low**: Piccoli bug estetici

---

### REGOLA #6: Competitor Mentions

**Identifica confronti con competitor**:

Le recensioni spesso confrontano con alternative.

**Pattern da riconoscere**:
```
"Meglio di [Competitor]"
"Preferisco [Competitor]"
"Come [Competitor] ma..."
"A differenza di [Competitor]..."
```

**Output**:
```json
{
  "competitor_mentions": [
    {
      "competitor_name": "Competitor A",
      "mention_count": 34,
      "sentiment": "we_are_better",
      "sample_quotes": [
        "Molto meglio di Competitor A",
        "Preferisco questo a Competitor A",
        "Better quality than Competitor A"
      ]
    },
    {
      "competitor_name": "Competitor B",
      "mention_count": 12,
      "sentiment": "they_are_better",
      "sample_quotes": [
        "Competitor B ha più features",
        "Competitor B costs less",
        "Passato a Competitor B, più conveniente"
      ]
    }
  ]
}
```

**Sentiment categories**:
- `we_are_better`: Preferiscono noi
- `they_are_better`: Preferiscono competitor
- `similar`: Simili, neutrale
- `different_use_case`: Usati per scopi diversi

---

### REGOLA #7: Time-based Analysis

**Trend temporali**:

Analizza come cambiano recensioni nel tempo.

```json
{
  "temporal_analysis": {
    "period": "last_6_months",
    "monthly_breakdown": [
      {
        "month": "2024-08",
        "total_reviews": 56,
        "average_rating": 4.1,
        "sentiment_breakdown": {
          "positive": 38,
          "neutral": 10,
          "negative": 8
        }
      },
      {
        "month": "2024-09",
        "total_reviews": 72,
        "average_rating": 4.4,
        "sentiment_breakdown": {
          "positive": 55,
          "neutral": 12,
          "negative": 5
        }
      }
    ],
    "trend": "improving",
    "notable_events": [
      {
        "date": "2024-09-15",
        "event": "New version release",
        "impact": "Rating increased from 4.1 to 4.4"
      }
    ]
  }
}
```

---

### REGOLA #8: Actionable Insights

**Genera raccomandazioni**:

Sulla base dell'analisi, suggerisci azioni concrete.

```json
{
  "actionable_insights": [
    {
      "priority": "high",
      "category": "customer_service",
      "finding": "89 recensioni (17%) lamentano tempi risposta lenti customer service",
      "recommendation": "Aumentare team support o implementare chatbot per richieste comuni",
      "expected_impact": "Riduzione recensioni negative del 10-15%"
    },
    {
      "priority": "medium",
      "category": "feature",
      "finding": "23 richieste per dark mode",
      "recommendation": "Implementare dark mode in prossimo release",
      "expected_impact": "Aumento satisfaction utenti power users"
    },
    {
      "priority": "critical",
      "category": "bug",
      "finding": "8 report di crash su iOS durante login",
      "recommendation": "Fix urgente necessario - impatta user acquisition",
      "expected_impact": "Riduzione churn nuovi utenti iOS"
    }
  ]
}
```

**Priority levels**:
- **Critical**: Richiede azione immediata (bug gravi, reputazione)
- **High**: Impatta molti utenti o sentiment generale
- **Medium**: Improvements importanti ma non urgenti
- **Low**: Nice-to-have, impatto limitato

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "aggregation_metadata": {
    "analysis_date": "2025-01-24",
    "total_reviews_analyzed": 690,
    "platforms": ["google", "trustpilot", "amazon"],
    "date_range": {
      "from": "2024-08-01",
      "to": "2025-01-24"
    },
    "languages": ["it", "en"]
  },
  "overall_metrics": {
    "average_rating": 4.3,
    "total_reviews": 690,
    "rating_distribution": {
      "5_stars": {"count": 450, "percentage": 65.2},
      "4_stars": {"count": 120, "percentage": 17.4},
      "3_stars": {"count": 45, "percentage": 6.5},
      "2_stars": {"count": 30, "percentage": 4.3},
      "1_star": {"count": 45, "percentage": 6.5}
    },
    "sentiment_summary": {
      "positive": 570,
      "neutral": 55,
      "negative": 65
    },
    "verified_reviews": 512,
    "company_response_rate": 78.5
  },
  "recurring_themes": [
    {
      "theme": "fast_delivery",
      "category": "delivery",
      "sentiment": "positive",
      "frequency": 234,
      "percentage": 33.9,
      "sample_quotes": [
        "Consegna velocissima",
        "Super fast delivery"
      ]
    },
    {
      "theme": "poor_packaging",
      "category": "packaging",
      "sentiment": "negative",
      "frequency": 89,
      "percentage": 12.9,
      "sample_quotes": [
        "Imballaggio scadente",
        "Bad packaging"
      ]
    }
  ],
  "aspect_analysis": {
    "product_quality": {
      "sentiment": "positive",
      "average_rating": 4.6,
      "confidence": 0.93,
      "mention_count": 456
    },
    "customer_service": {
      "sentiment": "mixed",
      "average_rating": 3.8,
      "confidence": 0.87,
      "mention_count": 234
    },
    "price_value": {
      "sentiment": "positive",
      "average_rating": 4.2,
      "confidence": 0.81,
      "mention_count": 189
    }
  },
  "feature_requests": [
    {
      "request": "Dark mode",
      "frequency": 23,
      "priority": "high",
      "sample_quotes": ["Would love dark mode"]
    }
  ],
  "bug_reports": [
    {
      "issue": "App crashes on login",
      "severity": "critical",
      "frequency": 8,
      "affected_platforms": ["iOS"],
      "sample_quotes": ["App crashes when I login"]
    }
  ],
  "competitor_mentions": [
    {
      "competitor_name": "Competitor A",
      "mention_count": 34,
      "sentiment": "we_are_better",
      "sample_quotes": ["Better than Competitor A"]
    }
  ],
  "temporal_analysis": {
    "rating_trend": "improving",
    "trend_direction": "+0.5 in last 3 months",
    "notable_events": [
      {
        "date": "2024-11-15",
        "event": "Product update 2.0",
        "impact": "Rating increased from 4.0 to 4.3"
      }
    ]
  },
  "actionable_insights": [
    {
      "priority": "critical",
      "category": "bug",
      "finding": "8 iOS login crashes reported",
      "recommendation": "Urgent iOS bug fix required",
      "expected_impact": "Prevent user churn"
    },
    {
      "priority": "high",
      "category": "customer_service",
      "finding": "89 reviews mention slow response times",
      "recommendation": "Increase support team or implement chatbot",
      "expected_impact": "15% reduction in negative reviews"
    }
  ],
  "top_positive_reviews": [
    {
      "review_id": "rev_001",
      "rating": 5,
      "date": "2025-01-20",
      "platform": "google",
      "snippet": "Prodotto eccellente, consegna veloce, imballaggio perfetto",
      "helpful_votes": 45
    }
  ],
  "top_negative_reviews": [
    {
      "review_id": "rev_089",
      "rating": 1,
      "date": "2025-01-18",
      "platform": "trustpilot",
      "snippet": "Prodotto danneggiato, customer service non risponde",
      "helpful_votes": 23
    }
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| aggregation_metadata | object | ✅ | Metadata analisi |
| overall_metrics | object | ✅ | Metriche aggregate |
| overall_metrics.average_rating | number | ✅ | Rating medio (decimale) |
| overall_metrics.total_reviews | number | ✅ | Numero recensioni totali |
| rating_distribution | object | ✅ | Distribuzione stelle |
| recurring_themes | array | ✅ | Temi ricorrenti |
| aspect_analysis | object | ✅ | Sentiment per aspetto |
| feature_requests | array | ❌ | Richieste feature |
| bug_reports | array | ❌ | Segnalazioni bug |
| competitor_mentions | array | ❌ | Menzioni competitor |
| temporal_analysis | object | ❌ | Analisi temporale |
| actionable_insights | array | ✅ | Raccomandazioni |
| top_positive_reviews | array | ❌ | Migliori recensioni (max 5) |
| top_negative_reviews | array | ❌ | Peggiori recensioni (max 5) |

---

## Errori Comuni da Evitare

### Errore #1: Sentiment Analysis superficiale
```
❌ SBAGLIATO: "Prodotto ok" → sentiment: "positive"
✅ CORRETTO:  "Prodotto ok" → sentiment: "neutral" (è tiepido, non entusiasta)
```

### Errore #2: Ignorare sarcasmo
```
❌ SBAGLIATO: "Fantastico, arrivato dopo 3 settimane" → positive
✅ CORRETTO:  "Fantastico, arrivato dopo 3 settimane" → negative (sarcasmo)
```

### Errore #3: Non normalizzare temi
```
❌ SBAGLIATO: "fast_shipping", "quick_delivery", "veloce_consegna" come 3 temi separati
✅ CORRETTO:  Un solo tema "fast_delivery" con 3 menzioni
```

### Errore #4: Perdere context
```
❌ SBAGLIATO: "Ma il servizio clienti pessimo" → aspect: customer_service, sentiment: negative
             ignorando il "Ma" che indica contrasto con parte positiva
✅ CORRETTO:  Marcare overall sentiment come "mixed"
```

---

## Esempi

### Esempio 1: Aggregazione Product Reviews

**Input**: 150 recensioni Amazon + 50 recensioni Google

**Output** (estratto):
```json
{
  "aggregation_metadata": {
    "total_reviews_analyzed": 200,
    "platforms": ["amazon", "google"]
  },
  "overall_metrics": {
    "average_rating": 4.5,
    "total_reviews": 200
  },
  "recurring_themes": [
    {
      "theme": "excellent_quality",
      "sentiment": "positive",
      "frequency": 87,
      "percentage": 43.5
    },
    {
      "theme": "slow_delivery",
      "sentiment": "negative",
      "frequency": 23,
      "percentage": 11.5
    }
  ]
}
```

### Esempio 2: Service Reviews

**Input**: 300 recensioni Trustpilot per servizio SaaS

**Output** (estratto):
```json
{
  "aspect_analysis": {
    "customer_support": {
      "sentiment": "positive",
      "average_rating": 4.7,
      "mention_count": 189
    },
    "user_interface": {
      "sentiment": "mixed",
      "average_rating": 3.9,
      "mention_count": 145
    }
  },
  "feature_requests": [
    {
      "request": "Mobile app",
      "frequency": 45,
      "priority": "high"
    },
    {
      "request": "API access",
      "frequency": 23,
      "priority": "medium"
    }
  ]
}
```

---

## Note Tecniche

- **Modello consigliato**: Claude 3.5 Sonnet
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 90 secondi (per grandi volumi)
- **Lingue supportate**: Multi-language (IT, EN, ES, FR, DE, etc.)
- **Input format**: Array di recensioni in JSON o testo raw

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Sentiment analysis multi-aspect
- ✅ Topic extraction e clustering
- ✅ Feature requests identification
- ✅ Bug reports extraction
- ✅ Competitor mentions tracking
- ✅ Temporal trend analysis
- ✅ Actionable insights generation
- ✅ Multi-platform aggregation
- ✅ Multi-language support
