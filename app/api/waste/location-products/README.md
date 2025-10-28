# Waste Location Products API

API per ottenere tutti i prodotti presenti in un'ubicazione specifica (waste/scrap location).

## Endpoint

```
POST /api/waste/location-products
```

## Request Body

```typescript
{
  locationId: number  // ID dell'ubicazione Odoo (stock.location)
}
```

## Response

### Success Response (200)

```typescript
{
  success: true,
  products: Array<{
    id: number;              // Product ID
    name: string;            // Nome prodotto
    code: string;            // Codice articolo (default_code)
    barcode: string;         // Barcode/EAN
    image: string | null;    // Base64 image (data:image/png;base64,...)
    quantity: number;        // Quantità disponibile
    uom: string;             // Unità di misura (es: "PZ", "KG")
    lot_id?: number;         // ID lotto (opzionale)
    lot_name?: string;       // Nome/numero lotto (opzionale)
    expiration_date?: string;// Data scadenza ISO (opzionale)
    quant_id: number;        // ID stock.quant per riferimento
  }>,
  metadata: {
    locationId: number;      // Location ID richiesta
    totalProducts: number;   // Numero prodotti totali
    totalQuants: number;     // Numero quants originali
    withLots: number;        // Prodotti con lotto
    withExpiration: number;  // Prodotti con data scadenza
  }
}
```

### Error Responses

**401 Unauthorized**
```typescript
{
  success: false,
  error: "Sessione non valida. Effettua il login."
}
```

**400 Bad Request**
```typescript
{
  success: false,
  error: "locationId richiesto"
}
```

**500 Internal Server Error**
```typescript
{
  success: false,
  error: "Errore nel caricamento prodotti",
  details?: string  // Solo in development mode
}
```

## Logica Interna

1. **Validazione sessione**: Verifica autenticazione Odoo
2. **Validazione input**: Controlla presenza locationId
3. **Fetch stock quants**: Carica tutti i quants con quantity > 0 nella location
4. **Fetch product details**: Carica dettagli prodotti (nome, codice, barcode, immagine)
5. **Fetch lot details**: Carica informazioni lotti e date scadenza (in parallelo)
6. **Mappatura dati**: Costruisce oggetti prodotto completi
7. **Raggruppamento**: Aggrega quantità per product_id + lot_id
8. **Ordinamento**: Ordina per nome prodotto alfabeticamente
9. **Response**: Ritorna lista prodotti con metadata

## Features

- **Parallel fetching**: Prodotti e lotti caricati in parallelo per performance
- **Efficient grouping**: Raggruppa quantity per product+lot con Map
- **Graceful degradation**: Continua anche se caricamento lotti fallisce
- **Rich metadata**: Include statistiche utili per UI
- **Error handling**: Gestione errori robusta con logging dettagliato
- **Type safety**: TypeScript types per tutti i campi

## Use Cases

- **Gestione scarti**: Visualizza prodotti da scartare/eliminare
- **Inventory audit**: Controlla cosa è presente in ubicazioni waste
- **Lot tracking**: Traccia lotti scaduti o da eliminare
- **Reporting**: Genera report su prodotti waste per analisi

## Example Usage

### Frontend (React/TypeScript)

```typescript
async function loadWasteProducts(locationId: number) {
  const response = await fetch('/api/waste/location-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error);
  }

  return data.products;
}

// Usage in component
const products = await loadWasteProducts(123);
console.log(`Caricati ${products.length} prodotti`);
console.log(`Prodotti con scadenza: ${data.metadata.withExpiration}`);
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/waste/location-products \
  -H "Content-Type: application/json" \
  -d '{"locationId": 123}'
```

## Performance Notes

- **Batch operations**: Usa search_read per fetch multipli in una chiamata
- **Parallel processing**: Prodotti e lotti caricati contemporaneamente
- **Efficient grouping**: Map-based aggregation O(n) complexity
- **Memory efficient**: Usa Map per lookup invece di nested loops

## Security

- ✅ Session validation required
- ✅ Input validation on locationId
- ✅ Odoo RPC via authenticated session
- ✅ No SQL injection risk (uses Odoo ORM)
- ✅ Error details hidden in production

## Related APIs

- `/api/ubicazioni/buffer-products` - Similar API for buffer locations
- `/api/waste/create-scrap` - Create scrap orders from waste products
- `/api/inventory/stock-quants` - General stock quants API

## Odoo Models Used

- `stock.quant` - Stock quantities per location
- `product.product` - Product master data
- `stock.lot` - Lot/serial numbers with expiration
- `stock.location` - Warehouse locations

## Dependencies

- `@/lib/odoo/odoo-helper` - Session management
- Next.js 14+ App Router
- Odoo 16+ (XML-RPC API)
