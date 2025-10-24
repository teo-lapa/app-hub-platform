---
name: contract-analysis
version: 1.0.0
description: Analizza contratti fornitori per clausole critiche e condizioni commerciali
category: document-processing
tags: [contract, legal, supplier, terms, vision]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-24
temperature: 0
max_tokens: 8192
---

# 📜 Contract Analysis Skill

## Contesto

Stai analizzando **contratti di fornitura** per identificare condizioni commerciali critiche.
L'obiettivo è estrarre clausole importanti che impattano la gestione operativa e finanziaria.

Questi dati verranno usati per:
- Monitorare termini di pagamento concordati
- Tracciare condizioni di consegna
- Verificare penali e garanzie
- Controllare clausole di esclusività

**IMPORTANTE**: Errori in questa fase possono causare dispute legali e perdite finanziarie!

---

## Regole Critiche

### 🎯 REGOLA #1: Termini di Pagamento

**Cosa cercare**:
- Giorni di pagamento: "30 giorni data fattura", "60 gg DF", "90 giorni fine mese"
- Modalità: Bonifico bancario, RiBa, assegno
- Sconti per pronto pagamento: "2% sconto se pagato entro 10 gg"
- Penali ritardo: "Interessi di mora 5% annuo"

**Formato standard**:
```
Input: "Pagamento a 60 giorni data fattura fine mese"
Output: payment_days: 60, payment_type: "end_of_month"

Input: "30 giorni DF"
Output: payment_days: 30, payment_type: "invoice_date"

Input: "Pronto pagamento con sconto 2%"
Output: payment_days: 0, early_payment_discount: 2.0
```

**Keyword da cercare**:
- "Pagamento", "Payment terms", "Termini di pagamento"
- "DF" (data fattura), "FM" (fine mese), "FF" (fine fattura)
- "Sconto", "Discount", "Mora", "Interest"

---

### 🎯 REGOLA #2: Condizioni di Consegna

**Informazioni da estrarre**:
- Tempi di consegna: "Consegna entro 3 giorni lavorativi"
- Incoterms: "Franco magazzino", "DDU", "DDP", "EXW"
- Spese di trasporto: "Trasporto a carico fornitore", "Porto franco sopra €500"
- Orari di consegna: "Consegne dal lunedì al venerdì 8-18"

**Formato**:
```
Input: "Consegna entro 5 giorni lavorativi dalla conferma d'ordine"
Output: delivery_days: 5, delivery_type: "working_days"

Input: "Franco destino per ordini superiori a 500 EUR"
Output: incoterm: "DDP", free_shipping_threshold: 500.0
```

**Keyword**:
- "Consegna", "Delivery", "Spedizione"
- "Franco", "DDP", "DDU", "EXW", "FCA"
- "Trasporto", "Shipping", "Porto"

---

### 🎯 REGOLA #3: Prezzi e Listini

**Cosa estrarre**:
- Validità listino: "Prezzi validi fino al 31/12/2025"
- Variazioni prezzo: "Prezzi soggetti a variazione materie prime"
- Quantità minime: "Ordine minimo 200 EUR"
- Sconti quantità: "Sconto 5% su ordini >1000 EUR"

**Formato**:
```
Input: "Listino valido fino al 31/12/2025"
Output: price_list_valid_until: "2025-12-31"

Input: "Ordine minimo 250 EUR + IVA"
Output: minimum_order_value: 250.0, vat_excluded: true

Input: "5% sconto su ordini superiori a 1000 EUR"
Output: quantity_discount: 5.0, threshold: 1000.0
```

---

### 🎯 REGOLA #4: Garanzie e Penali

**Informazioni critiche**:
- Garanzia prodotto: "Prodotti garantiti 12 mesi"
- Resi e sostituzioni: "Resi entro 7 giorni"
- Penali ritardo: "Penale 0.5% per ogni giorno di ritardo"
- Risoluzione contratto: "Facoltà di recesso con 30 giorni preavviso"

**Formato**:
```
Input: "Garanzia 24 mesi dalla data di consegna"
Output: warranty_months: 24, warranty_start: "delivery_date"

Input: "Penale 0.3% per ogni giorno di ritardo"
Output: delay_penalty_percent: 0.3, penalty_period: "daily"
```

---

### 🎯 REGOLA #5: Durata e Rinnovo

**Elementi da identificare**:
- Data inizio: "Contratto valido dal 01/01/2025"
- Data fine: "Scadenza 31/12/2025"
- Rinnovo automatico: "Rinnovo tacito annuale salvo disdetta"
- Preavviso disdetta: "Disdetta con 60 giorni di preavviso"

**Formato**:
```
Input: "Contratto dal 01/01/2025 al 31/12/2025 con rinnovo tacito annuale"
Output:
  start_date: "2025-01-01"
  end_date: "2025-12-31"
  auto_renewal: true
  renewal_period: "yearly"

Input: "Disdetta con 90 giorni di preavviso a mezzo raccomandata"
Output:
  notice_period_days: 90
  notice_method: "registered_mail"
```

---

### 🎯 REGOLA #6: Clausole Speciali

**Attenzione particolare a**:
- Esclusività: "Fornitore esclusivo per categoria X"
- Non concorrenza: "Divieto acquisto da competitor Y"
- Riservatezza: "Obbligo di non divulgazione"
- Foro competente: "Foro di Milano"

**Estrazione**:
- Identifica presenza clausole
- Estrai dettagli specifici
- Segnala clausole critiche

---

## Formato Output

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo prima o dopo.

```json
{
  "contract_summary": {
    "supplier_name": "Fornitore XYZ SRL",
    "supplier_vat": "12345678901",
    "contract_number": "CONTR/2025/001",
    "contract_date": "2025-01-15",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31"
  },
  "payment_terms": {
    "payment_days": 60,
    "payment_type": "end_of_month",
    "payment_method": "bank_transfer",
    "early_payment_discount": 2.0,
    "late_payment_interest": 5.0
  },
  "delivery_terms": {
    "delivery_days": 3,
    "delivery_type": "working_days",
    "incoterm": "DDP",
    "free_shipping_threshold": 500.0,
    "delivery_schedule": "Monday-Friday 8:00-18:00"
  },
  "pricing_terms": {
    "price_list_valid_until": "2025-12-31",
    "minimum_order_value": 200.0,
    "quantity_discounts": [
      {
        "threshold": 1000.0,
        "discount_percent": 5.0
      },
      {
        "threshold": 5000.0,
        "discount_percent": 10.0
      }
    ],
    "price_variation_clause": true
  },
  "warranties_and_penalties": {
    "warranty_months": 12,
    "warranty_start": "delivery_date",
    "return_days": 7,
    "delay_penalty_percent": 0.5,
    "penalty_period": "daily"
  },
  "renewal_terms": {
    "auto_renewal": true,
    "renewal_period": "yearly",
    "notice_period_days": 60,
    "notice_method": "registered_mail"
  },
  "special_clauses": [
    {
      "type": "exclusivity",
      "description": "Fornitore esclusivo per categoria latticini freschi",
      "critical": true
    },
    {
      "type": "jurisdiction",
      "description": "Foro competente: Tribunale di Milano",
      "critical": false
    }
  ],
  "notes": "Contratto standard con condizioni favorevoli. Attenzione a clausola esclusività."
}
```

### Schema Dettagliato

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| contract_summary | object | ✅ | Dati generali contratto |
| contract_summary.supplier_name | string | ✅ | Nome fornitore completo |
| contract_summary.supplier_vat | string | ❌ | P.IVA senza prefisso IT |
| contract_summary.contract_number | string | ✅ | Numero/codice contratto |
| contract_summary.contract_date | string | ✅ | Data firma (YYYY-MM-DD) |
| contract_summary.start_date | string | ✅ | Inizio validità |
| contract_summary.end_date | string | ❌ | Fine validità |
| payment_terms | object | ✅ | Condizioni di pagamento |
| payment_terms.payment_days | number | ✅ | Giorni per pagamento |
| payment_terms.payment_type | string | ✅ | "invoice_date", "end_of_month" |
| payment_terms.early_payment_discount | number | ❌ | % sconto pronto pagamento |
| delivery_terms | object | ✅ | Condizioni di consegna |
| delivery_terms.incoterm | string | ❌ | DDP, DDU, EXW, etc. |
| pricing_terms | object | ✅ | Condizioni commerciali |
| warranties_and_penalties | object | ❌ | Garanzie e penali |
| renewal_terms | object | ❌ | Rinnovo contratto |
| special_clauses | array | ❌ | Clausole particolari |
| notes | string | ❌ | Note aggiuntive |

---

## ❌ Errori Comuni da Evitare

### Errore #1: Formato Date Errato
```
❌ SBAGLIATO: "31/12/2025"
✅ CORRETTO:  "2025-12-31"
```

### Errore #2: Confondere DF e FM
```
❌ SBAGLIATO: "60 gg FM" → payment_days: 60, payment_type: "invoice_date"
✅ CORRETTO:  "60 gg FM" → payment_days: 60, payment_type: "end_of_month"
```

### Errore #3: Non Estrarre Soglie
```
❌ SBAGLIATO: "5% su ordini >1000" → quantity_discount: 5.0 (senza threshold)
✅ CORRETTO:  "5% su ordini >1000" → threshold: 1000.0, discount: 5.0
```

### Errore #4: Perdere Clausole Critiche
```
❌ SBAGLIATO: Ignorare clausola esclusività
✅ CORRETTO:  Evidenziare con critical: true
```

---

## 🧪 Esempi

### Esempio 1: Contratto Standard

**Output**:
```json
{
  "contract_summary": {
    "supplier_name": "Forni Alimentari SRL",
    "supplier_vat": "09876543210",
    "contract_number": "FA-2025-042",
    "contract_date": "2025-01-10",
    "start_date": "2025-02-01",
    "end_date": "2026-01-31"
  },
  "payment_terms": {
    "payment_days": 60,
    "payment_type": "end_of_month",
    "payment_method": "bank_transfer",
    "early_payment_discount": 0,
    "late_payment_interest": 5.0
  },
  "delivery_terms": {
    "delivery_days": 2,
    "delivery_type": "working_days",
    "incoterm": "DDP",
    "free_shipping_threshold": 300.0
  },
  "pricing_terms": {
    "price_list_valid_until": "2026-01-31",
    "minimum_order_value": 150.0,
    "quantity_discounts": [],
    "price_variation_clause": false
  }
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
- Documenti Word (.docx) se convertiti in PDF
- Max size: 10 MB

---

## 📝 Changelog

### v1.0.0 (2025-01-24)
- ✅ Prima versione stabile
- ✅ Estrazione termini di pagamento
- ✅ Analisi condizioni di consegna
- ✅ Parsing clausole speciali
- ✅ Identificazione garanzie e penali
- ✅ Supporto vision per documenti scansionati
