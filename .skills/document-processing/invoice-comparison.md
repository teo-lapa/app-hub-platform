---
name: invoice-comparison
version: 2.1.0
description: Confronto fattura PDF vs bozza Odoo - Logica semplice basata su SUBTOTAL
category: document-processing
tags: [invoice, comparison, accounting, simple]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-10-24
updated: 2025-10-29
---

# 📊 Invoice Comparison Skill v2.0 - LOGICA SEMPLICE

## 🎯 FILOSOFIA

**Ragiona come un UMANO che controlla una fattura manualmente:**

1. Guardo il TOTALE - torna? Bene, se no cerco il problema
2. Per ogni riga PDF, cerco riga bozza con **SUBTOTAL identico**
3. Se subtotal torna → riga OK, passo alla prossima
4. Se subtotal NON torna → controllo prezzo e quantità

**FINE. Niente fuzzy matching complicati, niente Level 1/2/3.**

---

## 📋 ALGORITMO STEP-BY-STEP

### STEP 0: Aggregazione Multi-Lotto (IMPORTANTE!)

Se nel PDF ci sono 2+ righe con **STESSO product_code**:
- Somma le quantità
- Somma i subtotal
- Tratta come **UNA SOLA RIGA** per il confronto

**Esempio:**
```
PDF ha:
  - 009014 CARCIOFI LOTTO A: qty=30, subtotal=276.00
  - 009014 CARCIOFI LOTTO B: qty=6, subtotal=55.20

Aggrega in:
  - 009014 CARCIOFI: qty=36, subtotal=331.20
```

---

### STEP 1: Match su SUBTOTAL (Priorità Massima)

**Per ogni riga PDF aggregata:**

1. Cerca nella bozza righe con **subtotal identico** (±0.01€ tolleranza)
2. Se trovi **1 SOLA riga** con quel subtotal → **MATCH!** ✅
3. Se trovi **0 righe** → prodotto mancante
4. Se trovi **2+ righe** → passa a Step 2 (match su descrizione)

**Perché funziona:**
- Il subtotal è **quasi sempre univoco** (es: €41.02, €35.94, €49.22)
- Se quantità e prezzo sono giusti, il subtotal torna
- Non serve controllare descrizioni complicate

---

### STEP 2: Match su Descrizione (solo se Step 1 fallisce)

**Solo se** Step 1 trova 0 righe o 2+ righe con stesso subtotal:

1. Cerca **parole chiave distinctive** nella descrizione PDF
2. Cerca quelle parole nelle descrizioni bozza
3. Se trovi match → confronta subtotal

**Parole chiave da cercare (in ordine):**
1. Codici: numeri/lettere tipo "009014", "1TRECCE-SV"
2. Nomi specifici: FUSILLONI, BRASELLO, PAPPARDELLE, TAGLIOLINI
3. Ripieno (per paste): RICOTTA LIMONE, PORCINI PATATE, SALSICCIA TALEGGIO

**Parole da IGNORARE:**
- Generiche: PASTA, RIPIENA, UOVO, ALL, FRESCO, CONF
- Forme: MEZZELUNE, TORTELLONE, RAVIOLI, QUADRATO
- Confezione: KG, GR, CA, CRT, MARC, LATTA

---

### STEP 3: Verifica Matematica

Quando trovi un match (Step 1 o Step 2):

```
Se subtotal_pdf = subtotal_bozza (±0.01€):
  → Riga OK ✅ Nessuna correzione

Se subtotal_pdf ≠ subtotal_bozza:
  → Calcola: differenza = subtotal_pdf - subtotal_bozza

  Se unit_price_pdf ≠ unit_price_bozza:
    → Correzione: UPDATE prezzo

  Se quantity_pdf ≠ quantity_bozza:
    → Correzione: UPDATE quantità

  Se entrambi diversi:
    → Correzione: UPDATE prezzo E quantità
```

---

## 🔧 CORREZIONI DA GENERARE

### A) Riga OK (subtotal identico)
**Non generare nessuna correzione!** Passa alla riga successiva.

---

### B) Prezzo diverso
```json
{
  "action": "update",
  "line_id": 123,
  "changes": {"price_unit": 12.62},
  "reason": "Prezzo errato: bozza €13.12, reale €12.62 (diff: -€0.50)",
  "requires_user_approval": false
}
```

---

### C) Quantità diversa
```json
{
  "action": "update",
  "line_id": 124,
  "changes": {"quantity": 3.25},
  "reason": "Quantità errata: bozza 3.00, reale 3.25 (diff: +€3.18)",
  "requires_user_approval": false
}
```

---

### D) Prodotto mancante (non trovato in bozza)
```json
{
  "action": "create",
  "parsed_line": {
    "description": "PRODOTTO XYZ",
    "product_code": "ABC123",
    "quantity": 5,
    "unit_price": 10.00,
    "subtotal": 50.00
  },
  "reason": "Prodotto presente in PDF ma non trovato in bozza",
  "requires_user_approval": true
}
```

---

### E) Prodotto extra in bozza (non in PDF)

**NON GENERARE NESSUNA CORREZIONE!**

Se un prodotto è in bozza ma non in PDF:
- Probabilmente aggiunto manualmente dal magazziniere
- Solo l'utente può decidere se eliminarlo
- **IGNORA completamente** - non segnalare

---

## 📊 FORMATO OUTPUT

```json
{
  "is_valid": boolean,
  "total_difference": number,
  "draft_total": number,
  "real_total": number,
  "differences": [
    {
      "type": "price_mismatch" | "quantity_mismatch" | "missing_product",
      "severity": "warning" | "error",
      "draft_line_id": number | null,
      "description": string,
      "expected_value": number,
      "actual_value": number,
      "amount_difference": number
    }
  ],
  "corrections_needed": [
    {
      "action": "update" | "create",
      "line_id": number | null,
      "changes": object | null,
      "parsed_line": object | null,
      "reason": string,
      "requires_user_approval": boolean
    }
  ],
  "can_auto_fix": boolean
}
```

---

## ✅ ESEMPI PRATICI

### Esempio 1: Match perfetto su subtotal

**PDF:**
```json
{
  "description": "FUSILLONI UOVO GR. 1000",
  "quantity": 3,
  "unit_price": 6.54,
  "subtotal": 19.62
}
```

**Bozza:**
```json
{
  "id": 100,
  "product": "FUSILLONI 1KG CA 5KG CRT MARC",
  "quantity": 3,
  "unit_price": 6.54,
  "subtotal": 19.62
}
```

**Analisi:**
1. Cerco righe bozza con subtotal = 19.62€
2. Trovata 1 riga con id=100
3. Subtotal identico → **MATCH!**
4. Nessuna correzione necessaria

**Output:** Nessuna correzione per questa riga ✅

---

### Esempio 2: Prezzo errato

**PDF:**
```json
{
  "description": "TORTELLONE MANZO GR. 1000",
  "quantity": 2,
  "unit_price": 12.62,
  "subtotal": 25.24
}
```

**Bozza:**
```json
{
  "id": 101,
  "product": "PASTA RIPIENA AL MANZO CONF CRT CA 5KG MARC",
  "quantity": 2,
  "unit_price": 13.12,
  "subtotal": 26.24
}
```

**Analisi:**
1. Cerco subtotal = 25.24€ → non trovato
2. Cerco subtotal simile: 26.24€ → trovato id=101
3. Differenza: €1.00 (€26.24 - €25.24)
4. Quantità OK (2=2), prezzo diverso (€12.62 vs €13.12)
5. Causa: prezzo errato

**Output:**
```json
{
  "action": "update",
  "line_id": 101,
  "changes": {"price_unit": 12.62},
  "reason": "Prezzo TORTELLONE MANZO: bozza €13.12, reale €12.62 (impatto: -€1.00)",
  "requires_user_approval": false
}
```

---

### Esempio 3: Prodotto mancante

**PDF:**
```json
{
  "description": "PACCHERI GR.500",
  "quantity": 1,
  "unit_price": 6.54,
  "subtotal": 6.54
}
```

**Bozza:** (nessuna riga con subtotal ≈ 6.54€)

**Analisi:**
1. Cerco subtotal = 6.54€ → non trovato
2. Cerco "PACCHERI" in descrizioni bozza → non trovato
3. Prodotto mancante!

**Output:**
```json
{
  "action": "create",
  "parsed_line": {
    "description": "PACCHERI GR.500",
    "quantity": 1,
    "unit_price": 6.54,
    "subtotal": 6.54
  },
  "reason": "Prodotto PACCHERI presente in PDF ma non trovato in bozza (€6.54)",
  "requires_user_approval": true
}
```

---

## 🚨 REGOLE CRITICHE

### 1. SUBTOTAL È LA PRIORITÀ #1
Non perdere tempo con fuzzy matching complicati.
Se subtotal torna → riga OK, punto.

### 2. NON segnalare prodotti extra in bozza
Se bozza ha righe non presenti in PDF → IGNORA.
Non creare "differenze" o "warning" per questo.

### 3. Tolleranza arrotondamento: ±€0.01
Es: subtotal PDF = €19.62, bozza = €19.63 → **OK** (arrotondamento)

### 4. Aggregazione multi-lotto SEMPRE
Prima di tutto, somma righe PDF con stesso product_code.

### 5. Descrizioni: cerca solo parole CHIAVE
Non fare matching completo di stringhe.
Cerca solo 1-2 parole distintive.

---

## ⚠️ OUTPUT FINALE

**IMPORTANTE:** Rispondi SOLO con JSON valido. NO testo prima/dopo.

Esempio output completo:

```json
{
  "is_valid": false,
  "total_difference": 1.95,
  "draft_total": 764.84,
  "real_total": 766.79,
  "differences": [
    {
      "type": "price_mismatch",
      "severity": "warning",
      "draft_line_id": 101,
      "description": "Prezzo TORTELLONE MANZO: bozza €13.12, reale €12.62",
      "expected_value": 12.62,
      "actual_value": 13.12,
      "amount_difference": 1.00
    }
  ],
  "corrections_needed": [
    {
      "action": "update",
      "line_id": 101,
      "changes": {"price_unit": 12.62},
      "reason": "Prezzo errato: -€0.50 per unità (impatto totale: -€1.00)",
      "requires_user_approval": false
    }
  ],
  "can_auto_fix": true
}
```

---

## 🎯 RICORDA

**Sei un contabile che controlla manualmente una fattura.**

1. Confronta SUBTOTAL delle righe
2. Se subtotal torna → OK
3. Se non torna → controlla prezzo/quantità
4. Segnala SOLO problemi reali
5. NON inventare problemi che non esistono

**SEMPLICE. EFFICACE. PRECISO.**
