---
name: invoice-parsing
version: 1.2.0
description: Estrae dati strutturati da fatture fornitori per arrivi merce
tags: [parsing, invoice, pdf, vision, ocr]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-15
updated: 2025-01-23
---

# 📄 Invoice Parsing Skill

## Contesto

Stai analizzando **fatture di fornitori** per arrivi merce in magazzino.
L'obiettivo è estrarre dati accurati per la gestione dell'inventario Odoo.

Questi dati verranno usati per:
- Compilare automaticamente le ricezioni in Odoo
- Registrare lotti e scadenze
- Aggiornare l'inventario

**IMPORTANTE**: Errori in questa fase causano sbalzi di inventario critici!

---

## Regole Critiche

### 🎯 REGOLA #1: Estrazione Quantità (MASSIMA PRIORITÀ!)

**PROBLEMA COMUNE**: Le fatture mostrano sia peso LORDO che peso NETTO.
Il peso lordo include l'imballaggio, quello netto è il prodotto effettivo.

**SOLUZIONE**:
1. Cerca SEMPRE il **PACKING LIST** (di solito pagine 5-6 della fattura)
2. Usa SOLO il **PESO NETTO** (Net Weight)
3. MAI usare peso lordo (Gross Weight)

**Esempi di conversione**:
```
Fattura dice: "5,000 KG"  → Converti in: 5.0
Fattura dice: "24,000 KG" → Converti in: 24.0
Fattura dice: "0,500 KG"  → Converti in: 0.5
```

**Unità multiple**:
```
"3 CT x 6 PZ"    → Calcola: 3 × 6 = 18 pezzi (unit: "PZ")
"5 Cartoni 12kg" → Calcola: 5 × 12 = 60 kg (unit: "KG")
```

**Keyword da cercare**:
- PESO NETTO, Net Weight, Netto, P.Netto
- ❌ NON usare: PESO LORDO, Gross Weight, Lordo, P.Lordo

---

### 🏷️ REGOLA #2: Numeri di Lotto

I lotti sono CRITICI per la tracciabilità alimentare (HACCP).

**Dove cercare**:
- "Lotto:", "Lot:", "L:", "Batch:", "N. Lotto"
- Spesso vicino alla descrizione prodotto
- A volte in tabella separata

**Se trovi SOLO scadenza** (senza lotto esplicito):
- Usa la data di scadenza come lot_number
- Formato: "SCAD-YYYYMMDD" (es: "SCAD-20251231")

**Formato**:
- Mantieni formato originale (alfanumerico)
- Esempi validi: "L20250115", "LOTTO123", "A1B2C3"

**Casi speciali**:
```
Lotto mancante + scadenza presente → lot_number = "SCAD-20251231"
Lotto presente → lot_number = valore originale
Nessun lotto e nessuna scadenza → lot_number = null
```

---

### 📅 REGOLA #3: Date di Scadenza

**Keyword da cercare**:
- "Scad:", "Scadenza:", "Best before:", "BBD:", "Da consumarsi entro:"
- "Use by:", "Exp:", "Expiry:"

**Conversione formato** (SEMPRE in YYYY-MM-DD):
```
Input: "31/12/2025"      → Output: "2025-12-31"
Input: "12-2025"         → Output: "2025-12-31" (ultimo giorno del mese)
Input: "Dec 2025"        → Output: "2025-12-31"
Input: "2025-12-31"      → Output: "2025-12-31" (già corretto)
```

**Casi speciali**:
- Se solo mese/anno: usa ultimo giorno del mese
- Se formato ambiguo (es: 01/02/2025): assumi formato europeo (GG/MM/YYYY)

---

### 🏢 REGOLA #4: P.IVA Fornitore

**ATTENZIONE**: La fattura contiene DUE P.IVA:
1. **Fornitore** (mittente) ← QUESTA È QUELLA GIUSTA
2. **Cliente** (destinatario/noi) ← NON questa!

**Dove cercare**:
- Nella sezione "Mittente", "Fornitore", "Supplier", "Venditore"
- Di solito in alto a sinistra o in intestazione
- Keyword: "P.IVA:", "VAT:", "Partita IVA:", "VAT Number:"

**Formato**:
- Rimuovi prefisso "IT" se presente
- Solo numeri (11 cifre per P.IVA italiana)
- Esempio: "IT12345678901" → "12345678901"

**Validazione**:
- P.IVA italiana = 11 cifre
- P.IVA estera = può variare (mantieni originale)

---

### 📦 REGOLA #5: Varianti Prodotto

Alcuni prodotti hanno varianti (colore, dimensione, formato).

**Esempi**:
```
"Ravioli Ricotta/Spinaci QUADRATO VERDE 250gr"
→ description: "Ravioli Ricotta/Spinaci"
→ variant: "Quadrato, Verde, 250gr"

"Panna UHT 1L"
→ description: "Panna UHT"
→ variant: "1L"
```

**Estrazione varianti**:
- Cerca: dimensioni (250g, 1L, 500ml)
- Cerca: colori (Rosso, Verde, Giallo)
- Cerca: forme (Quadrato, Rotondo)
- Cerca: tipi (Fresco, Surgelato)

---

### 📑 REGOLA #6: Fatture Multi-Riga

Alcune fatture (es. Pastificio Marcello) hanno una struttura particolare dove le informazioni sono distribuite su **più righe**.

#### 🎯 Pattern da Riconoscere

**Pattern 1: Lotto/Scadenza su Riga Separata**
```
1BRASELLO-SV    QUADRATO ROSSO BRASELLO GR.250      KG  2,00
                LOTTO 2210- SCADENZA 10/11/25
```
✅ **Estrazione corretta**:
- article_code: "1BRASELLO-SV"
- description: "QUADRATO ROSSO BRASELLO GR.250"
- quantity: 2.0
- unit: "KG"
- lot_number: "2210"
- expiry_date: "2025-10-11"

**Pattern 2: Header di Gruppo NON è un Prodotto**
```
ORDINE P10083    ← Non è un prodotto! È solo un header di raggruppamento

1BRASELLO-SV    QUADRATO ROSSO BRASELLO GR.250      KG  2,00
```
✅ **Azione**: Ignora la riga "ORDINE P10083" come prodotto

**Pattern 3: Codice Articolo in Prima Colonna**
```
Articolo         Descrizione                         UM  Quantità
1FUSILLI         FUSILLONI UOVO GR. 1000            KG  3,00
1PAPPARD         PAPPARDELLE ALL'UOVO GR.1000       KG  3,00
                 LOTTO 2210 - SCADENZA 07/11/25
```
✅ **Estrazione**:
- Prodotto 1: article_code="1FUSILLI", quantity=3.0, lot_number="2210", expiry_date="2025-07-11"
- Prodotto 2: article_code="1PAPPARD", quantity=3.0, lot_number="2210", expiry_date="2025-07-11"

#### ⚠️ Regole di Identificazione

**NON è un prodotto se la riga contiene SOLO**:
- "ORDINE" + numero (es: "ORDINE P10083")
- "LOTTO" + numero (es: "LOTTO 2210")
- Solo date senza descrizione
- Testo generico tipo "PER LA PASTA VIENE USATA" (note informative)

**È un prodotto se la riga ha**:
- Codice articolo valido (es: "1BRASELLO-SV")
- Descrizione prodotto significativa
- Quantità e unità di misura
- Anche se lotto/scadenza sono su riga successiva!

#### 🔗 Come Unire Righe Multiple

Quando vedi:
```
Riga 1: PRODOTTO X    3,00 KG
Riga 2:               LOTTO ABC - SCADENZA 31/12/2025
```

**Processo**:
1. Estrai prodotto da Riga 1
2. Leggi Riga 2 per lotto/scadenza
3. Combina in **UN SOLO** prodotto nel JSON

❌ **Non fare**:
- Non creare due prodotti separati
- Non ignorare la riga 2
- Non considerare "LOTTO ABC" come descrizione prodotto

✅ **Fai**:
- Unisci le info in un prodotto unico
- Associa lotto e scadenza al prodotto sopra

---

### 🔄 REGOLA #7: Gestione Duplicati e Multi-DDT (CRITICA!)

Alcune fatture (es. RISTORIS) contengono **più DDT** (Documenti di Trasporto) in una singola fattura.
Questo causa lo **STESSO PRODOTTO** con lo **STESSO LOTTO** ripetuto più volte.

#### 🚨 PROBLEMA

**Scenario**:
```
D.d.T. numero 000234-C del 20/10/2025
008126 CARCIOFI A SPICCHI OLIO - S.P. LATTA 3/1 - 2400 G  NR  30  9,200  276,00
       Lotto/Lot: LR248-040928  Scad./Exp.: 4/09/2028

D.d.T. numero 000235-C del 20/10/2025
008126 CARCIOFI A SPICCHI OLIO - S.P. LATTA 3/1 - 2400 G  NR  6   9,200  55,20
       Lotto/Lot: LR248-040928  Scad./Exp.: 4/09/2028
```

❌ **Errore comune**: Creare 2 prodotti separati nel JSON
✅ **Comportamento corretto**: Sommare le quantità in 1 solo prodotto

#### 📊 Algoritmo di Consolidamento

**PRIMA di generare il JSON finale, segui questi passi**:

1. **Estrai tutti i prodotti** dalla fattura (inclusi duplicati)
2. **Identifica duplicati** con chiave: `article_code + lot_number + expiry_date`
3. **Somma le quantità** dei duplicati
4. **Crea UN SOLO prodotto** nel JSON finale

#### 🎯 Esempio di Consolidamento

**Input dalla fattura**:
```
Riga 1: 001507 POMODORI CILIEG ROSSI  Qtà: 24  Lotto: LR214-020828  Scad: 2/08/2028
Riga 2: 001507 POMODORI CILIEG ROSSI  Qtà: 18  Lotto: LR214-020828  Scad: 2/08/2028
```

**Output JSON corretto**:
```json
{
  "products": [
    {
      "article_code": "001507",
      "description": "POMODORI CILIEG ROSSI SEMISEC LATTA 4/4 - 750 G",
      "quantity": 42.0,
      "unit": "NR",
      "lot_number": "LR214-020828",
      "expiry_date": "2028-08-02"
    }
  ]
}
```
**Calcolo**: 24 + 18 = 42 ✅

#### ⚙️ Chiave di Consolidamento

Due prodotti sono **duplicati** se hanno:
- ✅ Stesso `article_code` (o entrambi null)
- ✅ Stesso `lot_number`
- ✅ Stesso `expiry_date`
- ✅ Stessa `unit`

**NOTA**: La `description` può variare leggermente (spazi, maiuscole) → usa la versione più completa

#### 📝 Regole Aggiuntive

1. **Descrizione**: Se i duplicati hanno descrizioni diverse, usa quella più completa
2. **Unità di misura**: Devono essere identiche per sommare (KG+KG ✅, KG+PZ ❌)
3. **Somma solo quantità**: Altri campi (prezzo, totale) vengono ignorati

#### 🔢 Conteggio Prodotti

**IMPORTANTE**: All'inizio del JSON, aggiungi un campo `parsing_summary`:

```json
{
  "parsing_summary": {
    "total_lines_in_invoice": 32,
    "unique_products_after_consolidation": 29,
    "duplicates_found": 3
  },
  "supplier_name": "...",
  "products": [...]
}
```

**Campi**:
- `total_lines_in_invoice`: Numero di righe prodotto nella fattura (prima del consolidamento)
- `unique_products_after_consolidation`: Numero di prodotti nel JSON finale (dopo consolidamento)
- `duplicates_found`: Numero di prodotti che sono stati consolidati

#### ✅ Esempio Completo

**Fattura con**:
- 32 righe totali
- 3 prodotti duplicati (001507×2, 012605×2, 008126×2)
- 29 prodotti unici finali

**Output JSON**:
```json
{
  "parsing_summary": {
    "total_lines_in_invoice": 32,
    "unique_products_after_consolidation": 29,
    "duplicates_found": 3
  },
  "supplier_name": "RISTORIS SRL",
  "supplier_vat": "09017940967",
  "document_number": "650/E",
  "document_date": "2025-10-21",
  "products": [
    {
      "article_code": "001507",
      "description": "POMODORI CILIEG ROSSI SEMISEC LATTA 4/4 - 750 G",
      "quantity": 42.0,
      "unit": "NR",
      "lot_number": "LR214-020828",
      "expiry_date": "2028-08-02"
    },
    {
      "article_code": "012605",
      "description": "SALSA DI PISTACCHIO - RICETTA VASO VETRO ML 580 - 520 G",
      "quantity": 18.0,
      "unit": "NR",
      "lot_number": "LC25078-030327",
      "expiry_date": "2027-03-03"
    },
    {
      "article_code": "008126",
      "description": "CARCIOFI A SPICCHI OLIO - S.P. LATTA 3/1 - 2400 G",
      "quantity": 36.0,
      "unit": "NR",
      "lot_number": "LR248-040928",
      "expiry_date": "2028-09-04"
    }
  ]
}
```

#### 🚫 Cosa NON Fare

❌ **Non consolidare** se:
- Lotti diversi (anche se stesso prodotto)
- Scadenze diverse (anche se stesso lotto)
- Unità di misura diverse (KG vs PZ)

❌ **Non creare righe con qty=0**
❌ **Non duplicare prodotti nel JSON finale**

✅ **Sempre consolidare** prodotti identici sommando le quantità

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "parsing_summary": {
    "total_lines_in_invoice": 15,
    "unique_products_after_consolidation": 14,
    "duplicates_found": 1
  },
  "supplier_name": "Nome Fornitore SRL",
  "supplier_vat": "12345678901",
  "document_number": "FAT/2025/001",
  "document_date": "2025-01-15",
  "products": [
    {
      "article_code": "MOZ250",
      "description": "Mozzarella di Bufala",
      "quantity": 24.0,
      "unit": "KG",
      "lot_number": "L20250115",
      "expiry_date": "2025-02-15",
      "variant": "250g"
    },
    {
      "article_code": null,
      "description": "Ricotta Fresca",
      "quantity": 12.0,
      "unit": "KG",
      "lot_number": "SCAD-20250120",
      "expiry_date": "2025-01-20",
      "variant": ""
    }
  ]
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| parsing_summary | object | ✅ | Riepilogo parsing (NUOVO in v1.2.0) |
| parsing_summary.total_lines_in_invoice | number | ✅ | Righe prodotto nella fattura |
| parsing_summary.unique_products_after_consolidation | number | ✅ | Prodotti unici nel JSON |
| parsing_summary.duplicates_found | number | ✅ | Prodotti consolidati |
| supplier_name | string | ✅ | Nome completo fornitore |
| supplier_vat | string | ❌ | Solo numeri, senza prefisso IT |
| document_number | string | ✅ | Numero fattura/DDT |
| document_date | string | ✅ | Formato YYYY-MM-DD |
| products | array | ✅ | Lista prodotti (min 1) |
| products[].article_code | string\|null | ❌ | Codice articolo fornitore |
| products[].description | string | ✅ | Nome prodotto chiaro |
| products[].quantity | number | ✅ | Numero decimale (es: 24.0) |
| products[].unit | string | ✅ | KG, PZ, CT, L, ML, NR |
| products[].lot_number | string\|null | ❌ | Numero lotto |
| products[].expiry_date | string\|null | ❌ | YYYY-MM-DD |
| products[].variant | string | ❌ | Variante (può essere "") |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Peso Lordo invece di Netto
```
❌ SBAGLIATO: quantity: 26.5  (peso lordo 26,500 KG)
✅ CORRETTO:  quantity: 24.0  (peso netto 24,000 KG)
```

### Errore #2: Non moltiplicare quantità multiple
```
❌ SBAGLIATO: "3 CT x 6 PZ" → quantity: 3
✅ CORRETTO:  "3 CT x 6 PZ" → quantity: 18 (3 × 6)
```

### Errore #3: Unità errata
```
❌ SBAGLIATO: "5 Cartoni" → unit: "CT"
✅ CORRETTO:  "5 Cartoni da 12kg" → quantity: 60, unit: "KG"
```

### Errore #4: P.IVA destinatario invece fornitore
```
❌ SBAGLIATO: Prendere P.IVA da "Cliente/Destinatario"
✅ CORRETTO:  Prendere P.IVA da "Fornitore/Mittente"
```

### Errore #5: Formato data errato
```
❌ SBAGLIATO: "31/12/2025"
✅ CORRETTO:  "2025-12-31"
```

### Errore #6: Perdere numeri di lotto
```
❌ SBAGLIATO: lot_number: null (quando è presente nella fattura)
✅ CORRETTO:  lot_number: "L20250115" (se trovato)
```

### Errore #7: Virgola decimale italiana
```
❌ SBAGLIATO: quantity: "5,5" (stringa con virgola)
✅ CORRETTO:  quantity: 5.5 (numero con punto)
```

---

## 🧪 Esempi

### Esempio 1: Fattura Semplice
**Input**: PDF con 2 prodotti, lotti e scadenze chiare

**Output**:
```json
{
  "supplier_name": "Caseificio Rossi SRL",
  "supplier_vat": "01234567890",
  "document_number": "FAT/2025/042",
  "document_date": "2025-01-15",
  "products": [
    {
      "article_code": "MOZ125",
      "description": "Mozzarella Fior di Latte",
      "quantity": 10.0,
      "unit": "KG",
      "lot_number": "L20250115A",
      "expiry_date": "2025-01-25",
      "variant": "125g"
    },
    {
      "article_code": "RIC500",
      "description": "Ricotta Vaccina",
      "quantity": 5.0,
      "unit": "KG",
      "lot_number": "L20250115B",
      "expiry_date": "2025-01-22",
      "variant": "500g"
    }
  ]
}
```

### Esempio 2: Fattura con Quantità Multiple
**Input**: "3 Cartoni × 8 Pezzi da 250g"

**Output**:
```json
{
  "products": [
    {
      "description": "Mozzarella",
      "quantity": 24,
      "unit": "PZ",
      "variant": "250g"
    }
  ]
}
```
**Calcolo**: 3 cartoni × 8 pezzi = 24 pezzi totali

### Esempio 3: Lotto Mancante ma Scadenza Presente
**Input**: Prodotto senza lotto ma con "Scad: 31/12/2025"

**Output**:
```json
{
  "products": [
    {
      "description": "Panna Fresca",
      "quantity": 12.0,
      "unit": "L",
      "lot_number": "SCAD-20251231",
      "expiry_date": "2025-12-31",
      "variant": ""
    }
  ]
}
```

---

## 🔧 Note Tecniche

- **Modello**: Claude 3.5 Sonnet (ottimizzato per vision + PDF)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 60 secondi (per PDF grandi)

**Formati supportati**:
- PDF (nativi e scansionati)
- Immagini (JPG, PNG, WEBP)
- Max size: 10 MB

---

## 📝 Changelog

### v1.2.0 (2025-01-23)
- ✅ **REGOLA #7**: Gestione duplicati e multi-DDT
- ✅ Consolidamento automatico prodotti con stesso lotto+scadenza
- ✅ Campo `parsing_summary` con conteggio righe e prodotti unici
- ✅ Prevenzione creazione righe con qty=0

### v1.1.0 (2025-01-22)
- ✅ **REGOLA #6**: Gestione fatture multi-riga (es. Pastificio Marcello)
- ✅ Supporto lotto/scadenza su righe separate
- ✅ Riconoscimento header non-prodotto

### v1.0.0 (2025-01-15)
- ✅ Prima versione stabile
- ✅ Regole per peso netto/lordo
- ✅ Gestione lotti e scadenze
- ✅ Validazione P.IVA fornitore
- ✅ Parsing varianti prodotto
