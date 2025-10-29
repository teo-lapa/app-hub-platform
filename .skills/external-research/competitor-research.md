---
name: competitor-research
version: 1.1.0
description: Ricerca e analizza competitor per identificare strategie, prezzi, prodotti e posizionamento di mercato
category: external-research
tags: [competitor, research, market, strategy, pricing, analysis]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
---

# Competitor Research Skill

## Contesto

Stai conducendo **ricerca competitiva** per analizzare competitor in un mercato specifico.

L'obiettivo è raccogliere informazioni strutturate su:
- Prodotti e servizi offerti
- Strategie di pricing
- Posizionamento di mercato
- Punti di forza e debolezza
- Target audience
- Canali di distribuzione

Queste informazioni verranno usate per:
- Benchmark competitivo
- Identificazione opportunità di mercato
- Ottimizzazione strategia aziendale
- Gap analysis

**IMPORTANTE**: Raccogli SOLO informazioni pubblicamente disponibili. Non inventare dati se non disponibili.

---

## Regole Critiche

### REGOLA #1: Identificazione Competitor

**Come identificare i competitor**:

1. **Competitor Diretti**: Stesso prodotto/servizio, stesso target
2. **Competitor Indiretti**: Prodotto/servizio diverso ma stesso bisogno
3. **Competitor Potenziali**: Non ancora nel mercato ma potrebbero entrare

**Informazioni da raccogliere**:
```
Nome azienda
Sito web
Anno fondazione
Dimensione (fatturato, dipendenti)
Mercati geografici
```

**Fonti pubbliche**:
- Sito web ufficiale
- LinkedIn company page
- Social media (Facebook, Instagram, Twitter)
- Review sites (Google, Trustpilot, Yelp)
- News articles
- Company filings (se pubblici)

---

### REGOLA #2: Analisi Prodotti/Servizi

**Estrazione completa**:

Per ogni competitor, identifica:
1. **Catalogo prodotti/servizi principale**
2. **Caratteristiche uniche** (USP - Unique Selling Proposition)
3. **Qualità percepita** (basata su recensioni)
4. **Innovazione** (nuovi prodotti, tecnologie)

**Output strutturato**:
```json
{
  "products": [
    {
      "name": "Nome prodotto",
      "category": "Categoria",
      "description": "Descrizione breve",
      "features": ["feature1", "feature2"],
      "usp": "Elemento differenziante",
      "target_market": "Segmento target"
    }
  ]
}
```

**Casi speciali**:
- Se catalogo vasto (>50 prodotti): Raggruppa per categoria
- Se prodotto personalizzato: Indica "custom" e descrivi tipologie
- Se servizio SaaS: Includi piani e tier disponibili

---

### REGOLA #3: Analisi Pricing

**PROBLEMA COMUNE**: Prezzi non sempre pubblici, modelli diversi (subscription, one-time, freemium).

**SOLUZIONE**:
1. Cerca pricing page sul sito web
2. Controlla listing su marketplace (Amazon, ecc.)
3. Verifica recensioni utenti che menzionano prezzi
4. Se non disponibile: marca `pricing_available: false`

**Formati pricing da riconoscere**:
```
Freemium:
  - free_tier: true
  - paid_plans: [...]

Subscription:
  - model: "subscription"
  - billing: "monthly" | "annual"
  - tiers: [...]

One-time:
  - model: "one_time"
  - price: 199.00

Custom:
  - model: "custom"
  - note: "Contact for quote"
```

**Estrazione esempio**:
```json
{
  "pricing": {
    "model": "subscription",
    "currency": "EUR",
    "tiers": [
      {
        "name": "Basic",
        "price_monthly": 9.99,
        "price_annual": 99.00,
        "features": ["feature1", "feature2"]
      },
      {
        "name": "Pro",
        "price_monthly": 29.99,
        "price_annual": 299.00,
        "features": ["all Basic", "feature3", "feature4"]
      }
    ]
  }
}
```

---

### REGOLA #4: Posizionamento e Strategia

**Analizza**:

1. **Value Proposition**: Come si posizionano? (premium, budget, value-for-money)
2. **Messaging**: Quale messaggio comunicano? (qualità, prezzo, innovazione)
3. **Brand Identity**: Come si presentano? (professionale, casual, luxury)

**Indicatori da cercare**:
- Tagline / Slogan
- Mission statement
- About us page
- Marketing materials
- Social media tone

**Output**:
```json
{
  "positioning": {
    "market_segment": "premium" | "mid-market" | "budget",
    "value_proposition": "Descrizione proposta valore",
    "target_audience": "Descrizione audience",
    "brand_personality": ["professional", "innovative", "customer-centric"],
    "key_messages": ["messaggio1", "messaggio2"]
  }
}
```

---

### REGOLA #5: Punti Forza e Debolezza (SWOT)

**Analisi basata su**:
- Recensioni clienti
- Confronto caratteristiche prodotto
- Presenza online
- Velocità innovazione

**Struttura SWOT**:
```json
{
  "swot": {
    "strengths": [
      "Ampia gamma prodotti",
      "Eccellente customer service (4.8/5 rating)",
      "Tecnologia innovativa"
    ],
    "weaknesses": [
      "Prezzi più alti della media (+20%)",
      "Delivery lento (recensioni negative)",
      "Sito web datato"
    ],
    "opportunities": [
      "Espansione mercato internazionale",
      "Segmento B2B non coperto"
    ],
    "threats": [
      "Competitor emergenti low-cost",
      "Cambiamenti normativi"
    ]
  }
}
```

**Come identificare**:
- **Strengths**: Cosa fanno meglio di noi? Recensioni positive ricorrenti?
- **Weaknesses**: Lamentele comuni? Cosa manca nel loro prodotto?
- **Opportunities**: Mercati/segmenti non ancora coperti da loro?
- **Threats**: Trend di mercato sfavorevoli? Nuovi entranti?

---

### REGOLA #6: Presenza Online e Marketing

**Canali da analizzare**:

1. **Website**:
   - Traffic rank (approssimativo)
   - UX/UI quality
   - Mobile-friendly
   - Content marketing (blog, resources)

2. **Social Media**:
   - Followers count
   - Engagement rate
   - Posting frequency
   - Content type

3. **SEO/SEM**:
   - Keyword ranking (se disponibile)
   - Ads attivi (Google, Facebook)

4. **Review Sites**:
   - Average rating
   - Number of reviews
   - Recent sentiment

**Output**:
```json
{
  "online_presence": {
    "website": {
      "url": "https://competitor.com",
      "mobile_friendly": true,
      "has_blog": true,
      "content_quality": "high" | "medium" | "low"
    },
    "social_media": {
      "instagram": {
        "handle": "@competitor",
        "followers": 15000,
        "engagement_rate": "3.2%",
        "posting_frequency": "daily"
      },
      "linkedin": {
        "followers": 5000,
        "company_size": "51-200"
      }
    },
    "reviews": {
      "google": {
        "rating": 4.5,
        "total_reviews": 234,
        "recent_sentiment": "positive"
      },
      "trustpilot": {
        "rating": 4.2,
        "total_reviews": 89
      }
    }
  }
}
```

---

### REGOLA #7: Confronto Competitivo

**Tabella comparativa**:

Crea una matrice di confronto per visualizzare differenze chiave:

```json
{
  "competitive_matrix": [
    {
      "feature": "Prezzo base",
      "our_company": "€19.99/mese",
      "competitor_a": "€24.99/mese",
      "competitor_b": "€15.99/mese"
    },
    {
      "feature": "Customer support",
      "our_company": "24/7 chat + phone",
      "competitor_a": "Email only",
      "competitor_b": "Chat 9-17"
    },
    {
      "feature": "Free trial",
      "our_company": "14 days",
      "competitor_a": "7 days",
      "competitor_b": "30 days"
    }
  ]
}
```

**Metriche chiave**:
- Prezzo
- Features
- Customer support
- Delivery/Shipping
- Return policy
- Geographic coverage
- Customer satisfaction

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "research_metadata": {
    "research_date": "2025-01-24",
    "market_segment": "Food Delivery",
    "geographic_focus": "Italy",
    "competitors_analyzed": 3
  },
  "competitors": [
    {
      "company_info": {
        "name": "Competitor A SRL",
        "website": "https://competitora.com",
        "founded_year": 2018,
        "headquarters": "Milan, Italy",
        "company_size": "51-200 employees",
        "revenue_estimate": "€5-10M"
      },
      "products_services": [
        {
          "name": "Product X",
          "category": "Premium Delivery",
          "description": "Same-day delivery premium food",
          "features": ["30min delivery", "premium packaging", "real-time tracking"],
          "usp": "Fastest delivery in market",
          "target_market": "Urban professionals"
        }
      ],
      "pricing": {
        "model": "subscription",
        "currency": "EUR",
        "pricing_available": true,
        "tiers": [
          {
            "name": "Basic",
            "price_monthly": 9.99,
            "features": ["Free delivery over €20", "Standard packaging"]
          },
          {
            "name": "Premium",
            "price_monthly": 19.99,
            "features": ["Free delivery always", "Premium packaging", "Priority support"]
          }
        ]
      },
      "positioning": {
        "market_segment": "premium",
        "value_proposition": "Fastest premium delivery with eco-friendly packaging",
        "target_audience": "Urban professionals, age 25-45, high income",
        "brand_personality": ["innovative", "eco-conscious", "premium"],
        "key_messages": ["Speed", "Quality", "Sustainability"]
      },
      "swot": {
        "strengths": [
          "Market leader in speed (30min avg)",
          "Strong brand recognition",
          "Excellent customer rating (4.7/5)"
        ],
        "weaknesses": [
          "Higher prices than competitors (+15%)",
          "Limited geographic coverage (only major cities)",
          "Customer service response time slow"
        ],
        "opportunities": [
          "Expand to tier-2 cities",
          "Corporate B2B catering market untapped"
        ],
        "threats": [
          "New low-cost entrants",
          "Rising delivery costs"
        ]
      },
      "online_presence": {
        "website": {
          "url": "https://competitora.com",
          "mobile_friendly": true,
          "has_blog": true,
          "content_quality": "high"
        },
        "social_media": {
          "instagram": {
            "handle": "@competitora",
            "followers": 45000,
            "engagement_rate": "4.2%",
            "posting_frequency": "3x per week"
          },
          "facebook": {
            "followers": 32000,
            "engagement_rate": "2.1%"
          }
        },
        "reviews": {
          "google": {
            "rating": 4.7,
            "total_reviews": 1205,
            "recent_sentiment": "positive"
          },
          "trustpilot": {
            "rating": 4.5,
            "total_reviews": 456
          }
        }
      }
    }
  ],
  "competitive_matrix": [
    {
      "feature": "Delivery Speed",
      "competitor_a": "30 min",
      "competitor_b": "45 min",
      "competitor_c": "60 min"
    },
    {
      "feature": "Subscription Price",
      "competitor_a": "€19.99",
      "competitor_b": "€14.99",
      "competitor_c": "€9.99"
    }
  ],
  "summary": {
    "market_leader": "Competitor A",
    "price_leader": "Competitor C",
    "innovation_leader": "Competitor A",
    "key_trends": [
      "Shift towards subscription models",
      "Focus on sustainability",
      "Premium segment growing"
    ],
    "market_gaps": [
      "Mid-tier pricing segment underserved",
      "B2B corporate market underdeveloped",
      "Tier-2 cities coverage limited"
    ]
  }
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| research_metadata | object | ✅ | Metadata ricerca |
| research_metadata.research_date | string | ✅ | Data ricerca (YYYY-MM-DD) |
| competitors | array | ✅ | Lista competitor (min 1) |
| competitors[].company_info | object | ✅ | Info azienda |
| competitors[].products_services | array | ✅ | Prodotti/servizi |
| competitors[].pricing | object | ❌ | Informazioni pricing |
| competitors[].positioning | object | ✅ | Posizionamento |
| competitors[].swot | object | ✅ | Analisi SWOT |
| competitors[].online_presence | object | ✅ | Presenza online |
| competitive_matrix | array | ❌ | Matrice comparativa |
| summary | object | ✅ | Riepilogo analisi |

---

## Errori Comuni da Evitare

### Errore #1: Inventare dati non disponibili
```
❌ SBAGLIATO: revenue_estimate: "€10M" (se non disponibile pubblicamente)
✅ CORRETTO:  revenue_estimate: null o "not_available"
```

### Errore #2: Confondere competitor diretti e indiretti
```
❌ SBAGLIATO: Includere aziende in mercati completamente diversi
✅ CORRETTO:  Solo competitor che competono per stesso customer/bisogno
```

### Errore #3: Bias nelle analisi SWOT
```
❌ SBAGLIATO: Solo debolezze competitor, solo strengths nostri
✅ CORRETTO:  Analisi obiettiva basata su dati verificabili
```

### Errore #4: Dati outdated
```
❌ SBAGLIATO: Usare dati del 2020 senza indicarlo
✅ CORRETTO:  Sempre indicare data fonte e research_date
```

---

## Esempi

### Esempio 1: Competitor E-commerce

**Input**: Analizza competitor nel settore food delivery

**Output**:
```json
{
  "research_metadata": {
    "research_date": "2025-01-24",
    "market_segment": "Food Delivery",
    "geographic_focus": "Italy"
  },
  "competitors": [
    {
      "company_info": {
        "name": "DeliveryFast SRL",
        "website": "https://deliveryfast.it",
        "founded_year": 2019,
        "headquarters": "Rome, Italy"
      },
      "pricing": {
        "model": "commission",
        "delivery_fee": 3.50,
        "minimum_order": 10.00,
        "currency": "EUR"
      },
      "swot": {
        "strengths": ["Wide restaurant selection", "Fast delivery"],
        "weaknesses": ["High delivery fees", "Poor customer service"]
      }
    }
  ]
}
```

### Esempio 2: Competitor SaaS

**Input**: Analizza competitor software CRM

**Output**:
```json
{
  "competitors": [
    {
      "company_info": {
        "name": "CRM Pro",
        "website": "https://crmpro.com"
      },
      "pricing": {
        "model": "subscription",
        "pricing_available": true,
        "tiers": [
          {
            "name": "Starter",
            "price_monthly": 12.00,
            "price_annual": 120.00,
            "features": ["Up to 1000 contacts", "Email support"]
          },
          {
            "name": "Business",
            "price_monthly": 49.00,
            "price_annual": 490.00,
            "features": ["Unlimited contacts", "Phone support", "API access"]
          }
        ]
      }
    }
  ]
}
```

---

## Note Tecniche

- **Modello consigliato**: Claude 3.5 Sonnet
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 90 secondi (per ricerche complesse)
- **Note**: Questo skill non esegue ricerche web automatiche - richiede input utente con dati raccolti

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Analisi competitor completa
- ✅ SWOT analysis strutturata
- ✅ Pricing comparison
- ✅ Online presence tracking
- ✅ Competitive matrix
- ✅ Market gap identification
