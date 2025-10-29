---
name: stock-reconciliation
version: 1.1.0
description: Riconcilia differenze tra stock fisico e sistema per inventari accurati
category: inventory-management
tags: [reconciliation, inventory, stock, variance, audit]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
temperature: 0
max_tokens: 8192
---

# 📊 Stock Reconciliation Skill

## Contesto

Ricevi **due set di dati** da riconciliare:

1. **Stock Sistema** (quantità registrate in Odoo)
2. **Stock Fisico** (quantità realmente contate in magazzino)

Il tuo compito è **identificare, analizzare e spiegare le differenze** (variance) per mantenere un inventario accurato.

**CRITICITÀ**: Errori in questa fase causano:
- ❌ Inventario inaccurato
- ❌ Ordini sbagliati (out of stock o overstock)
- ❌ Perdite non registrate
- ❌ Problemi con revisioni contabili

---

## Input che Riceverai

### Struttura Stock Sistema (Odoo)
```json
[
  {
    "product_id": 101,
    "product_code": "MOZ250",
    "product_name": "Mozzarella Bufala 250g",
    "location": "WH/Stock",
    "system_qty": 45.0,
    "unit": "KG",
    "lot_number": "L20250115",
    "last_movement_date": "2025-01-15"
  }
]
```

### Struttura Stock Fisico (Conteggio)
```json
[
  {
    "product_code": "MOZ250",
    "product_name": "Mozzarella Bufala 250g",
    "location": "WH/Stock",
    "physical_qty": 42.0,
    "unit": "KG",
    "lot_number": "L20250115",
    "counted_by": "Mario Rossi",
    "count_date": "2025-01-20"
  }
]
```

---

## Strategia di Riconciliazione

### 🎯 FASE 1: Matching Prodotti

**Match per**:
1. **Codice prodotto** (priorità alta)
2. **Nome prodotto** + **Lotto** (se codice mancante)
3. **Location** (stesso magazzino/area)

**Esempio**:
```
Sistema: product_code="MOZ250", lot="L20250115", location="WH/Stock"
Fisico:  product_code="MOZ250", lot="L20250115", location="WH/Stock"
→ MATCH PERFETTO!
```

**Casi particolari**:
- Prodotto nel sistema ma non contato → fisico assente
- Prodotto contato ma non nel sistema → nuovo prodotto o errore
- Stesso prodotto, lotti diversi → tratta come prodotti separati

---

### 🎯 FASE 2: Calcolo Variance

**Formula**:
```
variance = physical_qty - system_qty
variance_percent = (variance / system_qty) × 100
```

**Interpretazione**:
```
variance > 0  → ECCEDENZA (più prodotto del previsto)
variance < 0  → MANCANZA (meno prodotto del previsto)
variance = 0  → ALLINEATO (perfetto!)
```

**Esempio**:
```
Sistema:  45.0 KG
Fisico:   42.0 KG
Variance: -3.0 KG (-6.67%)
→ MANCANO 3 KG
```

---

### 🎯 FASE 3: Classificazione Severity

**Classifica ogni differenza per gravità**:

#### 🟢 LOW (Bassa) - variance_percent < 5%
- Differenze minime accettabili
- Possibile tolleranza bilancia/arrotondamento
- **Azione**: Registra, nessun alert

**Esempio**: 100 KG → 98 KG (-2%)

---

#### 🟡 MEDIUM (Media) - 5% ≤ variance_percent < 15%
- Differenze significative ma gestibili
- Possibile errore di registrazione movimento
- **Azione**: Richiedi verifica, registra nota

**Esempio**: 50 PZ → 45 PZ (-10%)

---

#### 🔴 HIGH (Alta) - variance_percent ≥ 15%
- Differenze critiche
- Possibile furto, spreco non registrato, errore grave
- **Azione**: Alert immediato, indagine richiesta

**Esempio**: 100 KG → 75 KG (-25%)

---

#### ⚫ CRITICAL (Critica) - Casi Speciali
- Prodotto completamente mancante (system_qty > 0, physical_qty = 0)
- Prodotto trovato ma non a sistema (system_qty = 0, physical_qty > 0)
- Valore monetario alto (>500 EUR)
- **Azione**: Blocca operazioni, indagine immediata

---

### 🎯 FASE 4: Analisi Root Cause

**Per ogni variance, identifica possibile causa**:

#### Cause Comuni - Mancanza (variance < 0)
1. **"spoilage"**: Prodotto scaduto/deteriorato non registrato
2. **"theft"**: Furto o sottrazione
3. **"unregistered_consumption"**: Consumo non registrato (es. campioni, omaggi)
4. **"data_entry_error"**: Errore inserimento dati
5. **"counting_error"**: Errore nel conteggio fisico

**Suggerimenti identificazione**:
```
Prodotto deperibile + mancanza > 10% → probabile "spoilage"
Prodotto di valore + mancanza critica → possibile "theft"
Piccola mancanza + movimento recente → probabile "counting_error"
```

---

#### Cause Comuni - Eccedenza (variance > 0)
1. **"unreceived_delivery"**: Merce arrivata non registrata
2. **"return_not_processed"**: Reso non processato
3. **"data_entry_error"**: Errore inserimento (qty negativa invece positiva)
4. **"counting_error"**: Errore conteggio fisico
5. **"duplicate_entry"**: Registrazione doppia movimento

---

### 🎯 FASE 5: Proposta Azione Correttiva

**Per ogni variance, suggerisci azione**:

| Severity | Variance | Azione Proposta |
|----------|----------|----------------|
| LOW | < 5% | "adjust_system" - Allinea sistema a fisico |
| MEDIUM | 5-15% | "recount_required" - Ricontare per conferma |
| HIGH | > 15% | "investigation_required" - Indagine + riconteggio |
| CRITICAL | Speciale | "hold_operations" - Blocca operazioni, audit |

**Esempio**:
```json
{
  "severity": "HIGH",
  "variance_percent": -22.0,
  "recommended_action": "investigation_required",
  "action_details": "Indagare mancanza 11 KG. Verificare movimenti ultimi 7 giorni. Ricontare dopo indagine."
}
```

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "reconciliation_summary": {
    "count_date": "2025-01-20",
    "counted_by": "Mario Rossi",
    "location": "WH/Stock",
    "total_products_system": 45,
    "total_products_counted": 43,
    "products_matched": 40,
    "products_with_variance": 8,
    "products_not_found": 2,
    "products_unexpected": 3,
    "total_variance_value": -450.50
  },
  "variances": [
    {
      "product_id": 101,
      "product_code": "MOZ250",
      "product_name": "Mozzarella Bufala 250g",
      "lot_number": "L20250115",
      "location": "WH/Stock",
      "unit": "KG",
      "system_qty": 45.0,
      "physical_qty": 42.0,
      "variance": -3.0,
      "variance_percent": -6.67,
      "unit_value": 12.50,
      "variance_value": -37.50,
      "severity": "MEDIUM",
      "probable_cause": "spoilage",
      "cause_confidence": 0.75,
      "recommended_action": "recount_required",
      "action_details": "Verificare scadenze lotto L20250115. Possibile scarto non registrato.",
      "notes": "Prodotto deperibile, controllare celle frigo"
    },
    {
      "product_id": 102,
      "product_code": "OLIO5L",
      "product_name": "Olio Extra Vergine 5L",
      "lot_number": "25E172",
      "location": "WH/Stock",
      "unit": "PZ",
      "system_qty": 50.0,
      "physical_qty": 38.0,
      "variance": -12.0,
      "variance_percent": -24.0,
      "unit_value": 35.00,
      "variance_value": -420.00,
      "severity": "CRITICAL",
      "probable_cause": "theft",
      "cause_confidence": 0.60,
      "recommended_action": "hold_operations",
      "action_details": "ALERT: Mancanza critica prodotto alto valore. Bloccare movimenti. Audit immediato. Verificare video sorveglianza.",
      "notes": "Prodotto di valore, mancanza significativa"
    }
  ],
  "products_not_found": [
    {
      "product_id": 103,
      "product_code": "RIC500",
      "product_name": "Ricotta Fresca 500g",
      "lot_number": "L20250118",
      "system_qty": 15.0,
      "unit": "KG",
      "severity": "CRITICAL",
      "recommended_action": "investigation_required",
      "notes": "Prodotto nel sistema ma non trovato in conteggio. Verificare se consumato o spostato."
    }
  ],
  "products_unexpected": [
    {
      "product_code": "PROV001",
      "product_name": "Provola Affumicata",
      "physical_qty": 8.0,
      "unit": "KG",
      "location": "WH/Stock",
      "severity": "MEDIUM",
      "recommended_action": "register_receipt",
      "notes": "Prodotto trovato ma non a sistema. Verificare se arrivo non registrato."
    }
  ],
  "recommendations": [
    "Ricontare prodotti con severity MEDIUM o superiore",
    "Indagare mancanza critica OLIO5L (420 EUR)",
    "Verificare arrivi non registrati ultimi 3 giorni",
    "Controllare procedure scarico merce deperita"
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| reconciliation_summary | object | ✅ | Riepilogo riconciliazione |
| reconciliation_summary.total_variance_value | number | ✅ | Valore totale differenze (EUR) |
| variances | array | ✅ | Prodotti con differenze |
| variances[].variance | number | ✅ | Differenza quantità |
| variances[].variance_percent | number | ✅ | Percentuale differenza |
| variances[].severity | string | ✅ | LOW, MEDIUM, HIGH, CRITICAL |
| variances[].probable_cause | string | ✅ | Causa probabile |
| variances[].cause_confidence | number | ✅ | 0.0-1.0 confidenza causa |
| variances[].recommended_action | string | ✅ | Azione suggerita |
| products_not_found | array | ✅ | Nel sistema ma non contati |
| products_unexpected | array | ✅ | Contati ma non nel sistema |
| recommendations | array | ✅ | Azioni raccomandate |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Calcolo Variance Errato
```
❌ SBAGLIATO: variance = system_qty - physical_qty
✅ CORRETTO:  variance = physical_qty - system_qty
```

### Errore #2: Severity Mal Classificata
```
❌ SBAGLIATO: -25% → severity: "MEDIUM"
✅ CORRETTO:  -25% → severity: "HIGH"
```

### Errore #3: Non Considerare Valore
```
❌ SBAGLIATO: -2% su prodotto da 1000 EUR → LOW
✅ CORRETTO:  -2% su prodotto da 1000 EUR → MEDIUM/HIGH (20 EUR!)
```

### Errore #4: Causa Generica
```
❌ SBAGLIATO: probable_cause: "unknown"
✅ CORRETTO:  probable_cause: "spoilage" (con contesto)
```

---

## 🧪 Esempi

### Esempio 1: Riconciliazione Completa

**Input Sistema**:
```json
[
  {"product_code": "MOZ250", "system_qty": 100.0, "unit": "KG", "unit_value": 12.50},
  {"product_code": "OLIO5L", "system_qty": 50.0, "unit": "PZ", "unit_value": 35.00}
]
```

**Input Fisico**:
```json
[
  {"product_code": "MOZ250", "physical_qty": 98.0, "unit": "KG"},
  {"product_code": "OLIO5L", "physical_qty": 50.0, "unit": "PZ"},
  {"product_code": "NEW001", "physical_qty": 5.0, "unit": "KG"}
]
```

**Output**:
```json
{
  "reconciliation_summary": {
    "products_matched": 2,
    "products_with_variance": 1,
    "products_unexpected": 1,
    "total_variance_value": -25.00
  },
  "variances": [
    {
      "product_code": "MOZ250",
      "system_qty": 100.0,
      "physical_qty": 98.0,
      "variance": -2.0,
      "variance_percent": -2.0,
      "variance_value": -25.00,
      "severity": "LOW",
      "probable_cause": "counting_error",
      "recommended_action": "adjust_system"
    }
  ],
  "products_unexpected": [
    {
      "product_code": "NEW001",
      "physical_qty": 5.0,
      "severity": "MEDIUM",
      "recommended_action": "register_receipt"
    }
  ]
}
```

---

## 🔧 Note Tecniche

- **Modello**: Claude 3.5 Sonnet
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 60 secondi

**Calcoli**:
- Variance sempre con 2 decimali
- Percentuali arrotondate a 2 decimali
- Valori monetari con 2 decimali

---

## 📝 Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Matching prodotti sistema/fisico
- ✅ Calcolo variance con percentuali
- ✅ Classificazione severity automatica
- ✅ Analisi root cause
- ✅ Suggerimenti azioni correttive
- ✅ Supporto prodotti non trovati/inattesi
