---
name: extract-lots
version: 1.0.0
description: Estrae lotti e scadenze da qualsiasi documento (cerca ovunque)
category: document-processing
tags: [lots, expiry, traceability, universal]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-27
---

# 🔖 Agent 2 - Estrazione Lotti e Scadenze

## 🎯 Obiettivo

Estrarre lotti e date di scadenza da QUALSIASI parte del documento.

## 📋 Cosa Estrarre

Per ogni prodotto trova (se presente):
- **Numero lotto** (LOT, LOTTO, BATCH, codice alfanumerico)
- **Data scadenza** (SCAD, EXPIRY, EXP, TMC, BBD, data)

## 🔍 Dove Cercare - STRATEGIA INTELLIGENTE

⚠️ **PRIORITÀ DOCUMENTI** (segui Agent 1):
1. 🥇 Se c'è **FATTURA** → cerca lotti/scadenze PRIMA nella fattura
2. 🥈 Se lotti/scadenze NON sono in fattura → cercali nel **DDT** o **PACKING LIST**
3. 🥉 Se ci sono più documenti con STESSI prodotti → usa quello con più informazioni

**Dove cercare:**
- Tabelle "DETTAGLIO LOTTI"
- Colonne "LOTTO/SCADENZA" nella fattura
- Colonne "LOT", "BATCH", "LOTTO"
- Colonne "SCADENZA", "SCAD", "EXP", "EXPIRY"
- Note a piè di pagina
- Prima pagina, ultima pagina, ovunque!

**INTEGRAZIONE INTELLIGENTE:**
- Se FATTURA ha prodotti MA NON ha lotti → cerca lotti nel DDT/PACKING LIST
- Se FATTURA ha prodotti E lotti → usa SOLO la fattura

## ⚠️ Importante

- Se un prodotto NON ha lotto → `null`
- Se un prodotto NON ha scadenza → `null`
- NON inventare dati
- NON convertire le date (lascia formato originale)
- Se trovi STESSO prodotto con STESSO lotto in più documenti → riportalo UNA volta sola

## ✅ Output Richiesto

Rispondi SOLO con JSON valido:

```json
{
  "lots": [
    {
      "article_code": "71G",
      "lot_number": "5275MM2",
      "expiry_date": "08/02/26"
    },
    {
      "article_code": "CIA13",
      "lot_number": "2595225H2",
      "expiry_date": "19/12/25"
    },
    {
      "article_code": "E708",
      "lot_number": "1000566879",
      "expiry_date": null
    }
  ]
}
```

## 📋 Regole Output

1. ✅ Un oggetto per ogni prodotto CHE HA lotto/scadenza
2. ✅ `article_code`: Deve matchare con i codici estratti dall'Agent 1
3. ✅ `lot_number`: Stringa esatta come nel documento (o null)
4. ✅ `expiry_date`: Data esatta come nel documento (o null), NON convertire
5. ✅ Se un prodotto non ha lotti → NON includerlo nell'array

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
