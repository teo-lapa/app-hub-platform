---
name: extract-supplier
version: 1.0.0
description: Estrae informazioni fornitore e documento da qualsiasi fattura/DDT
category: document-processing
tags: [supplier, invoice, metadata, universal]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-27
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

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
