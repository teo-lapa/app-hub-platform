# ANALISI COMPLETA ODOO - APP CONTROLLO PREZZI

## INDICE
1. [Panoramica Sistema](#panoramica-sistema)
2. [Modelli Odoo Utilizzati](#modelli-odoo-utilizzati)
3. [Campi Odoo Necessari](#campi-odoo-necessari)
4. [Query e Domain Filters](#query-e-domain-filters)
5. [Formule di Calcolo](#formule-di-calcolo)
6. [Setup Odoo Richiesto](#setup-odoo-richiesto)
7. [Campi Custom da Creare](#campi-custom-da-creare)
8. [API Routes e Logica](#api-routes-e-logica)
9. [Warning e Problemi Identificati](#warning-e-problemi-identificati)

---

## PANORAMICA SISTEMA

L'app **Controllo Prezzi** permette a Paul e Laura di:
- Monitorare prezzi di vendita rispetto a **Punto Critico (PC)** e **Prezzo Medio**
- Classificare prodotti in 5 categorie di prezzo
- Marcare prezzi come "controllati" o "bloccati"
- Identificare vendite sotto margine minimo

### Categorie Prezzo
1. **SOTTO PUNTO CRITICO** - Prezzo < PC (Costo * 1.4) - ALERT
2. **TRA PC E MEDIO** - PC <= Prezzo < Media vendita
3. **SOPRA MEDIO** - Prezzo >= Media vendita
4. **RICHIESTE BLOCCO** - Task Odoo di richiesta blocco prezzo
5. **TUTTI I PREZZI** - Vista completa

---

## MODELLI ODOO UTILIZZATI

### 1. sale.order (Ordini Vendita)
**Scopo**: Recuperare ordini da controllare (draft + sent)

### 2. sale.order.line (Righe Ordine)
**Scopo**: Analizzare prezzo venduto per ogni prodotto

### 3. product.product (Prodotti)
**Scopo**: Dati prodotto, immagini, costi, prezzi listino

### 4. res.partner (Clienti)
**Scopo**: Info cliente per ogni ordine

### 5. product.pricelist.item (Prezzi Bloccati)
**Scopo**: Verificare se prezzo è locked in listino

### 6. mail.activity (Task/Attività)
**Scopo**: Contare richieste di blocco prezzo

### 7. ir.model (Meta-modelli)
**Scopo**: Trovare model_id per filtrare task

### 8. CUSTOM: price.check.review (DA CREARE)
**Scopo**: Tracciare stato review prezzi (pending/reviewed/blocked)

---

## CAMPI ODOO NECESSARI

### 📦 product.product
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- name                  # CHAR - Nome prodotto
- default_code          # CHAR - SKU/Codice interno
- barcode               # CHAR - Codice a barre
- image_128             # BINARY - Immagine piccola (base64)
- list_price            # FLOAT - Prezzo listino base
- standard_price        # FLOAT - COSTO D'ACQUISTO (per PC)
- company_id            # MANY2ONE - Azienda (filtro LAPA = 1)

CALCOLATI:
- qty_available         # FLOAT - Stock disponibile (opzionale)
```

### 🛒 sale.order
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- name                  # CHAR - Numero ordine (es: SO001)
- partner_id            # MANY2ONE (res.partner) - Cliente
- state                 # SELECTION - Stato ordine
  # Stati chiave: 'draft', 'sent', 'sale', 'done', 'cancel'
- date_order            # DATETIME - Data ordine
- pricelist_id          # MANY2ONE (product.pricelist) - Listino prezzi
- order_line            # ONE2MANY (sale.order.line) - Righe ordine
- company_id            # MANY2ONE - Azienda (LAPA = 1)
- user_id               # MANY2ONE (res.users) - Venditore
- amount_total          # FLOAT - Totale ordine (opzionale)
- commitment_date       # DATE - Data consegna (opzionale)
```

### 📋 sale.order.line
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- order_id              # MANY2ONE (sale.order) - Ordine parent
- product_id            # MANY2ONE (product.product) - Prodotto
- name                  # TEXT - Descrizione riga
- product_uom_qty       # FLOAT - Quantità ordinata
- product_uom           # MANY2ONE (uom.uom) - Unità di misura
- price_unit            # FLOAT - PREZZO VENDUTO (chiave per analisi)
- discount              # FLOAT - Sconto percentuale (0-100)
- price_subtotal        # FLOAT - Subtotale riga (opzionale)
- state                 # SELECTION - Stato riga (inherited da order)
- create_date           # DATETIME - Data creazione

CAMPI PER CALCOLO STORICO:
- create_date           # Per filtrare ultimi 3 mesi
- state                 # Solo 'sale' e 'done' per media
```

### 👤 res.partner
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- name                  # CHAR - Nome cliente/azienda
- email                 # CHAR - Email (opzionale)
- phone                 # CHAR - Telefono (opzionale)
- vat                   # CHAR - Partita IVA (opzionale)
- street                # CHAR - Indirizzo (opzionale)
- city                  # CHAR - Città (opzionale)
```

### 💰 product.pricelist.item
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- pricelist_id          # MANY2ONE (product.pricelist) - Listino
- product_id            # MANY2ONE (product.product) - Prodotto
- compute_price         # SELECTION - Tipo calcolo
  # 'fixed' = prezzo bloccato
  # 'percentage' = percentuale
  # 'formula' = formula
- fixed_price           # FLOAT - Prezzo fisso (se compute_price='fixed')
- applied_on            # SELECTION - Applicato su cosa
  # '0_product_variant' = prodotto specifico
  # '1_product' = template prodotto
  # '2_product_category' = categoria
  # '3_global' = globale
```

### 📨 mail.activity (Task Richieste Blocco)
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- res_model_id          # MANY2ONE (ir.model) - Modello collegato
- res_model             # CHAR - Nome modello (es: 'sale.order')
- res_id                # INT - ID record collegato
- summary               # CHAR - Titolo task
  # Cercare: 'Blocco Prezzo' oppure 'RICHIESTA BLOCCO PREZZO'
- note                  # HTML - Descrizione task
- user_id               # MANY2ONE (res.users) - Assegnato a
- date_deadline         # DATE - Scadenza
- state                 # SELECTION - Stato
  # 'overdue', 'today', 'planned', 'done'
```

### 🗂️ ir.model (Meta-modelli)
```python
CAMPI STANDARD:
- id                    # INT (Primary Key)
- model                 # CHAR - Nome tecnico modello (es: 'sale.order')
- name                  # CHAR - Nome visualizzato
```

---

## QUERY E DOMAIN FILTERS

### Query 1: Ordini da Controllare (draft + sent)
```python
domain = [
    ['company_id', '=', 1],           # Solo LAPA
    ['state', 'in', ['draft', 'sent']] # Ordini in revisione
]

fields = ['id', 'name', 'partner_id', 'state', 'order_line', 'pricelist_id']

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:77-89
```

### Query 2: Righe Ordine Specifico
```python
domain = [
    ['id', 'in', order_line_ids]  # IDs da order.order_line
]

fields = [
    'id',
    'product_id',
    'name',
    'product_uom_qty',
    'price_unit',      # PREZZO VENDUTO
    'discount'
]

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:126-142
```

### Query 3: Prodotti con Dettagli
```python
domain = [
    ['id', 'in', product_ids],           # Lista product IDs
    ['company_id', 'in', [1, false]]     # LAPA o globale
]

fields = [
    'id',
    'name',
    'default_code',
    'list_price',
    'standard_price'   # COSTO (per calcolo PC)
]

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:151-169
```

### Query 4: Storico Vendite Ultimi 3 Mesi (per Media)
```python
# Calcola data 3 mesi fa
from datetime import datetime, timedelta
three_months_ago = datetime.now() - timedelta(days=90)
date_from_str = three_months_ago.strftime('%Y-%m-%d')

domain = [
    ['product_id', 'in', product_ids],
    ['state', 'in', ['sale', 'done']],   # Solo ordini confermati
    ['create_date', '>=', date_from_str]  # Ultimi 3 mesi
]

fields = ['product_id', 'price_unit']

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:175-192
```

### Query 5: Prezzi Bloccati in Listino
```python
domain = [
    ['pricelist_id', '=', order_pricelist_id],
    ['product_id', 'in', product_ids]
]

fields = ['id', 'product_id', 'compute_price', 'fixed_price']

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:216-228
```

### Query 6: Task Richieste Blocco Prezzo
```python
# Step 1: Trova model_id per 'sale.order'
domain = [['model', '=', 'sale.order']]
fields = ['id', 'model']

# Step 2: Trova task con summary "Blocco Prezzo"
domain = [
    ['res_model_id', '=', model_id],
    ['res_model', '=', 'sale.order'],
    ['res_id', 'in', order_ids],
    ['summary', 'ilike', 'Blocco Prezzo']  # Case-insensitive LIKE
]

fields = ['id', 'res_id', 'summary']

# Codice da: app/api/controllo-prezzi/aggregate/route.ts:298-331
```

### Query 7: Filtraggio per Periodo (Ultimi N giorni)
```python
# Default: ultimi 7 giorni
days = 7  # parametro da query string
date_from = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

domain = [
    ['company_id', '=', 1],
    ['state', 'in', ['draft', 'sent']],
    ['date_order', '>=', date_from]  # Solo ordini recenti
]

# Nota: Implementare in /api/controllo-prezzi/products
```

---

## FORMULE DI CALCOLO

### 1. PUNTO CRITICO (PC)
```typescript
// Formula base: Costo + 40% margine
const criticalPrice = costPrice * 1.4;

// Esempio:
// costPrice = CHF 10.00
// criticalPrice = CHF 14.00 (margine minimo 40%)
```
**Campo Odoo**: `product.product.standard_price * 1.4`

### 2. PREZZO MEDIO VENDITA (AVG)
```typescript
// Media prezzi venduti ultimi 3 mesi
const historicalPrices = [18.50, 19.00, 18.75, 19.25, 18.80];
const avgSellingPrice = historicalPrices.reduce((sum, p) => sum + p, 0) / historicalPrices.length;
// avgSellingPrice = CHF 18.86

// Se nessuna vendita storica, usa list_price
if (historicalPrices.length === 0) {
  avgSellingPrice = product.list_price;
}
```
**Campo Odoo**: Calcolato da `sale.order.line.price_unit` (ultimi 3 mesi, state='sale'/'done')

### 3. MARGINE EFFETTIVO
```typescript
// Margine percentuale sul prezzo venduto
const margin = ((soldPrice - costPrice) / costPrice) * 100;

// Esempio:
// soldPrice = CHF 15.00
// costPrice = CHF 10.00
// margin = 50%
```

### 4. VARIAZIONE PERCENTUALE vs MEDIO
```typescript
// Quanto il prezzo venduto si discosta dalla media
const variation = ((soldPrice - avgSellingPrice) / avgSellingPrice) * 100;

// Esempio:
// soldPrice = CHF 15.00
// avgSellingPrice = CHF 18.86
// variation = -20.46% (venduto sotto media)
```

### 5. CLASSIFICAZIONE CATEGORIA
```typescript
function classifyPriceCategory(
  soldPrice: number,
  criticalPrice: number,
  avgSellingPrice: number
): 'below_critical' | 'critical_to_avg' | 'above_avg' {

  if (soldPrice < criticalPrice) {
    return 'below_critical';  // ALERT! Sotto margine minimo
  }

  if (avgSellingPrice > 0 && soldPrice < avgSellingPrice) {
    return 'critical_to_avg';  // Tra PC e Media
  }

  return 'above_avg';  // Sopra media (ottimo)
}
```

### 6. SLIDER VISUALE (Min-Max Range)
```typescript
// Calcolo range slider per visualizzazione grafica
const min = costPrice * 1.05;  // +5% margine minimo
const max = avgSellingPrice > 0
  ? avgSellingPrice * 2.5   // 2.5x media
  : costPrice * 4.2;         // oppure 4.2x costo

// Posizioni marker su slider
const criticalPos = ((criticalPrice - min) / (max - min)) * 100;  // %
const avgPos = ((avgSellingPrice - min) / (max - min)) * 100;     // %
const valuePos = ((soldPrice - min) / (max - min)) * 100;         // %
```
**Codice**: `app/controllo-prezzi/page.tsx:242-253`

---

## SETUP ODOO RICHIESTO

### A. Configurazione Standard (Nessuna Modifica)
Questi campi esistono già in Odoo 17 standard:
- ✅ `product.product.standard_price` (Costo)
- ✅ `product.product.list_price` (Prezzo Listino)
- ✅ `product.product.image_128` (Immagine)
- ✅ `sale.order.line.price_unit` (Prezzo Venduto)
- ✅ `sale.order.line.discount` (Sconto)
- ✅ `mail.activity` (Task)

### B. Campi Calcolati da Implementare
Questi vanno calcolati via API (non stored in Odoo):
- ⚙️ `criticalPrice` = `standard_price * 1.4`
- ⚙️ `avgSellingPrice` = Media `price_unit` ultimi 3 mesi
- ⚙️ `margin` = `(price_unit - standard_price) / standard_price * 100`
- ⚙️ `priceCategory` = Classificazione basata su formule

### C. Computed Fields Opzionali Odoo
Se vuoi ottimizzare performance, crea questi computed fields in Odoo:

```python
# In product.product model
class ProductProduct(models.Model):
    _inherit = 'product.product'

    critical_price = fields.Float(
        string='Punto Critico',
        compute='_compute_critical_price',
        help='Costo + 40% margine (standard_price * 1.4)'
    )

    @api.depends('standard_price')
    def _compute_critical_price(self):
        for product in self:
            product.critical_price = product.standard_price * 1.4

    avg_selling_price_3m = fields.Float(
        string='Prezzo Medio 3 Mesi',
        compute='_compute_avg_selling_price',
        help='Media prezzi vendita ultimi 3 mesi'
    )

    @api.depends('standard_price')
    def _compute_avg_selling_price(self):
        for product in self:
            # Query ultimi 3 mesi
            three_months_ago = fields.Date.today() - relativedelta(months=3)
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

**VANTAGGI**:
- Riduce chiamate API
- Dati pre-calcolati
- Filtri Odoo più veloci

**SVANTAGGI**:
- Richiede sviluppo custom Odoo
- Devi gestire aggiornamenti computed fields

---

## CAMPI CUSTOM DA CREARE

### MODELLO CUSTOM: price.check.review

Serve per tracciare lo stato di review dei prezzi.

```python
# File: /mnt/extra-addons/lapa_price_check/models/price_check_review.py

from odoo import models, fields, api

class PriceCheckReview(models.Model):
    _name = 'price.check.review'
    _description = 'Controllo Prezzi - Review Status'
    _order = 'create_date desc'

    # Identificatori
    product_id = fields.Many2one(
        'product.product',
        string='Prodotto',
        required=True,
        ondelete='cascade'
    )

    order_id = fields.Many2one(
        'sale.order',
        string='Ordine',
        required=True,
        ondelete='cascade'
    )

    order_line_id = fields.Many2one(
        'sale.order.line',
        string='Riga Ordine',
        required=True,
        ondelete='cascade'
    )

    # Status
    status = fields.Selection(
        [
            ('pending', 'Da Controllare'),
            ('reviewed', 'Controllato'),
            ('blocked', 'Bloccato')
        ],
        string='Stato',
        default='pending',
        required=True
    )

    # Review info
    reviewed_by = fields.Char(
        string='Controllato Da',
        help='Email utente che ha controllato'
    )

    reviewed_at = fields.Datetime(
        string='Data Controllo'
    )

    # Block info
    blocked_by = fields.Char(
        string='Bloccato Da',
        help='Email utente che ha bloccato'
    )

    blocked_at = fields.Datetime(
        string='Data Blocco'
    )

    # Note
    note = fields.Text(
        string='Note'
    )

    # Snapshot dati prezzo (per audit)
    price_sold = fields.Float(
        string='Prezzo Venduto',
        help='Snapshot price_unit al momento review'
    )

    price_cost = fields.Float(
        string='Costo Prodotto',
        help='Snapshot standard_price al momento review'
    )

    price_critical = fields.Float(
        string='Punto Critico',
        compute='_compute_price_critical',
        store=True
    )

    price_category = fields.Selection(
        [
            ('below_critical', 'Sotto PC'),
            ('critical_to_avg', 'Tra PC e Medio'),
            ('above_avg', 'Sopra Medio')
        ],
        string='Categoria Prezzo'
    )

    # Computed
    @api.depends('price_cost')
    def _compute_price_critical(self):
        for record in self:
            record.price_critical = record.price_cost * 1.4

    # Constraint: 1 solo record per product+order
    _sql_constraints = [
        (
            'unique_product_order',
            'UNIQUE(product_id, order_id)',
            'Esiste già un controllo per questo prodotto in questo ordine'
        )
    ]
```

### MANIFEST DEL MODULO

```python
# File: /mnt/extra-addons/lapa_price_check/__manifest__.py

{
    'name': 'LAPA Price Check',
    'version': '1.0.0',
    'category': 'Sales',
    'summary': 'Sistema controllo prezzi vendita vs punto critico',
    'description': '''
        Permette di tracciare lo stato di review dei prezzi:
        - Marcare prezzi come controllati
        - Bloccare prezzi sospetti
        - Audit trail completo
    ''',
    'author': 'LAPA',
    'depends': ['sale', 'product', 'mail'],
    'data': [
        'security/ir.model.access.csv',
        'views/price_check_review_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

### SECURITY (Access Rights)

```csv
# File: /mnt/extra-addons/lapa_price_check/security/ir.model.access.csv

id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_price_check_review_user,price.check.review.user,model_price_check_review,base.group_user,1,1,1,0
access_price_check_review_manager,price.check.review.manager,model_price_check_review,sales_team.group_sale_manager,1,1,1,1
```

### VIEW XML (Opzionale - per visualizzare in Odoo)

```xml
<!-- File: /mnt/extra-addons/lapa_price_check/views/price_check_review_views.xml -->

<odoo>
    <!-- Tree View -->
    <record id="view_price_check_review_tree" model="ir.ui.view">
        <field name="name">price.check.review.tree</field>
        <field name="model">price.check.review</field>
        <field name="arch" type="xml">
            <tree string="Controlli Prezzi">
                <field name="create_date"/>
                <field name="product_id"/>
                <field name="order_id"/>
                <field name="price_sold"/>
                <field name="price_critical"/>
                <field name="price_category"/>
                <field name="status"/>
                <field name="reviewed_by"/>
                <field name="reviewed_at"/>
            </tree>
        </field>
    </record>

    <!-- Form View -->
    <record id="view_price_check_review_form" model="ir.ui.view">
        <field name="name">price.check.review.form</field>
        <field name="model">price.check.review</field>
        <field name="arch" type="xml">
            <form string="Controllo Prezzo">
                <header>
                    <field name="status" widget="statusbar"/>
                </header>
                <sheet>
                    <group>
                        <group>
                            <field name="product_id"/>
                            <field name="order_id"/>
                            <field name="order_line_id"/>
                        </group>
                        <group>
                            <field name="price_sold"/>
                            <field name="price_cost"/>
                            <field name="price_critical"/>
                            <field name="price_category"/>
                        </group>
                    </group>
                    <group>
                        <group>
                            <field name="reviewed_by"/>
                            <field name="reviewed_at"/>
                        </group>
                        <group>
                            <field name="blocked_by"/>
                            <field name="blocked_at"/>
                        </group>
                    </group>
                    <group>
                        <field name="note"/>
                    </group>
                </sheet>
            </form>
        </field>
    </record>

    <!-- Menu -->
    <menuitem
        id="menu_price_check_review"
        name="Controlli Prezzi"
        parent="sale.sale_menu_root"
        action="action_price_check_review"
        sequence="50"/>

    <record id="action_price_check_review" model="ir.actions.act_window">
        <field name="name">Controlli Prezzi</field>
        <field name="res_model">price.check.review</field>
        <field name="view_mode">tree,form</field>
    </record>
</odoo>
```

---

## API ROUTES E LOGICA

### 1. GET /api/controllo-prezzi/counts

**Scopo**: Contare prodotti per categoria

**Implementazione Necessaria**:
```typescript
// Query ordini draft/sent ultimi 7 giorni
const orders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
  domain: [
    ['company_id', '=', 1],
    ['state', 'in', ['draft', 'sent']],
    ['date_order', '>=', dateFrom]
  ],
  fields: ['id', 'order_line']
});

// Per ogni riga ordine, calcola categoria
const counts = {
  below_critical: 0,
  critical_to_avg: 0,
  above_avg: 0,
  blocked: 0,
  all: 0
};

// Loop su order lines, calcola PC e AVG, classifica
```

**Status**: ⚠️ TODO - Attualmente ritorna dati MOCK

### 2. GET /api/controllo-prezzi/products

**Scopo**: Lista prodotti filtrati per categoria

**Parametri**:
- `category`: 'below_critical' | 'critical_to_avg' | 'above_avg' | 'blocked' | 'all'
- `days`: numero giorni (default 7)

**Implementazione Necessaria**:
```typescript
// 1. Query ordini del periodo
// 2. Fetch order lines con product details
// 3. Calcola avgSellingPrice per ogni prodotto (ultimi 3 mesi)
// 4. Classifica in categoria
// 5. Fetch status review da 'price.check.review'
// 6. Ritorna array PriceCheckProduct[]
```

**Status**: ⚠️ TODO - Attualmente ritorna dati MOCK

### 3. POST /api/controllo-prezzi/mark-reviewed

**Scopo**: Marca prezzo come controllato

**Body**:
```json
{
  "productId": 123,
  "orderId": 456,
  "reviewedBy": "paul@lapa.ch",
  "note": "Prezzo verificato e ok"
}
```

**Implementazione Necessaria**:
```typescript
// 1. Cerca record in 'price.check.review'
const existing = await callOdoo(cookies, 'price.check.review', 'search_read', [], {
  domain: [
    ['product_id', '=', productId],
    ['order_id', '=', orderId]
  ]
});

// 2. Se esiste, aggiorna
if (existing.length > 0) {
  await callOdoo(cookies, 'price.check.review', 'write', [
    [existing[0].id],
    {
      status: 'reviewed',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      note: note
    }
  ]);
}

// 3. Se non esiste, crea
else {
  await callOdoo(cookies, 'price.check.review', 'create', [{
    product_id: productId,
    order_id: orderId,
    status: 'reviewed',
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    note: note
  }]);
}
```

**Status**: ⚠️ TODO - Attualmente solo console.log

### 4. POST /api/controllo-prezzi/block-price

**Scopo**: Blocca prezzo (impedisce modifiche future)

**Body**:
```json
{
  "productId": 123,
  "orderId": 456,
  "blockedBy": "laura@lapa.ch",
  "note": "Prezzo troppo basso, bloccato"
}
```

**Implementazione Necessaria**:
```typescript
// 1. Crea/aggiorna record in 'price.check.review' con status='blocked'
// 2. OPZIONALE: Crea task Odoo per notificare venditore
const activityTypeId = 4; // TODO Activity type in Odoo

await callOdoo(cookies, 'mail.activity', 'create', [{
  res_model: 'sale.order',
  res_id: orderId,
  summary: 'RICHIESTA BLOCCO PREZZO',
  note: `Prodotto ID ${productId} bloccato da ${blockedBy}. Motivo: ${note}`,
  activity_type_id: activityTypeId,
  user_id: 1 // Assegna a Paul
}]);

// 3. OPZIONALE: Blocca prezzo in listino
// Trova pricelist dell'ordine, crea pricelist.item con compute_price='fixed'
```

**Status**: ⚠️ TODO - Attualmente solo console.log

### 5. POST /api/controllo-prezzi/mark-pending

**Scopo**: Riporta prezzo a "Da Controllare"

**Body**:
```json
{
  "productId": 123,
  "orderId": 456
}
```

**Implementazione Necessaria**:
```typescript
// Aggiorna record in 'price.check.review'
await callOdoo(cookies, 'price.check.review', 'write', [
  [reviewRecordId],
  {
    status: 'pending',
    reviewed_by: false,
    reviewed_at: false,
    blocked_by: false,
    blocked_at: false
  }
]);
```

**Status**: ⚠️ TODO - Attualmente solo console.log

### 6. GET /api/controllo-prezzi/aggregate

**Scopo**: Aggregazione COMPLETA di tutti ordini draft/sent con analisi prezzi

**Status**: ✅ IMPLEMENTATO COMPLETAMENTE

**Query Flow**:
1. Fetch ordini draft/sent
2. Per ogni ordine:
   - Fetch order lines
   - Fetch product details (cost, list_price)
   - Calcola avgSellingPrice (ultimi 3 mesi)
   - Verifica prezzi locked in listino
   - Classifica in categoria
3. Conta task "Blocco Prezzo"
4. Ritorna stats + lista completa prodotti

**Response**:
```json
{
  "success": true,
  "stats": {
    "sotto_pc": 12,
    "tra_pc_medio": 8,
    "sopra_medio": 45,
    "richieste_blocco": 3,
    "total_products": 65,
    "total_orders": 15
  },
  "products": [
    {
      "orderId": 123,
      "orderName": "SO001",
      "customerId": 45,
      "customerName": "Cliente Test",
      "lineId": 789,
      "productId": 100,
      "productName": "Prodotto A",
      "productCode": "PROD-A",
      "quantity": 5,
      "currentPriceUnit": 15.50,
      "costPrice": 12.00,
      "avgSellingPrice": 18.50,
      "criticalPoint": 16.80,
      "category": "below_critical",
      "isLocked": false
    }
  ],
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

---

## WARNING E PROBLEMI IDENTIFICATI

### 🔴 CRITICI

#### 1. API Routes NON Implementate
**File Interessati**:
- `app/api/controllo-prezzi/counts/route.ts` - Solo MOCK
- `app/api/controllo-prezzi/products/route.ts` - Solo MOCK
- `app/api/controllo-prezzi/mark-reviewed/route.ts` - Solo console.log
- `app/api/controllo-prezzi/block-price/route.ts` - Solo console.log
- `app/api/controllo-prezzi/mark-pending/route.ts` - Solo console.log

**Impatto**: App NON funzionante in produzione

**Fix**: Implementare tutte le route come `aggregate/route.ts`

#### 2. Modello Custom 'price.check.review' NON Esiste
**Problema**: Nessun database per tracciare status review

**Impatto**:
- Impossibile salvare stato "controllato"/"bloccato"
- Nessun audit trail
- Dati persi ad ogni ricarica

**Fix**: Creare modulo Odoo custom (vedi sezione "Campi Custom da Creare")

**ALTERNATIVA**: Usare file JSON locale (NON raccomandato per produzione)

#### 3. Performance: N+1 Query Problem
**File**: `app/api/controllo-prezzi/aggregate/route.ts`

**Problema**: Loop su ordini con query separate
```typescript
for (const order of orders) {
  const orderLines = await callOdoo(...);  // Query 1
  const products = await callOdoo(...);     // Query 2
  const historicalLines = await callOdoo(...); // Query 3
  const pricelistItems = await callOdoo(...);  // Query 4
}
```

**Impatto**:
- 100 ordini = 400+ chiamate Odoo
- Timeout dopo 120 secondi
- Lentezza estrema

**Fix**: Batch queries
```typescript
// Fetch TUTTI gli order line IDs in una query
const allOrderLineIds = orders.flatMap(o => o.order_line);
const allOrderLines = await callOdoo(cookies, 'sale.order.line', 'search_read', [], {
  domain: [['id', 'in', allOrderLineIds]]
});

// Poi raggruppa per order_id
const linesByOrder = groupBy(allOrderLines, 'order_id');
```

### 🟡 WARNINGS

#### 4. Campo 'standard_price' Può Essere Zero
**Problema**: Prodotti senza costo impostato

**Impatto**: `criticalPrice = 0 * 1.4 = 0` (ERRATO)

**Fix**: Validazione
```typescript
if (!costPrice || costPrice <= 0) {
  console.warn(`⚠️ Prodotto ${productId} ha costo zero o negativo`);
  continue; // Salta prodotto
}
```

#### 5. Media Vendita Può Essere Zero
**Problema**: Prodotti mai venduti (nuovi)

**Impatto**: Categoria errata (finisce in 'above_avg' per default)

**Fix**: Fallback a list_price
```typescript
const avgSellingPrice = avgPriceMap.get(productId) || product.list_price || 0;
```

#### 6. Nessun Filtro per Company Multi-Azienda
**Problema**: Query `mail.activity` non filtra per company

**Impatto**: Conta task di TUTTE le aziende, non solo LAPA

**Fix**: Aggiungere join con sale.order per filtrare company_id=1

#### 7. Slider Visuale Può Avere Range Negativo
**Problema**: Se `avgSellingPrice = 0`, `max = costPrice * 4.2` può essere < min

**Impatto**: Marker fuori range, UI rotta

**Fix**: Validazione
```typescript
const min = Math.max(0, costPrice * 1.05);
const max = Math.max(min + 1, avgSellingPrice * 2.5 || costPrice * 4.2);
```

#### 8. Nessun Rate Limiting
**Problema**: Chiamate Odoo senza throttling

**Impatto**: Odoo può bloccare API calls

**Fix**: Implementare rate limiting o caching

### 🟢 OTTIMIZZAZIONI

#### 9. Caching Mancante
**Opportunità**: Dati prodotti cambiano raramente

**Fix**: Redis cache o Next.js cache
```typescript
import { unstable_cache } from 'next/cache';

const getProductsWithCache = unstable_cache(
  async () => callOdoo(...),
  ['products-price-check'],
  { revalidate: 300 } // 5 minuti
);
```

#### 10. Immagini Non Ottimizzate
**Problema**: `image_128` caricato per TUTTI i prodotti

**Impatto**: Payload API pesante

**Fix**: Caricare immagini solo quando serve (lazy load)

#### 11. Nessun Pagination
**Problema**: Carica TUTTI i prodotti in una query

**Impatto**: Lentezza con >100 prodotti

**Fix**: Implementare pagination
```typescript
const limit = 50;
const offset = page * limit;

const products = await callOdoo(cookies, 'product.product', 'search_read', [], {
  domain: [...],
  limit,
  offset
});
```

---

## RIEPILOGO FINALE

### CAMPI ODOO STANDARD NECESSARI

| Modello | Campo | Tipo | Obbligatorio | Note |
|---------|-------|------|--------------|------|
| product.product | id | INT | ✅ | Primary key |
| product.product | name | CHAR | ✅ | Nome prodotto |
| product.product | default_code | CHAR | ⚠️ | SKU (può essere null) |
| product.product | barcode | CHAR | ❌ | Codice a barre |
| product.product | image_128 | BINARY | ❌ | Immagine base64 |
| product.product | list_price | FLOAT | ✅ | Prezzo listino |
| product.product | standard_price | FLOAT | ✅ | COSTO (per PC) |
| product.product | company_id | MANY2ONE | ⚠️ | Filtro LAPA=1 |
| sale.order | id | INT | ✅ | Primary key |
| sale.order | name | CHAR | ✅ | Numero ordine |
| sale.order | partner_id | MANY2ONE | ✅ | Cliente |
| sale.order | state | SELECTION | ✅ | draft/sent/sale/done |
| sale.order | date_order | DATETIME | ✅ | Data ordine |
| sale.order | order_line | ONE2MANY | ✅ | Righe ordine |
| sale.order | pricelist_id | MANY2ONE | ❌ | Listino (per lock) |
| sale.order.line | id | INT | ✅ | Primary key |
| sale.order.line | product_id | MANY2ONE | ✅ | Prodotto |
| sale.order.line | name | TEXT | ✅ | Descrizione |
| sale.order.line | product_uom_qty | FLOAT | ✅ | Quantità |
| sale.order.line | price_unit | FLOAT | ✅ | PREZZO VENDUTO |
| sale.order.line | discount | FLOAT | ❌ | Sconto % |
| sale.order.line | state | SELECTION | ✅ | Stato riga |
| sale.order.line | create_date | DATETIME | ✅ | Per filtro 3 mesi |
| res.partner | id | INT | ✅ | Primary key |
| res.partner | name | CHAR | ✅ | Nome cliente |
| mail.activity | id | INT | ✅ | Primary key |
| mail.activity | res_model | CHAR | ✅ | 'sale.order' |
| mail.activity | res_id | INT | ✅ | Order ID |
| mail.activity | summary | CHAR | ✅ | Filtro 'Blocco Prezzo' |

### CAMPI CUSTOM DA CREARE

| Modello | Campo | Tipo | Descrizione |
|---------|-------|------|-------------|
| price.check.review | product_id | MANY2ONE | Prodotto controllato |
| price.check.review | order_id | MANY2ONE | Ordine parent |
| price.check.review | order_line_id | MANY2ONE | Riga ordine specifica |
| price.check.review | status | SELECTION | pending/reviewed/blocked |
| price.check.review | reviewed_by | CHAR | Email reviewer |
| price.check.review | reviewed_at | DATETIME | Timestamp review |
| price.check.review | blocked_by | CHAR | Email blocker |
| price.check.review | blocked_at | DATETIME | Timestamp blocco |
| price.check.review | note | TEXT | Note |
| price.check.review | price_sold | FLOAT | Snapshot prezzo venduto |
| price.check.review | price_cost | FLOAT | Snapshot costo |
| price.check.review | price_critical | FLOAT | Computed: cost * 1.4 |
| price.check.review | price_category | SELECTION | Categoria prezzo |

### QUERY DOMAIN SUMMARY

```python
# 1. Ordini da controllare
[['company_id', '=', 1], ['state', 'in', ['draft', 'sent']]]

# 2. Righe ordine
[['id', 'in', order_line_ids]]

# 3. Prodotti
[['id', 'in', product_ids], ['company_id', 'in', [1, false]]]

# 4. Storico vendite (media 3 mesi)
[
  ['product_id', 'in', product_ids],
  ['state', 'in', ['sale', 'done']],
  ['create_date', '>=', three_months_ago]
]

# 5. Prezzi locked
[['pricelist_id', '=', pricelist_id], ['product_id', 'in', product_ids]]

# 6. Task blocco prezzo
[
  ['res_model', '=', 'sale.order'],
  ['res_id', 'in', order_ids],
  ['summary', 'ilike', 'Blocco Prezzo']
]
```

### FORMULE CHIAVE

```typescript
// Punto Critico
const criticalPrice = standard_price * 1.4;

// Prezzo Medio (ultimi 3 mesi)
const avgSellingPrice = sum(price_units) / count(price_units);

// Margine
const margin = ((price_unit - standard_price) / standard_price) * 100;

// Categoria
if (price_unit < criticalPrice) return 'below_critical';
if (price_unit < avgSellingPrice) return 'critical_to_avg';
return 'above_avg';
```

### AZIONI RICHIESTE

#### PRIORITÀ ALTA (Blockers)
1. ✅ Creare modulo Odoo `lapa_price_check` con model `price.check.review`
2. ✅ Implementare `/api/controllo-prezzi/products`
3. ✅ Implementare `/api/controllo-prezzi/counts`
4. ✅ Implementare `/api/controllo-prezzi/mark-reviewed`
5. ✅ Implementare `/api/controllo-prezzi/block-price`

#### PRIORITÀ MEDIA (Performance)
6. ⚠️ Ottimizzare query con batch operations
7. ⚠️ Aggiungere caching (Redis o Next.js cache)
8. ⚠️ Implementare pagination

#### PRIORITÀ BASSA (Nice to Have)
9. ℹ️ Creare computed fields in Odoo per PC e AVG
10. ℹ️ Aggiungere view Odoo per visualizzare review
11. ℹ️ Implementare rate limiting

---

## PROSSIMI STEP

1. **Setup Odoo**
   - Installare modulo `lapa_price_check`
   - Verificare access rights
   - Testare CRUD su `price.check.review`

2. **Implementare API**
   - Partire da `/products` usando logica di `aggregate`
   - Poi `/counts` (versione light di aggregate)
   - Infine mark-reviewed/block-price/mark-pending

3. **Testing**
   - Testare con ordini reali
   - Verificare performance con >50 ordini
   - Controllare edge cases (costo=0, no storico, ecc)

4. **Deploy**
   - Ambiente staging prima
   - Monitorare performance
   - Raccogliere feedback Paul/Laura

---

**Documento compilato il**: 2025-11-12
**Versione App**: Next.js 14 + Odoo 17
**Autore Analisi**: Odoo Integration Master
