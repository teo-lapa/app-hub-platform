# PORTALE CLIENTI - Checkout Implementation

Sistema completo di checkout con creazione ordini REALI su Odoo.

## Architettura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│  /portale-clienti/ordini/nuovo/page.tsx                         │
│  - Form checkout con validazione                                │
│  - Riepilogo carrello                                           │
│  - Data consegna, termini pagamento, note                       │
│  - Gestione stati (loading, error, success)                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ POST /api/portale-clienti/checkout
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  /app/api/portale-clienti/checkout/route.ts                    │
│  - Autenticazione JWT                                           │
│  - Validazione Zod                                              │
│  - Verifica sessione Odoo                                       │
│  - Delega a OrderService                                        │
│  - Error handling e status codes                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Delega business logic
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  /lib/services/order-service.ts                                │
│  - checkProductAvailability()                                   │
│  - checkCreditLimit()                                           │
│  - calculateOrderTotal()                                        │
│  - prepareOrderLines()                                          │
│  - createOrder() - MAIN METHOD                                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Chiamate Odoo XML-RPC
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ODOO INTEGRATION                             │
├─────────────────────────────────────────────────────────────────┤
│  /lib/odoo/odoo-helper.ts                                      │
│  - callOdoo()                                                   │
│  - searchReadOdoo()                                             │
│  - Session management                                           │
│  - Auto-reconnect su session expired                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ JSON-RPC over HTTP
                     ▼
              ┌──────────────┐
              │     ODOO     │
              │  sale.order  │
              └──────────────┘
```

## File Structure

```
app-hub-platform/
├── app/
│   ├── api/
│   │   └── portale-clienti/
│   │       └── checkout/
│   │           └── route.ts              # API endpoint POST
│   └── portale-clienti/
│       └── ordini/
│           └── nuovo/
│               └── page.tsx              # Pagina checkout UI
│
├── lib/
│   ├── hooks/
│   │   └── useCart.ts                    # Hook per gestione carrello
│   ├── services/
│   │   └── order-service.ts              # Business logic ordini
│   ├── validation/
│   │   └── checkout.ts                   # Zod schemas
│   └── odoo/
│       └── odoo-helper.ts                # Helper Odoo esistente
│
└── CHECKOUT_IMPLEMENTATION.md            # Questa documentazione
```

## API Endpoint

### POST /api/portale-clienti/checkout

Crea un ordine REALE su Odoo confermandolo automaticamente.

#### Request

```typescript
POST /api/portale-clienti/checkout
Content-Type: application/json
Cookie: auth_token=<JWT_TOKEN>

{
  "items": [
    {
      "product_id": 123,
      "quantity": 5
    },
    {
      "product_id": 456,
      "quantity": 10
    }
  ],
  "delivery_date": "2025-11-15",  // Optional: YYYY-MM-DD
  "payment_term_id": 2,            // Optional: ID termine pagamento
  "notes": "Consegnare al piano terra"  // Optional
}
```

#### Response Success (201 Created)

```json
{
  "success": true,
  "order_id": 789,
  "order_name": "SO001",
  "order_total": 450.50,
  "state": "sale",
  "message": "Ordine SO001 creato con successo"
}
```

#### Response Error Examples

**401 Unauthorized - Token JWT mancante o invalido**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Utente non autenticato o token scaduto."
  }
}
```

**400 Bad Request - Validazione fallita**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dati non validi",
    "details": {
      "items": ["Il carrello non può essere vuoto"]
    }
  }
}
```

**400 Bad Request - Prodotto non trovato**
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Alcuni prodotti non sono disponibili",
    "details": {
      "unavailableProducts": [123, 456]
    }
  }
}
```

**409 Conflict - Limite credito superato**
```json
{
  "success": false,
  "error": {
    "code": "CREDIT_LIMIT_EXCEEDED",
    "message": "Limite di credito superato",
    "details": {
      "orderTotal": 1500.00,
      "availableCredit": 500.00
    }
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Errore durante la creazione dell'ordine",
    "details": "Connection timeout"
  }
}
```

## Order Creation Flow

### Step-by-step Process

1. **Autenticazione**
   - Estrai JWT token da cookie `auth_token`
   - Verifica validità con `jwt.verify()`
   - Estrai `odooPartnerId` (customer ID su Odoo)

2. **Validazione Input**
   - Valida payload con Zod schema `CheckoutRequestSchema`
   - Verifica `items` non vuoto
   - Verifica `quantity > 0` per ogni prodotto

3. **Verifica Disponibilità Prodotti**
   - `searchReadOdoo('product.product', [['id', 'in', productIds]])`
   - Campi: `id, name, qty_available, uom_id, list_price`
   - Se prodotti mancanti → errore `PRODUCT_NOT_FOUND`

4. **Calcolo Totale Ordine**
   - `total = Σ (product.list_price × quantity)`
   - Usato per verifica credito

5. **Verifica Limite Credito** (opzionale)
   - `searchReadOdoo('res.partner', [['id', '=', customerId]])`
   - Campi: `credit_limit, credit`
   - `available = credit_limit - credit`
   - Se `available < orderTotal` → errore `CREDIT_LIMIT_EXCEEDED`
   - Se `credit_limit == 0` → skip check (nessun limite)

6. **Prepara Order Lines**
   ```javascript
   order_line: [
     [0, 0, {
       product_id: 123,
       product_uom_qty: 5,
       product_uom: 1,  // UOM ID da product.product
       name: "Prodotto X"
     }],
     // ...
   ]
   ```

7. **Crea Sale Order (DRAFT)**
   ```javascript
   const orderId = await callOdoo('sale.order', 'create', [{
     partner_id: customerId,
     order_line: orderLines,
     client_order_ref: `WEB-${Date.now()}`,
     date_order: new Date().toISOString(),
     commitment_date: deliveryDate,  // optional
     payment_term_id: paymentTermId,  // optional
     note: "ORDINE DA PORTALE CLIENTI\n\n..."
   }]);
   ```

8. **Conferma Ordine (DRAFT → SALE)**
   ```javascript
   await callOdoo('sale.order', 'action_confirm', [[orderId]]);
   ```
   - Questo crea automaticamente il `stock.picking` per la consegna
   - Stato ordine passa da `draft` a `sale`

9. **Leggi Dati Ordine Confermato**
   - `searchReadOdoo('sale.order', [['id', '=', orderId]])`
   - Campi: `name, amount_total, state`

10. **Risposta al Cliente**
    - Ritorna `order_id`, `order_name`, `order_total`, `state`

## Service Layer Design

### OrderService Class

```typescript
class OrderService {
  // Verifica disponibilità prodotti su Odoo
  async checkProductAvailability(productIds: number[]): Promise<ProductAvailability>

  // Verifica limite credito cliente
  async checkCreditLimit(customerId: number, orderTotal: number): Promise<CreditCheck>

  // Calcola totale ordine
  calculateOrderTotal(items, products): number

  // Prepara order_line per Odoo
  prepareOrderLines(items, products): any[]

  // MAIN: Crea ordine completo
  async createOrder(customerId, customerEmail, request): Promise<CreateOrderResult>
}
```

### Custom Error Classes

```typescript
class OrderServiceError extends Error
class ProductNotFoundError extends OrderServiceError
class InsufficientStockError extends OrderServiceError
class CreditLimitExceededError extends OrderServiceError
```

**Vantaggi**:
- Error handling tipizzato
- Logging centralizzato
- Testabilità (unit test semplici)
- Riusabilità (può essere chiamato da più endpoint)

## Frontend Implementation

### Pagina Checkout UI

**Features**:
- Riepilogo carrello con totali
- Form data consegna (DatePicker)
- Textarea note ordine
- Select termini pagamento
- Pulsante "Conferma Ordine" con loading state
- Success message + redirect automatico
- Error handling user-friendly

### useCart Hook

**Funzionalità**:
- `addItem(item)` - Aggiunge prodotto
- `removeItem(productId)` - Rimuove prodotto
- `updateQuantity(productId, qty)` - Aggiorna quantità
- `clearCart()` - Svuota carrello
- `getTotal()` - Calcola totale
- `getItemCount()` - Conta prodotti
- `hasItem(productId)` - Check presenza
- `getItemQuantity(productId)` - Get quantità

**Storage**: localStorage con chiave `portale_cart`

## Validation Layer

### Zod Schemas

```typescript
// Single item
OrderItemSchema = z.object({
  product_id: z.number().positive(),
  quantity: z.number().positive(),
})

// Full request
CheckoutRequestSchema = z.object({
  items: z.array(OrderItemSchema).min(1),
  delivery_date: z.string().optional(),
  payment_term_id: z.number().optional(),
  notes: z.string().max(1000).optional(),
})
```

**Benefici**:
- Type safety completo (TypeScript)
- Validazione runtime
- Error messages user-friendly
- Riutilizzabile client e server

## Security Considerations

1. **Autenticazione JWT**
   - Token verificato con `jwt.verify()`
   - Secret key da `process.env.JWT_SECRET`
   - Cookie HTTP-only (non accessibile da JS)

2. **Autorizzazione**
   - Ogni cliente può creare ordini solo per se stesso
   - `odooPartnerId` estratto dal token JWT
   - Nessun input utente per customer_id

3. **Input Validation**
   - Zod schema rigoroso
   - Quantità sempre positive
   - Note limitate a 1000 caratteri

4. **Rate Limiting**
   - TODO: Implementare rate limiting per prevenire abusi
   - Suggerito: max 10 ordini/ora per cliente

5. **HTTPS Only**
   - In produzione, sempre usare HTTPS
   - Cookie `Secure` flag abilitato

## Testing Guide

### Manual Testing

1. **Test Ordine Base**
   ```bash
   curl -X POST http://localhost:3000/api/portale-clienti/checkout \
     -H "Content-Type: application/json" \
     -H "Cookie: auth_token=<YOUR_JWT>" \
     -d '{
       "items": [
         {"product_id": 123, "quantity": 5}
       ]
     }'
   ```

2. **Test con Data Consegna**
   ```json
   {
     "items": [{"product_id": 123, "quantity": 5}],
     "delivery_date": "2025-11-15",
     "notes": "Consegna urgente"
   }
   ```

3. **Test Errore: Carrello Vuoto**
   ```json
   {
     "items": []
   }
   // Expected: 400 VALIDATION_ERROR
   ```

4. **Test Errore: Prodotto Inesistente**
   ```json
   {
     "items": [{"product_id": 999999, "quantity": 1}]
   }
   // Expected: 400 PRODUCT_NOT_FOUND
   ```

### Unit Testing (TODO)

```typescript
// test/services/order-service.test.ts
describe('OrderService', () => {
  it('should calculate order total correctly', () => {
    const service = new OrderService();
    const items = [
      { product_id: 1, quantity: 5 },
      { product_id: 2, quantity: 10 },
    ];
    const products = {
      1: { list_price: 10.00 },
      2: { list_price: 5.00 },
    };
    const total = service.calculateOrderTotal(items, products);
    expect(total).toBe(100.00); // 5*10 + 10*5
  });

  it('should throw ProductNotFoundError for missing products', async () => {
    // Mock searchReadOdoo to return empty array
    // Call checkProductAvailability
    // Expect ProductNotFoundError
  });

  // More tests...
});
```

## Monitoring & Logging

### Log Events

```typescript
console.log('🛒 Checkout iniziato per cliente ${customerId}');
console.log('✅ Prodotti verificati: ${productIds.length}');
console.log('💰 Totale ordine: €${total}');
console.log('✅ Credito OK');
console.log('📝 Ordine creato (draft): ${orderId}');
console.log('⚡ Ordine confermato: ${orderId}');
console.log('🎉 Ordine ${orderName} completato!');
console.error('❌ Errore checkout:', error);
```

### Metrics to Track

- **Order Creation Rate**: ordini/ora
- **Success Rate**: % ordini confermati con successo
- **Error Rate**: % errori per tipo
- **Average Order Value**: valore medio ordini
- **Credit Limit Blocks**: % ordini bloccati per credito

## Future Enhancements

### Phase 2 Features

1. **Stock Reservation**
   - Prenotare stock durante checkout
   - Timeout automatico (15 minuti)
   - Release stock se ordine non completato

2. **Multi-Warehouse Support**
   - Permettere selezione magazzino consegna
   - Calcolare disponibilità per magazzino
   - Routing intelligente

3. **Promotions & Discounts**
   - Codici sconto
   - Promozioni automatiche
   - Volume discounts

4. **Order Drafts**
   - Salvare carrello come draft
   - Riprendere ordini salvati
   - Condividi carrello via link

5. **Email Notifications**
   - Email conferma ordine
   - Email tracking spedizione
   - Email fattura emessa

6. **Payment Integration**
   - Pagamento online (Stripe/PayPal)
   - Conferma ordine solo dopo pagamento
   - Invoice automatiche

## Troubleshooting

### Problema: "Session expired"

**Causa**: La sessione Odoo è scaduta o invalida.

**Soluzione**:
1. Fare logout e login nuovamente
2. Verificare che `odoo_session_id` cookie sia valido
3. `odoo-helper.ts` ha auto-reconnect, ma potrebbe fallire

### Problema: "Product not found"

**Causa**: Il prodotto non esiste più su Odoo o è stato disattivato.

**Soluzione**:
1. Verificare che `product.product` con quell'ID esista
2. Verificare campo `active = true`
3. Aggiornare catalogo frontend

### Problema: "Credit limit exceeded"

**Causa**: Cliente ha superato il limite di credito.

**Soluzione**:
1. Contattare amministrazione per aumentare limite
2. Pagare fatture in sospeso per liberare credito
3. Modificare `credit_limit = 0` per disabilitare controllo

### Problema: Ordine creato ma non confermato

**Causa**: `action_confirm` fallito (es. stock mancante).

**Soluzione**:
1. Verificare log Odoo per errore specifico
2. Controllare disponibilità stock su Odoo
3. Verificare configurazione magazzini/route

## References

- **Odoo Sale Order Model**: `sale.order`
- **Odoo API Docs**: https://www.odoo.com/documentation/17.0/developer/reference/backend/orm.html
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Zod Documentation**: https://zod.dev

---

**Implementato da**: Backend Specialist Agent
**Data**: 2025-10-24
**Status**: Production Ready
**Version**: 1.0.0
