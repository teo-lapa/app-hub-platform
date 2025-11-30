# DIAGRAMMA FLUSSO DATI: Controllo Prezzi

## ARCHITETTURA GENERALE

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│                    /controllo-prezzi/page.tsx                    │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │ GET /counts                    │ GET /products?category=X
             │                                │
             v                                v
┌────────────────────────────┐   ┌────────────────────────────────┐
│  API: /api/controllo-      │   │  API: /api/controllo-          │
│       prezzi/counts         │   │       prezzi/products          │
└────────────┬───────────────┘   └────────────┬───────────────────┘
             │                                │
             │ Uses                           │ Uses
             │                                │
             v                                v
        ┌────────────────────────────────────────────┐
        │   /api/controllo-prezzi/aggregate          │
        │   (Core: Analizza tutti gli ordini)        │
        └────────────┬───────────────────────────────┘
                     │
                     │ Calls Odoo Models
                     │
        ┌────────────┴────────────────────────────┐
        │                                         │
        v                                         v
┌──────────────────┐                    ┌──────────────────┐
│  ODOO MODELS     │                    │  CUSTOM MODEL    │
│  (Standard)      │                    │  x_price_review  │
├──────────────────┤                    ├──────────────────┤
│ sale.order       │                    │ Tracking         │
│ sale.order.line  │                    │ reviewed/blocked │
│ product.product  │                    │ status           │
│ res.partner      │                    └──────────────────┘
│ pricelist.item   │
│ mail.activity    │
└──────────────────┘
```

---

## FLUSSO UTENTE: Paul/Laura

```
START: User apre /controllo-prezzi
│
├─ Step 1: LOAD COUNTS
│  │
│  ├─> GET /api/controllo-prezzi/counts
│  │   │
│  │   ├─> Calls /aggregate
│  │   │   │
│  │   │   ├─> Odoo: sale.order (draft/sent)
│  │   │   ├─> Odoo: sale.order.line
│  │   │   ├─> Odoo: product.product
│  │   │   ├─> Odoo: Calculate avg prices
│  │   │   ├─> Classify products by category
│  │   │   └─> Return: { sotto_pc: 12, tra_pc_medio: 8, ... }
│  │   │
│  │   ├─> Query x_price_review for blocked count
│  │   │
│  │   └─> Return: {
│  │         byCategory: {
│  │           below_critical: 12,
│  │           critical_to_avg: 8,
│  │           above_avg: 45,
│  │           blocked: 3,
│  │           all: 68
│  │         }
│  │       }
│  │
│  └─> UI: Mostra 5 badge con conteggi
│
├─ Step 2: USER CLICK "Sotto PC"
│  │
│  ├─> GET /api/controllo-prezzi/products?category=below_critical
│  │   │
│  │   ├─> Calls /aggregate
│  │   │   (same as above)
│  │   │
│  │   ├─> Filter products WHERE category = 'below_critical'
│  │   │
│  │   ├─> For each product:
│  │   │   ├─> Fetch image_128 from product.product
│  │   │   └─> Fetch review status from x_price_review
│  │   │
│  │   └─> Return: [
│  │         { id: 123, name: "Mozzarella", soldPrice: 3.20, ... },
│  │         { id: 124, name: "Ricotta", soldPrice: 4.10, ... }
│  │       ]
│  │
│  └─> UI: Mostra griglia prodotti (cards)
│
├─ Step 3: USER CLICK PRODOTTO
│  │
│  └─> UI: Apre modal con dettagli
│      ├─ Immagine prodotto
│      ├─ Prezzo venduto: 3.20 CHF
│      ├─ Punto Critico: 3.50 CHF
│      ├─ Prezzo Medio: 4.20 CHF
│      ├─ Slider visuale
│      └─ 3 pulsanti azioni
│
└─ Step 4: USER SCEGLIE AZIONE
   │
   ├─ Option A: MARCA CONTROLLATO
   │  │
   │  ├─> POST /api/controllo-prezzi/mark-reviewed
   │  │   Body: { productId: 123, orderId: 456, reviewedBy: "paul@lapa.ch" }
   │  │   │
   │  │   ├─> Odoo: Create/Update x_price_review
   │  │   │   {
   │  │   │     product_id: 123,
   │  │   │     order_id: 456,
   │  │   │     status: 'reviewed',
   │  │   │     reviewed_by: 'paul@lapa.ch',
   │  │   │     reviewed_at: NOW()
   │  │   │   }
   │  │   │
   │  │   └─> Return: { success: true }
   │  │
   │  └─> UI: Rimuove prodotto da lista
   │
   ├─ Option B: BLOCCA PREZZO
   │  │
   │  ├─> POST /api/controllo-prezzi/block-price
   │  │   Body: { productId: 123, orderId: 456, blockedBy: "paul@lapa.ch" }
   │  │   │
   │  │   ├─> Odoo: Create/Update x_price_review
   │  │   │   {
   │  │   │     product_id: 123,
   │  │   │     order_id: 456,
   │  │   │     status: 'blocked',
   │  │   │     blocked_by: 'paul@lapa.ch',
   │  │   │     blocked_at: NOW()
   │  │   │   }
   │  │   │
   │  │   ├─> OPTIONAL: Odoo: Create mail.activity
   │  │   │   {
   │  │   │     res_model: 'sale.order',
   │  │   │     res_id: 456,
   │  │   │     summary: 'Blocco Prezzo: Prodotto #123',
   │  │   │     user_id: venditore_ordine
   │  │   │   }
   │  │   │
   │  │   └─> Return: { success: true }
   │  │
   │  └─> UI: Rimuove prodotto da lista
   │
   └─ Option C: DA CONTROLLARE
      │
      ├─> POST /api/controllo-prezzi/mark-pending
      │   Body: { productId: 123, orderId: 456 }
      │   │
      │   ├─> Odoo: Update x_price_review
      │   │   {
      │   │     status: 'pending',
      │   │     reviewed_by: null,
      │   │     blocked_by: null
      │   │   }
      │   │
      │   └─> Return: { success: true }
      │
      └─> UI: Aggiorna badge status a "pending"

END
```

---

## FLUSSO DATI: /aggregate (Core Logic)

```
GET /api/controllo-prezzi/aggregate
│
├─ Step 1: GET ORDERS
│  │
│  └─> Odoo: sale.order.search_read([
│        ['company_id', '=', 1],
│        ['state', 'in', ['draft', 'sent']]
│      ])
│      Returns: [
│        { id: 100, name: "SO001", partner_id: [1, "Cliente A"], order_line: [1, 2, 3] },
│        { id: 101, name: "SO002", partner_id: [2, "Cliente B"], order_line: [4, 5, 6] }
│      ]
│
├─ Step 2: FOR EACH ORDER
│  │
│  ├─> A) GET ORDER LINES
│  │   │
│  │   └─> Odoo: sale.order.line.search_read([
│  │         ['id', 'in', [1, 2, 3]]
│  │       ])
│  │       Returns: [
│  │         { id: 1, product_id: [123, "Mozzarella"], price_unit: 3.20, ... },
│  │         { id: 2, product_id: [124, "Ricotta"], price_unit: 4.10, ... }
│  │       ]
│  │
│  ├─> B) GET PRODUCTS
│  │   │
│  │   └─> Odoo: product.product.search_read([
│  │         ['id', 'in', [123, 124]]
│  │       ])
│  │       Returns: [
│  │         { id: 123, name: "Mozzarella", standard_price: 2.50, list_price: 4.50 },
│  │         { id: 124, name: "Ricotta", standard_price: 3.00, list_price: 5.00 }
│  │       ]
│  │
│  ├─> C) GET HISTORICAL SALES (3 months)
│  │   │
│  │   └─> Odoo: sale.order.line.search_read([
│  │         ['product_id', 'in', [123, 124]],
│  │         ['state', 'in', ['sale', 'done']],
│  │         ['create_date', '>=', '2025-08-12']
│  │       ])
│  │       Returns: [
│  │         { product_id: [123], price_unit: 4.20 },
│  │         { product_id: [123], price_unit: 4.30 },
│  │         { product_id: [123], price_unit: 4.10 },
│  │         { product_id: [124], price_unit: 5.20 },
│  │         { product_id: [124], price_unit: 5.10 }
│  │       ]
│  │
│  ├─> D) CALCULATE AVG PRICES
│  │   │
│  │   ├─ Product 123: avgPrice = (4.20 + 4.30 + 4.10) / 3 = 4.20 CHF
│  │   └─ Product 124: avgPrice = (5.20 + 5.10) / 2 = 5.15 CHF
│  │
│  ├─> E) CHECK LOCKED PRICES
│  │   │
│  │   └─> Odoo: product.pricelist.item.search_read([
│  │         ['pricelist_id', '=', order.pricelist_id],
│  │         ['product_id', 'in', [123, 124]]
│  │       ])
│  │       Returns: [
│  │         { product_id: [123], compute_price: 'fixed', fixed_price: 3.50 }
│  │       ]
│  │       Product 123 → isLocked = true
│  │
│  └─> F) CLASSIFY PRODUCTS
│      │
│      ├─ Product 123 (Mozzarella):
│      │  ├─ soldPrice: 3.20 CHF
│      │  ├─ costPrice: 2.50 CHF
│      │  ├─ criticalPrice: 2.50 * 1.4 = 3.50 CHF
│      │  ├─ avgSellingPrice: 4.20 CHF
│      │  ├─ Comparison: 3.20 < 3.50
│      │  └─ Category: 'sotto_pc' ❌
│      │
│      └─ Product 124 (Ricotta):
│         ├─ soldPrice: 4.10 CHF
│         ├─ costPrice: 3.00 CHF
│         ├─ criticalPrice: 3.00 * 1.4 = 4.20 CHF
│         ├─ avgSellingPrice: 5.15 CHF
│         ├─ Comparison: 4.10 >= 4.20? NO → 4.10 < 5.15? YES
│         └─ Category: 'tra_pc_medio' ⚠️
│
├─ Step 3: COUNT PRICE LOCK REQUESTS
│  │
│  ├─> A) GET MODEL ID
│  │   │
│  │   └─> Odoo: ir.model.search_read([
│  │         ['model', '=', 'sale.order']
│  │       ])
│  │       Returns: { id: 84, model: 'sale.order' }
│  │
│  └─> B) COUNT ACTIVITIES
│      │
│      └─> Odoo: mail.activity.search_read([
│            ['res_model_id', '=', 84],
│            ['res_model', '=', 'sale.order'],
│            ['res_id', 'in', [100, 101]],
│            ['summary', 'ilike', 'Blocco Prezzo']
│          ])
│          Returns: [
│            { id: 501, res_id: 100, summary: "Blocco Prezzo: Prodotto #123" },
│            { id: 502, res_id: 101, summary: "Blocco Prezzo: Prodotto #456" }
│          ]
│          Count: 2 richieste
│
└─ Step 4: RETURN AGGREGATED DATA
   │
   └─> Response: {
         success: true,
         stats: {
           sotto_pc: 1,
           tra_pc_medio: 1,
           sopra_medio: 0,
           richieste_blocco: 2,
           total_products: 2,
           total_orders: 2
         },
         products: [
           {
             orderId: 100,
             orderName: "SO001",
             productId: 123,
             productName: "Mozzarella 125g",
             currentPriceUnit: 3.20,
             costPrice: 2.50,
             avgSellingPrice: 4.20,
             criticalPoint: 3.50,
             category: 'sotto_pc',
             isLocked: true
           },
           {
             orderId: 100,
             productId: 124,
             productName: "Ricotta 250g",
             currentPriceUnit: 4.10,
             costPrice: 3.00,
             avgSellingPrice: 5.15,
             criticalPoint: 4.20,
             category: 'tra_pc_medio',
             isLocked: false
           }
         ]
       }
```

---

## SCHEMA CLASSIFICAZIONE PREZZI

```
                SOPRA MEDIO
                     ↑
                     │ (OK - Prezzo buono)
      ───────────────┼───────────────────────────
                     │ avgSellingPrice = 4.20 CHF
                     │
                     │
             TRA PC E MEDIO
                     │ (Da verificare)
      ───────────────┼───────────────────────────
                     │ criticalPrice = 3.50 CHF (standard_price * 1.4)
                     │
                     │
               SOTTO PC
                     ↓ (ATTENZIONE - Margine basso!)


Esempio Mozzarella:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Costo: 2.50 CHF                                         │
│  ├─────────────────────────────────────────────┐        │
│  │ Punto Critico: 3.50 CHF (2.50 * 1.4)       │        │
│  │ ├───────────────────────────────────────┐   │        │
│  │ │ Prezzo Venduto: 3.20 CHF             │   │        │
│  │ │                                       │   │        │
│  │ │ SOTTO PC ❌                           │   │        │
│  │ │                                       │   │        │
│  │ └───────────────────────────────────────┘   │        │
│  │         ↓                                    │        │
│  │  [Gap: -0.30 CHF rispetto a PC]             │        │
│  │                                              │        │
│  │ Prezzo Medio (3 mesi): 4.20 CHF             │        │
│  │ ├───────────────────────────────────────┐   │        │
│  │ │ [Gap: -1.00 CHF rispetto a Medio]    │   │        │
│  │ └───────────────────────────────────────┘   │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## STORAGE: x_price_review Model

```
┌─────────────────────────────────────────────────────────┐
│                   x_price_review                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Record 1:                                              │
│  ├─ product_id: 123 (Mozzarella)                        │
│  ├─ order_id: 100 (SO001)                               │
│  ├─ status: 'reviewed'                                  │
│  ├─ reviewed_by: 'paul.diserens@gmail.com'              │
│  ├─ reviewed_at: '2025-11-12 10:30:00'                  │
│  ├─ note: 'Prezzo verificato - Cliente importante'      │
│  └─ [Snapshots: soldPrice, costPrice, criticalPrice]    │
│                                                         │
│  Record 2:                                              │
│  ├─ product_id: 124 (Ricotta)                           │
│  ├─ order_id: 100 (SO001)                               │
│  ├─ status: 'blocked'                                   │
│  ├─ blocked_by: 'paul.diserens@gmail.com'               │
│  ├─ blocked_at: '2025-11-12 14:15:00'                   │
│  ├─ note: 'Margine troppo basso - NON APPROVARE'        │
│  └─ [Snapshots: soldPrice, costPrice, criticalPrice]    │
│                                                         │
│  Record 3:                                              │
│  ├─ product_id: 125 (Parmigiano)                        │
│  ├─ order_id: 101 (SO002)                               │
│  ├─ status: 'pending'                                   │
│  ├─ reviewed_by: null                                   │
│  └─ note: null                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘

Indexes:
  - (product_id, order_id) → UNIQUE
  - status → INDEX for fast filtering
  - reviewed_at → INDEX for reporting
```

---

## PERFORMANCE OPTIMIZATION

### BEFORE (N+1 Problem)
```
GET /aggregate
├─ Query 1: sale.order (all draft/sent)           → 1 query
└─ FOR EACH order (50 ordini):
   ├─ Query 2: sale.order.line                    → 50 queries
   ├─ Query 3: product.product                    → 50 queries
   ├─ Query 4: sale.order.line (historical)       → 50 queries
   └─ Query 5: product.pricelist.item             → 50 queries

TOTAL: 1 + (50 * 4) = 201 queries
TIME: ~10-15 seconds ⚠️
```

### AFTER (Batch Queries)
```
GET /aggregate
├─ Query 1: sale.order (all draft/sent)               → 1 query
│   Returns: orderIds = [100, 101, 102, ..., 150]
│
├─ Query 2: sale.order.line (ALL at once)             → 1 query
│   WHERE: id IN [all order_line_ids from all orders]
│
├─ Query 3: product.product (ALL at once)             → 1 query
│   WHERE: id IN [all product_ids from all lines]
│
├─ Query 4: sale.order.line (historical, ALL)         → 1 query
│   WHERE: product_id IN [all product_ids]
│           AND state IN ['sale', 'done']
│           AND create_date >= 3_months_ago
│
├─ Query 5: product.pricelist.item (ALL pricelists)   → 1 query
│   WHERE: product_id IN [all product_ids]
│
└─ Post-processing: Raggruppa e classifica in memoria

TOTAL: 5 queries
TIME: ~2 seconds ✅
```

---

## CACHING STRATEGY

```
┌─────────────────────────────────────────────────────────┐
│                    REDIS CACHE                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Key: avg_price:123:2025-11                             │
│  Value: 4.20                                            │
│  TTL: 1 hour                                            │
│  (Prezzo medio prodotto 123 per novembre 2025)          │
│                                                         │
│  Key: product:123                                       │
│  Value: { id: 123, name: "Mozzarella", ... }            │
│  TTL: 10 minutes                                        │
│  (Dati prodotto 123)                                    │
│                                                         │
│  Key: review:123:100                                    │
│  Value: { status: "reviewed", reviewedBy: "paul..." }   │
│  TTL: 5 minutes                                         │
│  (Review status prodotto 123 in ordine 100)             │
│                                                         │
└─────────────────────────────────────────────────────────┘

Invalidation:
- avg_price: Invalida quando create/write su sale.order.line
- product: Invalida quando write su product.product
- review: Invalida quando write su x_price_review
```

---

## API ENDPOINTS SUMMARY

```
┌─────────────────────────────────────────────────────────┐
│  GET /api/controllo-prezzi/counts                       │
│  Returns: Conteggi per categoria                        │
│  Status: MOCK (TODO)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  GET /api/controllo-prezzi/products?category=X&days=7   │
│  Returns: Lista prodotti per categoria                  │
│  Status: MOCK (TODO)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  GET /api/controllo-prezzi/aggregate                    │
│  Returns: Tutti i prodotti con classificazione           │
│  Status: IMPLEMENTED ✅                                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  POST /api/controllo-prezzi/mark-reviewed               │
│  Body: { productId, orderId, reviewedBy, note }         │
│  Action: Marca come 'reviewed' in x_price_review        │
│  Status: MOCK (TODO)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  POST /api/controllo-prezzi/block-price                 │
│  Body: { productId, orderId, blockedBy, note }          │
│  Action: Marca come 'blocked' in x_price_review         │
│  Status: MOCK (TODO)                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  POST /api/controllo-prezzi/mark-pending                │
│  Body: { productId, orderId }                           │
│  Action: Reset a 'pending' in x_price_review            │
│  Status: MOCK (TODO)                                    │
└─────────────────────────────────────────────────────────┘
```

---

**Version:** 1.0
**Created:** 12 Nov 2025
**Purpose:** Visual reference for Controllo Prezzi data flow
