---
name: invoice-parsing
version: 1.0.0
description: Estrae dati strutturati da fatture fornitori per arrivi merce
tags: [parsing, invoice, pdf, vision, ocr]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-15
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

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
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
| supplier_name | string | ✅ | Nome completo fornitore |
| supplier_vat | string | ❌ | Solo numeri, senza prefisso IT |
| document_number | string | ✅ | Numero fattura/DDT |
| document_date | string | ✅ | Formato YYYY-MM-DD |
| products | array | ✅ | Lista prodotti (min 1) |
| products[].article_code | string\|null | ❌ | Codice articolo fornitore |
| products[].description | string | ✅ | Nome prodotto chiaro |
| products[].quantity | number | ✅ | Numero decimale (es: 24.0) |
| products[].unit | string | ✅ | KG, PZ, CT, L, ML |
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

### v1.0.0 (2025-01-15)
- ✅ Prima versione stabile
- ✅ Regole per peso netto/lordo
- ✅ Gestione lotti e scadenze
- ✅ Validazione P.IVA fornitore
- ✅ Parsing varianti prodotto
