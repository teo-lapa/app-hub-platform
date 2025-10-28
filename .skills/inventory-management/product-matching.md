---
name: product-matching
version: 1.1.0
description: Match intelligente tra prodotti fattura e righe inventario Odoo con conversione UoM automatica
category: inventory-management
tags: [matching, inventory, fuzzy-match, odoo, uom, conversion]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-15
updated: 2025-01-28
---

# 🔗 Product Matching Skill

## Contesto

Ricevi **due liste di prodotti** da confrontare:

1. **Prodotti dalla fattura** (già estratti con invoice-parsing skill)
2. **Prodotti attesi in Odoo** (dall'ordine di acquisto - purchase order)

Il tuo compito è **matchare** ogni prodotto della fattura con la corrispondente riga in Odoo.

**CRITICITÀ**: Errori in questa fase causano:
- ❌ Prodotti registrati doppi
- ❌ Inventario sballato
- ❌ Lotti persi
- ❌ Tracciabilità compromessa

---

## Input che Riceverai

### Struttura Prodotti Fattura
```json
[
  {
    "article_code": "MOZ250",
    "description": "Mozzarella di Bufala 250g",
    "quantity": 24.0,
    "unit": "KG",
    "lot_number": "L20250115",
    "expiry_date": "2025-02-15",
    "variant": "250g"
  }
]
```

### Struttura Righe Odoo
```json
[
  {
    "id": 12345,
    "product_id": [101, "Mozzarella Bufala DOP"],
    "product_name": "Mozzarella Bufala DOP 250gr",
    "product_code": "MOZ250",
    "product_uom_qty": 24.0,
    "qty_done": 0,
    "lot_id": false,
    "lot_name": false,
    "expiry_date": false,
    "variant_ids": [501, 502],
    "uom_info": {
      "id": 1,
      "name": "kg",
      "category_id": [1, "Weight"],
      "factor": 1.0,
      "factor_inv": 1.0,
      "uom_type": "reference",
      "rounding": 0.01
    },
    "uom_po_info": {
      "id": 5,
      "name": "Carton",
      "category_id": [1, "Weight"],
      "factor": 0.1,
      "factor_inv": 10.0,
      "uom_type": "bigger",
      "rounding": 1.0
    }
  }
]
```

**NOTA IMPORTANTE SU UoM**:
- `uom_info`: Unità di misura base del prodotto (es: KG, L, PZ)
- `uom_po_info`: Unità di misura acquisto (es: Carton, Pallet, Box)
- `factor`: Fattore di conversione dall'unità base (es: 0.1 = 1 unità = 10 base)
- `factor_inv`: Fattore inverso (es: 10.0 = 10 base = 1 unità)

---

## Strategia di Matching

### 🎯 Priorità 1: Match per Codice Articolo (95% confidence)

Se `article_code` dalla fattura **corrisponde esattamente** a `product_code` in Odoo:
- ✅ Match quasi certo
- Confidence: 95%

**Esempio**:
```
Fattura: article_code = "MOZ250"
Odoo:    product_code = "MOZ250"
→ MATCH! (confidence: 0.95)
```

---

### 🎯 Priorità 2: Match Fuzzy per Nome (70-90% confidence)

Se il codice non matcha, confronta i **nomi** con fuzzy matching.

**Normalizzazione**:
1. Converti in lowercase
2. Rimuovi forme societarie: "SRL", "S.R.L.", "SPA", "S.P.A.", "& C."
3. Rimuovi punteggiatura: ".", ",", "-", "/"
4. Rimuovi spazi multipli

**Esempi di match**:
```
"MOZZARELLA BUFALA 250G" ≈ "Mozzarella di Bufala 250gr"
→ MATCH (confidence: 0.85)

"PANNA FRESCA UHT" ≈ "Panna Fresca per Cucina UHT"
→ MATCH (confidence: 0.80)

"RICOTTA VACCINA" ≈ "Ricotta di Mucca"
→ MATCH (confidence: 0.75)
```

**Calcolo confidence**:
- Match esatto dopo normalizzazione: 90%
- Contiene tutte le parole chiave: 80%
- Contiene alcune parole chiave: 70%
- Match parziale: 60%

---

### 🎯 Priorità 3: Match per Varianti (75-85% confidence)

Le varianti possono essere scritte in modi diversi.

**Esempi**:
```
Fattura: "Quadrato, Verde, 250gr"
Odoo:    "QUADRATO RICOTTA/SPINACI VERDE GR.250"
→ MATCH (confidence: 0.80)

Fattura: "Rosso 500g"
Odoo:    "ROSSO POMODORO G.500"
→ MATCH (confidence: 0.75)
```

**Normalizzazione varianti**:
- "250g" = "250gr" = "GR.250" = "gr 250"
- "1L" = "1 Litro" = "1000ml"
- "Rosso" = "RED" = "ROSSO"

---

## 🔢 Conversione Quantità con UoM (CRITICISSIMO!)

### ⚠️ REGOLA PRIORITARIA #0 - CONVERSIONE QUANTITÀ

**ATTENZIONE**: Questa è la regola PIÙ IMPORTANTE di tutto lo skill!

Quando la fattura indica una quantità con moltiplicatore (es: "3 x 10ST", "5 x 12PZ"), DEVI:
1. **Verificare l'UoM configurata in Odoo** (`uom_info` e `uom_po_info`)
2. **Calcolare la quantità finale** usando i fattori di conversione
3. **Registrare nell'unità di misura base** (quella di `uom_info`)

### Esempio Reale: Burro "3 x 10ST"

**Fattura dice**:
```
3 x 10ST Vorzugsbutter Züger 1kg
```

**Odoo dice**:
```json
{
  "product_name": "BURRO VORZUGSBUTTER ZUEGER 1KG 10KG CRT AL",
  "uom_info": {
    "name": "kg",
    "factor": 1.0
  },
  "uom_po_info": {
    "name": "Carton",
    "factor": 0.1,
    "factor_inv": 10.0
  }
}
```

**Interpretazione**:
- "3 x 10ST" = 3 cartoni da 10 kg ciascuno
- UoM base in Odoo = KG
- UoM acquisto in Odoo = Carton (1 Carton = 10 KG, factor_inv = 10.0)
- **Quantità finale = 3 × 10 = 30.0 KG**

### ✅ Output Corretto
```json
{
  "quantity": 30.0,
  "match_reason": "3 cartoni × 10 kg/cartone = 30.0 kg (converted from 3 x 10ST using uom_po_info)"
}
```

### ❌ Output SBAGLIATO
```json
{
  "quantity": 3.0,  // ❌ SBAGLIATO! Questo registra solo 3 kg invece di 30 kg
  "match_reason": "Quantity from invoice"
}
```

### Regole di Conversione

1. **Se la fattura ha moltiplicatore (es: "3 x 10ST")**:
   - Estrai: quantità_cartoni = 3, pezzi_per_cartone = 10
   - Se `uom_po_info` esiste e ha `factor_inv`:
     - Verifica: `factor_inv` ≈ pezzi_per_cartone
     - Calcola: `quantity = quantità_cartoni × factor_inv`
   - Altrimenti: `quantity = quantità_cartoni × pezzi_per_cartone`

2. **Se la fattura ha solo numero (es: "5.0")**:
   - Se unità fattura ≈ `uom_info.name` (es: "KG" ≈ "kg"): usa direttamente
   - Se unità fattura ≈ `uom_po_info.name` (es: "CRT" ≈ "Carton"): converti con `factor_inv`

3. **Unità comuni**:
   - `ST`, `PZ`, `PCE` = Pieces (pezzi)
   - `CRT`, `CTN`, `CARTON` = Cartons (cartoni)
   - `KG` = Kilograms
   - `L`, `LT` = Liters
   - `BTL`, `FL`, `GLS` = Bottles/Flask/Glass
   - `PAK`, `PKG` = Package

### Esempi Pratici

#### Esempio 1: Olio "4 x 5L"
```
Fattura: "4 x 5L OLIO EXTRAVERGINE"
Odoo uom_info: { "name": "L", "factor": 1.0 }
Odoo uom_po_info: { "name": "Box", "factor_inv": 5.0 }

→ quantity: 20.0 (4 boxes × 5 L/box = 20 L)
```

#### Esempio 2: Pasta "10 x 500G"
```
Fattura: "10 x 500G PASTA PENNE"
Odoo uom_info: { "name": "kg", "factor": 1.0 }
Odoo uom_po_info: { "name": "Pack", "factor_inv": 0.5 }

→ quantity: 5.0 (10 packs × 0.5 kg/pack = 5.0 kg)
```

#### Esempio 3: Acqua "3 x 6BTL"
```
Fattura: "3 x 6BTL ACQUA NATURALE 1.5L"
Odoo uom_info: { "name": "Unit", "factor": 1.0 }
Odoo uom_po_info: { "name": "Pack", "factor_inv": 6.0 }

→ quantity: 18.0 (3 packs × 6 bottles/pack = 18 bottles)
```

---

## 🔥 Gestione Multi-Lotto (CRITICISSIMO!)

### ⚠️ REGOLA PRIORITARIA #1 - MULTI-LOTTO DELLO STESSO PRODOTTO

**ATTENZIONE**: Questa è la regola PIÙ IMPORTANTE di tutto lo skill!

Se nella fattura ci sono **DUE o più righe con lo STESSO PRODOTTO ma LOTTI DIVERSI**, DEVI **SEMPRE** creare righe separate!

### ❌ ERRORE COMUNE (DA EVITARE ASSOLUTAMENTE!)

```json
// SBAGLIATO! NON FARE MAI QUESTO!
Fattura ha:
  - OLIO 4 PZ, Lotto 25E172
  - OLIO 208 PZ, Lotto 25E458

Odoo ha:
  - OLIO 212 PZ (1 sola riga)

ERRORE: Fare una sola "update" con 4 o 208
✅ CORRETTO: Fare "update" per il primo + "create_new_line" per il secondo
```

### ✅ SOLUZIONE CORRETTA PASSO-PASSO

#### Step 1: Identifica se è multi-lotto
```javascript
// Controlla se ci sono prodotti duplicati nella fattura
const olio_products = fattura.filter(p => p.description includes "OLIO")
if (olio_products.length > 1) {
  // È MULTI-LOTTO! Devi creare righe separate!
}
```

#### Step 2: Prima occorrenza → `action: "update"`
```json
{
  "move_line_id": 123,
  "invoice_product_index": 0,  // Prima riga nella fattura
  "quantity": 4.0,
  "lot_number": "25E172",
  "expiry_date": "2026-08-30",
  "action": "update",  // ← Aggiorna la riga esistente
  "match_reason": "First occurrence - updating existing line"
}
```

#### Step 3: Seconda occorrenza → `action: "create_new_line"`
```json
{
  "move_line_id": 123,  // ← STESSO move_line_id della prima!
  "invoice_product_index": 1,  // Seconda riga nella fattura
  "quantity": 208.0,
  "lot_number": "25E458",
  "expiry_date": "2026-11-30",
  "action": "create_new_line",  // ← Crea NUOVA riga per secondo lotto
  "match_reason": "Same product, different lot - creating new line"
}
```

### 🎯 Esempio Reale (OLIO EXTRAVERGINE)

**Input Fattura**:
```json
[
  {
    "description": "OLIO EXTRAVERGINE DI OLIVA 100% ITALIA OLIVUM 5L 4PZ CRT PRIM",
    "quantity": 4.0,
    "lot_number": "25E172",
    "expiry_date": "2026-08-30"
  },
  {
    "description": "OLIO EXTRAVERGINE DI OLIVA 100% ITALIA OLIVUM 5L 4PZ CRT PRIM",
    "quantity": 208.0,
    "lot_number": "25E458",
    "expiry_date": "2026-11-30"
  }
]
```

**Input Odoo**:
```json
[
  {
    "id": 853309,
    "product_name": "OLIO EXTRAVERGINE DI OLIVA 100% ITALIA OLIVUM SL 4PZ CRT PRIM",
    "product_uom_qty": 212.0  // Totale atteso
  }
]
```

**Output CORRETTO**:
```json
[
  {
    "move_line_id": 853309,
    "invoice_product_index": 0,
    "quantity": 4.0,
    "lot_number": "25E172",
    "expiry_date": "2026-08-30",
    "match_confidence": 0.95,
    "match_reason": "Exact product match - First lot occurrence",
    "action": "update"
  },
  {
    "move_line_id": 853309,
    "invoice_product_index": 1,
    "quantity": 208.0,
    "lot_number": "25E458",
    "expiry_date": "2026-11-30",
    "match_confidence": 0.95,
    "match_reason": "Same product as index 0 - Second lot occurrence, creating new line",
    "action": "create_new_line"
  }
]
```

### 🚨 CHECKLIST PRIMA DI RISPONDERE

Prima di generare l'output finale, verifica:

- [ ] Ho controllato le UoM in Odoo (`uom_info` e `uom_po_info`)?
- [ ] Se la fattura ha moltiplicatore (es: "3 x 10ST"), ho fatto la conversione corretta?
- [ ] La quantità è espressa nell'unità di misura base (`uom_info.name`)?
- [ ] Ho controllato se ci sono prodotti duplicati nella fattura?
- [ ] Se ci sono duplicati, ho usato `action: "update"` per il PRIMO?
- [ ] Se ci sono duplicati, ho usato `action: "create_new_line"` per il SECONDO e successivi?
- [ ] Ho usato lo STESSO `move_line_id` per tutte le occorrenze dello stesso prodotto?
- [ ] Ho impostato `invoice_product_index` diversi per ogni occorrenza?

**Regole d'oro**:
1. **SEMPRE** fare conversione UoM guardando `uom_po_info.factor_inv`
2. **Primo** dello stesso prodotto → `action: "update"` (aggiorna riga esistente)
3. **Secondo+** dello stesso prodotto → `action: "create_new_line"` (crea nuova riga)

---

## Azioni Disponibili

### Action: `update`
**Quando usare**: Aggiornare una riga Odoo esistente con dati dalla fattura

**Esempio**:
```json
{
  "move_line_id": 123,
  "action": "update",
  "quantity": 24.0,
  "lot_number": "L20250115",
  "expiry_date": "2025-02-15"
}
```

---

### Action: `create_new_line`
**Quando usare**:
- Stesso prodotto, lotto diverso
- Prodotto nella fattura ma serve riga aggiuntiva in Odoo

**Esempio**:
```json
{
  "move_line_id": 123,
  "action": "create_new_line",
  "quantity": 15.0,
  "lot_number": "L20250116",
  "expiry_date": "2025-02-16"
}
```

**IMPORTANTE**: `move_line_id` indica la riga originale da cui copiare i dati del prodotto (product_id, location, ecc). La nuova riga avrà lo stesso prodotto ma quantità/lotto diversi.

---

### Action: `no_match`
**Quando usare**: Prodotto dalla fattura NON trovato in Odoo

**Esempio**:
```json
{
  "move_line_id": null,
  "invoice_product_index": 5,
  "action": "no_match",
  "match_reason": "Prodotto 'Burrata Premium' non trovato nell'ordine"
}
```

**Questi prodotti** verranno gestiti separatamente:
- L'utente può cercare manualmente
- Oppure creare nuovo prodotto
- Oppure ignorare

---

## ⚠️ Regola "Set to Zero"

**ATTENZIONE**: Tutte le righe Odoo che NON vengono matchate saranno **automaticamente messe a qty_done=0**.

### Quando è Corretto
✅ Prodotto era nell'ordine ma NON nella spedizione (backorder)
✅ Prodotto cancellato dal fornitore
✅ Consegna parziale concordata

### Quando Causa Problemi
❌ Consegne multiple per stesso P.O.
❌ Spedizioni parziali (arriva in 2-3 volte)
❌ Prodotto arriva dopo (ritardo)

### Raccomandazione
Prima di matchare, **CHIEDI SEMPRE** se questa è una:
- ✅ Consegna COMPLETA (tutto arrivato)
- ⚠️ Consegna PARZIALE (arriva altro dopo)

Se è parziale, **NON** mettere a zero righe non matchate!

---

## Formato Output

Rispondi SOLO con JSON array. NESSUN testo aggiuntivo.

```json
[
  {
    "move_line_id": 123,
    "invoice_product_index": 0,
    "quantity": 24.0,
    "lot_number": "L20250115",
    "expiry_date": "2025-02-15",
    "match_confidence": 0.95,
    "match_reason": "Exact code match: MOZ250",
    "action": "update"
  },
  {
    "move_line_id": 124,
    "invoice_product_index": 1,
    "quantity": 12.0,
    "lot_number": "L20250115",
    "expiry_date": "2025-02-20",
    "match_confidence": 0.85,
    "match_reason": "Fuzzy name match: Ricotta Vaccina ≈ Ricotta di Mucca",
    "action": "update"
  },
  {
    "move_line_id": null,
    "invoice_product_index": 2,
    "quantity": 0,
    "lot_number": null,
    "expiry_date": null,
    "match_confidence": 0.0,
    "match_reason": "Product 'Burrata Premium' not found in Odoo",
    "action": "no_match"
  }
]
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| move_line_id | number\|null | ✅ | ID riga Odoo (null se no_match) |
| invoice_product_index | number | ✅ | Indice prodotto nella fattura (0-based) |
| quantity | number | ✅ | Quantità da registrare |
| lot_number | string\|null | ❌ | Numero lotto |
| expiry_date | string\|null | ❌ | YYYY-MM-DD |
| match_confidence | number | ✅ | 0.0 - 1.0 (es: 0.95 = 95%) |
| match_reason | string | ✅ | Spiegazione del match |
| action | string | ✅ | "update", "create_new_line", "no_match" |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Non Creare Righe per Multi-Lotto
```
❌ SBAGLIATO:
Mozzarella Lotto A (10kg) + Lotto B (15kg) → 1 sola riga con qty=25

✅ CORRETTO:
2 righe separate:
  - update con Lotto A (10kg)
  - create_new_line con Lotto B (15kg)
```

### Errore #2: Match Troppo Generico
```
❌ SBAGLIATO:
"Mozzarella 125g" matcha con "Mozzarella 250g"
(grammature diverse!)

✅ CORRETTO:
"Mozzarella 125g" matcha SOLO con "Mozzarella 125g"
```

### Errore #3: Confidence Troppo Alta su Match Fuzzy
```
❌ SBAGLIATO:
"Ricotta Vaccina" ≈ "Ricotta Ovina" → confidence: 0.95

✅ CORRETTO:
"Ricotta Vaccina" ≈ "Ricotta Ovina" → confidence: 0.60
(sono due prodotti diversi!)
```

### Errore #4: Non Specificare match_reason
```
❌ SBAGLIATO:
"match_reason": "Match trovato"

✅ CORRETTO:
"match_reason": "Exact code match: MOZ250 = MOZ250"
```

### Errore #5: Usare move_line_id Sbagliato per create_new_line
```
❌ SBAGLIATO:
action: "create_new_line" con move_line_id di un altro prodotto

✅ CORRETTO:
action: "create_new_line" con move_line_id della riga originale dello STESSO prodotto
```

---

## 🧪 Esempi Completi

### Esempio 1: Match Semplice
**Input Fattura**:
```json
[
  { "article_code": "MOZ250", "description": "Mozzarella 250g", "quantity": 10.0 }
]
```

**Input Odoo**:
```json
[
  { "id": 123, "product_code": "MOZ250", "product_name": "Mozzarella Bufala 250gr", "product_uom_qty": 10.0 }
]
```

**Output**:
```json
[
  {
    "move_line_id": 123,
    "invoice_product_index": 0,
    "quantity": 10.0,
    "lot_number": null,
    "expiry_date": null,
    "match_confidence": 0.95,
    "match_reason": "Exact code match: MOZ250",
    "action": "update"
  }
]
```

---

### Esempio 2: Multi-Lotto
**Input Fattura**:
```json
[
  { "description": "Mozzarella", "quantity": 10.0, "lot_number": "A123" },
  { "description": "Mozzarella", "quantity": 15.0, "lot_number": "B456" }
]
```

**Input Odoo**:
```json
[
  { "id": 123, "product_name": "Mozzarella Bufala", "product_uom_qty": 25.0 }
]
```

**Output**:
```json
[
  {
    "move_line_id": 123,
    "invoice_product_index": 0,
    "quantity": 10.0,
    "lot_number": "A123",
    "match_confidence": 0.90,
    "match_reason": "Exact name match",
    "action": "update"
  },
  {
    "move_line_id": 123,
    "invoice_product_index": 1,
    "quantity": 15.0,
    "lot_number": "B456",
    "match_confidence": 0.90,
    "match_reason": "Same product, different lot",
    "action": "create_new_line"
  }
]
```

---

### Esempio 3: Prodotto Non Trovato
**Input Fattura**:
```json
[
  { "description": "Burrata Premium 200g", "quantity": 5.0 }
]
```

**Input Odoo**:
```json
[
  { "id": 123, "product_name": "Mozzarella Bufala" }
]
```

**Output**:
```json
[
  {
    "move_line_id": null,
    "invoice_product_index": 0,
    "quantity": 0,
    "lot_number": null,
    "expiry_date": null,
    "match_confidence": 0.0,
    "match_reason": "Product 'Burrata Premium 200g' not found in Odoo. No similar products detected.",
    "action": "no_match"
  }
]
```

---

## 🔧 Note Tecniche

- **Modello**: Claude 3.5 Sonnet
- **Max tokens**: 8000
- **Temperature**: 0 (deterministic)
- **Timeout**: 30 secondi

**Algoritmo Fuzzy Match**:
- Levenshtein distance
- Jaro-Winkler similarity
- Token set ratio

---

## 📝 Changelog

### v1.1.0 (2025-01-28)
- ✅ Conversione automatica quantità con UoM
- ✅ Lettura `uom_info` e `uom_po_info` da Odoo
- ✅ Gestione moltiplicatori fattura (es: "3 x 10ST")
- ✅ Calcolo automatico con `factor_inv`
- ✅ Upgrade a Claude Sonnet 4.5

### v1.0.0 (2025-01-15)
- ✅ Prima versione stabile
- ✅ Match per codice esatto
- ✅ Fuzzy matching per nome
- ✅ Gestione multi-lotto
- ✅ Validazione varianti
- ✅ Sistema confidence scoring
