---
name: extract-supplier
version: 1.1.0
description: Estrae informazioni fornitore e documento da qualsiasi fattura/DDT
category: document-processing
tags: [supplier, invoice, metadata, universal]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-27
updated: 2025-10-29
---

# 🏢 Agent 3 - Estrazione Info Fornitore e Documento

## 🎯 Obiettivo

Estrarre informazioni su fornitore e documento.

## 📋 Cosa Estrarre

- **Nome fornitore** (ragione sociale completa)
- **Partita IVA** fornitore (se presente)
- **Numero documento** (numero fattura o DDT)
- **Data documento**

## 🔍 Dove Cercare

- Intestazione documento
- Riquadro "Mittente" o "Fornitore"
- Numero e data fattura/DDT
- P.IVA o codice fiscale

## ✅ Output Richiesto

Rispondi SOLO con JSON valido:

```json
{
  "supplier_name": "AURICCHIO FORMAGGI SPA",
  "supplier_vat": "IT00123456789",
  "document_number": "FT2025/001234",
  "document_date": "2025-01-27"
}
```

## 📋 Regole Output

1. ✅ `supplier_name`: Nome completo come appare nel documento
2. ✅ `supplier_vat`: Solo se presente, altrimenti stringa vuota ""
3. ✅ `document_number`: Numero fattura/DDT
4. ✅ `document_date`: Formato YYYY-MM-DD

## ⚠️ Regole Speciali per Fornitore

### ALIGRO (Scontrini Cash & Carry)
Se vedi "ALIGRO" o "Demaurex & Cie SA":
- **supplier_name**: "ALIGRO Demaurex & Cie SA"
- **supplier_vat**: Estrai da "CHE-105.968.205 TVA" → solo numeri: "10596820"
- **document_number**: Estrai da "Rechnung Nr. 5-1-1299" → "5-1-1299"
- **document_date**: Converti "28.10.2025" → "2025-10-28"

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
