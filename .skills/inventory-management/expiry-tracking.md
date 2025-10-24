---
name: expiry-tracking
version: 1.0.0
description: Traccia prodotti in scadenza e prioritizza rotazione stock FIFO/FEFO
category: inventory-management
tags: [expiry, fefo, fifo, food-safety, haccp, rotation]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
temperature: 0
max_tokens: 8192
---

# ⏰ Expiry Tracking Skill

## Contesto

Stai monitorando **date di scadenza prodotti** per garantire:
- ✅ Sicurezza alimentare (HACCP compliance)
- ✅ Rotazione stock FIFO/FEFO corretta
- ✅ Riduzione sprechi e perdite
- ✅ Prevenzione vendita prodotti scaduti

**CRITICITÀ**: Errori in questa fase causano:
- ❌ Rischi sanitari (vendita prodotti scaduti)
- ❌ Sanzioni ASL/NAS
- ❌ Perdite economiche (scarti)
- ❌ Danni reputazionali

---

## Input che Riceverai

### Struttura Dati Lotti con Scadenze
```json
[
  {
    "product_id": 101,
    "product_code": "MOZ250",
    "product_name": "Mozzarella Bufala 250g",
    "category": "Dairy",
    "lot_number": "L20250115",
    "expiry_date": "2025-01-25",
    "quantity_on_hand": 45.0,
    "unit": "KG",
    "location": "WH/Stock/Frigo",
    "unit_value": 12.50,
    "supplier": "Caseificio Rossi"
  }
]
```

---

## Strategia di Tracking

### 🎯 FASE 1: Calcolo Giorni a Scadenza

**Formula**:
```
days_to_expiry = expiry_date - today
```

**Data di riferimento**: Oggi = 2025-01-24 (usare data corrente sistema)

**Esempio**:
```
Expiry: 2025-01-25
Today:  2025-01-24
Days to expiry: 1 giorno
```

**Casi speciali**:
```
days_to_expiry = 0  → SCADE OGGI
days_to_expiry < 0  → GIÀ SCADUTO
days_to_expiry > 365 → Scadenza oltre 1 anno
```

---

### 🎯 FASE 2: Classificazione per Urgenza

**Classifica ogni lotto in base a giorni rimanenti**:

#### 🔴 EXPIRED (Scaduto)
- **days_to_expiry < 0**
- Prodotto SCADUTO, non vendibile
- **Azione**: Blocco immediato, scarto obbligatorio
- **Priorità**: MASSIMA

**Esempio**: Scadenza 2025-01-20, oggi 2025-01-24 → -4 giorni

---

#### 🟠 CRITICAL (Critico) - 0-3 giorni
- **0 ≤ days_to_expiry ≤ 3**
- Scade oggi o entro 3 giorni
- **Azione**: Vendita immediata, promozione, donazione
- **Priorità**: ALTISSIMA

**Esempio**: Scadenza 2025-01-25, oggi 2025-01-24 → 1 giorno

---

#### 🟡 WARNING (Allerta) - 4-7 giorni
- **4 ≤ days_to_expiry ≤ 7**
- Settimana critica
- **Azione**: Priorità vendita, controllo consumo
- **Priorità**: ALTA

**Esempio**: Scadenza 2025-01-30, oggi 2025-01-24 → 6 giorni

---

#### 🟢 ATTENTION (Attenzione) - 8-30 giorni
- **8 ≤ days_to_expiry ≤ 30**
- Mese di visibilità
- **Azione**: Monitoraggio, pianificazione uso
- **Priorità**: MEDIA

**Esempio**: Scadenza 2025-02-15, oggi 2025-01-24 → 22 giorni

---

#### ⚪ SAFE (Sicuro) - > 30 giorni
- **days_to_expiry > 30**
- Oltre 1 mese
- **Azione**: Rotazione normale FIFO/FEFO
- **Priorità**: BASSA

**Esempio**: Scadenza 2025-03-24, oggi 2025-01-24 → 59 giorni

---

### 🎯 FASE 3: Calcolo Valore a Rischio

**Formula**:
```
at_risk_value = quantity_on_hand × unit_value
```

**Prioritizzazione per valore**:
- Prodotti alto valore (>500 EUR) → priorità anche se SAFE
- Prodotti basso valore (<50 EUR) in CRITICAL → tolleranza scarto

**Esempio**:
```
Prodotto: Tartufo (qty: 2 KG, valore: 500 EUR/kg)
At-risk value: 1000 EUR
Urgency: ATTENTION (20 giorni)
→ Priority: HIGH (per valore elevato!)
```

---

### 🎯 FASE 4: Analisi Rotazione FIFO/FEFO

**FIFO (First In, First Out)**: Primo arrivato, primo uscito
**FEFO (First Expired, First Out)**: Prima scadenza, prima uscita

**Per prodotti deperibili → SEMPRE FEFO!**

**Verifica ordine lotti**:
```
Prodotto: Mozzarella
  Lotto A: Scad 2025-01-25 (qty: 10 KG) ← Deve uscire PRIMA
  Lotto B: Scad 2025-01-28 (qty: 15 KG)
  Lotto C: Scad 2025-02-02 (qty: 20 KG)
```

**Identificazione problemi rotazione**:
- ❌ Lotto più vecchio con qty alta → non si sta vendendo
- ❌ Lotto nuovo in location principale → errore picking
- ✅ Qty proporzionali a scadenza → rotazione corretta

---

### 🎯 FASE 5: Suggerimenti Azioni

**Per ogni categoria urgenza, suggerisci azioni**:

#### EXPIRED (Scaduto)
```json
{
  "urgency": "EXPIRED",
  "actions": [
    "immediate_block",
    "quality_check",
    "disposal",
    "record_loss"
  ],
  "action_details": "BLOCCARE vendita. Verificare condizioni. Smaltire secondo procedure HACCP. Registrare perdita in contabilità."
}
```

---

#### CRITICAL (0-3 giorni)
```json
{
  "urgency": "CRITICAL",
  "actions": [
    "flash_sale",
    "internal_consumption",
    "donation",
    "promotional_price"
  ],
  "action_details": "Promozione lampo -30%. Usare per consumo interno/campioni. Contattare banco alimentare per donazione.",
  "price_reduction_suggestion": 30.0
}
```

---

#### WARNING (4-7 giorni)
```json
{
  "urgency": "WARNING",
  "actions": [
    "priority_picking",
    "promotional_price",
    "recipe_suggestion"
  ],
  "action_details": "Priorità picking questo lotto. Sconto 15%. Suggerire ricette/menu che usano il prodotto.",
  "price_reduction_suggestion": 15.0
}
```

---

#### ATTENTION (8-30 giorni)
```json
{
  "urgency": "ATTENTION",
  "actions": [
    "monitor_consumption",
    "forecast_usage",
    "pause_reorder"
  ],
  "action_details": "Monitorare consumo medio giornaliero. Verificare se qty è compatibile con giorni rimanenti. Sospendere riordino se necessario."
}
```

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "tracking_summary": {
    "analysis_date": "2025-01-24",
    "total_products_tracked": 150,
    "total_lots_tracked": 320,
    "expired_lots": 5,
    "critical_lots": 12,
    "warning_lots": 25,
    "attention_lots": 78,
    "safe_lots": 200,
    "total_at_risk_value": 12500.00,
    "urgent_action_required": true
  },
  "expiring_products": [
    {
      "product_id": 101,
      "product_code": "MOZ250",
      "product_name": "Mozzarella Bufala 250g",
      "category": "Dairy",
      "lot_number": "L20250115",
      "expiry_date": "2025-01-25",
      "days_to_expiry": 1,
      "quantity_on_hand": 45.0,
      "unit": "KG",
      "unit_value": 12.50,
      "at_risk_value": 562.50,
      "location": "WH/Stock/Frigo",
      "urgency": "CRITICAL",
      "priority": "VERY_HIGH",
      "actions": [
        "flash_sale",
        "internal_consumption"
      ],
      "action_details": "Scade domani! Promozione immediata -30% o uso interno. Qty elevata (45 KG) difficile da smaltire in 1 giorno.",
      "price_reduction_suggestion": 30.0,
      "notes": "Prodotto deperibile, controllare qualità prima vendita"
    },
    {
      "product_id": 102,
      "product_code": "TART500",
      "product_name": "Tartufo Nero Pregiato",
      "category": "Specialty",
      "lot_number": "T20250110",
      "expiry_date": "2025-01-22",
      "days_to_expiry": -2,
      "quantity_on_hand": 0.5,
      "unit": "KG",
      "unit_value": 800.00,
      "at_risk_value": 400.00,
      "location": "WH/Stock/Frigo",
      "urgency": "EXPIRED",
      "priority": "CRITICAL",
      "actions": [
        "immediate_block",
        "quality_check",
        "disposal"
      ],
      "action_details": "SCADUTO 2 giorni fa! Bloccare vendita. Verificare condizioni effettive (potrebbe essere ancora buono). Se deteriorato: smaltire e registrare perdita 400 EUR.",
      "notes": "Alto valore - verificare se recuperabile prima di smaltire"
    }
  ],
  "rotation_analysis": {
    "products_with_multiple_lots": [
      {
        "product_code": "MOZ250",
        "product_name": "Mozzarella Bufala 250g",
        "total_lots": 3,
        "lots": [
          {
            "lot_number": "L20250115",
            "expiry_date": "2025-01-25",
            "days_to_expiry": 1,
            "quantity": 45.0,
            "priority_order": 1
          },
          {
            "lot_number": "L20250118",
            "expiry_date": "2025-01-28",
            "days_to_expiry": 4,
            "quantity": 30.0,
            "priority_order": 2
          },
          {
            "lot_number": "L20250120",
            "expiry_date": "2025-02-01",
            "days_to_expiry": 8,
            "quantity": 15.0,
            "priority_order": 3
          }
        ],
        "rotation_status": "CORRECT",
        "rotation_notes": "FEFO rispettato: qty decrescenti con scadenze crescenti"
      }
    ]
  },
  "recommendations": [
    "URGENTE: 5 lotti scaduti da bloccare e smaltire (valore 850 EUR)",
    "Promozione flash per 12 lotti in scadenza entro 3 giorni (valore 3200 EUR)",
    "Monitorare Mozzarella L20250115: 45 KG da smaltire in 1 giorno",
    "Verificare tartufo T20250110 scaduto: alto valore (400 EUR), controllare se recuperabile",
    "Sospendere riordini prodotti con >30 giorni di scorta"
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| tracking_summary | object | ✅ | Riepilogo tracking |
| tracking_summary.expired_lots | number | ✅ | Lotti scaduti |
| tracking_summary.critical_lots | number | ✅ | Lotti 0-3 giorni |
| tracking_summary.total_at_risk_value | number | ✅ | Valore totale a rischio (EUR) |
| expiring_products | array | ✅ | Lista prodotti ordinata per urgenza |
| expiring_products[].days_to_expiry | number | ✅ | Giorni rimanenti |
| expiring_products[].urgency | string | ✅ | EXPIRED, CRITICAL, WARNING, ATTENTION, SAFE |
| expiring_products[].priority | string | ✅ | Priorità azione |
| expiring_products[].actions | array | ✅ | Azioni suggerite |
| rotation_analysis | object | ✅ | Analisi rotazione FIFO/FEFO |
| recommendations | array | ✅ | Azioni raccomandate prioritarie |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Calcolo Giorni Errato
```
❌ SBAGLIATO: days_to_expiry = today - expiry_date
✅ CORRETTO:  days_to_expiry = expiry_date - today
```

### Errore #2: Urgency Mal Classificata
```
❌ SBAGLIATO: 2 giorni → urgency: "WARNING"
✅ CORRETTO:  2 giorni → urgency: "CRITICAL"
```

### Errore #3: Non Considerare Valore
```
❌ SBAGLIATO: Tartufo 20 giorni → priority: "MEDIUM"
✅ CORRETTO:  Tartufo 20 giorni + 1000 EUR → priority: "HIGH"
```

### Errore #4: Ignorare Qty
```
❌ SBAGLIATO: 1 KG scade domani → priority: "HIGH"
✅ CORRETTO:  100 KG scadono domani → priority: "VERY_HIGH"
```

---

## 🧪 Esempi

### Esempio 1: Analisi Multi-Lotto

**Input**:
```json
[
  {"product_code": "MOZ250", "lot": "L1", "expiry": "2025-01-25", "qty": 45.0, "value": 12.50},
  {"product_code": "MOZ250", "lot": "L2", "expiry": "2025-01-28", "qty": 30.0, "value": 12.50},
  {"product_code": "RIC500", "lot": "R1", "expiry": "2025-01-22", "qty": 20.0, "value": 8.00}
]
```

**Output** (oggi = 2025-01-24):
```json
{
  "tracking_summary": {
    "expired_lots": 1,
    "critical_lots": 1,
    "warning_lots": 1,
    "total_at_risk_value": 1122.50
  },
  "expiring_products": [
    {
      "product_code": "RIC500",
      "expiry_date": "2025-01-22",
      "days_to_expiry": -2,
      "urgency": "EXPIRED",
      "at_risk_value": 160.00,
      "actions": ["immediate_block", "disposal"]
    },
    {
      "product_code": "MOZ250",
      "lot_number": "L1",
      "days_to_expiry": 1,
      "urgency": "CRITICAL",
      "at_risk_value": 562.50,
      "price_reduction_suggestion": 30.0
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
- Giorni calcolati da mezzanotte (00:00)
- Valori monetari con 2 decimali
- Ordinamento: urgency DESC, days_to_expiry ASC, at_risk_value DESC

---

## 📝 Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Calcolo giorni a scadenza
- ✅ Classificazione urgenza 5 livelli
- ✅ Calcolo valore a rischio
- ✅ Analisi rotazione FIFO/FEFO
- ✅ Suggerimenti azioni per categoria
- ✅ Supporto multi-lotto per prodotto
- ✅ Prioritizzazione per valore+urgenza
