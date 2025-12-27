# Invoices Agent - Query Odoo Reference

## Guida Rapida alle Query Odoo

Questo documento mostra le query Odoo esatte usate dall'InvoicesAgent per ogni metodo.

---

## 1. getCustomerInvoices(customerId)

### Query Odoo

```typescript
const domain = [
  ['partner_id', '=', customerId],
  ['move_type', '=', 'out_invoice']
];

const fields = [
  'name',
  'partner_id',
  'invoice_date',
  'invoice_date_due',
  'state',
  'payment_state',
  'amount_untaxed',
  'amount_tax',
  'amount_total',
  'amount_residual',
  'currency_id',
  'move_type',
  'invoice_origin',
  'ref',
  'invoice_payment_term_id'
];

const invoices = await client.searchRead('account.move', domain, fields, 1000);
```

### Esempio Risultato

```json
[
  {
    "id": 456,
    "name": "INV/2024/0123",
    "partner_id": [123, "Cliente S.r.l."],
    "invoice_date": "2024-01-15",
    "invoice_date_due": "2024-02-15",
    "state": "posted",
    "payment_state": "not_paid",
    "amount_untaxed": 1000.00,
    "amount_tax": 81.00,
    "amount_total": 1081.00,
    "amount_residual": 1081.00,
    "currency_id": [1, "CHF"],
    "move_type": "out_invoice"
  }
]
```

---

## 2. getInvoiceDetails(invoiceId)

### Query 1: Fattura

```typescript
const invoices = await client.searchRead(
  'account.move',
  [['id', '=', invoiceId]],
  [
    'name',
    'partner_id',
    'invoice_date',
    'invoice_date_due',
    'state',
    'payment_state',
    'amount_untaxed',
    'amount_tax',
    'amount_total',
    'amount_residual',
    'currency_id',
    'move_type',
    'invoice_origin',
    'ref',
    'invoice_payment_term_id',
    'invoice_line_ids'  // IDs delle linee
  ],
  1
);
```

### Query 2: Dati Partner

```typescript
const partners = await client.searchRead(
  'res.partner',
  [['id', '=', partner_id]],
  ['email', 'phone', 'city'],
  1
);
```

### Query 3: Linee Fattura

```typescript
const lines = await client.searchRead(
  'account.move.line',
  [['id', 'in', invoice_line_ids]],
  [
    'product_id',
    'name',
    'quantity',
    'price_unit',
    'price_subtotal',
    'price_total',
    'tax_ids',
    'discount'
  ],
  500
);
```

### Esempio Risultato Linea

```json
{
  "id": 789,
  "product_id": [100, "Prodotto A"],
  "name": "Descrizione prodotto A",
  "quantity": 5.0,
  "price_unit": 200.00,
  "price_subtotal": 1000.00,
  "price_total": 1081.00,
  "tax_ids": [1],
  "discount": 0.0
}
```

---

## 3. getCustomerBalance(customerId)

### Query Odoo

```typescript
const invoices = await client.searchRead(
  'account.move',
  [
    ['partner_id', '=', customerId],
    ['move_type', '=', 'out_invoice'],
    ['state', '=', 'posted']
  ],
  [
    'name',
    'amount_total',
    'amount_residual',
    'payment_state',
    'invoice_date_due',
    'currency_id'
  ],
  1000
);
```

### Calcoli Post-Query

```typescript
let total_invoiced = 0;
let total_due = 0;
let overdue_count = 0;

const today = new Date();

for (const inv of invoices) {
  total_invoiced += inv.amount_total || 0;
  total_due += inv.amount_residual || 0;

  // Conta fatture scadute
  if (inv.invoice_date_due && inv.amount_residual > 0) {
    const dueDate = new Date(inv.invoice_date_due);
    if (dueDate < today) {
      overdue_count++;
    }
  }
}

const total_paid = total_invoiced - total_due;
```

### Esempio Risultato

```json
{
  "customer_id": 123,
  "customer_name": "Cliente S.r.l.",
  "total_invoiced": 50000.00,
  "total_paid": 45000.00,
  "total_due": 5000.00,
  "invoices_count": 45,
  "overdue_invoices": 3,
  "oldest_due_date": "2023-12-15",
  "currency": "CHF"
}
```

---

## 4. getDueInvoices(customerId?, daysAhead)

### Calcolo Data Limite

```typescript
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + daysAhead);
const futureDateStr = futureDate.toISOString().split('T')[0]; // "2024-02-15"
```

### Query Odoo

```typescript
const domain = [
  ['move_type', '=', 'out_invoice'],
  ['state', '=', 'posted'],
  ['payment_state', 'in', ['not_paid', 'partial']],
  ['invoice_date_due', '!=', false],
  ['invoice_date_due', '<=', futureDateStr]
];

// Opzionale: filtra per cliente
if (customerId) {
  domain.push(['partner_id', '=', customerId]);
}

const invoices = await client.searchRead(
  'account.move',
  domain,
  ['name', 'partner_id', 'amount_total', 'amount_residual', 'invoice_date_due'],
  500
);
```

### Calcolo Urgenza Post-Query

```typescript
const today = new Date();

for (const inv of invoices) {
  const dueDate = new Date(inv.invoice_date_due);
  const diffTime = today.getTime() - dueDate.getTime();
  const days_overdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let urgency;
  if (days_overdue > 30) urgency = 'critical';      // 🔴
  else if (days_overdue > 15) urgency = 'high';     // 🟠
  else if (days_overdue > 0) urgency = 'medium';    // 🟡
  else urgency = 'low';                              // 🟢
}
```

### Esempio Risultato

```json
[
  {
    "id": 456,
    "name": "INV/2024/0100",
    "partner_name": "Cliente A",
    "amount_total": 2000.00,
    "amount_residual": 2000.00,
    "invoice_date_due": "2024-01-01",
    "days_overdue": 45,
    "urgency": "critical"
  },
  {
    "id": 457,
    "name": "INV/2024/0105",
    "partner_name": "Cliente B",
    "amount_total": 1500.00,
    "amount_residual": 1500.00,
    "invoice_date_due": "2024-02-10",
    "days_overdue": -5,
    "urgency": "low"
  }
]
```

---

## 5. getInvoices(customerId?, status, limit)

### Domain per Status

#### Status = 'open' (fatture aperte)

```typescript
const domain = [
  ['move_type', '=', 'out_invoice'],
  ['payment_state', 'in', ['not_paid', 'partial']],
  ['state', '=', 'posted']
];

if (customerId) {
  domain.push(['partner_id', '=', customerId]);
}
```

#### Status = 'paid' (fatture pagate)

```typescript
const domain = [
  ['move_type', '=', 'out_invoice'],
  ['payment_state', '=', 'paid']
];

if (customerId) {
  domain.push(['partner_id', '=', customerId]);
}
```

#### Status = 'all' (tutte)

```typescript
const domain = [
  ['move_type', '=', 'out_invoice']
];

if (customerId) {
  domain.push(['partner_id', '=', customerId]);
}
```

---

## 6. getPaymentLink(invoiceId)

### Query 1: Recupera Fattura

```typescript
const invoices = await client.searchRead(
  'account.move',
  [['id', '=', invoiceId]],
  ['name', 'access_token', 'amount_residual'],
  1
);
```

### Query 2: Genera Token (se mancante)

```typescript
// Metodo Odoo per generare access token
const tokenResult = await client.call(
  'account.move',
  'action_get_access_url',
  [[invoiceId]]
);

// tokenResult.url contiene il link completo
```

### URL Generato

```
https://odoo.domain.com/my/invoices/456?access_token=abc123xyz
```

---

## 7. sendPaymentReminder(invoiceId, customMessage?)

### Query 1: Recupera Fattura

```typescript
const invoices = await client.searchRead(
  'account.move',
  [['id', '=', invoiceId]],
  ['name', 'partner_id', 'amount_residual', 'invoice_date_due'],
  1
);
```

### Query 2: Recupera Email Partner

```typescript
const partners = await client.searchRead(
  'res.partner',
  [['id', '=', partnerId]],
  ['email', 'name'],
  1
);
```

### Query 3: Invia Messaggio

```typescript
await client.call('account.move', 'message_post', [
  [invoiceId],
  {
    body: customMessage || defaultMessage,
    subject: `Reminder: Fattura ${invoice.name}`,
    partner_ids: [partnerId],
    message_type: 'comment',
    subtype_xmlid: 'mail.mt_comment'
  }
]);
```

---

## 8. getInvoiceStats(startDate, endDate, customerId?)

### Query Odoo

```typescript
const domain = [
  ['move_type', '=', 'out_invoice'],
  ['state', '=', 'posted'],
  ['invoice_date', '>=', startDate],    // "2024-01-01"
  ['invoice_date', '<=', endDate]       // "2024-12-31"
];

if (customerId) {
  domain.push(['partner_id', '=', customerId]);
}

const invoices = await client.searchRead(
  'account.move',
  domain,
  [
    'name',
    'amount_total',
    'amount_residual',
    'payment_state',
    'invoice_date',
    'invoice_date_due',
    'currency_id'
  ],
  1000
);
```

### Calcoli Statistici

```typescript
let total_amount = 0;
let total_due = 0;
let overdue_count = 0;
let payment_days_sum = 0;
let paid_invoices_count = 0;

for (const inv of invoices) {
  total_amount += inv.amount_total || 0;
  total_due += inv.amount_residual || 0;

  // Conta scadute
  if (inv.invoice_date_due && inv.amount_residual > 0) {
    const dueDate = new Date(inv.invoice_date_due);
    if (dueDate < today) {
      overdue_count++;
    }
  }

  // Giorni medi pagamento (solo per fatture pagate)
  if (inv.payment_state === 'paid' && inv.invoice_date && inv.invoice_date_due) {
    const invoiceDate = new Date(inv.invoice_date);
    const dueDate = new Date(inv.invoice_date_due);
    const diffDays = Math.floor((dueDate - invoiceDate) / (1000 * 60 * 60 * 24));
    payment_days_sum += diffDays;
    paid_invoices_count++;
  }
}

const total_paid = total_amount - total_due;
const avg_payment_days = paid_invoices_count > 0
  ? Math.round(payment_days_sum / paid_invoices_count)
  : 0;
```

---

## Domini Odoo Comuni

### Filtrare per Tipo Fattura

```typescript
// Solo fatture clienti (vendita)
['move_type', '=', 'out_invoice']

// Solo note di credito
['move_type', '=', 'out_refund']

// Solo fatture fornitori (acquisto)
['move_type', '=', 'in_invoice']
```

### Filtrare per Stato

```typescript
// Solo fatture confermate
['state', '=', 'posted']

// Solo bozze
['state', '=', 'draft']

// Escludi annullate
['state', '!=', 'cancel']
```

### Filtrare per Stato Pagamento

```typescript
// Non pagate
['payment_state', '=', 'not_paid']

// Pagate
['payment_state', '=', 'paid']

// Parzialmente pagate
['payment_state', '=', 'partial']

// Non pagate o parziali
['payment_state', 'in', ['not_paid', 'partial']]
```

### Filtrare per Data

```typescript
// Fatture del 2024
['invoice_date', '>=', '2024-01-01'],
['invoice_date', '<=', '2024-12-31']

// Scadute (data scadenza passata)
['invoice_date_due', '<', '2024-02-15']

// In scadenza entro 30 giorni
['invoice_date_due', '<=', '2024-03-15']
```

### Filtrare per Cliente

```typescript
// Cliente specifico
['partner_id', '=', 123]

// Lista clienti
['partner_id', 'in', [123, 456, 789]]

// Escludi cliente
['partner_id', '!=', 123]
```

### Filtrare per Importo

```typescript
// Importo totale > 1000
['amount_total', '>', 1000]

// Saldo residuo > 0 (ha debiti)
['amount_residual', '>', 0]

// Fatture saldate completamente
['amount_residual', '=', 0]
```

---

## Campi Utili di account.move

### Identificativi

- `id` - ID univoco fattura
- `name` - Numero fattura (es. INV/2024/0123)
- `ref` - Riferimento esterno

### Partner

- `partner_id` - [ID, "Nome Cliente"]
- `partner_shipping_id` - Indirizzo spedizione
- `partner_bank_id` - Conto bancario

### Date

- `invoice_date` - Data fattura
- `invoice_date_due` - Data scadenza
- `create_date` - Data creazione
- `write_date` - Ultima modifica

### Stati

- `state` - draft | posted | cancel
- `payment_state` - not_paid | in_payment | paid | partial | reversed
- `move_type` - out_invoice | out_refund | in_invoice | in_refund

### Importi

- `amount_untaxed` - Imponibile
- `amount_tax` - IVA
- `amount_total` - Totale fattura
- `amount_residual` - Saldo da pagare
- `amount_residual_signed` - Saldo con segno

### Relazioni

- `invoice_line_ids` - IDs linee fattura
- `invoice_origin` - Ordine origine
- `invoice_payment_term_id` - Termini pagamento
- `currency_id` - Valuta

### Accesso

- `access_token` - Token per portale pubblico
- `access_url` - URL portale cliente

---

## Best Practices

### 1. Specificare Sempre i Campi

```typescript
// ❌ BAD: Richiede tutti i campi (lento)
await client.searchRead('account.move', domain);

// ✅ GOOD: Solo campi necessari
await client.searchRead('account.move', domain, [
  'name', 'amount_total', 'payment_state'
]);
```

### 2. Usare Limiti Appropriati

```typescript
// ✅ GOOD: Limita risultati
await client.searchRead('account.move', domain, fields, 100);

// ⚠️ CAUTION: Senza limite può restituire migliaia di record
await client.searchRead('account.move', domain, fields);
```

### 3. Filtrare Lato Server

```typescript
// ❌ BAD: Filtra in JavaScript
const all = await client.searchRead('account.move', [], fields);
const filtered = all.filter(inv => inv.amount_total > 1000);

// ✅ GOOD: Filtra in Odoo
await client.searchRead('account.move', [
  ['amount_total', '>', 1000]
], fields);
```

### 4. Ordinare Risultati

```typescript
// Ordina per data decrescente
await client.searchRead('account.move', domain, fields, 100, 'invoice_date DESC');

// Ordina per nome cliente
await client.searchRead('account.move', domain, fields, 100, 'partner_id');
```

---

## Debugging Query

### Log Domini Odoo

```typescript
const domain = [
  ['partner_id', '=', customerId],
  ['move_type', '=', 'out_invoice']
];

console.log('Odoo Domain:', JSON.stringify(domain));
// Output: [["partner_id","=",123],["move_type","=","out_invoice"]]
```

### Testare in Odoo Shell

```python
# In Odoo shell (odoo-bin shell)
env['account.move'].search_read(
  [('partner_id', '=', 123), ('move_type', '=', 'out_invoice')],
  ['name', 'amount_total']
)
```

---

## Riferimenti

- Odoo Documentation: https://www.odoo.com/documentation/16.0/developer/reference/backend/orm.html
- Account Move Model: https://github.com/odoo/odoo/blob/16.0/addons/account/models/account_move.py
