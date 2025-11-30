# DOCUMENTAZIONE COMPLETA LISTINI PREZZI ODOO

**Data analisi:** 2025-11-08
**Ambiente:** Odoo Staging (lapadevadmin-lapa-v2-main-7268478.dev.odoo.com)
**Stato:** Analisi in corso - Dati parziali

---

## INDICE

1. [Panoramica Sistema Listini](#1-panoramica-sistema-listini)
2. [Modello product.pricelist](#2-modello-productpricelist)
3. [Modello product.pricelist.item](#3-modello-productpricelistitem)
4. [Collegamento Partner-Listino](#4-collegamento-partner-listino)
5. [Modello sale.order e sale.order.line](#5-modello-saleorder-e-saleorderline)
6. [Logica di Calcolo Prezzi](#6-logica-di-calcolo-prezzi)
7. [Esempi Pratici e API](#7-esempi-pratici-e-api)
8. [Best Practices](#8-best-practices)

---

## 1. PANORAMICA SISTEMA LISTINI

Odoo utilizza un sistema di **listini prezzi** (pricelists) molto flessibile che permette di:

- Definire prezzi diversi per clienti diversi
- Applicare sconti in base alla quantità
- Creare regole di prezzo per prodotti specifici, categorie o globalmente
- Gestire validità temporale dei prezzi
- Applicare margini minimi e massimi

### Statistiche Sistema

- **326 listini** attivi trovati nel sistema
- Maggioranza dei listini con `discount_policy: "with_discount"`
- Alcuni listini specifici con `discount_policy: "without_discount"`
- Listini per fasce di prezzo (0-5m, 5m-10m, 10m-20m, 20m-più)
- Listini specifici per cliente/gruppo

---

## 2. MODELLO product.pricelist

### Campi Principali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | number | ID univoco del listino |
| `name` | string | Nome del listino (es: "Public Pricelist", "Listino 0-5m") |
| `active` | boolean | Se il listino è attivo |
| `currency_id` | array | Valuta del listino (es: [1, "CHF"]) |
| `company_id` | boolean/array | Azienda associata |
| `discount_policy` | string | Politica sconto: "with_discount" o "without_discount" |
| `item_ids` | array | IDs delle regole di prezzo associate |
| `sequence` | number | Ordine di visualizzazione |
| `code` | boolean | Codice del listino |
| `country_group_ids` | array | Gruppi di paesi per cui è valido |

### Campi Aggiuntivi

- **Messaggi e Attività**:
  - `message_ids`, `message_follower_ids`
  - `activity_ids`, `activity_state`
  - `message_has_error`, `message_needaction`

- **Metadata**:
  - `create_date`, `write_date`
  - `create_uid`, `write_uid`
  - `display_name`

- **Website**:
  - `website_id`, `website_message_ids`
  - `selectable` (se selezionabile sul sito web)

### Esempi Reali

```json
{
  "id": 1,
  "name": "Public Pricelist",
  "active": true,
  "currency_id": [3, "CHF"],
  "discount_policy": "with_discount",
  "item_ids": [1223] // 1223 regole
}

{
  "id": 956,
  "name": "AMA MARTINUCCI AG",
  "active": true,
  "currency_id": [3, "CHF"],
  "company_id": [1, "LAPA - finest italian food GmbH"],
  "discount_policy": "with_discount",
  "item_ids": [245] // 245 regole
}

{
  "id": 1033,
  "name": "HALTEN GASTRO GMBH",
  "active": true,
  "currency_id": [3, "CHF"],
  "discount_policy": "with_discount",
  "item_ids": [401] // 401 regole - listino più ricco
}
```

### Valori discount_policy

- **`with_discount`**: Il prezzo mostrato include lo sconto, ma il campo `discount` viene compilato nella riga ordine
- **`without_discount`**: Il prezzo finale è quello calcolato, senza mostrare lo sconto come percentuale separata

---

## 3. MODELLO product.pricelist.item

Le **regole di prezzo** (pricelist items) determinano come i prezzi vengono calcolati.

### Campi Fondamentali

| Campo | Tipo | Descrizione | Valori Possibili |
|-------|------|-------------|------------------|
| `pricelist_id` | array | Listino a cui appartiene | [id, "nome"] |
| `applied_on` | string | Dove si applica la regola | "0_product_variant", "1_product", "2_product_category", "3_global" |
| `compute_price` | string | Come calcolare il prezzo | "fixed", "percentage", "formula" |
| `min_quantity` | number | Quantità minima per applicare la regola | 0, 1, 10, 100, etc. |

### Campi di Targeting

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `product_id` | array/false | Prodotto specifico (variant) |
| `product_tmpl_id` | array/false | Template prodotto |
| `categ_id` | array/false | Categoria prodotto |

### Campi di Calcolo

| Campo | Tipo | Descrizione | Quando Usarlo |
|-------|------|-------------|---------------|
| `base` | string | Base di calcolo | "list_price", "standard_price", "pricelist" |
| `fixed_price` | number | Prezzo fisso | Quando `compute_price = "fixed"` |
| `percent_price` | number | Percentuale sul prezzo base | Quando `compute_price = "percentage"` |
| `price_discount` | number | Sconto percentuale | Quando `compute_price = "formula"` |
| `price_surcharge` | number | Sovrapprezzo fisso | Quando `compute_price = "formula"` |
| `price_min_margin` | number | Margine minimo richiesto | Opzionale |
| `price_max_margin` | number | Margine massimo consentito | Opzionale |

### Campi Temporali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `date_start` | string/false | Data inizio validità (YYYY-MM-DD) |
| `date_end` | string/false | Data fine validità (YYYY-MM-DD) |

### Valori del Campo `applied_on`

- **`3_global`**: Regola globale applicata a tutti i prodotti
- **`2_product_category`**: Regola applicata a una categoria specifica
- **`1_product`**: Regola applicata a un template prodotto
- **`0_product_variant`**: Regola applicata a una variante specifica (massima priorità)

### Valori del Campo `compute_price`

- **`fixed`**: Prezzo fisso definito in `fixed_price`
- **`percentage`**: Calcola come `base_price * (percent_price / 100)`
- **`formula`**: Calcola come `base_price * (1 - price_discount/100) + price_surcharge`

### Valori del Campo `base`

- **`list_price`**: Usa il prezzo di listino del prodotto (`product.list_price`)
- **`standard_price`**: Usa il costo standard del prodotto (`product.standard_price`)
- **`pricelist`**: Usa il prezzo di un altro listino

### Esempi di Regole Reali

#### Esempio 1: Prezzo fisso per prodotto specifico
```json
{
  "id": 12345,
  "pricelist_id": [956, "AMA MARTINUCCI AG"],
  "applied_on": "0_product_variant",
  "product_id": [24448, "OLIO EVO 100% ITALIANO LT.5"],
  "min_quantity": 1,
  "compute_price": "fixed",
  "fixed_price": 45.50,
  "base": "list_price"
}
```
**Significato**: Per il prodotto ID 24448, il prezzo è sempre 45.50 CHF

#### Esempio 2: Sconto percentuale su categoria
```json
{
  "id": 12346,
  "pricelist_id": [1, "Public Pricelist"],
  "applied_on": "2_product_category",
  "categ_id": [15, "Olio"],
  "min_quantity": 1,
  "compute_price": "percentage",
  "percent_price": 90,
  "base": "list_price"
}
```
**Significato**: Tutti i prodotti della categoria "Olio" sono venduti al 90% del prezzo di listino (sconto 10%)

#### Esempio 3: Sconto quantità
```json
{
  "id": 12347,
  "pricelist_id": [1, "Public Pricelist"],
  "applied_on": "0_product_variant",
  "product_id": [24448, "OLIO EVO 100% ITALIANO LT.5"],
  "min_quantity": 10,
  "compute_price": "formula",
  "price_discount": 15,
  "price_surcharge": 0,
  "base": "list_price"
}
```
**Significato**: Ordinando 10+ pezzi del prodotto, si ottiene il 15% di sconto

#### Esempio 4: Formula con sovrapprezzo
```json
{
  "id": 12348,
  "pricelist_id": [3, "CARBONARIUM PRICE LIST"],
  "applied_on": "3_global",
  "min_quantity": 1,
  "compute_price": "formula",
  "price_discount": 0,
  "price_surcharge": 5.00,
  "base": "list_price"
}
```
**Significato**: Tutti i prodotti hanno un sovrapprezzo di 5 CHF rispetto al listino

---

## 4. COLLEGAMENTO PARTNER-LISTINO

### Campo in res.partner

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `property_product_pricelist` | array | Listino assegnato al cliente [id, "nome"] |

### Esempio

```json
{
  "id": 12345,
  "name": "AMA MARTINUCCI AG",
  "customer_rank": 1,
  "supplier_rank": 0,
  "property_product_pricelist": [956, "AMA MARTINUCCI AG"]
}
```

### Come Funziona

1. Quando si crea un ordine di vendita per un cliente
2. Odoo legge `partner.property_product_pricelist`
3. Assegna quel listino al campo `sale_order.pricelist_id`
4. Tutte le righe ordine useranno quel listino per calcolare i prezzi

---

## 5. MODELLO sale.order e sale.order.line

### sale.order - Campi Listino

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `pricelist_id` | array | Listino utilizzato per l'ordine |
| `partner_id` | array | Cliente dell'ordine |
| `currency_id` | array | Valuta (derivata dal listino) |

### sale.order.line - Campi Prezzo

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `product_id` | array | Prodotto ordinato |
| `product_uom_qty` | number | Quantità ordinata |
| `product_uom` | array | Unità di misura |
| `price_unit` | number | Prezzo unitario applicato |
| `discount` | number | Sconto percentuale applicato |
| `price_subtotal` | number | Subtotale (price_unit * qty * (1-discount/100)) |
| `price_total` | number | Totale con tasse |
| `price_reduce` | number | Prezzo unitario dopo lo sconto |

### Esempio Riga Ordine

```json
{
  "order_id": [12345, "S00123"],
  "product_id": [24448, "OLIO EVO 100% ITALIANO LT.5"],
  "product_uom_qty": 10,
  "price_unit": 50.00,
  "discount": 15.0,
  "price_subtotal": 425.00,
  "price_total": 459.00
}
```

**Calcolo**:
- Prezzo base: 50.00 CHF
- Sconto: 15%
- Prezzo unitario effettivo: 50.00 * (1 - 0.15) = 42.50 CHF
- Subtotale: 42.50 * 10 = 425.00 CHF
- Totale con IVA 8%: 425.00 * 1.08 = 459.00 CHF

---

## 6. LOGICA DI CALCOLO PREZZI

### Algoritmo di Selezione Regola

Quando Odoo deve calcolare il prezzo di un prodotto:

```
1. IDENTIFICA IL LISTINO
   - Leggi pricelist_id dall'ordine o dal cliente

2. TROVA REGOLE APPLICABILI
   - Tutte le regole del listino dove:
     * applied_on corrisponde (prodotto specifico, categoria, globale)
     * min_quantity <= quantità ordinata
     * (date_start <= oggi <= date_end) OPPURE (date_start e date_end sono null)

3. ORDINA PER PRIORITÀ
   a) applied_on (più specifico vince):
      - 0_product_variant (massima priorità)
      - 1_product
      - 2_product_category
      - 3_global (minima priorità)

   b) A parità di applied_on:
      - min_quantity più alta vince
      - (permette sconti quantità progressivi)

4. SELEZIONA LA PRIMA REGOLA
   - Prendi la regola con priorità più alta

5. CALCOLA IL PREZZO
   Secondo il tipo di compute_price:

   FIXED:
     prezzo_finale = fixed_price

   PERCENTAGE:
     prezzo_base = leggi dal campo 'base' (list_price, standard_price, etc.)
     prezzo_finale = prezzo_base * (percent_price / 100)

   FORMULA:
     prezzo_base = leggi dal campo 'base'
     prezzo_finale = prezzo_base * (1 - price_discount/100) + price_surcharge

6. VERIFICA MARGINI (opzionale)
   - Se price_min_margin configurato: prezzo >= costo + min_margin
   - Se price_max_margin configurato: prezzo <= costo + max_margin

7. APPLICA discount_policy

   WITH_DISCOUNT:
     - Calcola lo sconto implicito
     - sale_order_line.price_unit = prezzo senza sconto
     - sale_order_line.discount = percentuale sconto

   WITHOUT_DISCOUNT:
     - sale_order_line.price_unit = prezzo finale
     - sale_order_line.discount = 0
```

### Esempio Pratico di Priorità

Supponiamo di avere queste regole per il prodotto ID 24448:

```
Regola A: applied_on=3_global, min_quantity=1, price=50.00
Regola B: applied_on=1_product, min_quantity=1, price=48.00
Regola C: applied_on=0_product_variant, min_quantity=1, price=45.00
Regola D: applied_on=0_product_variant, min_quantity=10, discount=15%
```

**Scenario 1**: Ordino 5 pezzi
- Regola selezionata: **C** (0_product_variant è più specifico di 1_product e 3_global)
- Prezzo: 45.00 CHF/pezzo

**Scenario 2**: Ordino 12 pezzi
- Regola selezionata: **D** (0_product_variant + min_quantity=10)
- Prezzo: 45.00 CHF - 15% = 38.25 CHF/pezzo

---

## 7. ESEMPI PRATICI E API

### 7.1 Ottenere il Listino di un Cliente

```javascript
const partner = await odoo.execute_kw(
    'res.partner',
    'read',
    [[partnerId]],
    { fields: ['name', 'property_product_pricelist'] }
);

const pricelistId = partner[0].property_product_pricelist[0];
const pricelistName = partner[0].property_product_pricelist[1];

console.log(`Cliente: ${partner[0].name}`);
console.log(`Listino: ${pricelistName} (ID: ${pricelistId})`);
```

### 7.2 Ottenere Tutte le Regole di un Listino

```javascript
const items = await odoo.execute_kw(
    'product.pricelist.item',
    'search_read',
    [[['pricelist_id', '=', pricelistId]]],
    {
        fields: [
            'applied_on', 'product_id', 'product_tmpl_id', 'categ_id',
            'min_quantity', 'compute_price', 'base',
            'fixed_price', 'percent_price', 'price_discount', 'price_surcharge',
            'date_start', 'date_end',
            'price_min_margin', 'price_max_margin'
        ],
        order: 'min_quantity desc'
    }
);

console.log(`Trovate ${items.length} regole`);
items.forEach(item => {
    console.log(`- ${item.applied_on} | Min Qty: ${item.min_quantity} | ${item.compute_price}`);
});
```

### 7.3 Calcolare il Prezzo di un Prodotto

#### Metodo 1: Usare il metodo nativo di Odoo

```javascript
// Questo metodo NON è sempre disponibile/documentato
// Verifica la versione di Odoo
const prezzo = await odoo.execute_kw(
    'product.pricelist',
    'get_product_price',
    [pricelistId, productId, quantity, partnerId]
);
```

#### Metodo 2: Calcolare manualmente (più affidabile)

```javascript
async function calcolaPrezzoManuale(pricelistId, productId, quantity) {
    // 1. Ottieni le regole del listino
    const items = await odoo.execute_kw(
        'product.pricelist.item',
        'search_read',
        [[['pricelist_id', '=', pricelistId]]],
        {
            fields: [
                'applied_on', 'product_id', 'product_tmpl_id', 'categ_id',
                'min_quantity', 'compute_price', 'base',
                'fixed_price', 'percent_price', 'price_discount', 'price_surcharge'
            ]
        }
    );

    // 2. Ottieni info prodotto
    const product = await odoo.execute_kw(
        'product.product',
        'read',
        [[productId]],
        { fields: ['product_tmpl_id', 'categ_id', 'list_price', 'standard_price'] }
    );

    const prod = product[0];

    // 3. Filtra regole applicabili
    const regoleApplicabili = items.filter(item => {
        if (item.min_quantity > quantity) return false;

        if (item.applied_on === '0_product_variant' && item.product_id) {
            return item.product_id[0] === productId;
        }
        if (item.applied_on === '1_product' && item.product_tmpl_id) {
            return item.product_tmpl_id[0] === prod.product_tmpl_id[0];
        }
        if (item.applied_on === '2_product_category' && item.categ_id) {
            return item.categ_id[0] === prod.categ_id[0];
        }
        if (item.applied_on === '3_global') {
            return true;
        }
        return false;
    });

    // 4. Ordina per priorità
    const priorita = {
        '0_product_variant': 4,
        '1_product': 3,
        '2_product_category': 2,
        '3_global': 1
    };

    regoleApplicabili.sort((a, b) => {
        const diffPriorita = priorita[b.applied_on] - priorita[a.applied_on];
        if (diffPriorita !== 0) return diffPriorita;
        return b.min_quantity - a.min_quantity;
    });

    if (regoleApplicabili.length === 0) {
        // Nessuna regola: usa list_price
        return prod.list_price;
    }

    // 5. Applica la prima regola
    const regola = regoleApplicabili[0];
    let prezzoBase;

    if (regola.base === 'list_price') {
        prezzoBase = prod.list_price;
    } else if (regola.base === 'standard_price') {
        prezzoBase = prod.standard_price;
    } else {
        prezzoBase = prod.list_price; // default
    }

    let prezzoFinale;

    if (regola.compute_price === 'fixed') {
        prezzoFinale = regola.fixed_price;
    } else if (regola.compute_price === 'percentage') {
        prezzoFinale = prezzoBase * (regola.percent_price / 100);
    } else if (regola.compute_price === 'formula') {
        prezzoFinale = prezzoBase * (1 - regola.price_discount / 100) + regola.price_surcharge;
    } else {
        prezzoFinale = prezzoBase;
    }

    return {
        prezzo: prezzoFinale,
        regola: regola,
        prezzoBase: prezzoBase
    };
}

// Uso:
const risultato = await calcolaPrezzoManuale(956, 24448, 10);
console.log(`Prezzo calcolato: ${risultato.prezzo} CHF`);
console.log(`Base: ${risultato.prezzoBase} CHF`);
console.log(`Regola applicata: ${risultato.regola.applied_on}`);
```

### 7.4 Creare una Riga Ordine con Prezzo Corretto

```javascript
// Quando crei una riga ordine, Odoo calcola automaticamente il prezzo
// in base al listino dell'ordine

const lineId = await odoo.execute_kw(
    'sale.order.line',
    'create',
    [{
        order_id: orderId,
        product_id: productId,
        product_uom_qty: quantity
        // price_unit e discount vengono calcolati automaticamente
    }]
);

// Se vuoi forzare un prezzo specifico:
const lineId = await odoo.execute_kw(
    'sale.order.line',
    'create',
    [{
        order_id: orderId,
        product_id: productId,
        product_uom_qty: quantity,
        price_unit: 45.00,  // Prezzo manuale
        discount: 10.0      // Sconto manuale
    }]
);
```

### 7.5 Modificare il Prezzo di una Riga Esistente

```javascript
// Modifica il prezzo di una riga ordine esistente
await odoo.execute_kw(
    'sale.order.line',
    'write',
    [[lineId], {
        price_unit: 42.00,
        discount: 5.0
    }]
);
```

### 7.6 Verificare se un Prezzo è Bloccato

```javascript
// Odoo non ha un concetto di "prezzo bloccato" nativamente
// Ma puoi verificare se l'utente ha i permessi per modificare i prezzi

// Opzione 1: Verifica i gruppi dell'utente
const user = await odoo.execute_kw(
    'res.users',
    'read',
    [[odoo.uid]],
    { fields: ['groups_id'] }
);

// Cerca il gruppo "Sales / Manager" che può modificare prezzi
const canEditPrices = user[0].groups_id.includes(SALES_MANAGER_GROUP_ID);

// Opzione 2: Usa le Access Rights
const access = await odoo.execute_kw(
    'sale.order.line',
    'check_access_rights',
    ['write'],
    { raise_exception: false }
);

console.log(`Can edit prices: ${access}`);
```

---

## 8. BEST PRACTICES

### 8.1 Strutturare i Listini

1. **Listino Base (Public)**
   - Usalo come listino di default
   - Definisci qui i prezzi standard per tutti i prodotti

2. **Listini Cliente Specifici**
   - Crea listini nominali per clienti importanti
   - Utile per prezzi fissi negoziati

3. **Listini per Fasce**
   - Crea listini basati su volume (0-5m, 5-10m, etc.)
   - Assegnali automaticamente in base al fatturato

4. **Listini Promozionali**
   - Usa `date_start` e `date_end` per promozioni temporanee
   - Tieni separate le regole promozionali da quelle standard

### 8.2 Definire le Regole

1. **Ordine di Specificità**
   - Parti da regole globali (`3_global`)
   - Aggiungi regole per categoria (`2_product_category`)
   - Affina con regole per prodotto specifico (`0_product_variant`)

2. **Sconti Quantità**
   - Usa `min_quantity` per creare scaglioni
   - Esempio: 1-9 pz = prezzo A, 10-49 pz = prezzo B, 50+ pz = prezzo C

3. **Margini**
   - Usa `price_min_margin` per garantire margini minimi
   - Utile per prodotti a basso margine

### 8.3 Manutenzione

1. **Revisione Periodica**
   - Controlla regole obsolete o duplicate
   - Elimina regole con date scadute

2. **Testing**
   - Prima di attivare un listino, testa con ordini di prova
   - Verifica i prezzi calcolati

3. **Documentazione**
   - Documenta i listini personalizzati
   - Tieni traccia delle negoziazioni con i clienti

### 8.4 Prestazioni

1. **Limita il Numero di Regole**
   - Troppi items rallentano il calcolo
   - Cerca di consolidare regole simili

2. **Usa Cache**
   - Se calcoli prezzi frequentemente, cachea i risultati
   - Invalida la cache quando cambi le regole

3. **Indicizza i Campi**
   - Assicurati che `pricelist_id`, `product_id`, `applied_on` siano indicizzati

---

## APPENDICE A: VALORI DI CAMPO

### discount_policy

| Valore | Descrizione | Uso |
|--------|-------------|-----|
| `with_discount` | Mostra prezzo base + sconto separato | Standard, trasparenza cliente |
| `without_discount` | Mostra solo prezzo finale | Listini fissi, B2B |

### applied_on

| Valore | Descrizione | Priorità |
|--------|-------------|----------|
| `0_product_variant` | Variante prodotto specifica | Alta (4) |
| `1_product` | Template prodotto | Media-alta (3) |
| `2_product_category` | Categoria prodotti | Media-bassa (2) |
| `3_global` | Tutti i prodotti | Bassa (1) |

### compute_price

| Valore | Formula | Campi Usati |
|--------|---------|-------------|
| `fixed` | `prezzo = fixed_price` | `fixed_price` |
| `percentage` | `prezzo = base * (percent_price / 100)` | `base`, `percent_price` |
| `formula` | `prezzo = base * (1 - price_discount/100) + price_surcharge` | `base`, `price_discount`, `price_surcharge` |

### base

| Valore | Descrizione | Campo Prodotto |
|--------|-------------|----------------|
| `list_price` | Prezzo di listino | `product.list_price` |
| `standard_price` | Costo standard | `product.standard_price` |
| `pricelist` | Altro listino | `(base_pricelist_id)` |

---

## APPENDICE B: QUERY UTILI

### Trovare tutti i listini attivi
```javascript
const pricelists = await odoo.execute_kw(
    'product.pricelist',
    'search_read',
    [[['active', '=', true]]],
    { fields: ['name', 'currency_id', 'discount_policy'] }
);
```

### Trovare clienti senza listino assegnato
```javascript
const partners = await odoo.execute_kw(
    'res.partner',
    'search_read',
    [[
        ['customer_rank', '>', 0],
        ['property_product_pricelist', '=', false]
    ]],
    { fields: ['name'] }
);
```

### Trovare regole in scadenza
```javascript
const oggi = new Date().toISOString().split('T')[0];
const trentaGiorni = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

const items = await odoo.execute_kw(
    'product.pricelist.item',
    'search_read',
    [[
        ['date_end', '!=', false],
        ['date_end', '>=', oggi],
        ['date_end', '<=', trentaGiorni]
    ]],
    { fields: ['pricelist_id', 'product_id', 'date_end'] }
);
```

### Trovare prodotti con più regole
```javascript
// Questo richiede aggregazione, meglio farlo con psql diretto
// oppure iterando in JavaScript
const items = await odoo.execute_kw(
    'product.pricelist.item',
    'search_read',
    [[['product_id', '!=', false]]],
    { fields: ['product_id', 'pricelist_id'] }
);

const conteggi = {};
items.forEach(item => {
    const prodId = item.product_id[0];
    conteggi[prodId] = (conteggi[prodId] || 0) + 1;
});

const prodottiMultiRegola = Object.entries(conteggi)
    .filter(([id, count]) => count > 5)
    .sort((a, b) => b[1] - a[1]);

console.log('Prodotti con più di 5 regole:', prodottiMultiRegola);
```

---

## PROSSIMI PASSI

Una volta completata l'analisi:

1. [ ] Verificare tutti i campi disponibili tramite il JSON completo
2. [ ] Testare il calcolo prezzi con esempi reali
3. [ ] Implementare funzione di calcolo prezzi nella tua app
4. [ ] Aggiungere validazione per prezzi bloccati/scontabili
5. [ ] Documentare casi limite e edge cases

---

**NOTA:** Questo documento è basato sull'analisi parziale. Verrà aggiornato con i dati completi una volta terminato lo script di analisi.
