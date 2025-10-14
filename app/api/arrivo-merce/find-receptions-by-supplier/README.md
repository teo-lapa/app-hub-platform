# API: Find Receptions By Supplier

Questa API cerca automaticamente le ricezioni in attesa per un fornitore specifico.

## Endpoint

```
POST /api/arrivo-merce/find-receptions-by-supplier
```

## Parametri di Input

```typescript
{
  supplier_id: number;        // Required - ID fornitore Odoo
  document_date?: string;     // Optional - Data fattura (YYYY-MM-DD)
  document_number?: string;   // Optional - Numero fattura per match con origin
  search_days?: number;       // Optional - Giorni di ricerca (default: 7 con date, 30 senza)
}
```

## Logica di Ricerca

### Con `document_date` fornita:
- Cerca ricezioni con `scheduled_date` entro ±`search_days` dalla data documento
- Ordina per vicinanza alla data:
  - Priorità 1: Ricezioni con scheduled_date = document_date (score: 100)
  - Priorità 2: Ricezioni ±3 giorni (score: 75+)
  - Priorità 3: Ricezioni ±7 giorni (score: 50+)

### Senza `document_date`:
- Cerca ricezioni degli ultimi 30 giorni (o `search_days` specificati)
- Ordina per `scheduled_date` DESC (più recente prima)

### Filtri applicati:
- `partner_id = supplier_id`
- `picking_type_code = 'incoming'`
- `state IN ['assigned', 'confirmed', 'waiting']` (esclude 'done' e 'cancel')

### Match esatto con `document_number`:
Se fornito, cerca ricezioni dove `origin` contiene il numero documento e le sposta in prima posizione.

## Response

```typescript
{
  found: boolean;
  count: number;
  receptions: [
    {
      id: number;
      name: string;              // Es: "WH/IN/04706"
      scheduled_date: string | false;
      state: string;             // 'assigned', 'confirmed', 'waiting'
      origin: string | false;    // Es: "P09956"
      products_count: number;    // Numero di prodotti nella ricezione
      total_qty: number;         // Quantità totale di tutti i prodotti
      date_match_score: number;  // 0-100: quanto è vicina alla data cercata
    }
  ],
  suggested_action: 'use_first' | 'ask_user' | 'create_manual';
  search_params: {
    supplier_id: number;
    document_date?: string;
    search_days: number;
  }
}
```

## Logica `suggested_action`

- **`use_first`**: 1 sola ricezione trovata (o match esatto con document_number)
- **`ask_user`**: 2-5 ricezioni trovate, mostrare lista all'utente
- **`create_manual`**: 0 ricezioni trovate, creare manualmente

## Date Match Score

Il punteggio indica quanto una ricezione è vicina alla data documento:

- **100**: Stesso giorno
- **90**: ±1 giorno
- **80**: ±2 giorni
- **75**: ±3 giorni
- **60**: ±5 giorni
- **50**: ±7 giorni
- **30**: ±14 giorni
- **15**: ±30 giorni
- **5**: Oltre 30 giorni

## Esempi di Utilizzo

### Esempio 1: Ricerca con data documento

```typescript
const response = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    supplier_id: 12345,
    document_date: '2025-10-14',
    document_number: 'P09956',
    search_days: 7
  })
});

const data = await response.json();
// {
//   found: true,
//   count: 2,
//   receptions: [
//     {
//       id: 86556,
//       name: "WH/IN/04706",
//       scheduled_date: "2025-10-14",
//       state: "assigned",
//       origin: "P09956",
//       products_count: 9,
//       total_qty: 572.0,
//       date_match_score: 100
//     },
//     {
//       id: 86557,
//       name: "WH/IN/04707",
//       scheduled_date: "2025-10-15",
//       state: "waiting",
//       origin: "P09955",
//       products_count: 5,
//       total_qty: 234.0,
//       date_match_score: 90
//     }
//   ],
//   suggested_action: "use_first"
// }
```

### Esempio 2: Ricerca senza data (ultimi 30 giorni)

```typescript
const response = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    supplier_id: 12345
  })
});

const data = await response.json();
// {
//   found: true,
//   count: 5,
//   receptions: [...], // ordinate per scheduled_date DESC
//   suggested_action: "ask_user"
// }
```

### Esempio 3: Nessuna ricezione trovata

```typescript
const response = await fetch('/api/arrivo-merce/find-receptions-by-supplier', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    supplier_id: 12345,
    document_date: '2025-10-14'
  })
});

const data = await response.json();
// {
//   found: false,
//   count: 0,
//   receptions: [],
//   suggested_action: "create_manual",
//   search_params: {
//     supplier_id: 12345,
//     document_date: "2025-10-14",
//     search_days: 7
//   }
// }
```

## Gestione Errori

### 400 - Bad Request
```json
{
  "error": "supplier_id mancante"
}
```

### 401 - Unauthorized
```json
{
  "error": "Sessione non valida"
}
```

### 500 - Internal Server Error
```json
{
  "error": "Errore durante la ricerca delle ricezioni",
  "details": "..."
}
```

## Note Implementative

- L'API utilizza la sessione Odoo dell'utente autenticato
- Per ogni ricezione trovata, carica i dettagli dei movimenti (`stock.move`) per calcolare:
  - `products_count`: numero di prodotti distinti
  - `total_qty`: somma delle quantità ordinate
- Le ricezioni parzialmente completate sono incluse nei risultati
- Le ricezioni senza `scheduled_date` sono comunque incluse ma ricevono score 0

## Integrazione con Workflow Esistente

Questa API è progettata per essere usata **prima** di chiamare `/find-reception`:

1. Utente scansiona/carica fattura
2. `/parse-invoice` estrae dati fornitore e fattura
3. **→ `/find-receptions-by-supplier`** cerca ricezioni candidate
4. Se `suggested_action = 'use_first'` → usa automaticamente la prima
5. Se `suggested_action = 'ask_user'` → mostra lista e chiedi conferma
6. Se `suggested_action = 'create_manual'` → crea nuova ricezione manuale
7. `/find-reception` carica dettagli completi della ricezione selezionata
8. `/process-reception` aggiorna lotti e quantità

## Vantaggi

- **Smart matching**: trova automaticamente la ricezione più probabile
- **Flessibile**: funziona con o senza data documento
- **Efficiente**: carica solo i dati necessari per il ranking
- **User-friendly**: fornisce azione suggerita per semplificare l'UX
- **Robusto**: gestisce ricezioni senza date, parzialmente completate, ecc.
