# QUICK REFERENCE: Controllo Prezzi - Requisiti Odoo

## MODELLI ODOO NECESSARI

### 1. STANDARD (Esistenti)
```
sale.order              → Ordini (draft/sent)
sale.order.line         → Righe ordine + prezzi
product.product         → Prodotti + costi
res.partner             → Clienti
product.pricelist.item  → Prezzi bloccati (fixed)
mail.activity           → Richieste blocco
ir.model               → Metadata
```

### 2. CUSTOM (Da Creare)
```python
x_price_review
├─ product_id           (Many2one)
├─ order_id             (Many2one)
├─ order_line_id        (Many2one)
├─ status               ('pending'|'reviewed'|'blocked')
├─ reviewed_by          (Char)
├─ reviewed_at          (Datetime)
├─ blocked_by           (Char)
├─ blocked_at           (Datetime)
├─ note                 (Text)
├─ sold_price           (Float - snapshot)
├─ cost_price           (Float - snapshot)
├─ critical_price       (Float - snapshot)
└─ avg_selling_price    (Float - snapshot)
```

---

## COMPUTED FIELDS NECESSARI

### 1. avg_selling_price_3m (product.product)
```python
# Media vendite ultimi 3 mesi
Fields: Float, Store=True, Computed
Query: sale.order.line WHERE
  - product_id = self.id
  - state IN ['sale', 'done']
  - create_date >= (oggi - 90 giorni)
Trigger: create/write su sale.order.line
```

### 2. critical_price (product.product)
```python
# Punto Critico = Costo * 1.4
Formula: standard_price * 1.4
Compute: On-the-fly (non stored)
```

### 3. price_category (sale.order.line)
```python
# Categoria prezzo
Logica:
  IF price_unit < critical_price: 'sotto_pc'
  ELIF price_unit < avg_selling_price: 'tra_pc_medio'
  ELSE: 'sopra_medio'
```

---

## FORMULE CHIAVE

```python
# Punto Critico
critical_price = product.standard_price * 1.4

# Prezzo Medio (ultimi 3 mesi)
avg_price = AVG(sale.order.line.price_unit) WHERE
  - product_id = X
  - state IN ['sale', 'done']
  - create_date >= (oggi - 90 giorni)

# Categoria Prezzo
if (sold_price < critical_price):
    category = 'sotto_pc'        # ATTENZIONE
elif (sold_price < avg_price):
    category = 'tra_pc_medio'    # DA VERIFICARE
else:
    category = 'sopra_medio'     # OK
```

---

## QUERY PRINCIPALI

### Ordini Draft/Sent
```python
sale.order.search_read([
  ['company_id', '=', 1],
  ['state', 'in', ['draft', 'sent']]
])
```

### Righe Ordine con Prezzi
```python
sale.order.line.search_read([
  ['id', 'in', order.order_line]
], ['id', 'product_id', 'price_unit', 'discount'])
```

### Storico Vendite (3 mesi)
```python
sale.order.line.search_read([
  ['product_id', 'in', productIds],
  ['state', 'in', ['sale', 'done']],
  ['create_date', '>=', date_3_months_ago]
], ['product_id', 'price_unit'])
```

### Prezzi Bloccati
```python
product.pricelist.item.search_read([
  ['pricelist_id', '=', order.pricelist_id[0]],
  ['product_id', 'in', productIds]
], ['product_id', 'compute_price', 'fixed_price'])

# isLocked = (compute_price === 'fixed')
```

### Richieste Blocco (Activities)
```python
# Step 1: Get model_id
ir.model.search_read([['model', '=', 'sale.order']])

# Step 2: Count activities
mail.activity.search_read([
  ['res_model_id', '=', modelId],
  ['res_model', '=', 'sale.order'],
  ['res_id', 'in', orderIds],
  ['summary', 'ilike', 'Blocco Prezzo']
])
```

---

## ENDPOINTS API

### GET /api/controllo-prezzi/counts
```typescript
Return: {
  byCategory: {
    below_critical: 12,   // Sotto PC
    critical_to_avg: 8,   // Tra PC e Medio
    above_avg: 45,        // Sopra Medio
    blocked: 3,           // Richieste blocco
    all: 68               // Totale
  }
}
```

### GET /api/controllo-prezzi/products
```typescript
Query: ?category=below_critical&days=7

Return: {
  products: [
    {
      id, name, code, image,
      soldPrice,
      costPrice,
      criticalPrice,
      avgSellingPrice,
      orderId, orderName, customerName,
      status, note,
      priceCategory
    }
  ],
  summary: { total, totalRevenue, byCategory, byStatus }
}
```

### POST /api/controllo-prezzi/mark-reviewed
```typescript
Body: {
  productId: 123,
  orderId: 456,
  reviewedBy: "paul@lapa.ch",
  note: "OK"
}

Action: Create/Update x_price_review with status='reviewed'
```

### POST /api/controllo-prezzi/block-price
```typescript
Body: {
  productId: 123,
  orderId: 456,
  blockedBy: "paul@lapa.ch",
  note: "Margine troppo basso"
}

Action: Create/Update x_price_review with status='blocked'
```

### POST /api/controllo-prezzi/mark-pending
```typescript
Body: {
  productId: 123,
  orderId: 456
}

Action: Reset x_price_review to status='pending'
```

---

## STORAGE OPTIONS

### Option 1: Custom Model Odoo (RACCOMANDATO)
```
Pro: Integrato, veloce, sicuro, backup automatico
Con: Richiede sviluppo modulo Odoo
```

### Option 2: PostgreSQL Esterno
```
Pro: Flessibile, indipendente
Con: Sync complesso, backup separato
```

### Option 3: File JSON (NON RACCOMANDATO)
```
Pro: Veloce da implementare
Con: Non scalabile, rischio perdita dati
```

---

## PERFORMANCE OPTIMIZATION

### N+1 Problem (ATTUALE)
```typescript
// BAD: 1 query per ordine
for (order of orders) {
  lines = await callOdoo(...)      // N queries
  products = await callOdoo(...)    // N queries
  historical = await callOdoo(...)  // N queries
}
// 50 ordini = 150+ queries!
```

### Batch Queries (TARGET)
```typescript
// GOOD: Batch tutto
const allOrderLineIds = orders.flatMap(o => o.order_line);
const allLines = await callOdoo(..., [['id', 'in', allOrderLineIds]]);
const allProductIds = allLines.map(l => l.product_id[0]);
const allProducts = await callOdoo(..., [['id', 'in', allProductIds]]);
// 50 ordini = 5 queries
```

### Caching Strategy
```typescript
Cache: Redis/Memory
Keys:
  - avg_price:{productId}:{month}  (TTL: 1h)
  - product:{productId}            (TTL: 10m)
  - review:{productId}:{orderId}   (TTL: 5m)
```

---

## CHECKLIST IMPLEMENTAZIONE

### Phase 1: Odoo Setup
- [ ] Crea custom model x_price_review
- [ ] Aggiungi field avg_selling_price_3m a product.product
- [ ] Aggiungi field price_category a sale.order.line
- [ ] Verifica activity_type "Blocco Prezzo"
- [ ] Crea security rules

### Phase 2: API Implementation
- [ ] Completa GET /counts (da mock a reale)
- [ ] Completa GET /products (da mock a reale)
- [ ] Completa POST /mark-reviewed
- [ ] Completa POST /block-price
- [ ] Completa POST /mark-pending

### Phase 3: Optimization
- [ ] Batch queries in /aggregate
- [ ] Aggiungi caching
- [ ] Index su x_price_review
- [ ] Pagination (limit 100)

### Phase 4: Testing
- [ ] Test con Paul/Laura accounts
- [ ] Test con 100+ prodotti
- [ ] Test performance (<2s)
- [ ] Test edge cases

---

## EXAMPLES

### Esempio: Prodotto "Sotto PC"
```
Prodotto: Mozzarella 125g
Costo (standard_price): 2.50 CHF
Punto Critico (2.50 * 1.4): 3.50 CHF
Prezzo Medio (3 mesi): 4.20 CHF
Prezzo Venduto: 3.20 CHF

Classificazione:
  3.20 < 3.50 → sotto_pc ❌ ALERT!

Azione Paul/Laura:
  1. Vede nella categoria "Sotto PC"
  2. Clicca e vede dettagli
  3. Opzioni:
     - Marca Controllato (prezzo OK per quel cliente)
     - Blocca Prezzo (non vendere sotto 3.50)
     - Da Controllare (rimanda decisione)
```

### Esempio: Query Completa
```typescript
// Get all products below critical price

const result = await fetch('/api/controllo-prezzi/products?category=below_critical&days=7');

// Response:
{
  products: [
    {
      id: 123,
      name: "Mozzarella 125g",
      code: "MOZ125",
      soldPrice: 3.20,
      costPrice: 2.50,
      criticalPrice: 3.50,    // 2.50 * 1.4
      avgSellingPrice: 4.20,
      orderId: 456,
      orderName: "SO001",
      customerName: "Ristorante Da Mario",
      status: "pending",
      priceCategory: "below_critical"
    }
  ]
}
```

---

## KEY CONTACTS

- Paul Diserens: paul.diserens@gmail.com
- Laura Diserens: laura.diserens@gmail.com
- Access Control: ONLY Paul & Laura (hardcoded in page.tsx)

---

## USEFUL LINKS

- App URL: /controllo-prezzi
- Full Analysis: ANALISI_ODOO_CONTROLLO_PREZZI.md
- Type Definitions: lib/types/price-check.ts
- Main Page: app/controllo-prezzi/page.tsx
- API Routes: app/api/controllo-prezzi/

---

**Version:** 1.0
**Last Updated:** 12 Nov 2025
