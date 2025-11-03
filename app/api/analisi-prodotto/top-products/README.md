# Top Products API

API endpoint per analizzare i top prodotti venduti in un periodo specificato.

## Endpoint

```
GET /api/analisi-prodotto/top-products
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dateFrom` | string | Yes | Data di inizio nel formato `YYYY-MM-DD` |
| `dateTo` | string | Yes | Data di fine nel formato `YYYY-MM-DD` |

## Esempio di Richiesta

```bash
curl "http://localhost:3000/api/analisi-prodotto/top-products?dateFrom=2025-05-01&dateTo=2025-11-03"
```

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "products": [
    {
      "id": 123,
      "name": "PRODUCT NAME",
      "uom": "kg",
      "totalQty": 1500.50,
      "totalRevenue": 25000.75,
      "orders": 45,
      "customers": 12,
      "marginPercent": 35.5,
      "avgPrice": 16.67,
      "avgCost": 10.75
    }
  ],
  "period": {
    "dateFrom": "2025-05-01",
    "dateTo": "2025-11-03"
  },
  "summary": {
    "totalProducts": 20,
    "totalRevenue": 150000.50,
    "totalQty": 5000.25,
    "avgMargin": 32.5
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "Parameters dateFrom and dateTo are required",
  "example": "/api/analisi-prodotto/top-products?dateFrom=2025-05-01&dateTo=2025-11-03"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Failed to fetch top products data",
  "details": "Error message details"
}
```

## Risposta Dettagliata

### `products` Array

Ogni prodotto nella lista contiene:

- **`id`** (number): ID del prodotto in Odoo
- **`name`** (string): Nome del prodotto
- **`uom`** (string): Unità di misura (es. "kg", "pz", "lt")
- **`totalQty`** (number): Quantità totale venduta nel periodo
- **`totalRevenue`** (number): Fatturato totale generato dal prodotto
- **`orders`** (number): Numero di ordini che includono questo prodotto
- **`customers`** (number): Numero di clienti unici che hanno ordinato questo prodotto
- **`marginPercent`** (number): Percentuale di margine calcolato come `(revenue - cost) / revenue * 100`
- **`avgPrice`** (number): Prezzo medio di vendita per unità
- **`avgCost`** (number): Costo medio per unità

### `period` Object

Contiene le date del periodo analizzato:

- **`dateFrom`** (string): Data di inizio
- **`dateTo`** (string): Data di fine

### `summary` Object

Riepilogo dei top 20 prodotti:

- **`totalProducts`** (number): Numero di prodotti nella lista (max 20)
- **`totalRevenue`** (number): Fatturato totale dei top 20 prodotti
- **`totalQty`** (number): Quantità totale venduta dei top 20 prodotti
- **`avgMargin`** (number): Margine medio percentuale dei top 20 prodotti

## Logica di Business

1. **Query su sale.order.line**: Recupera tutte le righe ordine con stato `sale` o `done` nel periodo specificato
2. **Aggregazione per prodotto**: Raggruppa i dati per `product_id` e calcola:
   - Quantità totale venduta
   - Fatturato totale (somma `price_subtotal`)
   - Costo totale (usando `purchase_price` dalla riga ordine)
   - Set di ordini unici
   - Set di clienti unici
3. **JOIN con product.product**: Recupera i dettagli del prodotto (nome, UOM, prezzi)
4. **Calcolo margini**: Per ogni prodotto calcola il margine percentuale
5. **Ordinamento**: Ordina per `totalRevenue` DESC
6. **Top 20**: Ritorna i primi 20 prodotti

## Calcolo del Margine

Il margine viene calcolato nel seguente modo:

```typescript
margin = totalRevenue - totalCost
marginPercent = (margin / totalRevenue) * 100
```

Dove:
- `totalCost` = somma di `purchase_price * product_uom_qty` per ogni riga ordine
- Se `purchase_price` non è disponibile, viene usato `standard_price` del prodotto come fallback

## Timeout

L'endpoint ha un timeout di **120 secondi** per gestire query su periodi estesi con molti dati.

## Note

- I prodotti sono ordinati per **fatturato totale** (non per quantità o margine)
- Vengono considerati solo ordini confermati (stato `sale` o `done`)
- Il calcolo dei clienti unici usa `order_partner_id` dalle righe ordine
- Tutti i valori numerici sono arrotondati a 2 decimali
