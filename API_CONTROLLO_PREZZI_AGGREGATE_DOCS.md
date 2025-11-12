# API Controllo Prezzi - Aggregate

## Endpoint
```
GET /api/controllo-prezzi/aggregate
```

## Descrizione
API per l'app "Controllo Prezzi" che aggrega TUTTI gli ordini in stato 'draft' e 'sent' con i loro prezzi e li analizza secondo i criteri del punto critico (PC).

## Funzionalità

### 1. Recupero Ordini in Revisione
- Recupera TUTTI gli ordini con `state IN ['draft', 'sent']`
- Solo ordini della company LAPA (`company_id = 1`)
- Ordinati per data ordine decrescente

### 2. Analisi Prezzi per Prodotto
Per ogni prodotto in ogni ordine, l'API:
- Recupera il **costo** (`costPrice = product.standard_price`)
- Calcola il **punto critico** (`PC = costPrice * 1.4`)
- Recupera il **prezzo medio** degli ultimi 3 mesi (`avgSellingPrice`)
- Determina la **categoria** del prezzo corrente:

#### Categorie Prezzo
1. **sotto_pc**: Prezzo corrente < Punto Critico (1.4x costo)
   - ⚠️ **CRITICO** - Prezzo troppo basso, margine insufficiente

2. **tra_pc_medio**: Punto Critico ≤ Prezzo corrente < Prezzo Medio
   - ⚡ **ATTENZIONE** - Prezzo sotto la media ma sopra il minimo

3. **sopra_medio**: Prezzo corrente ≥ Prezzo Medio
   - ✅ **OK** - Prezzo in linea o sopra la media

### 3. Conteggio Richieste Blocco Prezzo
- Conta tutte le attività (`mail.activity`) pendenti
- Filtrate per `summary ILIKE 'Blocco Prezzo'`
- Relative agli ordini in draft/sent

## Logica di Calcolo

### Punto Critico (PC)
```javascript
const criticalPoint = costPrice * 1.4;
// Margine del 40% sul costo
```

### Prezzo Medio (3 mesi)
```javascript
// Query: sale.order.line con:
// - state IN ['sale', 'done']
// - create_date >= (oggi - 3 mesi)
const avgSellingPrice = sum(price_unit) / count(lines);
```

### Determinazione Categoria
```javascript
if (currentPrice < criticalPoint) {
  category = 'sotto_pc';
} else if (avgSellingPrice > 0 && currentPrice < avgSellingPrice) {
  category = 'tra_pc_medio';
} else {
  category = 'sopra_medio';
}
```

## Response Format

### Success Response (200 OK)
```json
{
  "success": true,
  "stats": {
    "sotto_pc": 12,           // Prodotti sotto punto critico
    "tra_pc_medio": 25,       // Prodotti tra PC e medio
    "sopra_medio": 48,        // Prodotti sopra medio
    "richieste_blocco": 3,    // Task pendenti di blocco prezzo
    "total_products": 85,     // Totale prodotti analizzati
    "total_orders": 15        // Totale ordini in revisione
  },
  "products": [
    {
      "orderId": 12345,
      "orderName": "SO0123",
      "customerId": 567,
      "customerName": "Ristorante Da Mario",
      "lineId": 9876,
      "productId": 4321,
      "productName": "Spaghetti Barilla 500g",
      "productCode": "BAR-SPA-500",
      "quantity": 10,
      "currentPriceUnit": 1.20,
      "costPrice": 0.85,
      "avgSellingPrice": 1.45,
      "criticalPoint": 1.19,    // costPrice * 1.4
      "category": "tra_pc_medio",
      "isLocked": false
    }
  ],
  "timestamp": "2025-11-11T14:30:00.000Z"
}
```

### No Orders Found (200 OK)
```json
{
  "success": true,
  "stats": {
    "sotto_pc": 0,
    "tra_pc_medio": 0,
    "sopra_medio": 0,
    "richieste_blocco": 0,
    "total_products": 0,
    "total_orders": 0
  },
  "products": []
}
```

### Error Response (401 Unauthorized)
```json
{
  "success": false,
  "error": "User session not valid"
}
```

### Error Response (500 Internal Server Error)
```json
{
  "success": false,
  "error": "Error aggregating prices",
  "details": "Stack trace (solo in development)"
}
```

## Tipi TypeScript

### ProductAnalysis
```typescript
interface ProductAnalysis {
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  lineId: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  currentPriceUnit: number;
  costPrice: number;
  avgSellingPrice: number;
  criticalPoint: number;        // costPrice * 1.4
  category: 'sotto_pc' | 'tra_pc_medio' | 'sopra_medio';
  isLocked: boolean;
}
```

### AggregateStats
```typescript
interface AggregateStats {
  sotto_pc: number;
  tra_pc_medio: number;
  sopra_medio: number;
  richieste_blocco: number;
  total_products: number;
  total_orders: number;
}
```

## Esempio di Utilizzo

### Frontend (React/Next.js)
```typescript
// Fetch aggregated price data
const fetchPriceAggregation = async () => {
  const response = await fetch('/api/controllo-prezzi/aggregate', {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    console.log('Statistics:', data.stats);
    console.log('Products:', data.products);

    // Filtra prodotti critici
    const criticalProducts = data.products.filter(
      p => p.category === 'sotto_pc'
    );

    console.log(`${criticalProducts.length} prodotti sotto punto critico`);
  }
};
```

### Dashboard Widget
```typescript
// Mostra statistiche nel dashboard
const StatsWidget = ({ stats }: { stats: AggregateStats }) => (
  <div className="grid grid-cols-4 gap-4">
    <Card>
      <h3>Sotto PC</h3>
      <p className="text-red-500 text-3xl font-bold">{stats.sotto_pc}</p>
      <p className="text-sm text-gray-500">Critici</p>
    </Card>

    <Card>
      <h3>PC - Medio</h3>
      <p className="text-yellow-500 text-3xl font-bold">{stats.tra_pc_medio}</p>
      <p className="text-sm text-gray-500">Attenzione</p>
    </Card>

    <Card>
      <h3>Sopra Medio</h3>
      <p className="text-green-500 text-3xl font-bold">{stats.sopra_medio}</p>
      <p className="text-sm text-gray-500">OK</p>
    </Card>

    <Card>
      <h3>Richieste</h3>
      <p className="text-purple-500 text-3xl font-bold">{stats.richieste_blocco}</p>
      <p className="text-sm text-gray-500">Da approvare</p>
    </Card>
  </div>
);
```

## Performance

### Durata Stimata
- **Small** (1-5 ordini, 10-50 prodotti): ~2-5 secondi
- **Medium** (5-15 ordini, 50-150 prodotti): ~5-15 secondi
- **Large** (15+ ordini, 150+ prodotti): ~15-30 secondi

### Ottimizzazioni
- `maxDuration: 120` - Timeout massimo 2 minuti
- Batch processing per ordini
- Map per lookup veloci (productMap, avgPriceMap, lockedPricesMap)
- Continue on error per ordini singoli

### Cache Raccomandato
```typescript
// Implementa cache client-side per evitare reload frequenti
const CACHE_TTL = 5 * 60 * 1000; // 5 minuti
```

## Logging

L'API logga ogni step importante:
```
📊 [AGGREGATE-PRICES-API] Starting aggregation...
🔍 [AGGREGATE-PRICES-API] Fetching orders in draft/sent state...
✅ [AGGREGATE-PRICES-API] Found 15 orders to analyze
📋 [AGGREGATE-PRICES-API] Processing order SO0123 (ID: 12345)...
✅ [AGGREGATE-PRICES-API] Processed 6 products from order SO0123
🔍 [AGGREGATE-PRICES-API] Counting pending price lock requests...
✅ [AGGREGATE-PRICES-API] Found 3 pending price lock requests
✅ [AGGREGATE-PRICES-API] Aggregation complete: { sotto_pc: 12, ... }
```

## Dipendenze

### API Esistenti (riutilizzate)
- `/api/catalogo-venditori/order-prices/[orderId]` - Logica di base per prezzi ordine
- Modelli Odoo:
  - `sale.order` - Ordini vendita
  - `sale.order.line` - Righe ordine
  - `product.product` - Prodotti
  - `product.pricelist.item` - Prezzi bloccati
  - `mail.activity` - Task/Attività

### Librerie
- `@/lib/odoo-auth` - Autenticazione e chiamate Odoo
- Next.js 14 App Router

## Sicurezza

- ✅ Autenticazione obbligatoria (session check)
- ✅ Solo ordini LAPA company (`company_id = 1`)
- ✅ Read-only API (nessuna modifica dati)
- ✅ Error handling completo
- ✅ Input validation

## Testing

### Test Manuale
```bash
# 1. Avvia il server
npm run dev

# 2. Testa l'API
curl -X GET http://localhost:3000/api/controllo-prezzi/aggregate \
  -H "Cookie: session_id=YOUR_SESSION" \
  | jq .

# 3. Verifica response
# - success: true
# - stats con conteggi corretti
# - products array popolato
```

### Test Cases
1. **No orders in draft/sent** - Deve ritornare stats a 0
2. **Orders with products** - Deve categorizzare correttamente
3. **Products without avg price** - Deve usare list_price come fallback
4. **Locked prices** - Deve settare isLocked = true
5. **Session expired** - Deve ritornare 401

## Riferimenti Codice

### File Sorgente
- `app/api/controllo-prezzi/aggregate/route.ts`

### Ispirazione Logica
- `app/api/catalogo-venditori/order-prices/[orderId]/route.ts` (linee 1-337)
- `app/catalogo-venditori/review-prices/[orderId]/page.tsx` (linee 556-603)

### Configurazione App
- `lib/data/apps.ts` (ID: prezzi1)

## Roadmap Future

### Possibili Miglioramenti
1. **Cache Redis** - Cache dei risultati per 5 minuti
2. **Pagination** - Paginazione prodotti (limit/offset)
3. **Filtri** - Filter per customer, product, date range
4. **Export** - Export CSV/Excel dei prodotti
5. **WebSocket** - Real-time updates quando cambiano ordini
6. **Analytics** - Trend storici per categoria
7. **Notifications** - Alert quando sotto_pc > soglia

## Support

Per problemi o domande:
- Check logs: `[AGGREGATE-PRICES-API]`
- Verifica session Odoo valida
- Controlla stato ordini in Odoo (devono essere draft/sent)
