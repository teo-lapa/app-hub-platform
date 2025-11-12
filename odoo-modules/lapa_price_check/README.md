# LAPA Price Check Module

Modulo Odoo 17 per gestione controlli prezzi vendita.

## Installazione

1. Copia questa directory in `addons/` di Odoo
2. Restart Odoo server
3. Apps → Update Apps List
4. Cerca "LAPA Price Check"
5. Installa

## Oppure via comando

```bash
# Se hai Odoo da sorgente
cd /path/to/odoo
./odoo-bin -d your-database -i lapa_price_check --stop-after-init

# Poi restart normale
./odoo-bin -d your-database
```

## Modello Creato

**Model:** `x.price.review`

**Campi:**
- `product_id` - Prodotto (Many2one)
- `order_id` - Ordine (Many2one)
- `order_line_id` - Riga ordine (Many2one)
- `status` - Status (pending/reviewed/blocked)
- `reviewed_by` - Email chi ha controllato
- `reviewed_at` - Data controllo
- `blocked_by` - Email chi ha bloccato
- `blocked_at` - Data blocco
- `note` - Note

**Computed Fields:**
- `product_name`, `product_code`
- `order_name`
- `customer_id`, `customer_name`
- `price_unit`, `product_cost`

**Constraint:**
- Unique (product_id, order_id, company_id)

## API Usage (da NextJS)

```typescript
// Create review
await callOdoo(cookies, 'x.price.review', 'create', [{
  product_id: 123,
  order_id: 456,
  order_line_id: 789,
  status: 'pending'
}]);

// Mark as reviewed
await callOdoo(cookies, 'x.price.review', 'write', [[reviewId], {
  status: 'reviewed',
  reviewed_by: 'paul@lapa.ch',
  reviewed_at: new Date().toISOString(),
  note: 'Prezzo OK'
}]);

// Search
const reviews = await callOdoo(cookies, 'x.price.review', 'search_read', [], {
  domain: [
    ['status', '=', 'pending'],
    ['order_id', 'in', [456, 457, 458]]
  ],
  fields: ['product_id', 'status', 'note']
});
```

## Views

Menu: **Price Reviews → Controlli Prezzi**

- Tree view con colori per status
- Form view con statusbar
- Search filters (pending/reviewed/blocked)
- Group by (status, product, customer, date)

## Security

- Users: Read, Write, Create
- Managers: Full access (+ Delete)

## License

LGPL-3
