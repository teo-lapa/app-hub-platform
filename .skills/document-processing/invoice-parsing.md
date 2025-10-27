---
name: invoice-parsing
version: 1.4.0
description: Estrae dati strutturati da fatture fornitori per arrivi merce
category: document-processing
tags: [parsing, invoice, pdf, vision, ocr]
model: claude-3-5-sonnet-20241022
author: Lapa Team
created: 2025-01-15
updated: 2025-01-27
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

### 🧀 REGOLA #8: Auricchio - Colonna FATTURATA vs CONTENUTA (CRITICA!)

**Fornitore specifico**: GENNARO AURICCHIO S.P.A. / AURICCHIO

#### 🚨 PROBLEMA SPECIFICO

Le fatture Auricchio hanno una struttura tabellare particolare con **DUE colonne di quantità**:

1. **Colonna "CONTENUTA"**: Peso/pezzi contenuti nell'imballo (peso lordo o pezzi reali)
2. **Colonna "FATTURATA"**: Quantità effettivamente fatturata e da registrare in magazzino ← **QUESTA È QUELLA GIUSTA!**

**Layout tipico fattura Auricchio**:
```
ARTICOLO  DESCRIZIONE                  COLLI  CONTENUTA  FATTURATA  PREZZO
71G       PECORINO ROMANO...           2 KG   20,00 NR   20         18,00
CIA13     GORGONZOLA SANGIORGIO...     9 NR   36 KG      54,18      8,36
E708      PEC.ROMANO F.1 CAPPA NERA    1 NR   1 KG       21,85      17,10
```

#### ⚠️ Errore Comune

❌ **SBAGLIATO**: Estrarre quantità dalla colonna "CONTENUTA"
```json
{
  "article_code": "CIA13",
  "description": "GORGONZOLA SANGIORGIO 4 VASC.1/8 TS",
  "quantity": 36.0,  // ❌ ERRATO! Questo è "CONTENUTA"
  "unit": "KG"
}
```

✅ **CORRETTO**: Estrarre quantità dalla colonna "FATTURATA"
```json
{
  "article_code": "CIA13",
  "description": "GORGONZOLA SANGIORGIO 4 VASC.1/8 TS",
  "quantity": 54.18,  // ✅ CORRETTO! Questo è "FATTURATA"
  "unit": "KG"
}
```

#### 🎯 Regola di Identificazione

**Come riconoscere una fattura Auricchio**:
- Fornitore contiene: "AURICCHIO" o "GENNARO AURICCHIO"
- Header tabella contiene le colonne: "CONTENUTA" e "FATTURATA"
- Documento di trasporto con struttura simile

**Quando applicare questa regola**:
```
SE fornitore == "AURICCHIO" O "GENNARO AURICCHIO S.P.A.":
  → Cerca colonna "QUANTITA' FATTURATA" (o solo "FATTURATA")
  → Ignora colonna "CONTENUTA"
  → La colonna FATTURATA è tipicamente quella PIÙ A DESTRA nella tabella
```

#### 📊 Esempi Pratici

**Esempio 1: Pecorino Romano**
```
Input fattura:
ARTICOLO: 71G
DESCRIZIONE: PECORINO ROMANO DOP GRATTUGIATO FRESCO - 10 BUSTER KG 1
COLLI: 2 KG
CONTENUTA: 20,00 NR
FATTURATA: 20

Output JSON corretto:
{
  "article_code": "71G",
  "description": "PECORINO ROMANO DOP GRATTUGIATO FRESCO - 10 BUSTER KG 1",
  "quantity": 20.0,    // ← Dalla colonna FATTURATA
  "unit": "NR",        // ← Deriva da "COLLI: 2 KG" → unit principale
  "lot_number": "5275MM2",
  "expiry_date": "2026-08-02"
}
```

**Esempio 2: Gorgonzola**
```
Input fattura:
ARTICOLO: CIA13
DESCRIZIONE: GORGONZOLA SANGIORGIO 4 VASC.1/8 TS
COLLI: 9 NR
CONTENUTA: 36 KG     ← NON questa!
FATTURATA: 54,18     ← QUESTA!

Output JSON corretto:
{
  "article_code": "CIA13",
  "description": "GORGONZOLA SANGIORGIO 4 VASC.1/8 TS",
  "quantity": 54.18,   // ← Dalla colonna FATTURATA
  "unit": "KG",
  "lot_number": "2595225H2",
  "expiry_date": "2025-12-19"
}
```

**Esempio 3: Prodotto senza decimali**
```
Input fattura:
ARTICOLO: E708
DESCRIZIONE: PEC.ROMANO F.1 CAPPA NERA
COLLI: 1 NR
CONTENUTA: 1 KG      ← NON questa!
FATTURATA: 21,85     ← QUESTA!

Output JSON corretto:
{
  "article_code": "E708",
  "description": "PEC.ROMANO F.1 CAPPA NERA",
  "quantity": 21.85,   // ← Dalla colonna FATTURATA (con decimali!)
  "unit": "KG"
}
```

#### 🔍 Posizionamento Colonne

**Ordine tipico delle colonne in fattura Auricchio** (da sinistra a destra):
1. ARTICOLO (codice)
2. DESCRIZIONE
3. COLLI (tipo: "2 KG", "9 NR")
4. CONTENUTA ← ❌ NON usare
5. **FATTURATA** ← ✅ USA QUESTA!
6. PREZZO
7. IMPORTO

**Keyword per identificare la colonna giusta**:
- "QUANTITA' FATTURATA"
- "FATTURATA"
- "QTÀ FATTURATA"
- È la colonna **prima del PREZZO** e **dopo CONTENUTA**

#### 🧠 Strategia di Estrazione

```
PASSO 1: Identifica se è fattura Auricchio
  - Cerca "AURICCHIO" nel nome fornitore
  - Cerca header tabella con "CONTENUTA" e "FATTURATA"

PASSO 2: Se è Auricchio
  → Localizza colonna "FATTURATA" (di solito 5a colonna)
  → Estrai il valore da quella colonna
  → Ignora completamente colonna "CONTENUTA"

PASSO 3: Se NON è Auricchio
  → Usa le regole normali (REGOLA #1)
```

#### ⚠️ Casi Speciali

**Caso 1: Valori coincidenti**
```
CONTENUTA: 20,00
FATTURATA: 20

→ In questo caso i valori sono uguali, ma usa sempre FATTURATA
```

**Caso 2: Valori molto diversi**
```
CONTENUTA: 36 KG
FATTURATA: 54,18

→ È normale! La fatturata include peso netto effettivo
→ Usa FATTURATA: 54.18
```

**Caso 3: Fatturata con decimali, Contenuta senza**
```
CONTENUTA: 1 KG
FATTURATA: 21,85

→ Usa FATTURATA: 21.85 (mantieni i decimali!)
```

#### ✅ Checklist Validazione

Prima di estrarre quantità da fattura Auricchio, verifica:

- [ ] Ho identificato correttamente che è una fattura Auricchio?
- [ ] Ho localizzato la colonna "FATTURATA"?
- [ ] Sto usando il valore dalla colonna FATTURATA e NON da CONTENUTA?
- [ ] Ho mantenuto i decimali se presenti (es: 54,18 → 54.18)?
- [ ] L'unità di misura è coerente con la descrizione prodotto?

#### 🚫 Errori da Evitare

❌ **Errore 1**: Confondere CONTENUTA con FATTURATA
```json
// SBAGLIATO
{ "quantity": 36.0 }   // Preso da CONTENUTA

// CORRETTO
{ "quantity": 54.18 }  // Preso da FATTURATA
```

❌ **Errore 2**: Perdere i decimali
```json
// SBAGLIATO
{ "quantity": 54 }     // Perso il .18

// CORRETTO
{ "quantity": 54.18 }  // Mantiene decimali
```

❌ **Errore 3**: Non riconoscere Auricchio
```
// Se non riconosci Auricchio, userai le regole normali
// e rischierai di prendere CONTENUTA invece di FATTURATA
```

✅ **Best Practice**:
- Controlla SEMPRE il nome fornitore all'inizio
- Se è Auricchio, cerca esplicitamente "FATTURATA"
- Mantieni massima precisione nei decimali

#### 🔗 LINK LOTTI E SCADENZE DA TABELLA DETTAGLIO (CRITICO!)

**PROBLEMA**: Nei documenti Auricchio, le **quantità** sono nella FATTURA (pagine 2-3) ma i **lotti e scadenze** sono nel **DOCUMENTO DI TRASPORTO** (pagina 1)!

#### 📄 Struttura Documento Auricchio

**Pagina 1 - DOCUMENTO DI TRASPORTO**:
```
DETTAGLIO ARTICOLI PER LOTTO/PALLET

Articolo  Peso   Quantità  Lotto        Pallet/SSCC         Scadenza    EAN
71G       20,00  2         5275MM2      080046030481...     08/02/26    080046030...
CIA13     54,18  9         2595225H2    080046030481...     19/12/25    980046030...
E708      21,85  1         1000566879   080046030481...                 980046030...
E721      6,72   1         1000566880   080046030481...                 980046030...
```

**Pagine 2-3 - FATTURA**:
```
ARTICOLO  DESCRIZIONE                  COLLI  CONTENUTA  FATTURATA  PREZZO
71G       PECORINO ROMANO...           2 KG   20,00 NR   20         18,00
CIA13     GORGONZOLA SANGIORGIO...     9 NR   36 KG      54,18      8,36
E708      PEC.ROMANO F.1 CAPPA NERA    1 NR   1 KG       21,85      17,10
```

**NOTA**: La fattura **NON contiene lotti e scadenze**! Devi prenderli dalla tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET"!

#### 🎯 Strategia di Linking

```
PASSO 1: Identifica il documento Auricchio
  - Fornitore contiene "AURICCHIO"
  - Cerca la tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET" (di solito pagina 1)

PASSO 2: Estrai la tabella dettaglio
  - Colonne: Articolo, Peso, Quantità, Lotto, Scadenza
  - Crea una mappa: { codice_articolo → { lotto, scadenza } }

PASSO 3: Estrai i prodotti dalla fattura (pagine 2-3)
  - Quantità dalla colonna FATTURATA
  - Descrizione, codice articolo

PASSO 4: MATCH per codice articolo
  - Per ogni prodotto nella fattura, cerca il suo codice nella tabella dettaglio
  - Aggiungi lot_number e expiry_date dalla tabella dettaglio

PASSO 5: Formato data scadenza
  - Input: "08/02/26" → Output: "2026-02-08"
  - Input: "19/12/25" → Output: "2025-12-19"
```

#### 📊 Esempio Completo di Linking

**Input - Tabella Dettaglio (Pagina 1)**:
```
71G    | Lotto: 5275MM2    | Scadenza: 08/02/26
CIA13  | Lotto: 2595225H2  | Scadenza: 19/12/25
E708   | Lotto: 1000566879 | Scadenza: (vuota)
```

**Input - Fattura (Pagina 2)**:
```
71G    | PECORINO ROMANO... | FATTURATA: 20
CIA13  | GORGONZOLA...      | FATTURATA: 54,18
E708   | PEC.ROMANO...      | FATTURATA: 21,85
```

**Output JSON Corretto (con linking)**:
```json
{
  "products": [
    {
      "article_code": "71G",
      "description": "PECORINO ROMANO DOP GRATTUGIATO FRESCO - 10 BUSTER KG 1",
      "quantity": 20.0,
      "unit": "NR",
      "lot_number": "5275MM2",       // ← Dalla tabella dettaglio!
      "expiry_date": "2026-02-08"    // ← Dalla tabella dettaglio! (convertito)
    },
    {
      "article_code": "CIA13",
      "description": "GORGONZOLA SANGIORGIO 4 VASC.1/8 TS",
      "quantity": 54.18,
      "unit": "KG",
      "lot_number": "2595225H2",     // ← Dalla tabella dettaglio!
      "expiry_date": "2025-12-19"    // ← Dalla tabella dettaglio! (convertito)
    },
    {
      "article_code": "E708",
      "description": "PEC.ROMANO F.1 CAPPA NERA",
      "quantity": 21.85,
      "unit": "KG",
      "lot_number": "1000566879",    // ← Dalla tabella dettaglio!
      "expiry_date": null             // ← Scadenza vuota nella tabella
    }
  ]
}
```

#### 🔍 Come Trovare la Tabella Dettaglio

**Keyword da cercare nella pagina 1**:
- "DETTAGLIO ARTICOLI PER LOTTO/PALLET"
- "DETTAGLIO ARTICOLI PER LOTTO"
- Header colonne: "Articolo | Peso | Quantità | Lotto | Scadenza"

**Caratteristiche della tabella**:
- È nella **prima pagina** del documento
- Ha sempre le colonne: Articolo, Lotto, Scadenza
- I codici articolo (71G, CIA13, E708) corrispondono a quelli nella fattura

#### ⚠️ Casi Speciali

**Caso 1: Lotto presente, scadenza vuota**
```
E708 | Lotto: 1000566879 | Scadenza: (vuota)

→ lot_number: "1000566879"
→ expiry_date: null
```

**Caso 2: Stesso prodotto, lotti multipli**
```
Se nella tabella dettaglio trovi:
71G | Lotto: A123 | Scadenza: 08/02/26
71G | Lotto: B456 | Scadenza: 10/03/26

Nella fattura trovi:
71G | FATTURATA: 40

→ Crea DUE prodotti nel JSON:
  - 71G, lotto A123, quantity: 20
  - 71G, lotto B456, quantity: 20
```

**Caso 3: Codice articolo non trovato nella tabella**
```
Fattura ha: E721 | FATTURATA: 6,72
Tabella dettaglio: NON ha E721

→ lot_number: null
→ expiry_date: null
→ (meglio che niente, almeno registri il prodotto)
```

#### 🚨 Errori da Evitare

❌ **Errore #1**: Ignorare la tabella dettaglio
```json
// SBAGLIATO
{
  "article_code": "71G",
  "quantity": 20.0,
  "lot_number": null,        // ❌ Ignorato!
  "expiry_date": null        // ❌ Ignorato!
}

// CORRETTO
{
  "article_code": "71G",
  "quantity": 20.0,
  "lot_number": "5275MM2",   // ✅ Dalla tabella dettaglio
  "expiry_date": "2026-02-08" // ✅ Dalla tabella dettaglio
}
```

❌ **Errore #2**: Non convertire formato data
```json
// SBAGLIATO
{ "expiry_date": "08/02/26" }  // ❌ Formato italiano

// CORRETTO
{ "expiry_date": "2026-02-08" } // ✅ YYYY-MM-DD
```

❌ **Errore #3**: Non matchare per codice articolo
```
// Non assumere che l'ordine sia lo stesso!
// Matcha SEMPRE per codice articolo (71G, CIA13, etc.)
```

#### ✅ Checklist Linking

Prima di generare il JSON finale, verifica:

- [ ] Ho trovato la tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET"?
- [ ] Ho estratto lotti e scadenze per ogni codice articolo?
- [ ] Ho matchato correttamente fattura ↔ tabella dettaglio per codice?
- [ ] Ho convertito le date in formato YYYY-MM-DD?
- [ ] Se un codice non ha match, ho lasciato lot_number e expiry_date a null?

#### 📍 Posizione Tabella nel PDF

```
Pagina 1 (Documento Trasporto):
├── Header (GENNARO AURICCHIO S.P.A.)
├── Dati spedizione
├── DETTAGLIO ARTICOLI PER LOTTO/PALLET ← QUI!
│   ├── Articolo | Peso | Quantità | Lotto | Scadenza
│   ├── 71G      | 20,00| 2        | 5275MM2 | 08/02/26
│   ├── CIA13    | 54,18| 9        | 2595225H2 | 19/12/25
│   └── ...
└── Footer

Pagine 2-3 (Fattura):
├── ARTICOLO | DESCRIZIONE | COLLI | CONTENUTA | FATTURATA ← Quantità qui
└── ...
```

#### 🧠 Algoritmo di Estrazione Completo

```
1. Analizza TUTTE le pagine del documento
2. Identifica fornitore: "AURICCHIO"
3. Cerca tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET" (pagina 1)
4. Crea mappa lotti:
   map_lotti = {
     "71G": { lotto: "5275MM2", scadenza: "08/02/26" },
     "CIA13": { lotto: "2595225H2", scadenza: "19/12/25" },
     ...
   }
5. Estrai prodotti dalla fattura (pagine 2-3):
   - Codice articolo
   - Descrizione
   - Quantità da colonna FATTURATA
6. Per ogni prodotto:
   - Cerca codice in map_lotti
   - Aggiungi lot_number e expiry_date (se trovati)
   - Converti data scadenza in YYYY-MM-DD
7. Genera JSON finale
```

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

### v1.4.0 (2025-01-27)
- ✅ **REGOLA #8 EXTENDED**: Auricchio - Linking lotti/scadenze da tabella dettaglio
- ✅ Algoritmo multi-page: estrae lotti da pagina 1, quantità da pagine 2-3
- ✅ Matching automatico fattura ↔ documento trasporto per codice articolo
- ✅ Supporto tabella "DETTAGLIO ARTICOLI PER LOTTO/PALLET"
- ✅ Conversione automatica date scadenza (GG/MM/AA → YYYY-MM-DD)
- ✅ Gestione prodotti multi-lotto nella stessa fattura

### v1.3.0 (2025-01-27)
- ✅ **REGOLA #8**: Auricchio - Gestione colonne FATTURATA vs CONTENUTA
- ✅ Riconoscimento automatico fatture Auricchio
- ✅ Estrazione corretta quantità dalla colonna "FATTURATA"
- ✅ Supporto decimali e precisione per formaggi Auricchio
- ✅ Prevenzione errore estrazione da colonna "CONTENUTA"

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
