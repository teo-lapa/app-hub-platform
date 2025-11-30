# Analisi Prodotto API - Documentazione

## Endpoint

```
GET /api/analisi-prodotto
```

## Descrizione

API endpoint per analisi completa di un prodotto su Odoo. Recupera informazioni dettagliate su prezzi, giacenze, fornitori, ordini di acquisto/vendita e calcola statistiche aggregate con suggerimenti di riordino.

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `productName` | string | ✅ Yes | - | Nome del prodotto da analizzare (case insensitive) |
| `dateFrom` | string | ❌ No | 6 mesi fa | Data inizio periodo analisi (formato: YYYY-MM-DD) |
| `dateTo` | string | ❌ No | Oggi | Data fine periodo analisi (formato: YYYY-MM-DD) |

## Autenticazione

L'API utilizza la sessione Odoo dell'utente loggato tramite cookie `odoo_session_id`. Se non disponibile, utilizza le credenziali di fallback configurate in `.env.local`.

## Response Format

### Success Response (200 OK)

```typescript
{
  product: {
    id: number;
    name: string;
    defaultCode: string | null;
    barcode: string | null;
    category: string;
    listPrice: number;
    standardPrice: number;
    theoreticalMargin: number;
    qtyAvailable: number;
    virtualAvailable: number;
    incomingQty: number;
    outgoingQty: number;
    uom: string;
  };
  suppliers: Array<{
    partnerId: number;
    partnerName: string;
    productName: string | null;
    productCode: string | null;
    price: number;
    minQty: number;
    delay: number; // Lead time in days
  }>;
  purchaseOrders: Array<{
    orderId: number;
    orderName: string;
    supplierId: number;
    supplierName: string;
    productQty: number;
    qtyReceived: number;
    priceUnit: number;
    priceSubtotal: number;
    dateOrder: string;
    state: string;
  }>;
  saleOrders: Array<{
    orderId: number;
    orderName: string;
    customerId: number;
    customerName: string;
    productQty: number;
    qtyDelivered: number;
    priceUnit: number;
    priceSubtotal: number;
    createDate: string;
    state: string;
  }>;
  statistics: {
    totalPurchased: number;
    totalReceived: number;
    totalPurchaseCost: number;
    avgPurchasePrice: number;
    totalSold: number;
    totalDelivered: number;
    totalRevenue: number;
    avgSalePrice: number;
    profit: number;
    marginPercent: number;
    roi: number;
    monthlyAvgSales: number;
    weeklyAvgSales: number;
    daysOfCoverage: number;
  };
  topSuppliers: Array<{
    supplierName: string;
    orders: number;
    qty: number;
    cost: number;
    avgPrice: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    orders: number;
    qty: number;
    revenue: number;
    avgPrice: number;
  }>;
  reorderSuggestion: {
    reorderPoint: number;
    safetyStock: number;
    optimalOrderQty: number;
    currentStock: number;
    actionRequired: boolean;
    actionMessage: string;
    leadTime: number;
  };
  period: {
    dateFrom: string;
    dateTo: string;
  };
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Parameter productName is required"
}
```

#### 404 Not Found
```json
{
  "error": "Product \"PRODUCT_NAME\" not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Failed to analyze product",
  "details": "Error message details"
}
```

## Esempio di Utilizzo

### JavaScript/TypeScript

```typescript
const response = await fetch(
  '/api/analisi-prodotto?productName=FIORDILATTE%20JULIENNE&dateFrom=2024-05-01&dateTo=2024-10-31'
);

if (!response.ok) {
  const error = await response.json();
  console.error('Error:', error);
  return;
}

const data = await response.json();

console.log(`Product: ${data.product.name}`);
console.log(`Total Sold: ${data.statistics.totalSold} ${data.product.uom}`);
console.log(`Profit: CHF ${data.statistics.profit.toFixed(2)}`);
console.log(`Margin: ${data.statistics.marginPercent.toFixed(2)}%`);

if (data.reorderSuggestion.actionRequired) {
  console.log(`⚠️ ${data.reorderSuggestion.actionMessage}`);
}
```

### cURL

```bash
curl "http://localhost:3000/api/analisi-prodotto?productName=FIORDILATTE%20JULIENNE&dateFrom=2024-05-01&dateTo=2024-10-31"
```

### Node.js Test Script

```bash
node test-analisi-prodotto-api.js
```

## Calcoli e Logica

### Statistiche

- **Profit**: `totalRevenue - totalPurchaseCost`
- **Margin %**: `(profit / totalRevenue) * 100`
- **ROI**: `(profit / totalPurchaseCost) * 100`
- **Monthly Avg Sales**: `totalSold / numberOfMonths`
- **Weekly Avg Sales**: `monthlyAvgSales / 4`
- **Days of Coverage**: `(currentStock / weeklyAvgSales) * 7`

### Suggerimenti di Riordino

- **Safety Stock**: `weeklyAvgSales * 2` (2 settimane di scorta)
- **Reorder Point**: `(weeklyAvgSales * leadTime / 7) + safetyStock`
- **Optimal Order Qty**: `monthlyAvgSales` (ordine mensile)
- **Current Stock**: `qtyAvailable + incomingQty`

### Azioni Richieste

1. **Azione Urgente**: Se `currentStock < reorderPoint`
   - Messaggio: "AZIONE RICHIESTA: Ordinare X unità"

2. **Attenzione**: Se `daysOfCoverage < (leadTime + 7)`
   - Messaggio: "ATTENZIONE: Stock sufficiente per solo X giorni"

3. **Stock OK**: Altrimenti
   - Messaggio: "Stock OK per i prossimi X giorni"

## Performance

- **Timeout**: 120 secondi (configurato con `maxDuration`)
- **Caching**: Utilizza cache sessione Odoo (5 minuti)
- **Tempo medio risposta**: 2-5 secondi (dipende dalla quantità di dati)

## Note Tecniche

### Modelli Odoo Utilizzati

1. **product.product**: Informazioni prodotto e giacenze
2. **product.supplierinfo**: Lista fornitori configurati
3. **purchase.order.line**: Ordini di acquisto
4. **sale.order.line**: Ordini di vendita

### Campi Odoo Richiesti

L'API si aspetta che i seguenti campi siano disponibili in Odoo:
- `product.product`: id, name, default_code, barcode, list_price, standard_price, qty_available, virtual_available, incoming_qty, outgoing_qty, uom_id, categ_id, product_tmpl_id
- `product.supplierinfo`: partner_id, product_name, product_code, price, min_qty, delay
- `purchase.order.line`: order_id, partner_id, product_qty, qty_received, price_unit, price_subtotal, date_order, state, create_date
- `sale.order.line`: order_id, order_partner_id, product_uom_qty, qty_delivered, price_unit, price_subtotal, create_date, state

### Configurazione Environment Variables

Assicurati che `.env.local` contenga:

```env
ODOO_URL=https://your-odoo-instance.com
ODOO_DB=your-database-name
ODOO_ADMIN_EMAIL=admin@example.com
ODOO_ADMIN_PASSWORD=your-password
```

## Limitazioni

1. Ricerca prodotto per nome usa `ilike` (case insensitive, partial match)
2. Restituisce solo il primo prodotto trovato (limit: 1)
3. Top clienti limitati a 10
4. Il calcolo dei mesi tiene conto solo di mesi completi
5. Lead time predefinito è 7 giorni se non configurato nei fornitori

## Changelog

### Version 1.0.0 (2025-11-03)
- Creazione iniziale dell'API
- Implementazione analisi completa prodotto
- Calcolo statistiche e suggerimenti riordino
- Supporto autenticazione Odoo con fallback

## Autore

Sviluppato da Claude Code per LAPA Platform

## Licenza

Proprietario - LAPA
