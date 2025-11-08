# API Margini - Documentazione

API per l'analisi dei margini dei prodotti venduti da Odoo.

## Endpoint

```
GET /api/margini
```

## Query Parameters

| Parametro | Tipo | Default | Descrizione |
|-----------|------|---------|-------------|
| `startDate` | string (YYYY-MM-DD) | Primo giorno del mese corrente | Data inizio periodo |
| `endDate` | string (YYYY-MM-DD) | Oggi | Data fine periodo |
| `groupBy` | 'product' \| 'category' \| 'customer' | null | Raggruppa i risultati |

## Esempi di Utilizzo

### 1. Margini del mese corrente (default)

```bash
GET /api/margini
```

### 2. Margini di Ottobre 2025

```bash
GET /api/margini?startDate=2025-10-01&endDate=2025-10-31
```

### 3. Margini raggruppati per categoria

```bash
GET /api/margini?startDate=2025-10-01&endDate=2025-10-31&groupBy=category
```

### 4. Margini degli ultimi 7 giorni

```bash
GET /api/margini?startDate=2025-10-25&endDate=2025-10-31
```

## Response Format

```typescript
{
  // Riepilogo globale
  "summary": {
    "totalRevenue": number,      // Fatturato totale
    "totalCost": number,          // Costo totale
    "totalMargin": number,        // Margine totale
    "marginPercentage": number,   // % margine
    "orderCount": number,         // Numero ordini
    "productCount": number,       // Numero prodotti venduti
    "period": {
      "startDate": string,
      "endDate": string
    }
  },

  // Top 10 prodotti per margine
  "topProducts": [
    {
      "id": number,
      "name": string,
      "defaultCode": string,         // Codice prodotto
      "category": string,
      "quantitySold": number,
      "totalRevenue": number,
      "totalCost": number,
      "totalMargin": number,
      "marginPercentage": number,
      "avgSalePrice": number,
      "avgCostPrice": number
    }
  ],

  // Prodotti venduti in perdita (margine negativo)
  "lossProducts": [
    {
      "id": number,
      "name": string,
      "defaultCode": string,
      "category": string,
      "quantitySold": number,
      "totalRevenue": number,
      "totalCost": number,
      "totalMargin": number,          // Negativo
      "marginPercentage": number,
      "avgSalePrice": number,
      "avgCostPrice": number
    }
  ],

  // Prodotti regalati (revenue = 0)
  "giftsGiven": {
    "totalCost": number,              // Costo totale regali
    "productCount": number,           // Numero prodotti regalati
    "products": [
      {
        "id": number,
        "name": string,
        "defaultCode": string,
        "quantity": number,
        "cost": number,
        "date": string,               // Data ordine
        "orderName": string           // Nome ordine
      }
    ],
    // Regali raggruppati per cliente
    "byCustomer": [
      {
        "customerId": number,
        "customerName": string,
        "products": [...],            // Array di prodotti regalati
        "totalCost": number
      }
    ]
  },

  // Trend giornalieri
  "trends": [
    {
      "date": string,                 // YYYY-MM-DD
      "revenue": number,
      "cost": number,
      "margin": number,
      "orders": number
    }
  ],

  // Dati raggruppati (se groupBy specificato)
  "groupedData": {
    "groupBy": string,                // 'product' | 'category' | 'customer'
    "groups": [
      {
        "name": string,
        "revenue": number,
        "cost": number,
        "margin": number,
        "marginPercentage": number,
        "productCount": number
      }
    ]
  }
}
```

## Esempio Response

```json
{
  "summary": {
    "totalRevenue": 125430.50,
    "totalCost": 87801.35,
    "totalMargin": 37629.15,
    "marginPercentage": 30.0,
    "orderCount": 234,
    "productCount": 156,
    "period": {
      "startDate": "2025-10-01",
      "endDate": "2025-10-31"
    }
  },
  "topProducts": [
    {
      "id": 1234,
      "name": "Prosciutto Crudo DOP",
      "defaultCode": "PR001",
      "category": "Salumi",
      "quantitySold": 45.5,
      "totalRevenue": 2275.00,
      "totalCost": 1365.00,
      "totalMargin": 910.00,
      "marginPercentage": 40.0,
      "avgSalePrice": 50.00,
      "avgCostPrice": 30.00
    }
  ],
  "lossProducts": [
    {
      "id": 5678,
      "name": "Prodotto in Perdita",
      "defaultCode": "PP001",
      "category": "Varie",
      "quantitySold": 10,
      "totalRevenue": 50.00,
      "totalCost": 80.00,
      "totalMargin": -30.00,
      "marginPercentage": -60.0,
      "avgSalePrice": 5.00,
      "avgCostPrice": 8.00
    }
  ],
  "giftsGiven": {
    "totalCost": 450.00,
    "productCount": 15,
    "products": [
      {
        "id": 9999,
        "name": "Parmigiano Reggiano 24 mesi",
        "defaultCode": "PARM24",
        "quantity": 2,
        "cost": 120.00,
        "date": "2025-10-15 10:30:00",
        "orderName": "S00234"
      }
    ],
    "byCustomer": [
      {
        "customerId": 123,
        "customerName": "Ristorante Da Mario",
        "products": [...],
        "totalCost": 120.00
      }
    ]
  },
  "trends": [
    {
      "date": "2025-10-01",
      "revenue": 4500.00,
      "cost": 3150.00,
      "margin": 1350.00,
      "orders": 8
    }
  ]
}
```

## Note Implementative

### Logica di Calcolo

1. **Fatturato (Revenue)**: `price_subtotal` dalla riga ordine
2. **Costo**: `purchase_price * quantity` (fallback a `standard_price` se non disponibile)
3. **Margine**: `revenue - cost`
4. **% Margine**: `(margin / revenue) * 100`

### Prodotti Regalati

Sono considerati "regalati" i prodotti con:
- `price_subtotal = 0` (nessun ricavo)
- `cost > 0` (ma hanno un costo)

Questi vengono tracciati separatamente per:
- Identificare il costo totale dei regali
- Vedere quali clienti hanno ricevuto prodotti gratis
- Analizzare quali prodotti vengono regalati più frequentemente

### Prodotti in Perdita

Prodotti con `totalMargin < 0`, ovvero venduti a un prezzo inferiore al costo.

### Trend Giornalieri

Aggregazione giornaliera di revenue, cost, margin e numero ordini per visualizzare l'andamento nel periodo.

## Autenticazione

L'API usa la sessione Odoo dell'utente loggato tramite cookie `odoo_session_id`.
Se non disponibile, utilizza le credenziali di fallback configurate in `.env`.

## Errori

### 500 - Internal Server Error

```json
{
  "error": "Failed to fetch margin data",
  "details": "Error message..."
}
```

Possibili cause:
- Errore di autenticazione con Odoo
- Errore nella chiamata API Odoo
- Dati mancanti o corrotti

## Performance

- L'API esegue 4 chiamate a Odoo:
  1. `sale.order` - Recupero ordini
  2. `sale.order.line` - Recupero righe ordine
  3. `product.product` - Recupero dettagli prodotti
  4. Calcoli lato server

- Tempi stimati:
  - ~100 ordini: 2-3 secondi
  - ~500 ordini: 5-8 secondi
  - ~1000 ordini: 10-15 secondi

## Roadmap

- [ ] Aggiungere cache Redis per risultati recenti
- [ ] Esportazione Excel/CSV
- [ ] Filtri aggiuntivi (categoria, fornitore, venditore)
- [ ] Grafici e visualizzazioni integrate
- [ ] Notifiche per prodotti in perdita
