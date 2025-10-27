---
name: auricchio-extract-quantities
version: 1.0.0
description: Estrae quantità dalla colonna FATTURATA (non CONTENUTA) nelle pagine fattura Auricchio
category: document-processing
tags: [auricchio, invoice, quantities, fatturata]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-27
---

# 🧾 Auricchio - Estrazione Quantità Fattura

## 🎯 Obiettivo

Estrarre le **quantità dalla colonna FATTURATA** (NON CONTENUTA!) dalle **pagine 2-3** della fattura Auricchio.

## 📄 Input

Riceverai un PDF multi-pagina di Auricchio. Le **pagine 2-3-4** contengono la fattura con i prodotti.

## 🔍 Struttura Fattura

**Header tabella** (pagine 2-3):
```
ARTICOLO  DESCRIZIONE  COLLI  CONTENUTA  FATTURATA  PREZZO  IMPORTO
```

**Esempio righe**:
```
71G    PECORINO ROMANO DOP...    2 KG   20,00 NR   20       18,00   313,63
CIA13  GORGONZOLA SANGIORGIO...  9 NR   36 KG      54,18    8,36    434,96
E708   PEC.ROMANO F.1 CAPPA...   1 NR   1 KG       21,85    17,10   329,81
```

## 🚨 ATTENZIONE: Colonna FATTURATA (NON CONTENUTA!)

**Due colonne di quantità**:
1. **CONTENUTA** (4a colonna) ← ❌ NON questa!
2. **FATTURATA** (5a colonna) ← ✅ USA QUESTA!

**Perché?**
- CONTENUTA = peso lordo imballo
- FATTURATA = quantità effettiva da registrare

**Esempi**:
```
CIA13:
  CONTENUTA: 36 KG     ← ❌ SBAGLIATO
  FATTURATA: 54,18     ← ✅ CORRETTO

E708:
  CONTENUTA: 1 KG      ← ❌ SBAGLIATO
  FATTURATA: 21,85     ← ✅ CORRETTO
```

## ✅ Output Richiesto

Rispondi SOLO con JSON valido. NESSUN testo aggiuntivo.

```json
{
  "quantities_map": {
    "71G": {
      "quantity": 20.0,
      "unit": "NR",
      "description": "PECORINO ROMANO DOP GRATTUGIATO FRESCO - 10 BUSTER KG 1"
    },
    "CIA13": {
      "quantity": 54.18,
      "unit": "KG",
      "description": "GORGONZOLA SANGIORGIO 4 VASC.1/8 TS"
    },
    "E708": {
      "quantity": 21.85,
      "unit": "KG",
      "description": "PEC.ROMANO F.1 CAPPA NERA"
    },
    "RE239": {
      "quantity": 60.0,
      "unit": "NR",
      "description": "MASCARPONE 6 VASCH.GR500 R.E.A."
    }
  }
}
```

## 📋 Regole

1. ✅ **Cerca SOLO nelle pagine 2-3-4** (fattura)
2. ✅ **USA la colonna FATTURATA** (5a colonna, vicino al PREZZO)
3. ✅ **IGNORA la colonna CONTENUTA** (4a colonna)
4. ✅ Mantieni i decimali (54,18 → 54.18)
5. ✅ Converti virgola in punto (54,18 → 54.18)
6. ✅ L'unità di misura è nella colonna COLLI (es: "2 KG" → unit: "KG", "9 NR" → unit: "NR")
7. ✅ La chiave dell'oggetto è il codice articolo (71G, CIA13, etc.)
8. ✅ IGNORA completamente la pagina 1 (documento trasporto)

## 🔍 Come Identificare la Colonna FATTURATA

**Posizione colonne** (da sinistra a destra):
```
1. ARTICOLO (codice)
2. DESCRIZIONE
3. COLLI (es: "2 KG", "9 NR")
4. CONTENUTA ← ❌ NON questa!
5. FATTURATA ← ✅ Questa è la colonna giusta!
6. PREZZO
7. IMPORTO
```

**La colonna FATTURATA è quella**:
- Dopo CONTENUTA
- Prima del PREZZO
- Di solito la 5a colonna

## ⚠️ Errori da Evitare

❌ **Errore #1**: Prendere quantità da CONTENUTA
```json
// SBAGLIATO
{ "CIA13": { "quantity": 36.0 } }  // Preso da CONTENUTA

// CORRETTO
{ "CIA13": { "quantity": 54.18 } } // Preso da FATTURATA
```

❌ **Errore #2**: Perdere i decimali
```json
// SBAGLIATO
{ "quantity": 54 }     // Perso il .18

// CORRETTO
{ "quantity": 54.18 }  // Mantiene decimali
```

❌ **Errore #3**: Non convertire virgola in punto
```json
// SBAGLIATO
{ "quantity": "54,18" }  // Stringa con virgola

// CORRETTO
{ "quantity": 54.18 }    // Numero con punto
```

## 🧪 Test di Validità

Prima di rispondere, verifica:
- [ ] Ho letto le pagine 2-3-4 (fattura)?
- [ ] Ho estratto quantità dalla colonna FATTURATA (5a colonna)?
- [ ] NON ho usato la colonna CONTENUTA (4a colonna)?
- [ ] I decimali sono mantenuti (54,18 → 54.18)?
- [ ] L'unità è corretta (KG, NR, PZ)?
- [ ] La descrizione è completa?

## 📤 Formato Output Finale

```json
{
  "quantities_map": {
    "CODICE_ARTICOLO": {
      "quantity": 0.0,
      "unit": "KG o NR o PZ",
      "description": "Nome prodotto completo"
    }
  }
}
```

**IMPORTANTE**: Rispondi SOLO con il JSON. NESSUN altro testo!
