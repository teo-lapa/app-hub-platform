# ESEMPIO PRATICO: Controllo Prezzi - Caso d'Uso Reale

## SCENARIO

Paul apre l'app Controllo Prezzi per controllare i prezzi dei prodotti negli ordini in bozza.

---

## DATI DI ESEMPIO

### Ordine SO001 (ID: 100)
```
Cliente: Ristorante Da Mario (ID: 50)
Stato: draft
Data: 12 Nov 2025
Listino: Listino Ristoranti (ID: 5)

Righe ordine:
1. Mozzarella 125g (ID: 123)
   - Quantità: 10 pz
   - Prezzo unitario: 3.20 CHF
   - Sconto: 0%

2. Ricotta 250g (ID: 124)
   - Quantità: 5 pz
   - Prezzo unitario: 4.10 CHF
   - Sconto: 5%

3. Parmigiano 36 mesi (ID: 125)
   - Quantità: 2 kg
   - Prezzo unitario: 38.50 CHF
   - Sconto: 0%
```

### Prodotti in Odoo
```
Product ID 123: Mozzarella 125g
├─ Codice: MOZ125
├─ Costo (standard_price): 2.50 CHF
├─ Listino (list_price): 4.50 CHF
├─ Vendite 3 mesi:
│  ├─ 15/08: 4.20 CHF (Cliente A)
│  ├─ 22/08: 4.30 CHF (Cliente B)
│  ├─ 05/09: 4.10 CHF (Cliente C)
│  ├─ 18/09: 4.25 CHF (Cliente D)
│  └─ 01/10: 4.15 CHF (Cliente E)
└─ Avg 3 mesi: 4.20 CHF

Product ID 124: Ricotta 250g
├─ Codice: RIC250
├─ Costo (standard_price): 3.00 CHF
├─ Listino (list_price): 5.00 CHF
├─ Vendite 3 mesi:
│  ├─ 10/08: 5.20 CHF
│  ├─ 25/08: 5.10 CHF
│  ├─ 12/09: 5.25 CHF
│  └─ 28/09: 5.05 CHF
└─ Avg 3 mesi: 5.15 CHF

Product ID 125: Parmigiano 36 mesi
├─ Codice: PARM36
├─ Costo (standard_price): 28.00 CHF
├─ Listino (list_price): 42.00 CHF
├─ Vendite 3 mesi:
│  ├─ 05/08: 39.50 CHF
│  ├─ 20/08: 40.00 CHF
│  ├─ 15/09: 39.00 CHF
│  └─ 30/09: 39.50 CHF
└─ Avg 3 mesi: 39.50 CHF
```

---

## STEP 1: CALCOLO PREZZI CRITICI

### Mozzarella 125g (ID: 123)
```
Costo: 2.50 CHF
Punto Critico = 2.50 * 1.4 = 3.50 CHF
Prezzo Medio (3 mesi) = 4.20 CHF
Prezzo Venduto = 3.20 CHF

Confronto:
  3.20 < 3.50 (Punto Critico)
  → CATEGORIA: sotto_pc ❌
  → GAP PC: -0.30 CHF (-8.6%)
  → GAP Medio: -1.00 CHF (-23.8%)
```

### Ricotta 250g (ID: 124)
```
Costo: 3.00 CHF
Punto Critico = 3.00 * 1.4 = 4.20 CHF
Prezzo Medio (3 mesi) = 5.15 CHF
Prezzo Venduto = 4.10 CHF

Confronto:
  4.10 >= 4.20? NO (4.10 < 4.20)
  → CATEGORIA: sotto_pc ❌
  → GAP PC: -0.10 CHF (-2.4%)
  → GAP Medio: -1.05 CHF (-20.4%)
```

### Parmigiano 36 mesi (ID: 125)
```
Costo: 28.00 CHF
Punto Critico = 28.00 * 1.4 = 39.20 CHF
Prezzo Medio (3 mesi) = 39.50 CHF
Prezzo Venduto = 38.50 CHF

Confronto:
  38.50 >= 39.20? NO (38.50 < 39.20)
  → CATEGORIA: sotto_pc ❌
  → GAP PC: -0.70 CHF (-1.8%)
  → GAP Medio: -1.00 CHF (-2.5%)
```

---

## STEP 2: CLASSIFICAZIONE AUTOMATICA

### Risultato Aggregate API
```json
{
  "success": true,
  "stats": {
    "sotto_pc": 3,
    "tra_pc_medio": 0,
    "sopra_medio": 0,
    "richieste_blocco": 0,
    "total_products": 3,
    "total_orders": 1
  },
  "products": [
    {
      "orderId": 100,
      "orderName": "SO001",
      "customerId": 50,
      "customerName": "Ristorante Da Mario",
      "productId": 123,
      "productName": "Mozzarella 125g",
      "productCode": "MOZ125",
      "quantity": 10,
      "currentPriceUnit": 3.20,
      "costPrice": 2.50,
      "avgSellingPrice": 4.20,
      "criticalPoint": 3.50,
      "category": "sotto_pc",
      "isLocked": false
    },
    {
      "orderId": 100,
      "orderName": "SO001",
      "customerId": 50,
      "customerName": "Ristorante Da Mario",
      "productId": 124,
      "productName": "Ricotta 250g",
      "productCode": "RIC250",
      "quantity": 5,
      "currentPriceUnit": 4.10,
      "costPrice": 3.00,
      "avgSellingPrice": 5.15,
      "criticalPoint": 4.20,
      "category": "sotto_pc",
      "isLocked": false
    },
    {
      "orderId": 100,
      "orderName": "SO001",
      "customerId": 50,
      "customerName": "Ristorante Da Mario",
      "productId": 125,
      "productName": "Parmigiano 36 mesi",
      "productCode": "PARM36",
      "quantity": 2,
      "currentPriceUnit": 38.50,
      "costPrice": 28.00,
      "avgSellingPrice": 39.50,
      "criticalPoint": 39.20,
      "category": "sotto_pc",
      "isLocked": false
    }
  ]
}
```

---

## STEP 3: USER FLOW - Paul

### 3.1: Paul apre /controllo-prezzi
```
UI mostra badge:
┌─────────────────────────────────────────┐
│  💰 CONTROLLO PREZZI                    │
├─────────────────────────────────────────┤
│                                         │
│  🔴 SOTTO PUNTO CRITICO        [3]      │
│  🟡 TRA PC E MEDIO             [0]      │
│  🟢 SOPRA MEDIO                [0]      │
│  🔒 RICHIESTE BLOCCO           [0]      │
│  📊 TUTTI I PREZZI             [3]      │
│                                         │
└─────────────────────────────────────────┘
```

### 3.2: Paul clicca "SOTTO PUNTO CRITICO"
```
API Call: GET /api/controllo-prezzi/products?category=below_critical&days=7

UI mostra griglia:
┌──────────────────────────────────────────────────────┐
│  SOTTO PUNTO CRITICO                        [3]      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐               │
│  │ 📦     │  │ 📦     │  │ 📦     │               │
│  │Mozzar. │  │Ricotta │  │Parmig. │               │
│  │        │  │        │  │        │               │
│  │3.20 CHF│  │4.10 CHF│  │38.50   │               │
│  │⏳ Pend.│  │⏳ Pend.│  │⏳ Pend.│               │
│  │👤Mario │  │👤Mario │  │👤Mario │               │
│  └────────┘  └────────┘  └────────┘               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 3.3: Paul clicca card "Mozzarella 125g"
```
Modal si apre:
┌─────────────────────────────────────────────────────┐
│                     ✕ (close)                        │
│                                                      │
│            ┌──────────────────────┐                 │
│            │                      │                 │
│            │        📦            │                 │
│            │  (immagine prodotto) │                 │
│            │                      │                 │
│            └──────────────────────┘                 │
│                                                      │
│         MOZZARELLA 125g                              │
│         COD: MOZ125                                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Prezzo Venduto:      CHF 3.20                │   │
│  │ Sconto:              0%                      │   │
│  ├──────────────────────────────────────────────┤   │
│  │ Cliente:             Ristorante Da Mario     │   │
│  │ Ordine:              SO001                   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ANALISI PREZZI                               │   │
│  ├──────────────────────────────────────────────┤   │
│  │ Punto Critico:       CHF 3.50                │   │
│  │ Medio (3 mesi):      CHF 4.20                │   │
│  │ Costo:               CHF 2.50                │   │
│  │                                              │   │
│  │ [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]   │   │
│  │  ^        ^                  ^               │   │
│  │  Costo    PC                 Medio           │   │
│  │        👉 Venduto (3.20)                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  AZIONI DISPONIBILI                                  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ✅ Marca come Controllato                    │   │
│  │    Prezzo verificato e approvato             │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🔒 Blocca Prezzo                             │   │
│  │    Blocca e rimuovi dalla lista              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ⏳ Da Controllare                             │   │
│  │    Riporta in stato pending                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## STEP 4: DECISIONI DI PAUL

### Scenario A: "Marca come Controllato"
```
Paul pensa:
"Cliente importante, va bene dare sconto.
Ho verificato che il margine c'è (0.70 CHF = 28%)."

Paul clicca: ✅ Marca come Controllato

API Call:
POST /api/controllo-prezzi/mark-reviewed
{
  "productId": 123,
  "orderId": 100,
  "reviewedBy": "paul.diserens@gmail.com",
  "note": "Cliente importante - OK sconto"
}

Odoo crea record:
x_price_review.create({
  product_id: 123,
  order_id: 100,
  status: 'reviewed',
  reviewed_by: 'paul.diserens@gmail.com',
  reviewed_at: '2025-11-12 14:30:00',
  note: 'Cliente importante - OK sconto',
  sold_price: 3.20,
  cost_price: 2.50,
  critical_price: 3.50,
  avg_selling_price: 4.20
})

UI:
- Toast: "✅ Prezzo marcato come controllato"
- Prodotto scompare dalla lista
- Badge aggiornato: SOTTO PC [2] (era 3)
```

### Scenario B: "Blocca Prezzo"
```
Paul pensa:
"Questo prezzo è troppo basso. NON approvare.
Il venditore deve rinegoziare con il cliente."

Paul clicca: 🔒 Blocca Prezzo

API Call:
POST /api/controllo-prezzi/block-price
{
  "productId": 124,
  "orderId": 100,
  "blockedBy": "paul.diserens@gmail.com",
  "note": "Prezzo troppo basso - Rinegoziare"
}

Odoo:
1. Crea/aggiorna x_price_review:
   {
     product_id: 124,
     order_id: 100,
     status: 'blocked',
     blocked_by: 'paul.diserens@gmail.com',
     blocked_at: '2025-11-12 14:32:00',
     note: 'Prezzo troppo basso - Rinegoziare'
   }

2. OPZIONALE: Crea mail.activity per venditore:
   {
     res_model: 'sale.order',
     res_id: 100,
     summary: 'Blocco Prezzo: Ricotta 250g',
     note: 'Paul ha bloccato il prezzo. Rinegoziare con cliente.',
     user_id: venditore_ordine
   }

UI:
- Toast: "🔒 Prezzo bloccato - non apparirà più"
- Prodotto scompare dalla lista
- Badge aggiornato: SOTTO PC [1], RICHIESTE BLOCCO [1]
```

### Scenario C: "Da Controllare"
```
Paul pensa:
"Non sono sicuro. Voglio controllare più tardi."

Paul clicca: ⏳ Da Controllare

API Call:
POST /api/controllo-prezzi/mark-pending
{
  "productId": 125,
  "orderId": 100
}

Odoo aggiorna x_price_review:
{
  product_id: 125,
  order_id: 100,
  status: 'pending',
  reviewed_by: null,
  blocked_by: null
}

UI:
- Toast: "⏳ Prezzo riportato a Da Controllare"
- Badge status aggiornato: ⏳ Da Controllare
- Prodotto rimane in lista
```

---

## STEP 5: QUERY ODOO ESEGUITE

### Query 1: Get Orders (aggregate)
```python
sale.order.search_read([
  ['company_id', '=', 1],
  ['state', 'in', ['draft', 'sent']]
], ['id', 'name', 'partner_id', 'order_line'])

# Returns:
[{
  'id': 100,
  'name': 'SO001',
  'partner_id': [50, 'Ristorante Da Mario'],
  'order_line': [201, 202, 203]
}]
```

### Query 2: Get Order Lines
```python
sale.order.line.search_read([
  ['id', 'in', [201, 202, 203]]
], ['id', 'product_id', 'price_unit', 'product_uom_qty', 'discount'])

# Returns:
[
  {
    'id': 201,
    'product_id': [123, 'Mozzarella 125g'],
    'price_unit': 3.20,
    'product_uom_qty': 10,
    'discount': 0.0
  },
  {
    'id': 202,
    'product_id': [124, 'Ricotta 250g'],
    'price_unit': 4.10,
    'product_uom_qty': 5,
    'discount': 5.0
  },
  {
    'id': 203,
    'product_id': [125, 'Parmigiano 36 mesi'],
    'price_unit': 38.50,
    'product_uom_qty': 2,
    'discount': 0.0
  }
]
```

### Query 3: Get Products
```python
product.product.search_read([
  ['id', 'in', [123, 124, 125]]
], ['id', 'name', 'default_code', 'standard_price', 'list_price', 'image_128'])

# Returns:
[
  {
    'id': 123,
    'name': 'Mozzarella 125g',
    'default_code': 'MOZ125',
    'standard_price': 2.50,
    'list_price': 4.50,
    'image_128': 'iVBORw0KG...' (base64)
  },
  {
    'id': 124,
    'name': 'Ricotta 250g',
    'default_code': 'RIC250',
    'standard_price': 3.00,
    'list_price': 5.00,
    'image_128': 'iVBORw0KG...'
  },
  {
    'id': 125,
    'name': 'Parmigiano 36 mesi',
    'default_code': 'PARM36',
    'standard_price': 28.00,
    'list_price': 42.00,
    'image_128': 'iVBORw0KG...'
  }
]
```

### Query 4: Get Historical Sales (3 months)
```python
sale.order.line.search_read([
  ['product_id', 'in', [123, 124, 125]],
  ['state', 'in', ['sale', 'done']],
  ['create_date', '>=', '2025-08-12']
], ['product_id', 'price_unit'])

# Returns:
[
  {'product_id': [123], 'price_unit': 4.20},
  {'product_id': [123], 'price_unit': 4.30},
  {'product_id': [123], 'price_unit': 4.10},
  {'product_id': [123], 'price_unit': 4.25},
  {'product_id': [123], 'price_unit': 4.15},
  {'product_id': [124], 'price_unit': 5.20},
  {'product_id': [124], 'price_unit': 5.10},
  {'product_id': [124], 'price_unit': 5.25},
  {'product_id': [124], 'price_unit': 5.05},
  {'product_id': [125], 'price_unit': 39.50},
  {'product_id': [125], 'price_unit': 40.00},
  {'product_id': [125], 'price_unit': 39.00},
  {'product_id': [125], 'price_unit': 39.50}
]

# Calculate averages:
# Product 123: (4.20 + 4.30 + 4.10 + 4.25 + 4.15) / 5 = 4.20
# Product 124: (5.20 + 5.10 + 5.25 + 5.05) / 4 = 5.15
# Product 125: (39.50 + 40.00 + 39.00 + 39.50) / 4 = 39.50
```

### Query 5: Check Review Status
```python
x_price_review.search_read([
  ['product_id', 'in', [123, 124, 125]],
  ['order_id', '=', 100]
], ['product_id', 'status', 'reviewed_by', 'blocked_by', 'note'])

# PRIMA delle azioni:
# Returns: []

# DOPO mark_as_reviewed su 123:
[{
  'product_id': [123],
  'order_id': [100],
  'status': 'reviewed',
  'reviewed_by': 'paul.diserens@gmail.com',
  'note': 'Cliente importante - OK sconto'
}]

# DOPO block_price su 124:
[
  {
    'product_id': [123],
    'status': 'reviewed',
    ...
  },
  {
    'product_id': [124],
    'order_id': [100],
    'status': 'blocked',
    'blocked_by': 'paul.diserens@gmail.com',
    'note': 'Prezzo troppo basso - Rinegoziare'
  }
]
```

---

## STEP 6: STATO FINALE

### Badge Conteggi Aggiornati
```
┌─────────────────────────────────────────┐
│  💰 CONTROLLO PREZZI                    │
├─────────────────────────────────────────┤
│                                         │
│  🔴 SOTTO PUNTO CRITICO        [1]      │  (era 3)
│  🟡 TRA PC E MEDIO             [0]      │
│  🟢 SOPRA MEDIO                [0]      │
│  🔒 RICHIESTE BLOCCO           [1]      │  (era 0)
│  📊 TUTTI I PREZZI             [1]      │  (era 3)
│                                         │
└─────────────────────────────────────────┘
```

### Records in x_price_review
```
┌────────────────────────────────────────────────────────────────┐
│ ID │ Product    │ Order  │ Status   │ Reviewed/Blocked By    │
├────────────────────────────────────────────────────────────────┤
│ 1  │ 123 (Mozz) │ SO001  │ reviewed │ paul.diserens@gmail... │
│ 2  │ 124 (Ric)  │ SO001  │ blocked  │ paul.diserens@gmail... │
│ 3  │ 125 (Parm) │ SO001  │ pending  │ -                      │
└────────────────────────────────────────────────────────────────┘
```

### Prossime Azioni per Venditore
```
Venditore riceve notification in Odoo:
┌─────────────────────────────────────────────────────────────┐
│ 🔔 Hai 1 nuova attività                                     │
├─────────────────────────────────────────────────────────────┤
│ Blocco Prezzo: Ricotta 250g                                 │
│ Ordine: SO001 - Ristorante Da Mario                         │
│ Note: Paul ha bloccato il prezzo. Rinegoziare con cliente.  │
│ Prezzo attuale: 4.10 CHF                                    │
│ Prezzo minimo: 4.20 CHF (Punto Critico)                     │
│                                                             │
│ [Rivedi Prezzo] [Contatta Cliente]                          │
└─────────────────────────────────────────────────────────────┘
```

---

## SUMMARY

### Prodotti Analizzati: 3
- **Mozzarella 125g**: Sotto PC → Reviewed ✅
- **Ricotta 250g**: Sotto PC → Blocked 🔒
- **Parmigiano 36 mesi**: Sotto PC → Pending ⏳

### Query Eseguite: 5
- Get orders
- Get order lines
- Get products
- Get historical sales
- Check review status

### Actions: 2
- 1 review
- 1 block

### Tempo Totale: ~2 minuti
- Paul ha controllato 3 prodotti
- Ha preso 2 decisioni
- 1 prodotto rimandato

---

**Questo è un esempio completo del workflow end-to-end dell'app Controllo Prezzi.**
