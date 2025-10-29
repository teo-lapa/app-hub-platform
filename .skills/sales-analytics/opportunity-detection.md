---
name: opportunity-detection
version: 1.1.0
description: Identifica opportunità commerciali e rischi attraverso analisi dati vendita
category: sales-analytics
tags: [opportunities, anomalies, upsell, cross-sell, risk-detection]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
---

# 🎯 Opportunity Detection Skill

## Contesto

Stai analizzando **dati di vendita** per identificare opportunità commerciali nascoste e rischi potenziali.

L'obiettivo è trovare pattern actionable per:
- Aumentare revenue (upsell, cross-sell)
- Ridurre churn (customer at risk)
- Ottimizzare inventory (slow movers, fast movers)
- Identificare trend emergenti
- Anticipare problemi

**IMPORTANTE**: Opportunità non rilevate = revenue perso. Falsi positivi = tempo sprecato!

---

## Regole Critiche

### 🎯 REGOLA #1: Pattern Recognition (MASSIMA PRIORITÀ!)

**PROBLEMA COMUNE**: Identificare pattern casuali invece di trend reali (overfitting).

**SOLUZIONE**:
1. Richiedi MINIMO 3 occorrenze del pattern
2. Verifica significatività statistica
3. Contestualizza con dati business

**Pattern da Cercare**:

**A. Cross-Sell Opportunities**:
```javascript
// Prodotti acquistati insieme frequentemente
if (
  customers_buying_A_and_B > threshold &&
  customers_buying_only_A > 50
) {
  return {
    opportunity: "cross_sell",
    product_a: "Mozzarella",
    product_b: "Pomodori",
    conversion_potential: 45  // % clienti solo A che potrebbero comprare B
  }
}
```

**B. Upsell Opportunities**:
```javascript
// Clienti che comprano versione base ma potrebbero passare a premium
if (
  customer_avg_order_value > median &&
  customer_buys_only_basic_tier
) {
  return {
    opportunity: "upsell",
    customer_segment: "high_value_basic_tier",
    upsell_target: "premium_tier",
    estimated_revenue_increase: 2500
  }
}
```

**C. At-Risk Customers**:
```javascript
// Clienti con calo ordini o frequenza
if (
  orders_last_3m < orders_avg_3m * 0.5 &&
  customer_lifetime > 6_months
) {
  return {
    risk: "churn_risk",
    customer_id: "CUST_1234",
    risk_score: 0.75,
    estimated_revenue_at_risk: 12000
  }
}
```

---

### 📊 REGOLA #2: Soglie di Significatività

**Non segnalare tutto!** Usa soglie intelligenti.

**Thresholds Raccomandati**:

**Volume-based**:
```
Opportunità cross-sell: Min 10 clienti target
Upsell target: Min €1000 revenue potenziale
Product launch success: Min 50 ordini primo mese
Slow mover alert: <5 unità vendute in 60gg
```

**Percentage-based**:
```
Trend emergente: +30% crescita MoM per 2+ mesi consecutivi
Calo preoccupante: -20% revenue MoM
Churn risk: -50% ordini vs baseline
Cross-sell conversion: >20% attuale per validare pattern
```

**Statistical significance**:
```
Confidence level: >80% (p-value < 0.20)
Sample size: Min 30 data points
Effect size: Cohen's d > 0.5 (medium effect)
```

---

### 🔍 REGOLA #3: Tipologie di Opportunità

**Classifica OGNI opportunità** in una categoria chiara.

**Revenue Growth Opportunities**:
- `cross_sell`: Vendere prodotto complementare
- `upsell`: Upgrade a tier superiore
- `reactivation`: Riattivare clienti inattivi
- `expansion`: Vendere più quantità stesso prodotto
- `new_segment`: Espandere a nuovo segmento cliente

**Cost Reduction Opportunities**:
- `slow_mover_clearance`: Liquidare stock lento
- `customer_concentration_risk`: Diversificare dipendenza da pochi clienti
- `price_optimization`: Prodotti sotto/sovra-prezzati
- `channel_optimization`: Spostare vendite a canale più profittevole

**Risk Mitigation**:
- `churn_risk`: Clienti a rischio abbandono
- `payment_delay_risk`: Clienti con pagamenti lenti
- `stockout_risk`: Prodotti in esaurimento
- `margin_erosion`: Prodotti con margine in calo

**Emerging Trends**:
- `trending_up`: Prodotto/categoria in forte crescita
- `seasonal_shift`: Cambio pattern stagionale
- `new_use_case`: Cliente usa prodotto in modo nuovo
- `geographic_expansion`: Forte crescita area geografica

---

### 💰 REGOLA #4: Quantificazione Opportunità

**SEMPRE** quantifica l'impatto potenziale.

**Revenue Impact**:
```json
{
  "opportunity": "cross_sell_mozzarella_to_tomato_buyers",
  "current_state": {
    "customers_buying_tomatoes": 450,
    "customers_buying_both": 120,
    "conversion_rate": 26.7
  },
  "opportunity_size": {
    "target_customers": 330,
    "realistic_conversion_rate": 20.0,
    "expected_new_customers": 66,
    "avg_mozzarella_order_value": 85.00,
    "estimated_revenue_impact": 5610.00,
    "timeframe": "3_months",
    "confidence": "medium"
  }
}
```

**Calcolo Conservativo**:
- Usa conversion rate REALISTICO (non ottimistico)
- Applica discount factor per incertezza
- Considera costi implementazione

**Confidence Levels**:
- `high`: Dati solidi, pattern chiaro, precedenti simili
- `medium`: Dati buoni, pattern promettente
- `low`: Dati limitati, ipotesi da validare

---

### 📈 REGOLA #5: Prioritizzazione

**Non segnalare 100 opportunità!** Prioritizza le top.

**Prioritization Matrix**:
```javascript
priority_score = (revenue_impact × confidence) / effort

// Esempio
Opportunity A: (€10,000 × 0.9) / 2 (low effort) = 4,500
Opportunity B: (€50,000 × 0.3) / 8 (high effort) = 1,875

→ Priorità A > B (quick win vs uncertain long project)
```

**Output Top 10** opportunità ordinate per:
1. Priority score
2. Revenue impact
3. Quick wins (low effort, high confidence)

**Effort Estimation**:
```
1-3: Low (email campaign, simple promo)
4-6: Medium (sales training, targeted outreach)
7-10: High (product development, major campaign)
```

---

### 🚨 REGOLA #6: Anomaly Detection

**Rileva anomalie** che indicano problemi o opportunità.

**Statistical Anomalies**:
```javascript
// Z-score method
z_score = (value - mean) / std_dev

if (z_score > 2) {
  // Anomalia positiva
  flag = "unusually_high"
  investigate = "Trend emergente? Evento one-time? Errore dati?"
}

if (z_score < -2) {
  // Anomalia negativa
  flag = "unusually_low"
  investigate = "Problema? Stagionalità? Competitor?"
}
```

**Time-Series Anomalies**:
```javascript
// Sudden change detection
if (
  abs(current_week - avg_last_4_weeks) / avg_last_4_weeks > 0.30
) {
  return {
    anomaly_type: "sudden_change",
    change_magnitude: -35.5,
    investigation_needed: true
  }
}
```

**Pattern Breaks**:
```
Vendite sempre alte Venerdì, improvvisamente calo 3 Venerdì consecutivi
→ Anomalia: investigate competitor promo? Supply issue? Website issue?
```

---

## Tool Sequence

1. **load_sales_data**: Carica dati vendita
   - Input: date_range, granularity, dimensions
   - Output: sales_dataset

2. **analyze_customer_behavior**: Analizza comportamento clienti
   - Input: customer_transactions
   - Output: purchase_patterns, segments

3. **detect_cross_sell_patterns**: Identifica cross-sell
   - Input: basket_analysis_data
   - Output: product_affinities, opportunities

4. **identify_at_risk_customers**: Trova clienti a rischio
   - Input: customer_metrics, thresholds
   - Output: at_risk_list, churn_scores

5. **detect_anomalies**: Trova anomalie statistiche
   - Input: time_series_data
   - Output: anomalies, triggers

6. **quantify_opportunities**: Calcola impatto
   - Input: opportunities_raw
   - Output: opportunities_with_impact

7. **prioritize_opportunities**: Ordina per priorità
   - Input: opportunities_quantified
   - Output: top_opportunities_ranked

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "analysis_metadata": {
    "analysis_date": "2025-01-24",
    "period_analyzed": {
      "start_date": "2024-10-01",
      "end_date": "2025-01-23",
      "months": 3.8
    },
    "data_points_analyzed": 45678,
    "opportunities_found": 24,
    "risks_found": 8,
    "top_opportunities_limit": 10
  },
  "opportunities": [
    {
      "id": "OPP_001",
      "rank": 1,
      "type": "cross_sell",
      "priority_score": 4250.0,
      "title": "Cross-sell Mozzarella a clienti Pomodori",
      "description": "330 clienti acquistano pomodori ma non mozzarella. Tasso conversione storico 27% per clienti simili.",
      "current_state": {
        "total_tomato_buyers": 450,
        "already_buying_both": 120,
        "target_customers": 330,
        "current_conversion_rate": 26.7
      },
      "opportunity_metrics": {
        "estimated_revenue_impact": 5600.00,
        "estimated_margin_impact": 1680.00,
        "timeframe_months": 3,
        "confidence_level": "high",
        "confidence_score": 0.85,
        "effort_required": 2,
        "effort_description": "Email campaign + sales training"
      },
      "implementation": {
        "recommended_action": "Targeted email campaign con bundle Pomodoro+Mozzarella, sconto 10%",
        "target_segment": "Clienti con >3 ordini pomodori ultimi 6 mesi",
        "estimated_cost": 450.00,
        "expected_roi": 12.4,
        "quick_win": true
      },
      "supporting_data": {
        "pattern_strength": "strong",
        "sample_size": 120,
        "statistical_significance": "p < 0.05",
        "precedents": "Campagna simile Q3 2024 generò €4,200 (conv 22%)"
      }
    },
    {
      "id": "OPP_002",
      "rank": 2,
      "type": "upsell",
      "priority_score": 3800.0,
      "title": "Upsell Premium tier a clienti alto valore Basic tier",
      "description": "85 clienti Basic tier con spesa >€500/mese potrebbero beneficiare Premium (free shipping, 5% discount).",
      "current_state": {
        "high_value_basic_customers": 85,
        "avg_monthly_spend": 625.00,
        "premium_tier_threshold": 500.00
      },
      "opportunity_metrics": {
        "estimated_revenue_impact": 7650.00,
        "margin_impact": 3825.00,
        "timeframe_months": 6,
        "confidence_level": "medium",
        "confidence_score": 0.70,
        "effort_required": 3,
        "effort_description": "Sales call + personalized offer"
      },
      "implementation": {
        "recommended_action": "Direct sales outreach con ROI calculator personalizzato",
        "target_segment": "Basic customers >€500/mo ultimi 3 mesi",
        "estimated_conversion_rate": 15.0,
        "expected_conversions": 13
      }
    },
    {
      "id": "RISK_001",
      "rank": 3,
      "type": "churn_risk",
      "priority_score": -5200.0,
      "title": "12 clienti high-value a rischio churn",
      "description": "12 clienti storici (LTV >€10k) hanno ridotto ordini 60% ultimi 2 mesi.",
      "risk_metrics": {
        "customers_at_risk": 12,
        "avg_customer_ltv": 12500.00,
        "total_revenue_at_risk": 150000.00,
        "churn_probability": 0.65,
        "expected_loss": 97500.00,
        "risk_level": "critical"
      },
      "risk_indicators": [
        "Order frequency dropped from 8/month to 3/month",
        "Average order value down 45%",
        "No contact with account manager in 60 days"
      ],
      "mitigation": {
        "recommended_action": "Immediate account manager call + retention offer (10% discount 3 months)",
        "urgency": "high",
        "effort_required": 4,
        "estimated_retention_rate": 0.60,
        "expected_saved_revenue": 58500.00
      }
    },
    {
      "id": "OPP_003",
      "rank": 4,
      "type": "trending_up",
      "priority_score": 3200.0,
      "title": "Categoria 'Formaggi Vegani' in forte crescita",
      "description": "Categoria vegana cresciuta 45% MoM ultimi 3 mesi - trend emergente da cavalcare.",
      "trend_data": {
        "growth_mom_3m": 45.0,
        "revenue_current": 8500.00,
        "revenue_3m_ago": 2850.00,
        "new_customers_segment": 67,
        "repeat_rate": 0.58
      },
      "opportunity_metrics": {
        "estimated_revenue_impact": 15000.00,
        "timeframe_months": 6,
        "confidence_level": "high",
        "confidence_score": 0.82
      },
      "implementation": {
        "recommended_action": "Espandere catalog vegano +5 SKU, marketing campaign mirato",
        "effort_required": 6,
        "investment_required": 3500.00,
        "expected_roi": 4.3
      }
    }
  ],
  "summary": {
    "total_revenue_opportunity": 28250.00,
    "total_revenue_at_risk": 97500.00,
    "quick_wins_count": 3,
    "high_confidence_opportunities": 5,
    "critical_risks": 1,
    "net_opportunity_value": 84250.00
  },
  "recommendations": [
    {
      "priority": "critical",
      "action": "Address churn risk immediately - 12 high-value customers at risk (€97k revenue)",
      "timeline": "This week"
    },
    {
      "priority": "high",
      "action": "Launch cross-sell Mozzarella campaign - quick win, €5.6k revenue, low effort",
      "timeline": "Next 2 weeks"
    },
    {
      "priority": "medium",
      "action": "Expand vegan category - strong trend, €15k opportunity in 6 months",
      "timeline": "Next quarter"
    }
  ],
  "insights": [
    "Cross-sell patterns forti: clienti pomodori hanno 27% conversion a mozzarella",
    "12 clienti high-value mostrano segnali churn - intervento urgente necessario",
    "Trend vegano +45% MoM - segmento emergente da presidiare",
    "85 clienti Basic spendono come Premium ma non hanno upgrade - upsell opportunity"
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| analysis_metadata | object | ✅ | Metadati analisi |
| opportunities | array | ✅ | Lista opportunità/rischi (top 10) |
| opportunities[].id | string | ✅ | Identificatore unico |
| opportunities[].rank | number | ✅ | Ranking per priorità |
| opportunities[].type | string | ✅ | cross_sell/upsell/churn_risk/trending_up/etc |
| opportunities[].priority_score | number | ✅ | Score per ordinamento (negativo se risk) |
| opportunities[].estimated_revenue_impact | number | ✅ | Impatto revenue stimato |
| opportunities[].confidence_level | string | ✅ | high/medium/low |
| opportunities[].effort_required | number | ✅ | 1-10 (effort scale) |
| opportunities[].implementation | object | ✅ | Azioni raccomandate |
| opportunities[].supporting_data | object | ❌ | Dati a supporto |
| summary | object | ✅ | Riepilogo generale |
| recommendations | array | ✅ | Top 3-5 azioni prioritarie |
| insights | array | ✅ | Insight chiave |

---

## Errori Comuni da Evitare

### Errore #1: Pattern su Dati Insufficienti
```
❌ SBAGLIATO: "3 clienti comprano A+B → cross-sell opportunity"
✅ CORRETTO:  Min 10-20 occorrenze per validare pattern
```

### Errore #2: Non Quantificare Impatto
```
❌ SBAGLIATO: "Opportunità upsell clienti Basic"
✅ CORRETTO:  "85 clienti, €7.6k revenue potenziale, 15% conversion attesa"
```

### Errore #3: Ignorare Effort/Cost
```
❌ SBAGLIATO: Opportunità €1k revenue con €5k costo implementazione
✅ CORRETTO:  Calcolare ROI e prioritizzare per (impact/effort)
```

### Errore #4: Troppi Falsi Positivi
```
❌ SBAGLIATO: Segnalare 50 "opportunità" con bassa confidence
✅ CORRETTO:  Top 10 ad alta confidence, validate statisticamente
```

### Errore #5: Anomalie Senza Context
```
❌ SBAGLIATO: "Vendite +40% lunedì scorso" (senza spiegare perché)
✅ CORRETTO:  "Vendite +40%: likely dovuto a campagna email sent domenica sera"
```

---

## Esempi

### Esempio 1: Cross-Sell Opportunity
**Input**: Analisi basket ultimi 3 mesi

**Output**:
```json
{
  "opportunities": [
    {
      "type": "cross_sell",
      "title": "Cross-sell Ricotta a clienti Pasta fresca",
      "target_customers": 240,
      "estimated_revenue_impact": 4800.00,
      "confidence_level": "high",
      "implementation": {
        "recommended_action": "Bundle Pasta+Ricotta con -15%"
      }
    }
  ]
}
```

### Esempio 2: Churn Risk
**Input**: Customer activity ultimi 6 mesi

**Output**:
```json
{
  "opportunities": [
    {
      "type": "churn_risk",
      "customers_at_risk": 8,
      "total_revenue_at_risk": 65000.00,
      "risk_level": "high",
      "mitigation": {
        "recommended_action": "Account manager call + retention offer",
        "urgency": "critical"
      }
    }
  ]
}
```

### Esempio 3: Trending Product
**Input**: Product performance 6 mesi

**Output**:
```json
{
  "opportunities": [
    {
      "type": "trending_up",
      "title": "Olio Olivum in forte crescita",
      "growth_mom_3m": 62.0,
      "implementation": {
        "recommended_action": "Aumentare inventory, lanciare promo awareness"
      }
    }
  ]
}
```

---

## Note Tecniche

- **Modello**: Claude 3.5 Sonnet (ottimizzato per pattern recognition)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic - CRITICO per detection accuracy)
- **Timeout**: 60 secondi

**Algoritmi**:
- Association rules (Apriori algorithm) per cross-sell
- Cohort analysis per churn prediction
- Z-score, IQR per anomaly detection
- Time-series decomposition per trend detection
- RFM analysis (Recency, Frequency, Monetary)

**Statistical Tests**:
- Chi-square test per product associations
- T-test per group comparisons
- Mann-Kendall per trend significance
- Confidence intervals per revenue estimates

---

## Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Opportunity types: cross_sell, upsell, reactivation, expansion, trending
- ✅ Risk detection: churn_risk, stockout_risk, margin_erosion
- ✅ Statistical pattern validation (min sample size, significance tests)
- ✅ Quantificazione impatto (revenue, margin, confidence)
- ✅ Prioritization matrix (impact/effort score)
- ✅ Anomaly detection (statistical + time-series)
- ✅ Implementation roadmap con effort estimation
- ✅ ROI calculation
- ✅ Temperature 0 per detection accuracy
