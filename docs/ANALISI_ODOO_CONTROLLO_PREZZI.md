# ANALISI COMPLETA: Requisiti Odoo per App "Controllo Prezzi"

**Data Analisi:** 12 Novembre 2025
**App Analizzata:** /controllo-prezzi
**Scopo:** Identificare TUTTI i requisiti Odoo necessari per implementare l'app

---

## EXECUTIVE SUMMARY

L'app "Controllo Prezzi" richiede:
- 5 modelli Odoo STANDARD (nessun custom model necessario)
- 1 CUSTOM MODEL da creare: `x_price_review` per tracking
- 3 campi computed necessari
- Integrazione con mail.activity per richieste di blocco
- Query complesse su ordini ultimi 7 giorni
- Calcolo media prezzi ultimi 3 mesi

---

## 1. MODELLI ODOO NECESSARI

### 1.1 sale.order (Ordini di Vendita)
**Scopo:** Fonte principale dei dati - ordini in stato draft/sent

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID ordine
- name                  # Nome ordine (es: SO001)
- partner_id            # Cliente (relazione a res.partner)
- state                 # Stato ordine (draft, sent, sale, done, cancel)
- order_line            # Righe ordine (relazione a sale.order.line)
- date_order            # Data ordine
- commitment_date       # Data consegna prevista
- pricelist_id          # Listino prezzi applicato
- company_id            # Azienda (LAPA = 1)
- user_id               # Venditore assegnato
```

**Query Usate:**
```python
# Endpoint: /api/controllo-prezzi/aggregate
domain: [
  ['company_id', '=', 1],           # Solo LAPA
  ['state', 'in', ['draft', 'sent']] # Solo ordini in revisione
]
order: 'date_order DESC'
```

**Dove viene usato:**
- `/api/controllo-prezzi/aggregate` - Recupera TUTTI gli ordini draft/sent
- `/api/controllo-prezzi/products` - Filtra ordini ultimi N giorni (TODO)
- `/api/controllo-prezzi/counts` - Conta prodotti per categoria (TODO)

---

### 1.2 sale.order.line (Righe Ordine)
**Scopo:** Contiene i dettagli dei prodotti venduti e prezzi applicati

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID riga ordine
- order_id              # Ordine di appartenenza
- product_id            # Prodotto (relazione a product.product)
- name                  # Descrizione prodotto
- product_uom_qty       # Quantità
- price_unit            # Prezzo unitario applicato (IMPORTANTE!)
- discount              # Sconto % applicato
- state                 # Stato riga (draft, sale, done, cancel)
- create_date           # Data creazione (per storico)
```

**Query Usate:**
```python
# 1. Righe ordine corrente
domain: [['id', 'in', order.order_line]]

# 2. Storico vendite ultimi 3 mesi (per calcolo media)
domain: [
  ['product_id', 'in', productIds],
  ['state', 'in', ['sale', 'done']],      # Solo vendite confermate
  ['create_date', '>=', '2025-08-12']     # Ultimi 3 mesi
]
```

**Dove viene usato:**
- `/api/controllo-prezzi/aggregate` - Analizza righe ordini draft/sent
- Calcolo prezzo medio vendita (ultimi 3 mesi)

---

### 1.3 product.product (Prodotti)
**Scopo:** Informazioni sui prodotti, costo di acquisto, listino

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID prodotto
- name                  # Nome prodotto
- default_code          # Codice interno/SKU
- barcode               # Codice a barre
- list_price            # Prezzo listino base
- standard_price        # COSTO D'ACQUISTO (FONDAMENTALE!)
- image_128             # Immagine prodotto (base64)
- categ_id              # Categoria prodotto
- company_id            # Azienda
```

**Query Usate:**
```python
domain: [
  ['id', 'in', productIds],
  ['company_id', 'in', [1, false]]  # LAPA o globale
]
```

**CAMPO CRITICO:**
- `standard_price` = Costo d'acquisto (usato per calcolare Punto Critico)

**Dove viene usato:**
- `/api/controllo-prezzi/aggregate` - Recupera dati prodotti
- `/api/controllo-prezzi/products` - Mostra card prodotto con immagine

---

### 1.4 res.partner (Clienti)
**Scopo:** Informazioni clienti per visualizzazione

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID cliente
- name                  # Nome cliente (es: "Ristorante Da Mario")
- email                 # Email
- phone                 # Telefono
- vat                   # Partita IVA
- user_id               # Venditore assegnato
```

**Dove viene usato:**
- Visualizzazione cliente nella card prodotto
- Filtro per venditore (futuro)

---

### 1.5 product.pricelist.item (Listino Prezzi)
**Scopo:** Verifica se prezzo è "bloccato" (fixed_price)

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID item listino
- pricelist_id          # Listino di appartenenza
- product_id            # Prodotto
- compute_price         # Tipo calcolo: 'fixed', 'percentage', 'formula'
- fixed_price           # Prezzo fisso (se compute_price='fixed')
```

**Query Usate:**
```python
domain: [
  ['pricelist_id', '=', order.pricelist_id[0]],
  ['product_id', 'in', productIds]
]
```

**Logica:**
- `compute_price === 'fixed'` → Prezzo bloccato (isLocked = true)

**Dove viene usato:**
- `/api/controllo-prezzi/aggregate` - Determina se prodotto ha prezzo bloccato

---

### 1.6 mail.activity (Task/Attività)
**Scopo:** Traccia "Richieste di Blocco Prezzo" create dai venditori

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID attività
- res_model             # Modello di riferimento ('sale.order')
- res_model_id          # ID del modello (FK a ir.model)
- res_id                # ID risorsa (ID ordine)
- summary               # Oggetto attività (contiene "Blocco Prezzo")
- activity_type_id      # Tipo attività
- user_id               # Utente assegnato
- date_deadline         # Scadenza
- state                 # Stato (planned, today, overdue, done)
```

**Query Usate:**
```python
# Prima recupera model_id di 'sale.order'
ir.model.search_read([['model', '=', 'sale.order']])

# Poi conta attività
domain: [
  ['res_model_id', '=', modelId],
  ['res_model', '=', 'sale.order'],
  ['res_id', 'in', orderIds],
  ['summary', 'ilike', 'Blocco Prezzo']  # Filtra per tipo richiesta
]
```

**Dove viene usato:**
- `/api/controllo-prezzi/aggregate` - Conta richieste di blocco pending
- `/api/controllo-prezzi/counts` - Badge "Richieste Blocco"

---

### 1.7 ir.model (Metadata Models)
**Scopo:** Recupera model_id per query su mail.activity

**Campi Richiesti:**
```python
Fields Used:
- id                    # ID modello
- model                 # Nome modello (es: 'sale.order')
```

**Query Usate:**
```python
domain: [['model', '=', 'sale.order']]
limit: 1
```

---

## 2. CUSTOM MODEL DA CREARE

### 2.1 x_price_review (Price Review Tracking)
**Scopo:** Tracciare le revisioni dei prezzi (reviewed, blocked, pending)

**Struttura del Model:**
```python
class XPriceReview(models.Model):
    _name = 'x.price.review'
    _description = 'Price Review Tracking'
    _order = 'create_date DESC'

    # Identificatori
    product_id = fields.Many2one('product.product', required=True)
    order_id = fields.Many2one('sale.order', required=True)
    order_line_id = fields.Many2one('sale.order.line', required=True)

    # Stato revisione
    status = fields.Selection([
        ('pending', 'Da Controllare'),
        ('reviewed', 'Controllato'),
        ('blocked', 'Bloccato')
    ], default='pending', required=True)

    # Chi e quando
    reviewed_by = fields.Char('Revisionato Da')      # Email utente
    reviewed_at = fields.Datetime('Data Revisione')
    blocked_by = fields.Char('Bloccato Da')          # Email utente
    blocked_at = fields.Datetime('Data Blocco')

    # Note
    note = fields.Text('Note')

    # Snapshot prezzi (per storico)
    sold_price = fields.Float('Prezzo Venduto', digits='Product Price')
    cost_price = fields.Float('Costo Acquisto', digits='Product Price')
    critical_price = fields.Float('Punto Critico', digits='Product Price')
    avg_selling_price = fields.Float('Prezzo Medio', digits='Product Price')

    # Metadata
    create_date = fields.Datetime('Data Creazione', readonly=True)
    write_date = fields.Datetime('Ultima Modifica', readonly=True)
```

**Indici Necessari:**
```sql
CREATE INDEX idx_x_price_review_product_order
ON x_price_review(product_id, order_id);

CREATE INDEX idx_x_price_review_status
ON x_price_review(status);
```

**API Methods Necessari:**
```python
def mark_as_reviewed(self, product_id, order_id, reviewed_by, note=None):
    """Marca un prodotto come controllato"""

def block_price(self, product_id, order_id, blocked_by, note=None):
    """Blocca un prezzo"""

def mark_as_pending(self, product_id, order_id):
    """Riporta a stato pending"""

def get_review_status(self, product_id, order_id):
    """Recupera stato revisione"""
```

**Endpoint che lo usano:**
- `/api/controllo-prezzi/mark-reviewed` - Salva review
- `/api/controllo-prezzi/block-price` - Salva blocco
- `/api/controllo-prezzi/mark-pending` - Reset a pending
- `/api/controllo-prezzi/products` - Filtra per status
- `/api/controllo-prezzi/counts` - Conta per status

---

## 3. COMPUTED FIELDS NECESSARI

### 3.1 avgSellingPrice (Prezzo Medio Vendita)
**Scopo:** Calcola prezzo medio vendita ultimi 3 mesi

**Come viene calcolato:**
```python
# Logica attuale in aggregate/route.ts (linee 179-211)

1. Query sale.order.line:
   - product_id in productIds
   - state in ['sale', 'done']
   - create_date >= (oggi - 3 mesi)

2. Raggruppa per product_id
3. Calcola media di price_unit

# Esempio implementazione Odoo
def _compute_avg_selling_price(self):
    three_months_ago = fields.Date.today() - timedelta(days=90)
    for product in self:
        lines = self.env['sale.order.line'].search([
            ('product_id', '=', product.id),
            ('state', 'in', ['sale', 'done']),
            ('create_date', '>=', three_months_ago)
        ])
        if lines:
            product.avg_selling_price_3m = sum(lines.mapped('price_unit')) / len(lines)
        else:
            product.avg_selling_price_3m = product.list_price
```

**Dove serve:**
- Calcolo categoria prezzo (tra_pc_medio, sopra_medio)
- Visualizzazione slider prezzi
- Badge indicatore performance

**Performance:**
- Cached field con compute_sudo=True
- Store=True per velocità
- Trigger: create/write su sale.order.line

---

### 3.2 criticalPrice (Punto Critico)
**Scopo:** Calcola Punto Critico = standard_price * 1.4

**Implementazione:**
```python
# SEMPLICE - Non richiede stored field

critical_price = fields.Float(
    compute='_compute_critical_price',
    string='Punto Critico',
    digits='Product Price'
)

def _compute_critical_price(self):
    for product in self:
        product.critical_price = product.standard_price * 1.4
```

**Formula:**
```
Punto Critico = Costo Acquisto * 1.4
```

**Dove serve:**
- Classificazione prodotti "sotto_pc"
- Visualizzazione marker su slider
- Calcolo margine minimo accettabile

---

### 3.3 priceCategory (Categoria Prezzo)
**Scopo:** Determina categoria prezzo rispetto a PC e Media

**Logica di Classificazione:**
```python
# Da aggregate/route.ts (linee 249-261)

if (currentPrice < criticalPoint):
    category = 'sotto_pc'       # SOTTO PUNTO CRITICO - ATTENZIONE!

elif (avgSellingPrice > 0 && currentPrice < avgSellingPrice):
    category = 'tra_pc_medio'   # TRA PC E MEDIO - DA VERIFICARE

else:
    category = 'sopra_medio'    # SOPRA MEDIO - OK
```

**Implementazione Odoo:**
```python
def _compute_price_category(self):
    """Calcola categoria prezzo per riga ordine"""
    for line in self:
        product = line.product_id
        current_price = line.price_unit
        critical_point = product.standard_price * 1.4
        avg_price = product.avg_selling_price_3m or product.list_price

        if current_price < critical_point:
            line.price_category = 'sotto_pc'
        elif avg_price > 0 and current_price < avg_price:
            line.price_category = 'tra_pc_medio'
        else:
            line.price_category = 'sopra_medio'
```

**Dove serve:**
- Filtro categorie nell'UI
- Badge colorati nelle card
- Aggregazione conteggi

---

## 4. CONFIGURAZIONI ODOO RICHIESTE

### 4.1 Company ID
```python
LAPA Company ID: 1
```
**Tutte le query devono filtrare per company_id = 1**

### 4.2 Stati Ordine Monitorati
```python
States: ['draft', 'sent']
```
Solo ordini in revisione, non ancora confermati.

### 4.3 Listini Prezzi
- Devono esistere product.pricelist per ogni venditore
- compute_price='fixed' indica prezzo bloccato

### 4.4 Activity Types
- Deve esistere un activity_type con nome "Blocco Prezzo"
- Usato per creare richieste di blocco

---

## 5. STORAGE DATI TRACKING

### Opzione A: Custom Model Odoo (RACCOMANDATO)
**Pro:**
- Integrato con Odoo
- Query veloci
- Backup automatico
- Security rules native

**Contro:**
- Richiede sviluppo modulo Odoo
- Deploy più complesso

**Implementazione:**
```python
# Module: lapa_price_review
# File: models/x_price_review.py
```

---

### Opzione B: Database Esterno (PostgreSQL)
**Pro:**
- Indipendente da Odoo
- Facile da modificare
- Query flessibili

**Contro:**
- Sync complesso
- Backup separato
- Security manuale

**Schema:**
```sql
CREATE TABLE price_reviews (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL,
  order_id INT NOT NULL,
  order_line_id INT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  blocked_by VARCHAR(255),
  blocked_at TIMESTAMP,
  note TEXT,
  sold_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  critical_price DECIMAL(10,2),
  avg_selling_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_order ON price_reviews(product_id, order_id);
CREATE INDEX idx_status ON price_reviews(status);
```

---

### Opzione C: File JSON (NON RACCOMANDATO)
**Pro:**
- Veloce da implementare
- Zero dipendenze

**Contro:**
- Non scalabile
- Nessun backup
- Concorrenza problematica
- Perdita dati facile

**Struttura:**
```json
{
  "reviews": [
    {
      "productId": 123,
      "orderId": 456,
      "status": "reviewed",
      "reviewedBy": "paul.diserens@gmail.com",
      "reviewedAt": "2025-11-12T10:30:00Z",
      "note": "Prezzo verificato, OK"
    }
  ]
}
```

---

## 6. QUERY E FILTRI PRINCIPALI

### 6.1 Recupera Ordini Draft/Sent (Aggregate)
```python
# Endpoint: /api/controllo-prezzi/aggregate
Model: sale.order
Method: search_read
Domain: [
  ['company_id', '=', 1],
  ['state', 'in', ['draft', 'sent']]
]
Fields: ['id', 'name', 'partner_id', 'state', 'order_line']
Order: 'date_order DESC'
```

### 6.2 Recupera Righe Ordine
```python
Model: sale.order.line
Method: search_read
Domain: [['id', 'in', order.order_line]]
Fields: [
  'id', 'product_id', 'name',
  'product_uom_qty', 'price_unit', 'discount'
]
```

### 6.3 Recupera Dati Prodotti
```python
Model: product.product
Method: search_read
Domain: [
  ['id', 'in', productIds],
  ['company_id', 'in', [1, false]]
]
Fields: [
  'id', 'name', 'default_code',
  'list_price', 'standard_price'
]
```

### 6.4 Calcola Prezzo Medio (3 mesi)
```python
Model: sale.order.line
Method: search_read
Domain: [
  ['product_id', 'in', productIds],
  ['state', 'in', ['sale', 'done']],
  ['create_date', '>=', '2025-08-12']  # 3 mesi fa
]
Fields: ['product_id', 'price_unit']

# Post-processing
avgPriceMap = {}
for line in lines:
    productId = line['product_id'][0]
    avgPriceMap[productId] = avg(prices[productId])
```

### 6.5 Verifica Prezzi Bloccati (Listino)
```python
Model: product.pricelist.item
Method: search_read
Domain: [
  ['pricelist_id', '=', order.pricelist_id[0]],
  ['product_id', 'in', productIds]
]
Fields: ['id', 'product_id', 'compute_price', 'fixed_price']

# Logica
isLocked = (item.compute_price === 'fixed')
```

### 6.6 Conta Richieste di Blocco
```python
# Step 1: Get model ID
Model: ir.model
Method: search_read
Domain: [['model', '=', 'sale.order']]
Fields: ['id', 'model']
Limit: 1

# Step 2: Count activities
Model: mail.activity
Method: search_read
Domain: [
  ['res_model_id', '=', modelId],
  ['res_model', '=', 'sale.order'],
  ['res_id', 'in', orderIds],
  ['summary', 'ilike', 'Blocco Prezzo']
]
Fields: ['id', 'res_id', 'summary']

# Count
richieste_blocco = len(activities)
```

---

## 7. PERFORMANCE CONSIDERATIONS

### 7.1 Problemi Attuali
```python
# ❌ N+1 Problem in aggregate/route.ts
for order in orders:
    orderLines = callOdoo(...)      # 1 query per order
    products = callOdoo(...)         # 1 query per order
    historicalLines = callOdoo(...)  # 1 query per order
    pricelistItems = callOdoo(...)   # 1 query per order

# Con 50 ordini = 200+ queries!
```

### 7.2 Ottimizzazioni Necessarie
```python
# ✅ Batch Queries
1. Fetch ALL order IDs
2. Fetch ALL order_line_ids in 1 query
3. Fetch ALL products in 1 query
4. Fetch ALL historical data in 1 query
5. Post-process in memoria

# Riduce da 200+ a 5 queries
```

### 7.3 Caching Strategy
```python
# Cache avgSellingPrice per prodotto
Key: `avg_price:${productId}:${dateMonth}`
TTL: 1 hour (richiesto ogni ora)

# Cache product.product
Key: `product:${productId}`
TTL: 10 minutes

# Cache review status
Key: `review:${productId}:${orderId}`
TTL: 5 minutes
```

---

## 8. WORKFLOW COMPLETO

### 8.1 User Flow: Paul/Laura
```
1. Apre /controllo-prezzi
2. Vede 5 categorie con conteggi:
   - Sotto PC (12)
   - Tra PC e Medio (8)
   - Sopra Medio (45)
   - Richieste Blocco (3)
   - Tutti (68)
3. Clicca "Sotto PC"
4. API fetch /api/controllo-prezzi/products?category=below_critical
5. Vede griglia prodotti
6. Clicca su prodotto
7. Vede modal con:
   - Immagine prodotto
   - Prezzo venduto vs PC vs Medio
   - Slider visuale
   - 3 azioni:
     a) Marca Controllato → /api/controllo-prezzi/mark-reviewed
     b) Blocca Prezzo → /api/controllo-prezzi/block-price
     c) Da Controllare → /api/controllo-prezzi/mark-pending
```

### 8.2 Data Flow
```
1. GET /api/controllo-prezzi/counts
   → Odoo: sale.order (draft/sent)
   → Odoo: sale.order.line
   → Calcola categorie
   → Return: { sotto_pc: 12, tra_pc_medio: 8, ... }

2. GET /api/controllo-prezzi/products?category=sotto_pc
   → Odoo: sale.order (draft/sent)
   → Odoo: sale.order.line
   → Odoo: product.product
   → Odoo: sale.order.line (storico 3 mesi)
   → Calcola avgPrice per prodotto
   → Filtra category = 'sotto_pc'
   → Return: [ { id, name, soldPrice, criticalPrice, ... } ]

3. POST /api/controllo-prezzi/mark-reviewed
   → Body: { productId, orderId, reviewedBy }
   → Save to x_price_review:
     {
       product_id: 123,
       order_id: 456,
       status: 'reviewed',
       reviewed_by: 'paul@lapa.ch',
       reviewed_at: NOW()
     }
   → Return: { success: true }
```

---

## 9. ENDPOINTS DA IMPLEMENTARE

### 9.1 GET /api/controllo-prezzi/counts
**Status:** MOCK (linea 10: TODO)

**Cosa deve fare:**
```typescript
1. Chiama /api/controllo-prezzi/aggregate
2. Estrae stats.sotto_pc, stats.tra_pc_medio, ...
3. Query x_price_review per contare blocked
4. Return {
     byCategory: {
       below_critical: stats.sotto_pc,
       critical_to_avg: stats.tra_pc_medio,
       above_avg: stats.sopra_medio,
       blocked: reviewsBlocked.length,
       all: stats.total_products
     }
   }
```

---

### 9.2 GET /api/controllo-prezzi/products
**Status:** MOCK (linea 17: TODO)

**Query params:**
- category: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all'
- days: number (default 7)

**Cosa deve fare:**
```typescript
1. Chiama /api/controllo-prezzi/aggregate
2. Filtra products per category
3. Per ogni product:
   - Fetch x_price_review status
   - Fetch image_128 from product.product
4. Return {
     success: true,
     products: [...],
     summary: { total, totalRevenue, byCategory, byStatus }
   }
```

---

### 9.3 POST /api/controllo-prezzi/mark-reviewed
**Status:** MOCK (linea 24: TODO)

**Body:**
```json
{
  "productId": 123,
  "orderId": 456,
  "reviewedBy": "paul.diserens@gmail.com",
  "note": "Prezzo verificato"
}
```

**Cosa deve fare:**
```typescript
1. Create/Update record in x_price_review:
   {
     product_id: 123,
     order_id: 456,
     status: 'reviewed',
     reviewed_by: 'paul.diserens@gmail.com',
     reviewed_at: new Date(),
     note: 'Prezzo verificato'
   }
2. Return { success: true }
```

---

### 9.4 POST /api/controllo-prezzi/block-price
**Status:** MOCK (linea 24: TODO)

**Body:**
```json
{
  "productId": 123,
  "orderId": 456,
  "blockedBy": "paul.diserens@gmail.com",
  "note": "Prezzo bloccato - margine troppo basso"
}
```

**Cosa deve fare:**
```typescript
1. Create/Update record in x_price_review:
   {
     product_id: 123,
     order_id: 456,
     status: 'blocked',
     blocked_by: 'paul.diserens@gmail.com',
     blocked_at: new Date(),
     note: 'Prezzo bloccato - margine troppo basso'
   }

2. OPZIONALE: Crea mail.activity su sale.order:
   {
     res_model: 'sale.order',
     res_id: 456,
     summary: 'Blocco Prezzo: Prodotto #123',
     note: 'Paul ha bloccato il prezzo...',
     user_id: order.user_id (venditore)
   }

3. Return { success: true }
```

---

### 9.5 POST /api/controllo-prezzi/mark-pending
**Status:** MOCK (linea 24: TODO)

**Body:**
```json
{
  "productId": 123,
  "orderId": 456
}
```

**Cosa deve fare:**
```typescript
1. Update record in x_price_review:
   {
     status: 'pending',
     reviewed_by: null,
     reviewed_at: null,
     blocked_by: null,
     blocked_at: null
   }
2. Return { success: true }
```

---

## 10. CHECKLIST IMPLEMENTAZIONE

### STEP 1: Preparazione Odoo
- [ ] Crea custom model `x_price_review`
- [ ] Aggiungi field `avg_selling_price_3m` a product.product (stored, computed)
- [ ] Aggiungi field `price_category` a sale.order.line (computed)
- [ ] Verifica activity_type "Blocco Prezzo" esiste
- [ ] Crea security rules per x_price_review

### STEP 2: API Counts
- [ ] Implementa GET /api/controllo-prezzi/counts
- [ ] Integra con /aggregate per stats
- [ ] Query x_price_review per blocked count
- [ ] Test con ordini draft reali

### STEP 3: API Products
- [ ] Implementa GET /api/controllo-prezzi/products
- [ ] Integra con /aggregate
- [ ] Filtra per category
- [ ] Fetch image_128 per ogni prodotto
- [ ] Fetch review status da x_price_review
- [ ] Test con filtri

### STEP 4: API Mark Reviewed
- [ ] Implementa POST /api/controllo-prezzi/mark-reviewed
- [ ] Create/Update in x_price_review
- [ ] Validation productId, orderId esistono
- [ ] Test con UI

### STEP 5: API Block Price
- [ ] Implementa POST /api/controllo-prezzi/block-price
- [ ] Create/Update in x_price_review
- [ ] OPZIONALE: Crea mail.activity
- [ ] Test con UI

### STEP 6: API Mark Pending
- [ ] Implementa POST /api/controllo-prezzi/mark-pending
- [ ] Reset status in x_price_review
- [ ] Test con UI

### STEP 7: Ottimizzazioni
- [ ] Batch queries in /aggregate (ridurre N+1)
- [ ] Cache avgSellingPrice (Redis/Memory)
- [ ] Index su x_price_review
- [ ] Pagination per /products (limit 100)

### STEP 8: Testing
- [ ] Test con Paul/Laura accounts
- [ ] Test con 100+ prodotti
- [ ] Test performance (<2s per categoria)
- [ ] Test edge cases (prodotti senza storico)

---

## 11. DOMANDE E RISPOSTE

### Q1: Quali modelli Odoo sono necessari?
**A:** 7 modelli:
1. sale.order (STANDARD)
2. sale.order.line (STANDARD)
3. product.product (STANDARD)
4. res.partner (STANDARD)
5. product.pricelist.item (STANDARD)
6. mail.activity (STANDARD)
7. x_price_review (CUSTOM - DA CREARE)

---

### Q2: Ci sono campi custom da creare in Odoo?
**A:** SI, 3 campi:

1. **product.product.avg_selling_price_3m**
   - Type: Float
   - Compute: Media price_unit ultimi 3 mesi
   - Store: True (per performance)

2. **sale.order.line.price_category**
   - Type: Selection
   - Compute: Categoria prezzo (sotto_pc, tra_pc_medio, sopra_medio)
   - Store: False (computed on-the-fly)

3. **Tutto il model x_price_review** (vedi sezione 2.1)

---

### Q3: Ci sono computed fields necessari?
**A:** SI, 3 computed fields:

1. **avgSellingPrice** (avg_selling_price_3m)
   - Calcola media vendite ultimi 3 mesi
   - Trigger: create/write su sale.order.line

2. **criticalPrice**
   - Formula: standard_price * 1.4
   - Compute semplice

3. **priceCategory**
   - Determina: sotto_pc | tra_pc_medio | sopra_medio
   - Dipende da: soldPrice, criticalPrice, avgSellingPrice

---

### Q4: Come viene calcolato il "punto critico"?
**A:** Formula semplice:
```python
Punto Critico = standard_price * 1.4

# Dove:
# - standard_price = Costo d'acquisto del prodotto (product.product)
# - 1.4 = Moltiplicatore fisso (40% margine minimo)

# Esempio:
# Prodotto costa 10 CHF
# Punto Critico = 10 * 1.4 = 14 CHF
# Se vendo sotto 14 CHF → ALERT "sotto_pc"
```

---

### Q5: Come viene calcolato il "prezzo medio"?
**A:** Media vendite ultimi 3 mesi:
```python
1. Query sale.order.line WHERE:
   - product_id = X
   - state IN ['sale', 'done']
   - create_date >= (oggi - 3 mesi)

2. Estrai tutti price_unit

3. Calcola media:
   avgPrice = SUM(price_unit) / COUNT(lines)

# Se nessuna vendita → Usa list_price
```

---

### Q6: Cosa sono le "richieste di blocco"?
**A:** Task (mail.activity) creati dai venditori per chiedere blocco prezzo.

**Dove vengono salvate:**
- Model: `mail.activity`
- res_model: `sale.order`
- res_id: ID dell'ordine
- summary: Contiene "Blocco Prezzo"

**Come vengono contate:**
```python
mail.activity.search_read([
  ['res_model', '=', 'sale.order'],
  ['res_id', 'in', orderIds],
  ['summary', 'ilike', 'Blocco Prezzo']
])
```

---

### Q7: Serve un database custom per tracking?
**A:** SI. 3 opzioni:

**RACCOMANDATO: Custom Model Odoo (x_price_review)**
- Pro: Integrato, veloce, sicuro
- Contro: Richiede sviluppo modulo

**Alternativa: PostgreSQL esterno**
- Pro: Flessibile, indipendente
- Contro: Sync complesso

**NON RACCOMANDATO: File JSON**
- Pro: Veloce da fare
- Contro: Non scalabile, rischio perdita dati

---

## 12. NEXT STEPS

### Immediate (Settimana 1)
1. Crea custom model `x_price_review` in Odoo
2. Implementa computed field `avg_selling_price_3m`
3. Implementa API /counts (completa)
4. Implementa API /products (completa)

### Short-term (Settimana 2)
5. Implementa API mark-reviewed
6. Implementa API block-price
7. Implementa API mark-pending
8. Test end-to-end con Paul/Laura

### Medium-term (Settimana 3-4)
9. Ottimizza performance /aggregate (batch queries)
10. Aggiungi caching (Redis)
11. Aggiungi pagination
12. Dashboard analytics per Paul/Laura

---

## APPENDICE A: Esempio Completo di Query

```typescript
// ESEMPIO: Recupera tutti i prodotti "sotto_pc" ultimi 7 giorni

// Step 1: Get orders
const orders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
  domain: [
    ['company_id', '=', 1],
    ['state', 'in', ['draft', 'sent']],
    ['date_order', '>=', '2025-11-05']  // Ultimi 7 giorni
  ],
  fields: ['id', 'name', 'partner_id', 'order_line']
});

// Step 2: Get order lines
const orderLineIds = orders.flatMap(o => o.order_line);
const lines = await callOdoo(cookies, 'sale.order.line', 'search_read', [], {
  domain: [['id', 'in', orderLineIds]],
  fields: ['id', 'product_id', 'price_unit', 'product_uom_qty']
});

// Step 3: Get products
const productIds = lines.map(l => l.product_id[0]);
const products = await callOdoo(cookies, 'product.product', 'search_read', [], {
  domain: [['id', 'in', productIds]],
  fields: ['id', 'name', 'default_code', 'standard_price', 'image_128']
});

// Step 4: Calculate avg prices (last 3 months)
const historicalLines = await callOdoo(cookies, 'sale.order.line', 'search_read', [], {
  domain: [
    ['product_id', 'in', productIds],
    ['state', 'in', ['sale', 'done']],
    ['create_date', '>=', '2025-08-12']
  ],
  fields: ['product_id', 'price_unit']
});

// Post-process
const avgPriceMap = new Map();
historicalLines.forEach(line => {
  const pid = line.product_id[0];
  if (!avgPriceMap.has(pid)) avgPriceMap.set(pid, []);
  avgPriceMap.get(pid).push(line.price_unit);
});

avgPriceMap.forEach((prices, pid) => {
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  avgPriceMap.set(pid, avg);
});

// Step 5: Filter "sotto_pc"
const sottoPcProducts = lines.filter(line => {
  const product = products.find(p => p.id === line.product_id[0]);
  const criticalPrice = product.standard_price * 1.4;
  return line.price_unit < criticalPrice;
});

console.log(`Trovati ${sottoPcProducts.length} prodotti sotto PC`);
```

---

## APPENDICE B: SQL per Custom Model

```sql
-- Create custom model table
CREATE TABLE x_price_review (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES product_product(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES sale_order(id) ON DELETE CASCADE,
  order_line_id INTEGER REFERENCES sale_order_line(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  blocked_by VARCHAR(255),
  blocked_at TIMESTAMP,
  note TEXT,
  sold_price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  critical_price NUMERIC(10,2),
  avg_selling_price NUMERIC(10,2),
  create_date TIMESTAMP NOT NULL DEFAULT NOW(),
  write_date TIMESTAMP NOT NULL DEFAULT NOW(),
  create_uid INTEGER REFERENCES res_users(id),
  write_uid INTEGER REFERENCES res_users(id)
);

-- Indexes
CREATE INDEX idx_x_price_review_product_order
  ON x_price_review(product_id, order_id);

CREATE INDEX idx_x_price_review_status
  ON x_price_review(status);

CREATE INDEX idx_x_price_review_reviewed_at
  ON x_price_review(reviewed_at);

-- Constraints
ALTER TABLE x_price_review
  ADD CONSTRAINT unique_product_order
  UNIQUE(product_id, order_id);

-- Trigger for write_date
CREATE OR REPLACE FUNCTION update_write_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.write_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_write_date
  BEFORE UPDATE ON x_price_review
  FOR EACH ROW
  EXECUTE FUNCTION update_write_date();
```

---

**Fine Analisi**
**Documento creato:** 12 Novembre 2025
**Revisione:** v1.0
**Autore:** Odoo Integration Master
