---
name: extract-products
version: 1.0.0
description: Estrae prodotti da qualsiasi fattura/DDT con quantità e descrizioni
category: document-processing
tags: [invoice, products, extraction, universal]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-27
---

# 📦 Agent 1 - Estrazione Prodotti

## 🎯 Obiettivo

Estrarre TUTTI i prodotti dal documento (fattura/DDT) con quantità e descrizioni.

## 📋 Cosa Estrarre

Per ogni prodotto trova:
- **Codice articolo** (se presente)
- **Descrizione** completa del prodotto
- **Quantità** (numero)
- **Unità di misura** (KG, NR, PZ, LT, etc.)

## 🔍 Dove Cercare - PRIORITÀ DOCUMENTI

⚠️ **IMPORTANTE**: Spesso ci sono più documenti nello stesso PDF (FATTURA + DDT + PACKING LIST). Usa SOLO UNO:

**PRIORITÀ** (dal più importante al meno):
1. 🥇 **FATTURA** o **FATTURA RIEPILOGATIVA** → Se c'è, usa SOLO questa!
2. 🥈 **DDT** (Documento Trasporto) → Se non c'è fattura, usa questo
3. 🥉 **PACKING LIST** → Se non ci sono gli altri, usa questo

**Come riconoscere:**
- FATTURA: Titolo "FATTURA", "FATTURA RIEPILOGATIVA", "INVOICE", ha prezzi e importi
- DDT: Titolo "DDT", "DOCUMENTO DI TRASPORTO", "DELIVERY NOTE", codice tipo "20676/00"
- PACKING LIST: Titolo "PACKING LIST", "LISTA COLLI"

**REGOLA D'ORO**: Se vedi una FATTURA, IGNORA completamente DDT e PACKING LIST! Sono duplicati!

## ⚠️ Regole Speciali Quantità

**AURICCHIO**: Se vedi due colonne di quantità (CONTENUTA e FATTURATA), usa SEMPRE **FATTURATA** (quella vicina al PREZZO)

**ALTRI FORNITORI**: Usa la quantità principale/fatturata del documento

## ✅ Output Richiesto

Rispondi SOLO con JSON valido:

```json
{
  "products": [
    {
      "article_code": "71G",
      "description": "PECORINO ROMANO DOP GRATTUGIATO FRESCO 1KG 10KG CRT",
      "quantity": 20.0,
      "unit": "NR"
    },
    {
      "article_code": "CIA13",
      "description": "GORGONZOLA DOP SANGIORGIO EXP.4 VASC. 1/8 TS",
      "quantity": 54.18,
      "unit": "KG"
    }
  ]
}
```

## 📋 Regole Output

1. ✅ Estrai TUTTI i prodotti del documento
2. ✅ `article_code`: Se non c'è → usa parte della descrizione o numero progressivo
3. ✅ `quantity`: Sempre numero decimale (54,18 → 54.18)
4. ✅ `unit`: Sempre maiuscolo (KG, NR, PZ, etc.)
5. ✅ `description`: Completa, come appare nel documento

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
