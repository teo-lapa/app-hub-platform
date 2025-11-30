# DIAGNOSI: Perché "DGD Gastro GmbH" non viene trovato dalla ricerca

## PROBLEMA IDENTIFICATO

**"DGD Gastro GmbH" ha `customer_rank = 0`**, quindi viene BLOCCATO dal filtro `customer_rank > 0` nella ricerca.

---

## DATI COMPLETI "DGD Gastro GmbH" (ID: 10136)

```json
{
  "id": 10136,
  "name": "DGD Gastro GmbH",
  "customer_rank": 0,  ← PROBLEMA QUI!
  "is_company": true,
  "type": "contact",
  "active": true,
  "parent_id": null,
  "team_id": [9, "I Campioni del Gusto"],
  "email": "info@pizza-amore.ch",
  "phone": null,
  "city": "Rüschlikon"
}
```

---

## RISULTATI TEST

### TEST 1: Ricerca BASE - Solo nome "DGD"
**Domain:** `[['name', 'ilike', 'DGD']]`
**Risultato:** ✅ Trovati 3 record
- DGD Gastro GmbH (ID: 10136)
- DGD Gastro GmbH (Fatturazione) (ID: 10137)
- KEK Restaurant Küsnacht C/o DGD GastroGmbH (Consegna) (ID: 10138)

### TEST 2: Ricerca con customer_rank > 0
**Domain:** `[['name', 'ilike', 'DGD'], ['customer_rank', '>', 0]]`
**Risultato:** ❌ Trovati 0 record
**DIAGNOSI:** Il filtro `customer_rank > 0` BLOCCA il risultato perché "DGD Gastro GmbH" ha `customer_rank = 0`

### TEST 3: Ricerca con is_company = true
**Domain:** `[['name', 'ilike', 'DGD'], ['is_company', '=', true]]`
**Risultato:** ✅ Trovati 1 record (DGD Gastro GmbH)

### TEST 4: Ricerca con type = 'contact'
**Domain:** `[['name', 'ilike', 'DGD'], ['type', '=', 'contact']]`
**Risultato:** ✅ Trovati 1 record (DGD Gastro GmbH)

### TEST 5: Ricerca con active = true
**Domain:** `[['name', 'ilike', 'DGD'], ['active', '=', true]]`
**Risultato:** ✅ Trovati 3 record

### TEST 6: Combinazione customer_rank > 0 E is_company = true
**Domain:** `[['name', 'ilike', 'DGD'], ['customer_rank', '>', 0], ['is_company', '=', true]]`
**Risultato:** ❌ Trovati 0 record
**DIAGNOSI:** Il filtro `customer_rank > 0` BLOCCA il risultato

### TEST 7: Domain COMPLESSO (API route attuale)
**Domain:**
```javascript
[
  ['customer_rank', '>', 0],  // ← QUESTO BLOCCA!
  '|',
    ['is_company', '=', true],
    '&',
      ['is_company', '=', false],
      ['type', '=', 'contact'],
  '|', '|', '|', '|',
  ['name', 'ilike', 'DGD'],
  ['email', 'ilike', 'DGD'],
  ['phone', 'ilike', 'DGD'],
  ['mobile', 'ilike', 'DGD'],
  ['city', 'ilike', 'DGD']
]
```
**Risultato:** ❌ Trovati 0 record
**DIAGNOSI:** Il filtro `customer_rank > 0` all'inizio del domain BLOCCA "DGD Gastro GmbH"

---

## ANALISI DEI FILTRI

| Filtro | Stato | Note |
|--------|-------|------|
| `customer_rank > 0` | ❌ BLOCCA | DGD Gastro GmbH ha `customer_rank = 0` |
| `is_company = true` | ✅ OK | DGD Gastro GmbH ha `is_company = true` |
| `type = 'contact'` | ✅ OK | DGD Gastro GmbH ha `type = 'contact'` |
| `active = true` | ✅ OK | DGD Gastro GmbH ha `active = true` |

---

## CAUSA ROOT

**"DGD Gastro GmbH" è un'AZIENDA ma non ha mai effettuato ordini**, quindi:
- `customer_rank = 0` (non è considerato "cliente attivo")
- Il filtro `customer_rank > 0` nell'API `/api/clienti/search` lo esclude

---

## SOLUZIONI POSSIBILI

### SOLUZIONE 1: Rimuovere il filtro `customer_rank > 0` (CONSIGLIATA)
Questo permetterà di trovare TUTTE le aziende e contatti, anche quelli senza ordini.

**PRO:**
- Trova tutte le aziende registrate in Odoo
- Utile per aggiungere clienti al catalogo anche se non hanno mai ordinato

**CONTRO:**
- Restituisce anche aziende/contatti mai usati (possibile "rumore")

**Modifica richiesta in `app/api/clienti/search/route.ts`:**
```typescript
// PRIMA (riga 114):
['customer_rank', '>', 0],  // ← RIMUOVERE QUESTA RIGA

// DOPO:
// Nessun filtro su customer_rank
```

---

### SOLUZIONE 2: Usare `customer_rank >= 0` invece di `> 0`
Questo include anche le aziende con `customer_rank = 0`.

**PRO:**
- Più esplicito che vogliamo includere anche clienti senza ordini

**CONTRO:**
- Stesso effetto di rimuovere il filtro

**Modifica richiesta in `app/api/clienti/search/route.ts`:**
```typescript
// PRIMA (riga 114):
['customer_rank', '>', 0],

// DOPO:
['customer_rank', '>=', 0],
```

---

### SOLUZIONE 3: Gestire `customer_rank` come NULL-safe
Alcuni record potrebbero avere `customer_rank = null` invece di `0`.

**Modifica richiesta:**
```typescript
'|',  // OR
  ['customer_rank', '>', 0],      // Clienti attivi
  ['customer_rank', '=', false],  // Clienti mai usati (null/false)
```

---

## QUERY CORRETTA PER TROVARE "DGD Gastro GmbH"

```javascript
// Ricerca minimalista (solo nome)
[
  ['name', 'ilike', 'DGD'],
  ['is_company', '=', true]
]
```

Oppure per includere TUTTI i clienti (con e senza ordini):

```javascript
// Ricerca SENZA filtro customer_rank
[
  // NESSUN filtro customer_rank

  // Logica OR: Aziende O Contatti veri (NO indirizzi)
  '|',
    ['is_company', '=', true],
    '&',
      ['is_company', '=', false],
      ['type', '=', 'contact'],

  // Ricerca testuale
  '|', '|', '|', '|',
  ['name', 'ilike', query],
  ['email', 'ilike', query],
  ['phone', 'ilike', query],
  ['mobile', 'ilike', query],
  ['city', 'ilike', query]
]
```

---

## IMPATTO TOTALE

**ATTENZIONE:** Non è solo "DGD Gastro GmbH" ad essere bloccato!

### Analisi completa database Odoo:
- **3360 clienti TOTALI** hanno `customer_rank = 0`
- Tutti questi clienti sono **INVISIBILI** nella ricerca attuale
- Include sia **aziende** che **contatti** registrati ma mai usati

### Campione analizzato (primi 100):
- **29 Aziende** bloccate
- **71 Contatti** bloccati
- **85% senza team** assegnato (probabilmente clienti importati o mai attivati)

### Esempi di clienti bloccati:
- DGD Gastro GmbH (Rüschlikon)
- A TAVOLA JEANNERET (Peseux)
- ADA Gastro GmbH (Rickenbach)
- ACCADEMIA DEL GUSTO GMBH (Zürich)
- E altri 3356 clienti...

---

## AZIONI CONSIGLIATE

### 1. **IMMEDIATO:** Rimuovere il filtro `customer_rank > 0`

Questo è **CRITICO** perché:
- Blocca 3360 clienti (potenzialmente il 50-70% del database!)
- Impedisce di trovare nuovi clienti o clienti occasionali
- Rende impossibile aggiungere clienti al catalogo se non hanno mai ordinato

### 2. **OPZIONALE:** Aggiungere toggle UI "Solo clienti attivi"

Se vuoi mantenere la possibilità di filtrare per clienti attivi:
```typescript
// In CustomerSelector.tsx
const [onlyActiveCustomers, setOnlyActiveCustomers] = useState(false);

// Aggiungi parametro alla query
const searchUrl = `/api/clienti/search?q=${query}&active_only=${onlyActiveCustomers}`;
```

### 3. **IMPORTANTE:** Verificare la qualità dei dati

Con 3360 clienti con `customer_rank = 0`:
- Alcuni potrebbero essere duplicati
- Altri potrebbero essere test/demo
- Molti potrebbero essere clienti legittimi mai attivati

---

## FILE GENERATI

1. **`diagnosi-dgd-gastro-v2.js`** - Script diagnostico completo per "DGD Gastro GmbH"
2. **`DIAGNOSI_DGD_GASTRO.json`** - Dati completi di tutte le ricerche (1.2MB)
3. **`trova-altri-clienti-bloccati.js`** - Script per trovare tutti i clienti con `customer_rank = 0`
4. **`CLIENTI_BLOCCATI_customer_rank_0.json`** - Lista dei primi 100 clienti bloccati
5. **`REPORT_DIAGNOSI_DGD_GASTRO.md`** - Questo report

---

## RIEPILOGO ESECUTIVO

### Problema
Il filtro `customer_rank > 0` nella ricerca clienti blocca **3360 clienti** che hanno `customer_rank = 0`, tra cui "DGD Gastro GmbH".

### Causa
I clienti con `customer_rank = 0` sono aziende/contatti registrati in Odoo ma che **non hanno mai effettuato ordini**.

### Soluzione immediata
Rimuovere la riga 114 in `C:\Users\lapa\OneDrive\Desktop\Claude Code\app\api\clienti\search\route.ts`:
```typescript
['customer_rank', '>', 0],  // ← RIMUOVERE QUESTA RIGA
```

### Impatto
- ✅ "DGD Gastro GmbH" diventerà ricercabile
- ✅ Altri 3359 clienti diventeranno visibili
- ✅ Sarà possibile aggiungere nuovi clienti al catalogo anche se non hanno mai ordinato
- ⚠️ La lista dei risultati potrebbe includere clienti mai usati (filtro opzionale consigliato)

---

**Data:** 2025-11-10
**Autore:** Claude Code Agent
**Clienti bloccati identificati:** 3360
**File di analisi:** 5
