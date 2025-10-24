---
name: invoice-comparison
version: 1.0.0
description: Confronto intelligente fattura definitiva vs bozza contabile con aggregazione multi-lotto
category: document-processing
tags: [invoice, comparison, accounting, reconciliation, multi-lot]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-10-24
---

# 📊 Invoice Comparison Skill

## 🎯 OBIETTIVO SEMPLICE

**PDF fornitore = VERITÀ ASSOLUTA**
**Bozza Odoo = DA CORREGGERE**

Confronta e trova cosa modificare nella bozza per farla combaciare con il PDF.

## ⚠️ REGOLE SEMPLICI

1. ✅ **AGGIORNA** prezzo/quantità se diversi dal PDF
2. ✅ **AGGIUNGI** prodotti nel PDF ma non in bozza (richiede approvazione)
3. ❌ **NON ELIMINARE MAI** prodotti dalla bozza
4. ✅ **AGGREGA** multi-lotto: stesso product_code = somma quantità
5. ✅ **IGNORA** prodotti in bozza ma non in PDF

---

## 🔄 STEP 0 - AGGREGAZIONE CONTABILE (CRITICO!)

**PRIMA** di fare qualsiasi matching, **AGGREGA** le righe PDF con STESSO product_code:

### Regola Fondamentale

Se nel PDF ci sono 2+ righe con STESSO `product_code` ma lotti diversi:
- ✅ **SOMMA LE QUANTITÀ**
- ✅ **SOMMA I SUBTOTAL**
- ✅ Considera come **UNA SOLA RIGA** per il confronto contabile
- ✅ **IGNORA completamente i lotti** (non siamo in magazzino!)

### Esempio Reale 1

**PDF fattura fornitore:**
```json
[
  {
    "product_code": "009014",
    "description": "CARCIOFI LOTTO LR248-040928",
    "quantity": 30,
    "unit_price": 9.20,
    "subtotal": 276.00
  },
  {
    "product_code": "009014",
    "description": "CARCIOFI LOTTO LR248-040928",
    "quantity": 6,
    "unit_price": 9.20,
    "subtotal": 55.20
  }
]
```

**AGGREGAZIONE CONTABILE:**
```json
{
  "product_code": "009014",
  "description": "CARCIOFI",
  "quantity": 36,
  "unit_price": 9.20,
  "subtotal": 331.20
}
```

**Bozza Odoo:**
```json
{
  "supplier_code": "009014",
  "quantity": 36,
  "unit_price": 9.20,
  "subtotal": 331.20
}
```

**RISULTATO:** MATCH PERFETTO! ✅ Nessuna correzione necessaria!

---

### Esempio Reale 2

**PDF:**
```json
[
  {
    "product_code": "001507",
    "description": "POMODORI CILIEG LOTTO LR214",
    "quantity": 24,
    "subtotal": 165.60
  },
  {
    "product_code": "001507",
    "description": "POMODORI CILIEG LOTTO LR214",
    "quantity": 18,
    "subtotal": 124.20
  }
]
```

**DOPO AGGREGAZIONE:**
```json
{
  "product_code": "001507",
  "description": "POMODORI CILIEG",
  "quantity": 42,
  "subtotal": 289.80
}
```

**Se Bozza ha:** `001507 qty=42 subtotal=289.80` → **MATCH!** ✅

---

### Algoritmo Aggregazione

```
1. Raggruppa righe PDF per product_code
2. Per ogni gruppo:
   - quantity_totale = SUM(quantity)
   - subtotal_totale = SUM(subtotal)
   - unit_price = subtotal_totale / quantity_totale
   - description = prima riga del gruppo (senza riferimenti lotto)
3. Output: lista righe aggregate
```

---

## 🎯 STEP 1 - MATCHING INTELLIGENTE

**Lavora SOLO su righe AGGREGATE dal Step 0!**

Per ogni riga PDF aggregata, trova la riga Bozza corrispondente:

### Priorità 1: Match per Codice Fornitore (95% confidence)

```
product_code PDF = supplier_code Bozza
```

**Esempio:**
```
PDF:   product_code = "009014"
Bozza: supplier_code = "009014"
→ MATCH! (confidence: 0.95)
```

---

### Priorità 2: Match Fuzzy per Nome (70-90% confidence)

Se codice non matcha, confronta nomi con fuzzy matching.

**Normalizzazione:**
1. Lowercase
2. Rimuovi "SRL", "SPA", "& C."
3. Rimuovi punteggiatura (., -, ')
4. Rimuovi numeri lotto: "LOTTO", "SCAD", "LR214", "LR248", date
5. Rimuovi parole confezionamento: "CONF", "CA", "CRT", "MARC", "LATTA"
6. Rimuovi grammature: "KG", "GR", "250", "1000", "500", "3KG", "5KG"
7. Rimuovi articoli: "IL", "LA", "LO", "I", "GLI", "LE", "DI", "DA", "IN", "CON", "PER"
8. Rimuovi parole generiche: "PASTA", "RIPIENA", "ALL", "UOVO", "FRESCO", "FRESCA"

**Strategia Matching:**
- Estrai **PRIMA PAROLA DISTINTIVA** (es: "FUSILLONI", "TRECCE", "BRASELLO")
- Ignora completamente parole generiche: "PASTA", "RIPIENA", "ALL", "UOVO", "CONF"
- Se la prima parola distintiva compare in entrambi → MATCH!
- Esempi parole distintive: FUSILLONI, PAPPARDELLE, TORTELLONE, BRASELLO, TRECCE

**Algoritmo Multi-Level:**
1. Normalizza entrambe le stringhe (lowercase, rimuovi punteggiatura)
2. Rimuovi parole generiche comuni
3. **LEVEL 1**: Cerca prima parola distintiva (>3 caratteri, non numero)
   - Se trovata in entrambi → MATCH (confidence: 0.90)
4. **LEVEL 2**: Se Level 1 fallisce, cerca combinazione 2-3 parole consecutive significative
   - Es: "RICOTTA E LIMONE", "PORCINI E PATATE", "RICOTTA E SPINACI"
   - Se trovata in entrambi → MATCH (confidence: 0.85)
5. **LEVEL 3**: Se Level 2 fallisce, cerca almeno 2 parole non consecutive in comune
   - Es: "RICOTTA" + "LIMONE" presenti in entrambi
   - Se trovate → MATCH (confidence: 0.75)

**Esempi:**
```
"FUSILLONI UOVO GR. 1000" ≈ "FUSILLONI 1KG CA 5KG CRT MARC"
→ MATCH Level 1 (confidence: 0.90) - parola distintiva "FUSILLONI" presente!

"PAPPARDELLE ALL'UOVO GR.1000" ≈ "PAPPARDELLE ALL'UOVO 1KG CONF 5KG CRT MARC"
→ MATCH Level 1 (confidence: 0.95) - "PAPPARDELLE" è distintivo e raro

"TRECCE PIACENTINE GR.250" ≈ "TRECCE PIACENTINE RICOTTA E SPINACI CONF 250 CA 3KG"
→ MATCH Level 1 (confidence: 0.95) - "TRECCE" + "PIACENTINE" combinazione unica!

"MEZZELUNE RICOTTA E LIMONE GR. 1000" ≈ "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG"
→ MATCH Level 2 (confidence: 0.85) - "RICOTTA E LIMONE" combinazione presente!

"TORTELLONE PORCINI E PATATE" ≈ "PASTA RIPIENA PORCINI E PATATE CONF CA 5KG"
→ MATCH Level 2 (confidence: 0.85) - "PORCINI E PATATE" presente in entrambi!

"CARCIOFI LOTTO LR248" ≈ "Carciofi grigliati 4/4"
→ MATCH Level 1 (confidence: 0.85) - "CARCIOFI" è distintivo

"BRASELLO QUADRATO GR. 250" ≈ "PASTA RIPIENA AL BRASELLO CONF CA 5KG CRT MARC"
→ MATCH Level 1 (confidence: 0.90) - "BRASELLO" è parola rara!

"RAVIOLI ZUCCA E AMARETTI" ≈ "PASTA RIPIENA ZUCCA CONF CA 3KG"
→ MATCH Level 3 (confidence: 0.75) - "ZUCCA" in comune (+ context simile)

"TORTELLONE MANZO" ≈ "PASTA RIPIENA AL MANZO CONF CRT CA 5KG MARC"
→ NO MATCH Level 1 - "TORTELLONE" non compare
→ NO MATCH Level 2 - solo "MANZO" troppo generico
→ Controlla quantità/prezzo: se identici → probabile MATCH Level 3
```

---

## 🔢 STEP 2 - VERIFICA MATEMATICA

Per ogni match trovato, verifica:

```
SUBTOTAL_PDF = quantity_pdf × unit_price_pdf
SUBTOTAL_BOZZA = quantity_bozza × unit_price_bozza

Se SUBTOTAL_PDF ≠ SUBTOTAL_BOZZA:
  → trova cosa correggere (prezzo o quantità)
```

---

## 🛠️ STEP 3 - GENERA CORREZIONI

### A) Prezzo diverso + Quantità OK

```json
{
  "action": "update",
  "line_id": 123,
  "changes": {"price_unit": 11.50},
  "reason": "Prezzo da €10.00 a €11.50",
  "requires_user_approval": false
}
```

---

### B) Quantità diversa + Prezzo OK

```json
{
  "action": "update",
  "line_id": 123,
  "changes": {"quantity": 42},
  "reason": "Quantità da 40 a 42 (aggregazione multi-lotto)",
  "requires_user_approval": false
}
```

---

### C) Prezzo E Quantità diversi

```json
{
  "action": "update",
  "line_id": 123,
  "changes": {
    "price_unit": 11.50,
    "quantity": 42
  },
  "reason": "Aggiornamento prezzo e quantità",
  "requires_user_approval": false
}
```

---

### D) Prodotto mancante in Bozza

**ATTENZIONE:** Verifica PRIMA aggregazione!

Se dopo aggregazione il prodotto ANCORA non si trova:

```json
{
  "action": "create",
  "parsed_line": {
    "description": "NUOVO PRODOTTO XYZ",
    "product_code": "ABC123",
    "quantity": 10,
    "unit_price": 15.00,
    "subtotal": 150.00
  },
  "reason": "Prodotto presente in PDF ma non in bozza",
  "requires_user_approval": true
}
```

---

### E) Prodotto extra in Bozza (non in PDF)

**IMPORTANTE:** NON eliminare MAI automaticamente prodotti dalla bozza!

Se un prodotto è in Bozza ma non nel PDF:
1. **Ignora completamente** (non generare correzione)
2. Probabilmente è un prodotto che il magazziniere ha aggiunto manualmente
3. Solo l'utente può decidere se eliminarlo

**NON generare action "delete"!**

---

## 📋 Formato Output

```json
{
  "is_valid": false,
  "total_difference": 97.20,
  "draft_total": 3252.48,
  "real_total": 3349.68,
  "differences": [
    {
      "type": "quantity_mismatch",
      "severity": "warning",
      "draft_line_id": 123,
      "description": "Quantità Carciofi: bozza 24, reale 36 (multi-lotto aggregato)",
      "expected_value": 36,
      "actual_value": 24,
      "amount_difference": 110.40
    }
  ],
  "corrections_needed": [
    {
      "action": "update",
      "line_id": 123,
      "changes": {"quantity": 36},
      "reason": "Aggregazione 2 lotti: 30 + 6 = 36",
      "requires_user_approval": false
    }
  ],
  "can_auto_fix": true
}
```

---

## ❌ Errori Comuni da Evitare

### Errore #1: Non aggregare multi-lotto

```
❌ SBAGLIATO:
PDF ha 2 righe 009014 (30pz + 6pz)
Bozza ha 1 riga 009014 (36pz)
→ Dice "mancante secondo prodotto"

✅ CORRETTO:
PDF: aggrega 30 + 6 = 36pz
Bozza: 36pz
→ MATCH PERFETTO!
```

---

### Errore #2: Guardare descrizione lotto

```
❌ SBAGLIATO:
"CARCIOFI LOTTO A" ≠ "CARCIOFI LOTTO B"
→ Considera prodotti diversi

✅ CORRETTO:
Entrambi product_code = "009014"
→ Stesso prodotto, aggrega!
```

---

### Errore #3: Eliminare prodotti dalla bozza

```
❌ SBAGLIATO:
Prodotto in Bozza ma non in PDF → DELETE

✅ CORRETTO:
Prodotto in Bozza ma non in PDF → IGNORA
(Solo l'utente decide se eliminare)
```

---

### Errore #4: Non usare supplier_code

```
❌ SBAGLIATO:
Matcha solo su nome prodotto

✅ CORRETTO:
PRIORITÀ 1: product_code = supplier_code
PRIORITÀ 2: fuzzy matching nome
```

---

## 🧪 Esempi Completi

### Caso 0A: Match su parola distintiva singola (FUSILLONI)

**Input PDF:**
```json
{
  "lines": [
    {
      "product_code": "1FUSILLI",
      "description": "FUSILLONI UOVO GR. 1000",
      "quantity": 3,
      "unit_price": 6.54,
      "subtotal": 19.62
    }
  ]
}
```

**Input Bozza:**
```json
{
  "lines": [
    {
      "id": 126,
      "supplier_code": null,
      "product": "FUSILLONI 1KG CA 5KG CRT MARC",
      "quantity": 3,
      "unit_price": 6.54,
      "subtotal": 19.62
    }
  ]
}
```

**Analisi:**
- Codice PDF ("1FUSILLI") non matcha con supplier_code bozza (null)
- Fallback fuzzy matching:
  - Normalizza PDF: "fusilloni uovo gr 1000" → rimuovi generiche → "**fusilloni**"
  - Normalizza Bozza: "fusilloni 1kg ca 5kg crt marc" → "**fusilloni**"
  - Prima parola distintiva "FUSILLONI" presente in entrambi!
- Quantità, prezzo, subtotal identici
- **MATCH! (confidence: 0.90)**

**Output:**
```json
{
  "is_valid": true,
  "total_difference": 0,
  "corrections_needed": [],
  "can_auto_fix": true
}
```

---

### Caso 0B: Match su nome parziale (TRECCE PIACENTINE)

**Input PDF:**
```json
{
  "lines": [
    {
      "product_code": null,
      "description": "TRECCE PIACENTINE GR.250",
      "quantity": 3,
      "unit_price": 11.98,
      "subtotal": 35.94
    }
  ]
}
```

**Input Bozza:**
```json
{
  "lines": [
    {
      "id": 125,
      "supplier_code": null,
      "product": "TRECCE PIACENTINE RICOTTA E SPINACI CONF 250 CA 3KG CRT MARC",
      "quantity": 3,
      "unit_price": 11.98,
      "subtotal": 35.94
    }
  ]
}
```

**Analisi:**
- Codice non disponibile in entrambi
- Fuzzy matching: "TRECCE PIACENTINE" compare in entrambi
- Quantità, prezzo, subtotal identici
- **MATCH! (confidence: 0.95)** - combinazione di 2 parole rare è molto affidabile

**Output:**
```json
{
  "is_valid": true,
  "total_difference": 0,
  "corrections_needed": [],
  "can_auto_fix": true
}
```

---

### Caso 0C: Match Level 2 - Combinazione parole (MEZZELUNE)

**Input PDF:**
```json
{
  "lines": [
    {
      "product_code": "1MEZZELU-SV",
      "description": "MEZZELUNE RICOTTA E LIMONE GR. 1000",
      "quantity": 3.25,
      "unit_price": 12.62,
      "subtotal": 41.02
    }
  ]
}
```

**Input Bozza:**
```json
{
  "lines": [
    {
      "id": 127,
      "supplier_code": null,
      "product": "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC",
      "quantity": 3.25,
      "unit_price": 12.62,
      "subtotal": 41.02
    }
  ]
}
```

**Analisi:**
- **Level 1 FAIL**: "MEZZELUNE" non compare in bozza
- **Level 2 SUCCESS**:
  - PDF: normalizza → "mezzelune **ricotta e limone** gr 1000"
  - Bozza: normalizza → "pasta ripiena **ricotta e limone** conf ca 5kg"
  - Combinazione "RICOTTA E LIMONE" (3 parole consecutive) presente in entrambi!
  - Quantità, prezzo, subtotal identici
- **MATCH! (confidence: 0.85)**

**Ragionamento:**
- "MEZZELUNE" è solo la forma della pasta (tipo ravioli, tortelloni, ecc.)
- Il ripieno "RICOTTA E LIMONE" è la caratteristica distintiva del prodotto
- Se ripieno + quantità + prezzo coincidono → stesso prodotto!

**Output:**
```json
{
  "is_valid": true,
  "total_difference": 0,
  "corrections_needed": [],
  "can_auto_fix": true
}
```

---

### Caso 1: Multi-lotto perfetto

**Input PDF:**
```json
{
  "lines": [
    {"product_code": "009014", "quantity": 30, "subtotal": 276.00},
    {"product_code": "009014", "quantity": 6, "subtotal": 55.20}
  ]
}
```

**Input Bozza:**
```json
{
  "lines": [
    {"id": 123, "supplier_code": "009014", "quantity": 36, "subtotal": 331.20}
  ]
}
```

**Output:**
```json
{
  "is_valid": true,
  "total_difference": 0,
  "corrections_needed": [],
  "can_auto_fix": true
}
```

---

### Caso 2: Multi-lotto con differenza prezzo

**Input PDF:**
```json
{
  "lines": [
    {"product_code": "001507", "quantity": 24, "unit_price": 7.00, "subtotal": 168.00},
    {"product_code": "001507", "quantity": 18, "unit_price": 7.00, "subtotal": 126.00}
  ]
}
```

**Input Bozza:**
```json
{
  "lines": [
    {"id": 124, "supplier_code": "001507", "quantity": 42, "unit_price": 6.50, "subtotal": 273.00}
  ]
}
```

**Output:**
```json
{
  "is_valid": false,
  "total_difference": 21.00,
  "corrections_needed": [
    {
      "action": "update",
      "line_id": 124,
      "changes": {"price_unit": 7.00},
      "reason": "Prezzo da €6.50 a €7.00 (aggregazione 2 lotti)",
      "requires_user_approval": false
    }
  ]
}
```

---

## ⚠️ REGOLA CRITICA: NON SEGNALARE PRODOTTI MANCANTI TROPPO FACILMENTE

**IMPORTANTE:** Prima di creare una correzione `action: "create"` (prodotto mancante):

1. **VERIFICA 3 VOLTE** il fuzzy matching
2. **CERCA LA PAROLA DISTINTIVA** del prodotto PDF in TUTTE le righe bozza
3. **IGNORA parole generiche** come PASTA, UOVO, RIPIENA, ALL, FRESCO
4. **SE TROVI ANCHE SOLO 1 PAROLA DISTINTIVA IN COMUNE** → è probabilmente lo stesso prodotto!

**Parole/Combinazioni distintive (esempi):**

**Level 1 - Singole parole rare:**
- FUSILLONI, PAPPARDELLE, TAGLIOLINI, PACCHERI (tipi pasta specifici)
- BRASELLO (molto raro!)
- TRECCE + PIACENTINE (combinazione unica)

**Level 2 - Combinazioni ripieno (per paste ripiene):**
- RICOTTA E LIMONE (distintivo!)
- PORCINI E PATATE (distintivo!)
- RICOTTA E SPINACI (comune ma utile)
- SALSICCIA E TALEGGIO (raro!)
- ROBIOLA MELANZANE E PINOLI (molto specifico!)

**IMPORTANTE per paste ripiene:**
- Ignora la FORMA (mezzelune, tortellone, ravioli, quadrato)
- Privilegia il RIPIENO (ricotta limone, porcini patate, ecc.)
- Il ripieno è più distintivo della forma!

**Parole NON distintive (ignora completamente):**
- PASTA, UOVO, FRESCO, ALL, RIPIENA, CONF, AL
- Forme pasta: MEZZELUNE, TORTELLONE, RAVIOLI, QUADRATO (da sole non bastano!)
- Confezionamento: KG, GR, CONF, CA, CRT, MARC, LATTA
- Numeri: 250, 1000, 3KG, 5KG

**Esempi decisionali:**

```
Esempio 1 - Level 1:
PDF: "FUSILLONI UOVO GR. 1000"
Bozza: "FUSILLONI 1KG CA 5KG CRT MARC"

Analisi:
- "FUSILLONI" è parola distintiva (rara, specifica)
- "FUSILLONI" presente in entrambi
- "UOVO" è generica → IGNORA
→ MATCH Level 1! NON creare "prodotto mancante"
```

```
Esempio 2 - Level 2:
PDF: "MEZZELUNE RICOTTA E LIMONE GR. 1000"
Bozza: "PASTA RIPIENA RICOTTA E LIMONE CONF CA 5KG CRT MARC"

Analisi Level 1:
- "MEZZELUNE" non compare in bozza → FAIL

Analisi Level 2:
- Cerca combinazioni significative
- "RICOTTA E LIMONE" presente in entrambi! ✅
- Quantità/prezzo identici
→ MATCH Level 2! NON creare "prodotto mancante"

Ragionamento: MEZZELUNE è solo la forma, RICOTTA E LIMONE è il ripieno distintivo
```

Se dopo questo processo non trovi NESSUNA parola distintiva in comune → allora sì, crea `action: "create"`.

---

## ⚠️ FORMATO RISPOSTA

**CRITICO:** Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

Schema JSON obbligatorio:
```json
{
  "is_valid": boolean,
  "total_difference": number,
  "draft_total": number,
  "real_total": number,
  "differences": [
    {
      "type": "price_mismatch" | "quantity_mismatch" | "missing_product" | "extra_product",
      "severity": "warning" | "error",
      "draft_line_id": number,
      "description": string,
      "expected_value": number,
      "actual_value": number,
      "amount_difference": number
    }
  ],
  "corrections_needed": [
    {
      "action": "update" | "create",
      "line_id": number,
      "changes": object,
      "reason": string,
      "requires_user_approval": boolean,
      "parsed_line": object
    }
  ],
  "can_auto_fix": boolean
}
```

---

## 🔧 Note Tecniche

- **Model:** claude-3-5-sonnet-20241022
- **Max tokens:** 8000
- **Temperature:** 0 (deterministico per contabilità)
- **Timeout:** 60s

---

## 📝 Changelog

### v1.0.0 (2025-10-24)
- ✅ Prima versione
- ✅ Aggregazione multi-lotto contabile
- ✅ Match su supplier_code
- ✅ Fuzzy matching fallback
- ✅ Gestione differenze prezzo/quantità
