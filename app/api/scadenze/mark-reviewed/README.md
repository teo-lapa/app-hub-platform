# API Endpoint: Mark as Reviewed

Endpoint per marcare i prodotti in scadenza come verificati fisicamente.

## Strategia di Storage

L'endpoint implementa un approccio ibrido:

1. **Postgres (Preferito)**: Usa `@vercel/postgres` se disponibile
   - Crea automaticamente la tabella `expiry_reviews` se non esiste
   - Crea indici per ottimizzare le query
   - Performance e scalabilita ottimali

2. **File JSON (Fallback)**: Se Postgres non e disponibile
   - Salva in `/tmp/expiry_reviews.json` (Linux/Mac)
   - Salva in `%TEMP%\expiry_reviews.json` (Windows)
   - Fallback secondario in `./tmp/expiry_reviews.json` se anche /tmp non e scrivibile

## Schema Database

### Tabella: `expiry_reviews`

```sql
CREATE TABLE IF NOT EXISTS expiry_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  lot_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  reviewed_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR(255) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_expiry_reviews_product
  ON expiry_reviews(product_id, lot_id, location_id);

CREATE INDEX IF NOT EXISTS idx_expiry_reviews_date
  ON expiry_reviews(reviewed_at DESC);
```

## POST: Salva Review

**Endpoint**: `POST /api/scadenze/mark-reviewed`

### Request Body

```typescript
interface MarkAsReviewedRequest {
  productId: number;     // ID prodotto Odoo
  lotId: number;         // ID lotto
  locationId: number;    // ID ubicazione
  reviewedBy: string;    // Email o username utente
  note?: string;         // Note opzionali
}
```

### Response

```typescript
interface MarkAsReviewedResponse {
  success: boolean;
  reviewId?: number;     // ID della review creata
  error?: string;        // Messaggio di errore
  message?: string;      // Messaggio informativo
}
```

### Esempio

```bash
curl -X POST http://localhost:3000/api/scadenze/mark-reviewed \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 12345,
    "lotId": 67890,
    "locationId": 28,
    "reviewedBy": "mario.rossi@example.com",
    "note": "Verificato fisicamente - prodotto in buone condizioni"
  }'
```

### Response Success

```json
{
  "success": true,
  "reviewId": 42,
  "message": "Review salvata con successo in database"
}
```

### Response Error

```json
{
  "success": false,
  "error": "Campi obbligatori mancanti: productId, lotId, locationId, reviewedBy"
}
```

## GET: Recupera Reviews

**Endpoint**: `GET /api/scadenze/mark-reviewed`

### Query Parameters

- `product_id` (optional): Filtra per ID prodotto
- `lot_id` (optional): Filtra per ID lotto
- `location_id` (optional): Filtra per ID ubicazione
- `limit` (optional): Numero massimo risultati (default: 100)

### Response

```json
{
  "success": true,
  "reviews": [
    {
      "id": 42,
      "product_id": 12345,
      "lot_id": 67890,
      "location_id": 28,
      "reviewed_at": "2025-10-28T14:30:00.000Z",
      "reviewed_by": "mario.rossi@example.com",
      "note": "Verificato fisicamente - prodotto OK",
      "created_at": "2025-10-28T14:30:00.000Z"
    }
  ],
  "count": 1,
  "source": "postgres"  // o "json_file"
}
```

### Esempi

```bash
# Tutte le reviews
curl http://localhost:3000/api/scadenze/mark-reviewed

# Reviews per prodotto specifico
curl http://localhost:3000/api/scadenze/mark-reviewed?product_id=12345

# Reviews per lotto specifico
curl http://localhost:3000/api/scadenze/mark-reviewed?lot_id=67890

# Reviews recenti (ultime 10)
curl http://localhost:3000/api/scadenze/mark-reviewed?limit=10
```

## Error Handling

L'endpoint gestisce automaticamente i seguenti scenari:

1. **Postgres non disponibile**: Fallback automatico a file JSON
2. **File system non scrivibile**: Tenta path alternativi
3. **Validazione input**: Ritorna 400 con messaggio di errore chiaro
4. **Errori generici**: Ritorna 500 con dettagli in console

## Logging

L'endpoint produce i seguenti log:

```
📝 Salvataggio review prodotto: { productId, lotId, locationId, reviewedBy, note }
✅ Review salvata in Postgres: 42
⚠️ Postgres non disponibile, uso fallback JSON: error message
✅ Review salvata in file JSON: 42
📁 Review salvata in path alternativo: /alternative/path
❌ Errore salvataggio review: error message
```

## Testing

Vedi file `test.http` per esempi di test con REST Client di VS Code.

## Integrazione Frontend

Esempio di uso dal frontend React:

```typescript
const handleMarkAsReviewed = async () => {
  try {
    const response = await fetch('/api/scadenze/mark-reviewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        productId: product.id,
        lotId: product.lotId,
        locationId: product.locationId,
        reviewedBy: user?.email || 'unknown',
        note: 'Verificato fisicamente',
      }),
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Prodotto marcato come verificato');
    } else {
      toast.error(data.error || 'Errore durante verifica');
    }
  } catch (error) {
    toast.error('Errore: ' + error.message);
  }
};
```

## Note

- Le reviews sono immutabili (no UPDATE/DELETE via API)
- I timestamp sono in UTC
- L'ID e auto-incrementale (SERIAL in Postgres, calcolato in JSON)
- Il campo `note` e opzionale ma consigliato per tracciabilita
