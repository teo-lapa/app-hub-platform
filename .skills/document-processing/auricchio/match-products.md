---
name: auricchio-match-products
version: 1.1.0
description: Matcha prodotti Auricchio da fattura con righe ricezione Odoo per codice articolo
category: document-processing
tags: [auricchio, matching, odoo, product-matching]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-27
updated: 2025-10-29
---

# 🔗 Auricchio - Matching Prodotti

## 🎯 Obiettivo

Matchare i prodotti dalla fattura Auricchio con le righe della ricezione Odoo, combinando:
- Quantità (da AGENTE 2)
- Lotti e scadenze (da AGENTE 1)
- Righe Odoo (dalla ricezione)

## 📄 Input

Riceverai **3 JSON**:

### 1️⃣ Lotti (da AGENTE 1)
```json
{
  "lots_map": {
    "71G": { "lot_number": "5275MM2", "expiry_date": "08/02/26" },
    "CIA13": { "lot_number": "2595225H2", "expiry_date": "19/12/25" }
  }
}
```

### 2️⃣ Quantità (da AGENTE 2)
```json
{
  "quantities_map": {
    "71G": { "quantity": 20.0, "unit": "NR", "description": "PECORINO ROMANO..." },
    "CIA13": { "quantity": 54.18, "unit": "KG", "description": "GORGONZOLA..." }
  }
}
```

### 3️⃣ Righe Odoo (dalla ricezione)
```json
{
  "odoo_lines": [
    {
      "id": 123456,
      "product_code": "71G",
      "product_name": "PECORINO ROMANO DOP GRATTUGIATO FRESCO 1KG 10KG CRT AUR",
      "expected_qty": 20.0
    },
    {
      "id": 123457,
      "product_code": "CIA13",
      "product_name": "GORGONZOLA DOP SANGIORGIO EXP.4 VASC. 1/8 TS PZ CA 1.5KG AUR",
      "expected_qty": 54.18
    }
  ]
}
```

## 🔍 Strategia di Matching

**Match per CODICE ARTICOLO**:
1. Per ogni riga Odoo, cerca il `product_code` (es: "71G")
2. Trova lo stesso codice in `quantities_map`
3. Trova lo stesso codice in `lots_map`
4. Combina i dati

**Esempio**:
```
Riga Odoo: product_code = "CIA13"
  ↓
Cerca "CIA13" in quantities_map → quantity: 54.18, unit: "KG"
  ↓
Cerca "CIA13" in lots_map → lot_number: "2595225H2", expiry_date: "19/12/25"
  ↓
MATCH trovato!
```

## ✅ Output Richiesto

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo.

```json
{
  "matched_lines": [
    {
      "odoo_line_id": 123456,
      "product_code": "71G",
      "product_name": "PECORINO ROMANO DOP GRATTUGIATO FRESCO 1KG 10KG CRT AUR",
      "quantity": 20.0,
      "unit": "NR",
      "lot_number": "5275MM2",
      "expiry_date": "08/02/26",
      "match_status": "matched"
    },
    {
      "odoo_line_id": 123457,
      "product_code": "CIA13",
      "product_name": "GORGONZOLA DOP SANGIORGIO EXP.4 VASC. 1/8 TS PZ CA 1.5KG AUR",
      "quantity": 54.18,
      "unit": "KG",
      "lot_number": "2595225H2",
      "expiry_date": "19/12/25",
      "match_status": "matched"
    },
    {
      "odoo_line_id": 123458,
      "product_code": "CAMEMBERT",
      "product_name": "CAMEMBERT DI BUFALA CON TARTUFO 150G PZ 6PZ A CRT AUR",
      "quantity": 0,
      "unit": "PZ",
      "lot_number": null,
      "expiry_date": null,
      "match_status": "not_found_in_invoice"
    }
  ]
}
```

## 📋 Regole

1. ✅ **Match per codice articolo** (case-insensitive)
2. ✅ Se trovato in entrambi (quantities + lots) → `match_status: "matched"`
3. ✅ Se NON trovato nella fattura → `quantity: 0`, `lot_number: null`, `match_status: "not_found_in_invoice"`
4. ✅ Se trovato in quantities ma NON in lots → usa quantity, ma `lot_number: null`
5. ✅ **NON convertire le date** (lascia formato GG/MM/AA, lo farà il prossimo agente)
6. ✅ Mantieni il `product_name` da Odoo (NON dalla fattura)
7. ✅ **TUTTE** le righe Odoo devono essere nell'output (anche quelle non trovate)

## 🎯 Casi Speciali

### Caso 1: Prodotto con quantità ma senza lotto
```json
quantities_map ha: "E708" → quantity: 21.85
lots_map NON ha: "E708"

Output:
{
  "product_code": "E708",
  "quantity": 21.85,
  "lot_number": null,
  "expiry_date": null,
  "match_status": "matched"
}
```

### Caso 2: Prodotto NON trovato in fattura
```json
Odoo ha: "CAMEMBERT"
quantities_map NON ha: "CAMEMBERT"
lots_map NON ha: "CAMEMBERT"

Output:
{
  "product_code": "CAMEMBERT",
  "quantity": 0,
  "lot_number": null,
  "expiry_date": null,
  "match_status": "not_found_in_invoice"
}
```

### Caso 3: Codice con variazioni (match fuzzy)
```
Odoo: "71G"
Fattura: "71g" (lowercase)

→ MATCH! (case-insensitive)
```

## ⚠️ Errori da Evitare

❌ **Errore #1**: Saltare righe Odoo non trovate
```json
// SBAGLIATO: Solo 2 righe nell'output (manca CAMEMBERT)
{ "matched_lines": [ {71G}, {CIA13} ] }

// CORRETTO: 3 righe (incluso CAMEMBERT con qty=0)
{ "matched_lines": [ {71G}, {CIA13}, {CAMEMBERT con qty=0} ] }
```

❌ **Errore #2**: Convertire le date
```json
// SBAGLIATO
{ "expiry_date": "2026-08-02" }  // Convertita!

// CORRETTO
{ "expiry_date": "08/02/26" }    // Lascia formato originale
```

❌ **Errore #3**: Usare descrizione dalla fattura
```json
// SBAGLIATO
{ "product_name": "PECORINO ROMANO DOP..." }  // Dalla fattura

// CORRETTO
{ "product_name": "PECORINO ROMANO DOP GRATTUGIATO FRESCO 1KG 10KG CRT AUR" }  // Da Odoo
```

## 🧪 Test di Validità

Prima di rispondere, verifica:
- [ ] Tutte le righe Odoo sono nell'output?
- [ ] Il matching è per codice articolo (case-insensitive)?
- [ ] Le righe non trovate hanno quantity=0 e lot_number=null?
- [ ] Le date sono in formato GG/MM/AA (NON convertite)?
- [ ] Il product_name è quello di Odoo (NON della fattura)?

## 📤 Formato Output Finale

```json
{
  "matched_lines": [
    {
      "odoo_line_id": 0,
      "product_code": "CODICE",
      "product_name": "Nome da Odoo",
      "quantity": 0.0,
      "unit": "KG o NR o PZ",
      "lot_number": "LOTTO o null",
      "expiry_date": "GG/MM/AA o null",
      "match_status": "matched o not_found_in_invoice"
    }
  ]
}
```

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
