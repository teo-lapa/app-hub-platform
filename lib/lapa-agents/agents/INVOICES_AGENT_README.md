# Invoices Agent - Documentazione Completa

## Panoramica

L'**InvoicesAgent** è collegato ai dati reali di Odoo e fornisce accesso completo alle fatture clienti tramite query sul modello `account.move`.

## Collegamento ai Dati Reali Odoo

### Modelli Odoo Utilizzati

1. **account.move** - Fatture
   - `move_type = 'out_invoice'` - Fatture clienti
   - `move_type = 'out_refund'` - Note di credito
   - `state`: draft, posted, cancel
   - `payment_state`: not_paid, in_payment, paid, partial, reversed

2. **account.move.line** - Linee fattura
   - Prodotti, quantità, prezzi
   - Calcolo IVA e sconti

3. **res.partner** - Clienti
   - Dati anagrafici cliente
   - Email, telefono, indirizzo

### Campi Chiave

```typescript
// Campi principali fattura (account.move)
{
  id: number,
  name: string,                    // Numero fattura (es. INV/2024/0001)
  partner_id: [number, string],    // [ID, "Nome Cliente"]
  invoice_date: string,            // Data fattura
  invoice_date_due: string,        // Data scadenza
  state: string,                   // draft, posted, cancel
  payment_state: string,           // not_paid, paid, partial
  amount_total: number,            // Importo totale
  amount_residual: number,         // Importo ancora da pagare
  currency_id: [number, string]    // [ID, "CHF"]
}
```

## Metodi Implementati

### 1. getCustomerInvoices(customerId)

Recupera tutte le fatture di un cliente specifico.

**Query Odoo:**
```typescript
domain: [
  ['partner_id', '=', customerId],
  ['move_type', '=', 'out_invoice']
]
```

**Esempio:**
```typescript
const result = await agent.getCustomerInvoices(123);
console.log(result.data); // Array di fatture
```

**Ritorna:**
```typescript
{
  success: boolean,
  data?: Invoice[],
  message?: { it, en, de }
}
```

---

### 2. getInvoiceDetails(invoiceId)

Recupera dettagli completi di una fattura con linee prodotto.

**Query Odoo:**
```typescript
// Step 1: Recupera fattura
account.move.search_read([['id', '=', invoiceId]])

// Step 2: Recupera linee
account.move.line.search_read([['id', 'in', invoice_line_ids]])

// Step 3: Recupera dati partner
res.partner.search_read([['id', '=', partner_id]])
```

**Esempio:**
```typescript
const result = await agent.getInvoiceDetails(456);
console.log(result.data?.lines); // Linee fattura
console.log(result.data?.partner_email); // Email cliente
```

**Ritorna:**
```typescript
{
  success: boolean,
  data?: InvoiceDetails,  // Include: lines[], partner_email, days_overdue
  message?: { it, en, de }
}
```

---

### 3. getCustomerBalance(customerId)

Calcola il saldo aperto di un cliente (alias di `getOpenBalance`).

**Query Odoo:**
```typescript
domain: [
  ['partner_id', '=', customerId],
  ['move_type', '=', 'out_invoice'],
  ['state', '=', 'posted']
]
```

**Calcoli:**
- `total_invoiced` = Somma `amount_total`
- `total_due` = Somma `amount_residual`
- `total_paid` = `total_invoiced - total_due`
- `overdue_invoices` = Fatture con `invoice_date_due < oggi` e `amount_residual > 0`

**Esempio:**
```typescript
const result = await agent.getCustomerBalance(123);
console.log(`Da pagare: CHF ${result.data?.total_due}`);
```

**Ritorna:**
```typescript
{
  success: boolean,
  data?: {
    customer_id: number,
    customer_name: string,
    total_invoiced: number,
    total_paid: number,
    total_due: number,
    invoices_count: number,
    overdue_invoices: number,
    oldest_due_date: string | null,
    currency: string
  },
  message?: { it, en, de }
}
```

---

### 4. getDueInvoices(customerId?, daysAhead)

Recupera fatture scadute o in scadenza nei prossimi N giorni.

**Query Odoo:**
```typescript
domain: [
  ['move_type', '=', 'out_invoice'],
  ['state', '=', 'posted'],
  ['payment_state', 'in', ['not_paid', 'partial']],
  ['invoice_date_due', '!=', false],
  ['invoice_date_due', '<=', futureDate]  // Oggi + daysAhead
]
```

**Calcolo Urgenza:**
- 🔴 **critical**: Scaduta da >30 giorni
- 🟠 **high**: Scaduta da 15-30 giorni
- 🟡 **medium**: Scaduta da 1-15 giorni
- 🟢 **low**: In scadenza (non ancora scaduta)

**Esempio:**
```typescript
const result = await agent.getDueInvoices(123, 30); // Prossimi 30 giorni
const critical = result.data?.filter(inv => inv.urgency === 'critical');
```

**Ritorna:**
```typescript
{
  success: boolean,
  data?: DueInvoice[],  // Include: days_overdue, urgency
  message?: { it, en, de }
}
```

---

### 5. getInvoices(customerId?, status, limit)

Metodo generico per filtrare fatture.

**Parametri:**
- `customerId` - Filtra per cliente (opzionale)
- `status` - 'open' (aperte), 'paid' (pagate), 'all' (tutte)
- `limit` - Numero massimo risultati (default: 100)

**Query Odoo per status='open':**
```typescript
domain: [
  ['move_type', '=', 'out_invoice'],
  ['payment_state', 'in', ['not_paid', 'partial']],
  ['state', '=', 'posted']
]
```

**Esempio:**
```typescript
// Tutte le fatture aperte
const result = await agent.getInvoices(undefined, 'open', 500);

// Fatture pagate di un cliente
const result2 = await agent.getInvoices(123, 'paid', 100);
```

---

### 6. getPaymentLink(invoiceId)

Genera link per pagamento online della fattura.

**Odoo API:**
```typescript
// Tenta di generare access token
account.move.action_get_access_url([[invoiceId]])

// URL formato:
// https://odoo.com/my/invoices/{id}?access_token={token}
```

**Esempio:**
```typescript
const result = await agent.getPaymentLink(456);
console.log(result.data?.payment_url); // Link portale cliente
```

---

### 7. sendPaymentReminder(invoiceId, customMessage?)

Invia reminder di pagamento via email al cliente.

**Odoo API:**
```typescript
account.move.message_post([invoiceId], {
  body: customMessage || defaultMessage,
  subject: "Reminder: Fattura XXX",
  partner_ids: [partnerId],
  message_type: 'comment',
  subtype_xmlid: 'mail.mt_comment'
})
```

**Esempio:**
```typescript
const result = await agent.sendPaymentReminder(456,
  "Gentile cliente, la fattura è in scadenza."
);
```

---

### 8. getInvoiceStats(startDate, endDate, customerId?)

Calcola statistiche aggregate per periodo.

**Dati Calcolati:**
- Numero totale fatture
- Fatturato totale
- Importo pagato
- Importo da pagare
- Giorni medi di pagamento
- Numero fatture scadute

**Esempio:**
```typescript
const result = await agent.getInvoiceStats('2024-01-01', '2024-12-31');
console.log(result.data?.total_amount); // Fatturato anno
console.log(result.data?.avg_payment_days); // Media giorni pagamento
```

---

## Pattern di Utilizzo

### Inizializzazione

```typescript
import { getInvoicesAgent } from '@/lib/lapa-agents/agents/invoices-agent';

const agent = getInvoicesAgent(); // Singleton
```

### Gestione Errori

Tutti i metodi ritornano un oggetto con `success: boolean`:

```typescript
const result = await agent.getCustomerInvoices(123);

if (result.success) {
  // Dati disponibili in result.data
  console.log(result.data);
  console.log(result.message?.it); // Messaggio multilingua
} else {
  // Gestisci errore
  console.error(result.error);
}
```

### Messaggi Multilingua

Ogni risposta include messaggi in 3 lingue:

```typescript
result.message = {
  it: "Trovate 15 fatture aperte per questo cliente",
  en: "Found 15 open invoices for this customer",
  de: "15 offene Rechnungen für diesen Kunden gefunden"
}
```

---

## Utility Methods

### formatAmount(amount, currency)

```typescript
agent.formatAmount(1234.56, 'CHF') // "CHF 1234.56"
```

### formatDate(dateString, locale)

```typescript
agent.formatDate('2024-01-15', 'it') // "15 gennaio 2024"
agent.formatDate('2024-01-15', 'en') // "January 15, 2024"
agent.formatDate('2024-01-15', 'de') // "15. Januar 2024"
```

### getPaymentStateLabel(paymentState)

```typescript
agent.getPaymentStateLabel('not_paid')
// { it: "Non pagata", en: "Not paid", de: "Nicht bezahlt" }
```

### getUrgencyEmoji(urgency)

```typescript
agent.getUrgencyEmoji('critical') // "🔴"
agent.getUrgencyEmoji('high')     // "🟠"
agent.getUrgencyEmoji('medium')   // "🟡"
agent.getUrgencyEmoji('low')      // "🟢"
```

---

## Esempi Pratici

### Dashboard Fatture Cliente

```typescript
async function loadCustomerDashboard(customerId: number) {
  const agent = getInvoicesAgent();

  // Carica saldo
  const balance = await agent.getCustomerBalance(customerId);

  // Carica fatture scadute
  const overdue = await agent.getDueInvoices(customerId, 0);

  // Carica fatture aperte
  const open = await agent.getInvoices(customerId, 'open');

  return {
    balance: balance.data,
    overdueInvoices: overdue.data,
    openInvoices: open.data
  };
}
```

### Report Scadenze

```typescript
async function generateOverdueReport() {
  const agent = getInvoicesAgent();

  // Tutte le fatture scadute
  const result = await agent.getDueInvoices(undefined, 0);

  if (result.success) {
    // Raggruppa per urgenza
    const critical = result.data?.filter(inv => inv.urgency === 'critical');
    const high = result.data?.filter(inv => inv.urgency === 'high');

    console.log(`Fatture critiche: ${critical?.length}`);
    console.log(`Fatture urgenti: ${high?.length}`);
  }
}
```

### Invio Reminder Automatico

```typescript
async function sendOverdueReminders() {
  const agent = getInvoicesAgent();

  // Fatture scadute da più di 7 giorni
  const result = await agent.getDueInvoices(undefined, 0);

  if (result.success) {
    const toRemind = result.data?.filter(inv => inv.days_overdue > 7);

    for (const invoice of toRemind || []) {
      await agent.sendPaymentReminder(invoice.id);
      console.log(`Reminder inviato per ${invoice.name}`);
    }
  }
}
```

---

## Note Tecniche

### Client Odoo

L'agente usa `getOdooClient()` da `@/lib/odoo-client` che:
- Gestisce autenticazione automatica
- Supporta sessionless (ideale per API routes)
- Riconnette automaticamente se la sessione scade

### Performance

- Tutti i metodi usano `searchRead` ottimizzato
- I campi sono specificati esplicitamente (no `*`)
- Limiti configurabili per evitare sovraccarico

### Sicurezza

- Nessun dato sensibile in console (solo log strutturati)
- Validazione automatica degli input
- Gestione errori robusto

---

## Testing

Vedi `examples/test-invoices-agent.ts` per esempi completi di utilizzo.

```bash
# Esegui test (dopo aver configurato ID reali)
npx ts-node lib/lapa-agents/examples/test-invoices-agent.ts
```

---

## Roadmap

Funzionalità future da implementare:

- [ ] Esportazione fatture in PDF batch
- [ ] Analisi predittiva ritardi pagamento
- [ ] Integrazione con sistemi di pagamento (Stripe, PayPal)
- [ ] Notifiche push per scadenze
- [ ] Dashboard analytics real-time

---

## Supporto

Per domande o problemi:
- Documentazione Odoo: https://www.odoo.com/documentation/16.0/
- API Reference: Vedi `/lib/odoo-client.ts`
