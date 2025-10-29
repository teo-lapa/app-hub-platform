---
name: auricchio-compile-reception
version: 1.1.0
description: Compila ricezione Odoo convertendo date e preparando dati per update
category: document-processing
tags: [auricchio, odoo, compilation, date-conversion]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-27
updated: 2025-10-29
---

# ✅ Auricchio - Compilazione Ricezione

## 🎯 Obiettivo

Convertire i dati matchati in formato pronto per l'update su Odoo:
- ✅ Convertire date da GG/MM/AA a YYYY-MM-DD
- ✅ Preparare i comandi di update per ogni riga
- ✅ Gestire righe da mettere a zero

## 📄 Input

Riceverai il JSON dall'AGENTE 3 (matched_lines):

```json
{
  "matched_lines": [
    {
      "odoo_line_id": 123456,
      "product_code": "71G",
      "product_name": "PECORINO ROMANO...",
      "quantity": 20.0,
      "unit": "NR",
      "lot_number": "5275MM2",
      "expiry_date": "08/02/26",
      "match_status": "matched"
    },
    {
      "odoo_line_id": 123458,
      "product_code": "CAMEMBERT",
      "product_name": "CAMEMBERT...",
      "quantity": 0,
      "unit": "PZ",
      "lot_number": null,
      "expiry_date": null,
      "match_status": "not_found_in_invoice"
    }
  ]
}
```

## 🔄 Conversione Date

**Regole**:
```
Input: "08/02/26" (GG/MM/AA)
Output: "2026-02-08" (YYYY-MM-DD)

Input: "19/12/25" (GG/MM/AA)
Output: "2025-12-19" (YYYY-MM-DD)

Input: null
Output: null
```

**Logica anno**:
- Se AA <= 50 → 20AA (es: 26 → 2026)
- Se AA > 50 → 19AA (es: 98 → 1998)

## ✅ Output Richiesto

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo.

```json
{
  "updates": [
    {
      "odoo_line_id": 123456,
      "product_code": "71G",
      "product_name": "PECORINO ROMANO DOP GRATTUGIATO FRESCO 1KG 10KG CRT AUR",
      "qty_done": 20.0,
      "lot_name": "5275MM2",
      "expiration_date": "2026-02-08",
      "action": "update"
    },
    {
      "odoo_line_id": 123457,
      "product_code": "CIA13",
      "product_name": "GORGONZOLA DOP SANGIORGIO EXP.4 VASC. 1/8 TS PZ CA 1.5KG AUR",
      "qty_done": 54.18,
      "lot_name": "2595225H2",
      "expiration_date": "2025-12-19",
      "action": "update"
    },
    {
      "odoo_line_id": 123458,
      "product_code": "CAMEMBERT",
      "product_name": "CAMEMBERT DI BUFALA CON TARTUFO 150G PZ 6PZ A CRT AUR",
      "qty_done": 0,
      "lot_name": null,
      "expiration_date": null,
      "action": "set_to_zero"
    }
  ],
  "summary": {
    "total_lines": 3,
    "to_update": 2,
    "to_set_zero": 1,
    "with_lots": 2,
    "without_lots": 1
  }
}
```

## 📋 Regole

1. ✅ **Converti TUTTE le date** da GG/MM/AA a YYYY-MM-DD
2. ✅ Cambia nomi campi:
   - `quantity` → `qty_done`
   - `lot_number` → `lot_name`
   - `expiry_date` → `expiration_date`
3. ✅ Se `match_status: "matched"` → `action: "update"`
4. ✅ Se `match_status: "not_found_in_invoice"` → `action: "set_to_zero"` e `qty_done: 0`
5. ✅ Se `lot_name` è null → lascia null
6. ✅ Se `expiration_date` è null → lascia null
7. ✅ Aggiungi `summary` con conteggi

## 🎯 Esempi Conversione Date

```
"08/02/26" → "2026-02-08"  ✅
"19/12/25" → "2025-12-19"  ✅
"26/01/26" → "2026-01-26"  ✅
"24/11/25" → "2025-11-24"  ✅
"18/04/26" → "2026-04-18"  ✅
null       → null           ✅
```

## 🎯 Esempi Action

```
match_status: "matched", quantity: 20.0
  → action: "update", qty_done: 20.0 ✅

match_status: "not_found_in_invoice", quantity: 0
  → action: "set_to_zero", qty_done: 0 ✅

match_status: "matched", lot_number: null
  → action: "update", lot_name: null ✅
```

## ⚠️ Errori da Evitare

❌ **Errore #1**: Non convertire le date
```json
// SBAGLIATO
{ "expiration_date": "08/02/26" }  // Non convertita!

// CORRETTO
{ "expiration_date": "2026-02-08" } // Convertita!
```

❌ **Errore #2**: Non cambiare i nomi dei campi
```json
// SBAGLIATO
{ "quantity": 20.0, "lot_number": "5275MM2" }

// CORRETTO
{ "qty_done": 20.0, "lot_name": "5275MM2" }
```

❌ **Errore #3**: Mettere qty_done non zero per not_found
```json
// SBAGLIATO
{ "match_status": "not_found_in_invoice", "qty_done": 6 }

// CORRETTO
{ "match_status": "not_found_in_invoice", "qty_done": 0, "action": "set_to_zero" }
```

❌ **Errore #4**: Anno sbagliato
```json
// SBAGLIATO
"26/01/26" → "1926-01-26"  // Anno 1926!

// CORRETTO
"26/01/26" → "2026-01-26"  // Anno 2026
```

## 🧪 Test di Validità

Prima di rispondere, verifica:
- [ ] Tutte le date sono convertite in YYYY-MM-DD?
- [ ] I nomi dei campi sono cambiati (qty_done, lot_name, expiration_date)?
- [ ] Le righe not_found hanno qty_done=0 e action="set_to_zero"?
- [ ] Le righe matched hanno action="update"?
- [ ] Il summary ha i conteggi corretti?
- [ ] Gli anni sono nel 2000s (non 1900s)?

## 📤 Formato Output Finale

```json
{
  "updates": [
    {
      "odoo_line_id": 0,
      "product_code": "CODICE",
      "product_name": "Nome prodotto",
      "qty_done": 0.0,
      "lot_name": "LOTTO o null",
      "expiration_date": "YYYY-MM-DD o null",
      "action": "update o set_to_zero"
    }
  ],
  "summary": {
    "total_lines": 0,
    "to_update": 0,
    "to_set_zero": 0,
    "with_lots": 0,
    "without_lots": 0
  }
}
```

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
