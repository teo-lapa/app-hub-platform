---
name: receipt-extraction
version: 1.1.0
description: Estrae dati da scontrini e ricevute per tracciabilità spese e rimborsi
category: document-processing
tags: [receipt, expense, ocr, vision, reimbursement]
model: claude-sonnet-4-5-20250929
author: Lapa Team
created: 2025-01-24
updated: 2025-10-29
temperature: 0
max_tokens: 8192
---

# 🧾 Receipt Extraction Skill

## Contesto

Stai analizzando **scontrini e ricevute** per tracciare spese operative e rimborsi.
L'obiettivo è estrarre dati accurati per la contabilità e gestione note spese.

Questi dati verranno usati per:
- Registrare spese operative (carburante, parcheggi, materiali)
- Gestire note spese dipendenti
- Tracciare acquisti occasionali
- Verificare conformità fiscale

**IMPORTANTE**: Errori causano problemi con rimborsi e verifiche fiscali!

---

## Regole Critiche

### 🎯 REGOLA #1: Identificazione Esercente

**Dati da estrarre**:
- Nome esercente: "Bar Rossi", "Supermercato ABC"
- P.IVA/CF: "P.IVA 12345678901" o "C.F. RSSMRA80A01..."
- Indirizzo: Via, CAP, Città
- Numero scontrino/ricevuta

**Formato**:
```
Input scontrino con:
  "SUPERMERCATO CONAD SRL"
  "P.IVA: 01234567890"
  "Via Roma 15, 20100 Milano"

Output:
  merchant_name: "SUPERMERCATO CONAD SRL"
  merchant_vat: "01234567890"
  merchant_address: "Via Roma 15, 20100 Milano"
```

**Keyword da cercare**:
- "P.IVA", "Partita IVA", "VAT", "C.F.", "Codice Fiscale"
- Nome negozio solitamente in alto (prima riga)
- Indirizzo sotto il nome
- Numero scontrino: "N.", "Nr.", "Scontrino", "Receipt"

**Attenzione**:
- P.IVA italiana = 11 cifre
- Codice Fiscale = 16 caratteri alfanumerici
- Rimuovi prefisso "IT" se presente

---

### 🎯 REGOLA #2: Data e Ora

**Informazioni da estrarre**:
- Data emissione scontrino
- Ora emissione
- Identificare formato data italiano vs internazionale

**Conversione formato** (SEMPRE in YYYY-MM-DD HH:MM):
```
Input: "15/01/2025 14:35"
Output: date: "2025-01-15", time: "14:35"

Input: "01-15-2025 2:35 PM"
Output: date: "2025-01-15", time: "14:35"

Input: "15 Gen 2025 ore 14:35"
Output: date: "2025-01-15", time: "14:35"
```

**Keyword**:
- "Data", "Date", "Del", "IL"
- "Ora", "Time", "Orario"
- Formati comuni: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD

**Casi speciali**:
- Se solo data senza ora: time = null
- Se formato ambiguo (01/02/2025): assumi formato europeo (GG/MM/YYYY)

---

### 🎯 REGOLA #3: Totali e IVA

**Importi critici**:
- **Totale scontrino** (importo finale pagato)
- **Totale IVA** (se presente)
- **Imponibile** (se presente)
- **Metodo di pagamento** (contanti, carta, ecc.)

**Formato**:
```
Input:
  "Imponibile:     €45.00"
  "IVA 22%:        €9.90"
  "TOTALE:         €54.90"
  "Pagato CARTA"

Output:
  taxable_amount: 45.00
  vat_amount: 9.90
  vat_rate: 22.0
  total_amount: 54.90
  payment_method: "card"
```

**Keyword per totali**:
- "TOTALE", "TOTAL", "Tot.", "EURO", "EUR", "€"
- "Imponibile", "Subtotal", "Base"
- "IVA", "VAT", "Tax"

**Keyword metodi pagamento**:
- Contanti: "CONTANTI", "CASH", "€"
- Carta: "CARTA", "CARD", "BANCOMAT", "EC"
- Altro: "ASSEGNO", "BUONO", "VOUCHER"

**Attenzione**:
- Usa SEMPRE il punto decimale (45.90, non 45,90)
- Importo sempre numerico, NON stringa
- Se IVA non presente: vat_amount = null

---

### 🎯 REGOLA #4: Dettaglio Articoli (Opzionale)

**Per ogni articolo nello scontrino**:
- Descrizione prodotto
- Quantità
- Prezzo unitario
- Totale riga

**Formato**:
```
Input:
  "2x ACQUA NATURALE 1L       €0.50    €1.00"
  "1x PANE INTEGRALE           -       €2.50"

Output:
  items: [
    {
      description: "ACQUA NATURALE 1L",
      quantity: 2,
      unit_price: 0.50,
      line_total: 1.00
    },
    {
      description: "PANE INTEGRALE",
      quantity: 1,
      unit_price: null,
      line_total: 2.50
    }
  ]
```

**Nota**: Il dettaglio articoli è **opzionale** e richiesto solo se:
- Esplicitamente richiesto dall'utente
- Scontrino leggibile e ben strutturato
- Necessario per tracciabilità specifica (es. spese mensa)

**Non estrarre articoli se**:
- Scontrino illeggibile o sfocato
- Layout complesso senza struttura chiara
- Non richiesto esplicitamente

---

### 🎯 REGOLA #5: Categoria Spesa

**Identifica automaticamente la categoria** in base al tipo di esercente:

**Categorie comuni**:
- **fuel**: Stazioni di servizio, carburante
- **parking**: Parcheggi, strisce blu
- **food**: Ristoranti, bar, mense
- **supplies**: Cancelleria, materiali ufficio
- **grocery**: Supermercati, alimentari
- **transport**: Taxi, pedaggi, trasporti
- **other**: Altro non classificabile

**Identificazione**:
```
"ENI STATION" → category: "fuel"
"AUTOGRILL" → category: "food"
"TIGOTA'" → category: "supplies"
"PARCHEGGIO COMUNALE" → category: "parking"
"CARREFOUR" → category: "grocery"
```

**Se incerto**: category = "other"

---

### 🎯 REGOLA #6: Validazione Fiscale

**Verifiche da fare**:
- P.IVA presente e valida (11 cifre per Italia)
- Data non futura
- Importo totale > 0
- Scontrino o ricevuta fiscale (non fattura!)

**Flag di validazione**:
```json
{
  "fiscal_validation": {
    "has_vat_number": true,
    "vat_number_valid": true,
    "date_valid": true,
    "is_fiscal_receipt": true,
    "warnings": []
  }
}
```

**Possibili warning**:
- "P.IVA mancante"
- "Data scontrino futura"
- "Importo totale = 0"
- "Scontrino non fiscale (senza P.IVA)"

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "receipt_info": {
    "merchant_name": "SUPERMERCATO CONAD SRL",
    "merchant_vat": "01234567890",
    "merchant_address": "Via Roma 15, 20100 Milano",
    "receipt_number": "0042-1234",
    "date": "2025-01-15",
    "time": "14:35"
  },
  "amounts": {
    "taxable_amount": 45.00,
    "vat_amount": 9.90,
    "vat_rate": 22.0,
    "total_amount": 54.90,
    "currency": "EUR"
  },
  "payment": {
    "method": "card",
    "card_last_digits": "1234"
  },
  "category": "grocery",
  "items": [
    {
      "description": "LATTE INTERO 1L",
      "quantity": 2,
      "unit_price": 1.20,
      "line_total": 2.40
    },
    {
      "description": "PANE INTEGRALE",
      "quantity": 1,
      "unit_price": 2.50,
      "line_total": 2.50
    }
  ],
  "fiscal_validation": {
    "has_vat_number": true,
    "vat_number_valid": true,
    "date_valid": true,
    "is_fiscal_receipt": true,
    "warnings": []
  },
  "notes": "Scontrino leggibile, tutti i dati estratti correttamente"
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| receipt_info | object | ✅ | Dati esercente |
| receipt_info.merchant_name | string | ✅ | Nome negozio/esercente |
| receipt_info.merchant_vat | string | ❌ | P.IVA (11 cifre) |
| receipt_info.receipt_number | string | ❌ | Numero scontrino |
| receipt_info.date | string | ✅ | YYYY-MM-DD |
| receipt_info.time | string | ❌ | HH:MM formato 24h |
| amounts | object | ✅ | Importi |
| amounts.total_amount | number | ✅ | Totale pagato |
| amounts.vat_amount | number | ❌ | IVA |
| amounts.vat_rate | number | ❌ | % IVA |
| payment | object | ✅ | Metodo pagamento |
| payment.method | string | ✅ | "cash", "card", "other" |
| category | string | ✅ | Categoria spesa |
| items | array | ❌ | Articoli (opzionale) |
| fiscal_validation | object | ✅ | Validazione fiscale |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Virgola nei Numeri
```
❌ SBAGLIATO: total_amount: "54,90" (stringa con virgola)
✅ CORRETTO:  total_amount: 54.90 (numero con punto)
```

### Errore #2: Formato Data Errato
```
❌ SBAGLIATO: date: "15/01/2025"
✅ CORRETTO:  date: "2025-01-15"
```

### Errore #3: Confondere Imponibile e Totale
```
❌ SBAGLIATO: total_amount: 45.00 (è l'imponibile!)
✅ CORRETTO:  total_amount: 54.90 (totale con IVA)
               taxable_amount: 45.00
```

### Errore #4: P.IVA con Prefisso IT
```
❌ SBAGLIATO: merchant_vat: "IT01234567890"
✅ CORRETTO:  merchant_vat: "01234567890"
```

### Errore #5: Categoria Errata
```
❌ SBAGLIATO: "BAR CENTRALE" → category: "grocery"
✅ CORRETTO:  "BAR CENTRALE" → category: "food"
```

---

## 🧪 Esempi

### Esempio 1: Scontrino Supermercato

**Output**:
```json
{
  "receipt_info": {
    "merchant_name": "ESSELUNGA SPA",
    "merchant_vat": "00777420159",
    "merchant_address": "Piazza Duomo 1, Milano",
    "receipt_number": "1234",
    "date": "2025-01-20",
    "time": "18:45"
  },
  "amounts": {
    "taxable_amount": 23.77,
    "vat_amount": 5.23,
    "vat_rate": 22.0,
    "total_amount": 29.00,
    "currency": "EUR"
  },
  "payment": {
    "method": "card",
    "card_last_digits": null
  },
  "category": "grocery",
  "items": [],
  "fiscal_validation": {
    "has_vat_number": true,
    "vat_number_valid": true,
    "date_valid": true,
    "is_fiscal_receipt": true,
    "warnings": []
  }
}
```

### Esempio 2: Scontrino Carburante

**Output**:
```json
{
  "receipt_info": {
    "merchant_name": "ENI STATION",
    "merchant_vat": "00905811006",
    "receipt_number": "A-123456",
    "date": "2025-01-15",
    "time": "07:30"
  },
  "amounts": {
    "total_amount": 65.00,
    "vat_amount": 11.72,
    "vat_rate": 22.0,
    "currency": "EUR"
  },
  "payment": {
    "method": "card"
  },
  "category": "fuel",
  "items": [
    {
      "description": "BENZINA 95",
      "quantity": 35.5,
      "unit_price": 1.83,
      "line_total": 65.00
    }
  ],
  "fiscal_validation": {
    "has_vat_number": true,
    "vat_number_valid": true,
    "date_valid": true,
    "is_fiscal_receipt": true,
    "warnings": []
  }
}
```

### Esempio 3: Scontrino Parcheggio

**Output**:
```json
{
  "receipt_info": {
    "merchant_name": "ATM PARCHEGGI MILANO",
    "merchant_vat": "09168070150",
    "receipt_number": "P-987654",
    "date": "2025-01-18",
    "time": "15:20"
  },
  "amounts": {
    "total_amount": 8.00,
    "vat_amount": 1.45,
    "vat_rate": 22.0,
    "currency": "EUR"
  },
  "payment": {
    "method": "cash"
  },
  "category": "parking",
  "fiscal_validation": {
    "has_vat_number": true,
    "vat_number_valid": true,
    "date_valid": true,
    "is_fiscal_receipt": true,
    "warnings": []
  },
  "notes": "Parcheggio 4 ore - Zona C"
}
```

---

## 🔧 Note Tecniche

- **Modello**: Claude 3.5 Sonnet (ottimizzato per vision + OCR)
- **Max tokens**: 8192
- **Temperature**: 0 (deterministic)
- **Timeout**: 30 secondi

**Formati supportati**:
- Immagini (JPG, PNG, WEBP) - **formato principale per scontrini**
- PDF (se scontrino scannerizzato)
- Max size: 10 MB

**OCR ottimizzato per**:
- Scontrini termici (anche sbiaditi)
- Ricevute stampate
- Foto da smartphone (anche angolate)

---

## 📝 Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Estrazione dati esercente
- ✅ Parsing importi e IVA
- ✅ Identificazione metodo pagamento
- ✅ Categorizzazione automatica spese
- ✅ Validazione fiscale
- ✅ Supporto vision per scontrini foto/scan
- ✅ Estrazione articoli opzionale
