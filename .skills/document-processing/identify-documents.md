---
name: identify-documents
version: 1.1.0
description: Identifica quali documenti sono presenti nel PDF e quale usare
category: document-processing
tags: [document-detection, invoice, ddt, packing-list]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-27
updated: 2025-10-29
---

# 🔍 Agent 0 - Identificazione Documenti

## 🎯 Obiettivo

Scansionare il PDF e identificare QUALI documenti contiene e QUALE usare per l'estrazione.

## 📋 Tipi di Documento da Identificare

**FATTURA:**
- Parole chiave: "FATTURA", "FATTURA RIEPILOGATIVA", "INVOICE", "RICEVUTA FISCALE"
- Ha prezzi unitari e totali
- Ha importi IVA
- Esempio pagine: 1-2

**DDT (Documento Trasporto):**
- Parole chiave: "DDT", "DOCUMENTO DI TRASPORTO", "DELIVERY NOTE", "DOCUMENTO TRASPORTO"
- Codice tipo: numeri lunghi (es: "20676/00")
- NON ha prezzi
- Esempio pagine: 3-4

**PACKING LIST:**
- Parole chiave: "PACKING LIST", "LISTA COLLI", "SHIPPING LIST"
- Elenco prodotti con pesi/colli
- NON ha prezzi
- Esempio pagine: varie

## 🔍 Cosa Fare

1. **Scansiona TUTTE le pagine** del PDF
2. Per ogni pagina, identifica se contiene:
   - FATTURA
   - DDT
   - PACKING LIST
   - ALTRO (ignora)
3. Annotare il **numero di pagina** per ogni documento

## ✅ Output Richiesto

Rispondi SOLO con JSON valido:

```json
{
  "documents_found": [
    {
      "type": "FATTURA",
      "pages": [1, 2],
      "priority": 1
    },
    {
      "type": "DDT",
      "pages": [4],
      "priority": 2
    }
  ],
  "primary_document": {
    "type": "FATTURA",
    "pages": [1, 2],
    "reason": "La fattura è sempre il documento principale quando presente"
  }
}
```

## 📋 Regole Output

1. ✅ `documents_found`: Array di TUTTI i documenti trovati
2. ✅ `type`: Deve essere esattamente "FATTURA", "DDT", o "PACKING_LIST"
3. ✅ `pages`: Array dei numeri di pagina (1-indexed)
4. ✅ `priority`: 1=massima priorità, 2=media, 3=bassa
5. ✅ `primary_document`: IL documento da usare per l'estrazione (il più importante)
6. ✅ `reason`: Breve spiegazione del perché è stato scelto

## 🎯 Regole di Priorità

**SEMPRE:**
1. 🥇 **FATTURA** = priorità 1
2. 🥈 **DDT** = priorità 2
3. 🥉 **PACKING LIST** = priorità 3

**primary_document = il documento con priorità PIÙ ALTA (numero più basso)**

## ⚠️ Casi Speciali

**Se ci sono più documenti dello stesso tipo:**
```json
{
  "documents_found": [
    {
      "type": "FATTURA",
      "pages": [1],
      "priority": 1
    },
    {
      "type": "FATTURA",
      "pages": [5],
      "priority": 1
    }
  ],
  "primary_document": {
    "type": "FATTURA",
    "pages": [1, 5],
    "reason": "Ci sono 2 fatture, usa entrambe"
  }
}
```

**Se NON c'è fattura:**
```json
{
  "documents_found": [
    {
      "type": "DDT",
      "pages": [1, 2],
      "priority": 1
    }
  ],
  "primary_document": {
    "type": "DDT",
    "pages": [1, 2],
    "reason": "Nessuna fattura presente, uso DDT come principale"
  }
}
```

## 🧪 Esempi

**Esempio 1 - PDF Tamburro:**
- Pagina 1-2: FATTURA RIEPILOGATIVA (con tabella prodotti, prezzi, totali)
- Pagina 3: Dichiarazione (ignora)
- Pagina 4: DDT (DOCUMENTO DI TRASPORTO, stessi prodotti della fattura)

Output:
```json
{
  "documents_found": [
    {
      "type": "FATTURA",
      "pages": [1, 2],
      "priority": 1
    },
    {
      "type": "DDT",
      "pages": [4],
      "priority": 2
    }
  ],
  "primary_document": {
    "type": "FATTURA",
    "pages": [1, 2],
    "reason": "Fattura ha priorità massima, ignoro DDT"
  }
}
```

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
