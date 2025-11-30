# ODOO SETUP CHECKLIST: Controllo Prezzi

Questa checklist elenca ESATTAMENTE tutti i passi per configurare Odoo per l'app Controllo Prezzi.

---

## PARTE 1: CUSTOM MODEL x_price_review

### Step 1.1: Crea Modulo Odoo
```bash
# Struttura directory
addons/
└── lapa_price_review/
    ├── __init__.py
    ├── __manifest__.py
    ├── models/
    │   ├── __init__.py
    │   └── x_price_review.py
    └── security/
        ├── ir.model.access.csv
        └── x_price_review_security.xml
```

### Step 1.2: __manifest__.py
```python
# addons/lapa_price_review/__manifest__.py

{
    'name': 'LAPA Price Review',
    'version': '17.0.1.0.0',
    'category': 'Sales',
    'summary': 'Price review tracking for sales orders',
    'description': """
        Track price reviews for products in draft/sent sales orders.
        Used by "Controllo Prezzi" app in Next.js frontend.
    """,
    'author': 'LAPA',
    'website': 'https://lapa.ch',
    'depends': ['base', 'sale_management', 'product'],
    'data': [
        'security/x_price_review_security.xml',
        'security/ir.model.access.csv',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

### Step 1.3: models/x_price_review.py
```python
# addons/lapa_price_review/models/x_price_review.py

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class XPriceReview(models.Model):
    _name = 'x.price.review'
    _description = 'Price Review Tracking'
    _order = 'create_date DESC'
    _rec_name = 'display_name'

    # Identificatori
    product_id = fields.Many2one(
        'product.product',
        string='Product',
        required=True,
        ondelete='cascade',
        index=True
    )
    order_id = fields.Many2one(
        'sale.order',
        string='Sale Order',
        required=True,
        ondelete='cascade',
        index=True
    )
    order_line_id = fields.Many2one(
        'sale.order.line',
        string='Order Line',
        ondelete='cascade'
    )

    # Stato revisione
    status = fields.Selection([
        ('pending', 'Da Controllare'),
        ('reviewed', 'Controllato'),
        ('blocked', 'Bloccato')
    ], string='Status', default='pending', required=True, index=True)

    # Chi e quando - Reviewed
    reviewed_by = fields.Char(
        string='Revisionato Da',
        help='Email utente che ha revisionato'
    )
    reviewed_at = fields.Datetime(
        string='Data Revisione',
        index=True
    )

    # Chi e quando - Blocked
    blocked_by = fields.Char(
        string='Bloccato Da',
        help='Email utente che ha bloccato'
    )
    blocked_at = fields.Datetime(
        string='Data Blocco'
    )

    # Note
    note = fields.Text(
        string='Note',
        help='Note aggiuntive sulla revisione'
    )

    # Snapshot prezzi (per storico)
    sold_price = fields.Float(
        string='Prezzo Venduto',
        digits='Product Price',
        help='Prezzo venduto al momento della revisione'
    )
    cost_price = fields.Float(
        string='Costo Acquisto',
        digits='Product Price',
        help='Costo di acquisto al momento della revisione'
    )
    critical_price = fields.Float(
        string='Punto Critico',
        digits='Product Price',
        help='Punto critico (costo * 1.4) al momento della revisione'
    )
    avg_selling_price = fields.Float(
        string='Prezzo Medio',
        digits='Product Price',
        help='Prezzo medio vendita 3 mesi al momento della revisione'
    )

    # Display name
    display_name = fields.Char(
        string='Name',
        compute='_compute_display_name',
        store=True
    )

    # Constraints
    _sql_constraints = [
        ('unique_product_order',
         'UNIQUE(product_id, order_id)',
         'Review già esistente per questo prodotto in questo ordine!')
    ]

    @api.depends('product_id', 'order_id', 'status')
    def _compute_display_name(self):
        for record in self:
            record.display_name = f"{record.product_id.name} - {record.order_id.name} [{record.status}]"

    @api.constrains('status', 'reviewed_by', 'blocked_by')
    def _check_status_user(self):
        for record in self:
            if record.status == 'reviewed' and not record.reviewed_by:
                raise ValidationError(_('Reviewed by is required when status is "reviewed"'))
            if record.status == 'blocked' and not record.blocked_by:
                raise ValidationError(_('Blocked by is required when status is "blocked"'))

    def mark_as_reviewed(self, reviewed_by, note=None):
        """Mark product as reviewed"""
        self.ensure_one()
        self.write({
            'status': 'reviewed',
            'reviewed_by': reviewed_by,
            'reviewed_at': fields.Datetime.now(),
            'note': note or self.note
        })
        return True

    def block_price(self, blocked_by, note=None):
        """Block price"""
        self.ensure_one()
        self.write({
            'status': 'blocked',
            'blocked_by': blocked_by,
            'blocked_at': fields.Datetime.now(),
            'note': note or self.note
        })
        return True

    def mark_as_pending(self):
        """Reset to pending status"""
        self.ensure_one()
        self.write({
            'status': 'pending',
            'reviewed_by': False,
            'reviewed_at': False,
            'blocked_by': False,
            'blocked_at': False
        })
        return True

    @api.model
    def get_or_create_review(self, product_id, order_id, order_line_id=None):
        """Get existing review or create new one"""
        review = self.search([
            ('product_id', '=', product_id),
            ('order_id', '=', order_id)
        ], limit=1)

        if not review:
            # Create with snapshot data
            product = self.env['product.product'].browse(product_id)
            order = self.env['sale.order'].browse(order_id)
            line = self.env['sale.order.line'].browse(order_line_id) if order_line_id else False

            # Calculate prices
            cost_price = product.standard_price
            critical_price = cost_price * 1.4
            sold_price = line.price_unit if line else 0.0

            # Calculate avg price (last 3 months)
            three_months_ago = fields.Date.today() - timedelta(days=90)
            historical_lines = self.env['sale.order.line'].search([
                ('product_id', '=', product_id),
                ('state', 'in', ['sale', 'done']),
                ('create_date', '>=', three_months_ago)
            ])
            avg_price = sum(historical_lines.mapped('price_unit')) / len(historical_lines) if historical_lines else product.list_price

            review = self.create({
                'product_id': product_id,
                'order_id': order_id,
                'order_line_id': order_line_id,
                'status': 'pending',
                'sold_price': sold_price,
                'cost_price': cost_price,
                'critical_price': critical_price,
                'avg_selling_price': avg_price
            })

        return review
```

### Step 1.4: security/ir.model.access.csv
```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_x_price_review_user,x.price.review user,model_x_price_review,base.group_user,1,1,1,0
access_x_price_review_manager,x.price.review manager,model_x_price_review,sales_team.group_sale_manager,1,1,1,1
```

### Step 1.5: security/x_price_review_security.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <!-- Record Rules -->
        <record id="price_review_rule_company" model="ir.rule">
            <field name="name">Price Review: Company Rule</field>
            <field name="model_id" ref="model_x_price_review"/>
            <field name="domain_force">[('order_id.company_id', 'in', company_ids)]</field>
            <field name="groups" eval="[(4, ref('base.group_user'))]"/>
        </record>
    </data>
</odoo>
```

### Step 1.6: Installa Modulo
```bash
# 1. Riavvia Odoo in modalità update
./odoo-bin -c odoo.conf -u lapa_price_review -d your_database --stop-after-init

# 2. Oppure da UI:
# Apps > Update Apps List > Search "LAPA Price Review" > Install
```

---

## PARTE 2: COMPUTED FIELD avg_selling_price_3m

### Step 2.1: Crea Modulo (se non esiste)
```bash
addons/
└── lapa_product_enhancements/
    ├── __init__.py
    ├── __manifest__.py
    └── models/
        ├── __init__.py
        └── product_product.py
```

### Step 2.2: __manifest__.py
```python
{
    'name': 'LAPA Product Enhancements',
    'version': '17.0.1.0.0',
    'category': 'Sales',
    'summary': 'Product enhancements for LAPA',
    'depends': ['product', 'sale'],
    'data': [],
    'installable': True,
}
```

### Step 2.3: models/product_product.py
```python
from odoo import api, fields, models
from datetime import timedelta

class ProductProduct(models.Model):
    _inherit = 'product.product'

    avg_selling_price_3m = fields.Float(
        string='Avg Selling Price (3 months)',
        compute='_compute_avg_selling_price_3m',
        store=True,
        digits='Product Price',
        help='Average selling price of last 3 months'
    )

    @api.depends('product_tmpl_id')
    def _compute_avg_selling_price_3m(self):
        """Calculate average selling price from last 3 months of sales"""
        three_months_ago = fields.Date.today() - timedelta(days=90)

        for product in self:
            # Find all confirmed sale order lines with this product
            lines = self.env['sale.order.line'].search([
                ('product_id', '=', product.id),
                ('state', 'in', ['sale', 'done']),
                ('create_date', '>=', three_months_ago)
            ])

            if lines:
                # Calculate average of price_unit
                total_price = sum(lines.mapped('price_unit'))
                product.avg_selling_price_3m = total_price / len(lines)
            else:
                # Fallback to list price if no sales
                product.avg_selling_price_3m = product.list_price

    def _recompute_avg_prices_batch(self):
        """Batch recompute for performance (can be called from cron)"""
        products = self.search([('active', '=', True)])
        products._compute_avg_selling_price_3m()
```

### Step 2.4: Aggiungi Cron Job (opzionale, per refresh automatico)
```xml
<!-- In lapa_product_enhancements/data/cron.xml -->
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data noupdate="1">
        <record id="cron_recompute_avg_prices" model="ir.cron">
            <field name="name">Recompute Product Average Prices</field>
            <field name="model_id" ref="product.model_product_product"/>
            <field name="state">code</field>
            <field name="code">model._recompute_avg_prices_batch()</field>
            <field name="interval_number">1</field>
            <field name="interval_type">days</field>
            <field name="numbercall">-1</field>
            <field name="active" eval="True"/>
        </record>
    </data>
</odoo>
```

---

## PARTE 3: COMPUTED FIELD price_category

### Step 3.1: Estendi sale.order.line
```python
# In lapa_product_enhancements/models/sale_order_line.py

from odoo import api, fields, models

class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    price_category = fields.Selection([
        ('sotto_pc', 'Sotto Punto Critico'),
        ('tra_pc_medio', 'Tra PC e Medio'),
        ('sopra_medio', 'Sopra Medio')
    ], string='Price Category', compute='_compute_price_category', store=False)

    critical_price = fields.Float(
        string='Critical Price',
        compute='_compute_critical_price',
        digits='Product Price'
    )

    @api.depends('product_id', 'product_id.standard_price')
    def _compute_critical_price(self):
        """Calculate critical price = cost * 1.4"""
        for line in self:
            if line.product_id:
                line.critical_price = line.product_id.standard_price * 1.4
            else:
                line.critical_price = 0.0

    @api.depends('price_unit', 'critical_price', 'product_id.avg_selling_price_3m')
    def _compute_price_category(self):
        """Determine price category"""
        for line in self:
            current_price = line.price_unit
            critical_price = line.critical_price
            avg_price = line.product_id.avg_selling_price_3m if line.product_id else 0.0

            if current_price < critical_price:
                line.price_category = 'sotto_pc'
            elif avg_price > 0 and current_price < avg_price:
                line.price_category = 'tra_pc_medio'
            else:
                line.price_category = 'sopra_medio'
```

---

## PARTE 4: VERIFICHE FINALI

### Check 1: Verifica Modelli Installati
```python
# Da shell Odoo:
self.env['ir.model'].search([('model', '=', 'x.price.review')])
# Deve ritornare 1 record

self.env['x.price.review'].search([])
# Deve funzionare (anche se lista vuota)
```

### Check 2: Verifica Computed Fields
```python
# Da shell Odoo:
product = self.env['product.product'].browse(123)
print(product.avg_selling_price_3m)  # Deve stampare un numero

line = self.env['sale.order.line'].browse(456)
print(line.critical_price)           # Deve stampare costo * 1.4
print(line.price_category)           # Deve stampare 'sotto_pc' / 'tra_pc_medio' / 'sopra_medio'
```

### Check 3: Verifica Access Rights
```python
# Da shell Odoo (come utente normale):
self.env['x.price.review'].check_access_rights('read')    # True
self.env['x.price.review'].check_access_rights('write')   # True
self.env['x.price.review'].check_access_rights('create')  # True
```

### Check 4: Test CRUD Operations
```python
# Da shell Odoo:
# Create
review = self.env['x.price.review'].create({
    'product_id': 123,
    'order_id': 456,
    'status': 'pending'
})

# Read
review = self.env['x.price.review'].search([('product_id', '=', 123)], limit=1)
print(review.display_name)

# Update (mark as reviewed)
review.mark_as_reviewed('paul.diserens@gmail.com', 'Test review')
print(review.status)  # 'reviewed'

# Update (block)
review.block_price('paul.diserens@gmail.com', 'Test block')
print(review.status)  # 'blocked'

# Update (reset)
review.mark_as_pending()
print(review.status)  # 'pending'
```

---

## PARTE 5: CONFIGURAZIONI ODOO

### Config 1: Company ID
```
Verifica company_id di LAPA:
Settings > Companies > LAPA
ID: 1 (dovrebbe essere 1)
```

### Config 2: Activity Type "Blocco Prezzo"
```bash
# Opzione A: Crea manualmente
Settings > Technical > Activities > Activity Types
> Create:
  Name: Blocco Prezzo
  Summary: Richiesta blocco prezzo prodotto
  Icon: fa-lock

# Opzione B: Crea via XML data
<record id="activity_type_price_block" model="mail.activity.type">
    <field name="name">Blocco Prezzo</field>
    <field name="summary">Richiesta blocco prezzo prodotto</field>
    <field name="icon">fa-lock</field>
</record>
```

### Config 3: Database Indexes (Performance)
```sql
-- Esegui da psql o pgAdmin
CREATE INDEX IF NOT EXISTS idx_sale_order_state_company
  ON sale_order(state, company_id);

CREATE INDEX IF NOT EXISTS idx_sale_order_line_product_state
  ON sale_order_line(product_id, state);

CREATE INDEX IF NOT EXISTS idx_sale_order_line_create_date
  ON sale_order_line(create_date);

CREATE INDEX IF NOT EXISTS idx_mail_activity_summary
  ON mail_activity(summary);

-- Già creati automaticamente dal model x_price_review:
-- idx_x_price_review_product_order (product_id, order_id)
-- idx_x_price_review_status (status)
-- idx_x_price_review_reviewed_at (reviewed_at)
```

---

## PARTE 6: TEST END-TO-END

### Test 1: Crea Review da API
```bash
curl -X POST http://localhost:3000/api/controllo-prezzi/mark-reviewed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 123,
    "orderId": 456,
    "reviewedBy": "paul.diserens@gmail.com",
    "note": "Test review"
  }'

# Expected: { "success": true }
```

### Test 2: Verifica in Odoo
```python
# Da shell Odoo:
review = self.env['x.price.review'].search([
    ('product_id', '=', 123),
    ('order_id', '=', 456)
], limit=1)

print(f"Status: {review.status}")           # 'reviewed'
print(f"Reviewed by: {review.reviewed_by}") # 'paul.diserens@gmail.com'
print(f"Note: {review.note}")               # 'Test review'
```

### Test 3: Test UI Completa
```
1. Login come paul.diserens@gmail.com
2. Apri /controllo-prezzi
3. Vedi conteggi (dovrebbe caricare senza errori)
4. Clicca "Sotto PC"
5. Vedi lista prodotti
6. Clicca un prodotto
7. Clicca "Marca come Controllato"
8. Verifica che scompare dalla lista
9. Ricarica pagina
10. Verifica che non c'è più
```

---

## PARTE 7: TROUBLESHOOTING

### Problema: "Model x.price.review not found"
```bash
Soluzione:
1. Verifica modulo installato: Apps > Search "LAPA Price Review"
2. Se non installato: Install
3. Se già installato: Upgrade
4. Riavvia server Odoo
```

### Problema: "Field avg_selling_price_3m does not exist"
```bash
Soluzione:
1. Verifica modulo lapa_product_enhancements installato
2. Upgrade module
3. Force recompute:
   Shell: self.env['product.product'].search([])._compute_avg_selling_price_3m()
```

### Problema: "Access Denied su x.price.review"
```bash
Soluzione:
1. Verifica ir.model.access.csv
2. Verifica security rules in x_price_review_security.xml
3. Da UI: Settings > Technical > Security > Access Rights
   > Search "x.price.review"
   > Verifica permessi READ/WRITE/CREATE
```

### Problema: "Performance lenta (>10s)"
```bash
Soluzione:
1. Verifica indexes creati (vedi Config 3)
2. Attiva EXPLAIN ANALYZE su query lente:
   odoo.conf: log_level = debug
3. Implementa batch queries (vedi ANALISI_ODOO_CONTROLLO_PREZZI.md sezione 7.2)
4. Aggiungi caching Redis
```

### Problema: "Conteggi errati nelle categorie"
```bash
Soluzione:
1. Verifica formula criticalPrice = standard_price * 1.4
2. Verifica avgSellingPrice calcolato correttamente:
   Shell: product = self.env['product.product'].browse(123)
          product._compute_avg_selling_price_3m()
          print(product.avg_selling_price_3m)
3. Verifica logica price_category in sale.order.line
4. Force refresh:
   Shell: self.env['product.product'].search([])._compute_avg_selling_price_3m()
```

---

## COMPLETION CHECKLIST

- [ ] Modulo lapa_price_review creato
- [ ] Model x_price_review installato
- [ ] Security rules configurate
- [ ] Access rights verificati
- [ ] Modulo lapa_product_enhancements installato
- [ ] Field avg_selling_price_3m funzionante
- [ ] Field price_category funzionante
- [ ] Computed field critical_price funzionante
- [ ] Activity type "Blocco Prezzo" creato
- [ ] Database indexes creati
- [ ] Test CRUD su x_price_review OK
- [ ] Test API mark-reviewed OK
- [ ] Test API block-price OK
- [ ] Test API mark-pending OK
- [ ] Test UI completa OK
- [ ] Performance <2s su 50 ordini

---

## NEXT STEPS AFTER SETUP

1. Implementa API endpoints (da MOCK a REAL)
2. Ottimizza performance (batch queries)
3. Aggiungi caching (Redis)
4. Setup monitoring (log query lente)
5. Create dashboard analytics per Paul/Laura

---

**Version:** 1.0
**Created:** 12 Nov 2025
**Purpose:** Step-by-step Odoo setup guide for Controllo Prezzi
