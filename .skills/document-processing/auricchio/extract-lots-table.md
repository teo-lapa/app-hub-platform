---
name: auricchio-extract-lots
version: 1.1.0
description: Estrae tabella lotti e scadenze da documento trasporto Auricchio (pagina 1)
category: document-processing
tags: [auricchio, lots, expiry, table-extraction]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-27
updated: 2025-10-29
---

# 📦 Auricchio - Estrazione Tabella Lotti

## 🎯 Obiettivo

Estrarre SOLO la tabella **"DETTAGLIO ARTICOLI PER LOTTO/PALLET"** dalla **pagina 1** del documento di trasporto Auricchio.

## 📄 Input

Riceverai un PDF multi-pagina di Auricchio. La **pagina 1** contiene il documento di trasporto con la tabella lotti.

## 🔍 Cosa Cercare

**Header tabella** (pagina 1):
```
DETTAGLIO ARTICOLI PER LOTTO/PALLET
```

**Colonne della tabella**:
- Articolo (codice prodotto es: 71G, CIA13, E708)
- Peso
- Quantità
- **Lotto** ← IMPORTANTE!
- Pallet/SSCC
- **Scadenza** ← IMPORTANTE!
- EAN Confezione
- EAN Contenuto

## 📊 Esempio Tabella

```
Articolo  Peso   Quantità  Lotto        Pallet/SSCC         Scadenza    EAN Conf    EAN Cont
71G       20,00  2         5275MM2      080046030481...     08/02/26    08004603... 80145480...
CIA13     54,18  9         2595225H2    080046030481...     19/12/25    98004603... 2928665
E708      21,85  1         1000566879   080046030481...                 98004603...
RE239     30,00  10        272          080046030481...     26/01/26    08004603... 80046031...
```

## ✅ Output Richiesto

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo.

```json
{
  "lots_map": {
    "71G": {
      "lot_number": "5275MM2",
      "expiry_date": "08/02/26"
    },
    "CIA13": {
      "lot_number": "2595225H2",
      "expiry_date": "19/12/25"
    },
    "E708": {
      "lot_number": "1000566879",
      "expiry_date": null
    },
    "RE239": {
      "lot_number": "272",
      "expiry_date": "26/01/26"
    }
  }
}
```

## 📋 Regole

1. ✅ **Cerca SOLO nella pagina 1** del PDF
2. ✅ **NON convertire le date** (lascia formato GG/MM/AA)
3. ✅ Se scadenza è vuota → `null`
4. ✅ Se lotto è vuoto → `null`
5. ✅ Mantieni i codici articolo ESATTAMENTE come sono (71G, CIA13, etc.)
6. ✅ La chiave dell'oggetto è il codice articolo
7. ✅ IGNORA completamente le pagine 2-3-4 (fattura)

## ⚠️ Errori da Evitare

❌ **NON** leggere la fattura (pagine 2-3)
❌ **NON** convertire le date adesso (lo farà il prossimo agente)
❌ **NON** aggiungere informazioni non presenti nella tabella
❌ **NON** inventare lotti o scadenze

## 🧪 Test di Validità

Prima di rispondere, verifica:
- [ ] Ho trovato la tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET"?
- [ ] Ho estratto TUTTI i prodotti della tabella?
- [ ] I codici articolo sono corretti (71G, CIA13, etc.)?
- [ ] Le date sono in formato GG/MM/AA (NON convertite)?
- [ ] Se la scadenza è vuota, ho messo `null`?

## 📤 Formato Output Finale

```json
{
  "lots_map": {
    "CODICE_ARTICOLO": {
      "lot_number": "LOTTO o null",
      "expiry_date": "GG/MM/AA o null"
    }
  }
}
```

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
