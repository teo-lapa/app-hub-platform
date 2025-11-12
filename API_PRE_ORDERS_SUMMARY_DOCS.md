# API: Pre-Orders Summary

## Endpoint
```
GET /api/smart-ordering-v2/pre-orders-summary
```

## Descrizione
Carica tutti i prodotti con PRE-ORDINE che hanno clienti assegnati nel database `preorder_customer_assignments`, raggruppa per fornitore e calcola statistiche aggregate.

## Autenticazione
Richiede cookie `odoo_session_id` valido.

## Parametri
Nessuno (GET senza query params).

## Risposta

### Success Response (200 OK)
```typescript
{
  success: true,
  preOrderSuppliers: [
    {
      supplierId: number,          // ID fornitore Odoo
      supplierName: string,        // Nome fornitore
      products: [
        {
          productId: number,       // ID prodotto Odoo
          productName: string,     // Nome completo prodotto
          productCode: string,     // Codice articolo
          unitPrice: number,       // Prezzo unitario
          uom: string,            // Unità di misura (es. "PZ", "KG")
          totalQuantity: number,  // Somma quantità tutti i clienti
          customerCount: number,  // Numero clienti che hanno prenotato
          estimatedValue: number, // totalQuantity * unitPrice
          assignments: [
            {
              customerId: number,
              customerName: string,
              quantity: number,
              notes: string | null
            }
          ]
        }
      ],
      totalProducts: number,       // Numero prodotti di questo fornitore
      totalCustomers: number,      // Clienti unici per questo fornitore
      totalQuantity: number,       // Somma quantità di tutti i prodotti
      estimatedValue: number       // Somma valore di tutti i prodotti
    }
  ],
  stats: {
    totalSuppliers: number,        // Numero fornitori totali
    totalProducts: number,         // Numero prodotti totali
    totalCustomers: number,        // Numero clienti totali
    totalAssignments: number,      // Numero assegnazioni totali
    totalQuantity: number,         // Quantità totale globale
    totalEstimatedValue: number    // Valore stimato globale
  },
  generatedAt: string              // ISO timestamp
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Session non trovata - Rifare login"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message"
}
```

## Logica di Business

### 1. Caricamento Assegnazioni
- Carica tutte le assegnazioni da `preorder_customer_assignments`
- Se la tabella non esiste o è vuota, ritorna array vuoto

### 2. Caricamento Prodotti
- Per ogni `product_id` con assegnazioni, carica info da Odoo:
  - Nome completo (`display_name`)
  - Codice articolo (`default_code`)
  - Fornitori (`seller_ids`)
  - Prezzo (`lst_price`)
  - UOM (`uom_id`)

### 3. Identificazione Fornitore
- Usa il **primo** fornitore in `seller_ids` come fornitore principale
- Se nessun fornitore, usa ID 0 con nome "Nessun fornitore"

### 4. Raggruppamento
- Raggruppa prodotti per `supplierId`
- Per ogni fornitore, calcola:
  - Lista prodotti con assegnazioni
  - Totale prodotti
  - Clienti unici (no duplicati tra prodotti)
  - Quantità totale (somma di tutti i prodotti)
  - Valore stimato (somma `quantity * price`)

### 5. Ordinamento
- I fornitori sono ordinati per **valore stimato decrescente**
- I prodotti all'interno di ogni fornitore mantengono l'ordine originale

## Esempio di Utilizzo

### JavaScript/TypeScript (Frontend)
```typescript
async function loadPreOrdersSummary() {
  const response = await fetch('/api/smart-ordering-v2/pre-orders-summary');
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error);
  }

  // Mostra statistiche globali
  console.log('Total suppliers:', data.stats.totalSuppliers);
  console.log('Total value: €', data.stats.totalEstimatedValue);

  // Itera per fornitore
  data.preOrderSuppliers.forEach(supplier => {
    console.log(`\n${supplier.supplierName}`);
    console.log(`  Products: ${supplier.totalProducts}`);
    console.log(`  Customers: ${supplier.totalCustomers}`);
    console.log(`  Value: €${supplier.estimatedValue}`);

    // Mostra prodotti
    supplier.products.forEach(product => {
      console.log(`    - ${product.productName}`);
      console.log(`      Qty: ${product.totalQuantity} ${product.uom}`);
      console.log(`      Customers: ${product.customerCount}`);
    });
  });
}
```

### cURL
```bash
curl -X GET \
  'http://localhost:3000/api/smart-ordering-v2/pre-orders-summary' \
  -H 'Cookie: odoo_session_id=YOUR_SESSION_ID' \
  | jq .
```

## Casi d'Uso

### 1. Riepilogo Pre-Ordini per Acquisti
Permette all'ufficio acquisti di vedere rapidamente:
- Quali fornitori hanno prodotti in pre-ordine
- Quanto vale ogni ordine da fare
- Quanti clienti aspettano ogni prodotto

### 2. Prioritizzazione Fornitori
Ordinando per valore stimato, si possono identificare i fornitori da contattare per primi.

### 3. Pianificazione Logistica
Conoscendo il numero di clienti per prodotto, si può pianificare la logistica di distribuzione.

### 4. Report Pre-Ordini
Base per generare report PDF/Excel da inviare ai fornitori o alla direzione.

## Performance

### Ottimizzazioni Implementate
- ✅ Query database ottimizzata con join minime
- ✅ Caricamento batch prodotti e clienti da Odoo
- ✅ Map/Set per lookup veloci invece di cicli nested
- ✅ Calcolo statistiche in un solo passaggio

### Tempi Attesi
- 100 assegnazioni: ~2-3 secondi
- 500 assegnazioni: ~5-8 secondi
- 1000+ assegnazioni: ~10-15 secondi

### Limiti
- Nessun limite sul numero di assegnazioni/prodotti
- Se troppo lenti, considerare:
  - Paginazione risultati
  - Cache in-memory per fornitori
  - Pre-calcolo statistiche in background job

## Note Tecniche

### Database Schema
Richiede tabella `preorder_customer_assignments`:
```sql
CREATE TABLE preorder_customer_assignments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Dipendenze
- `@vercel/postgres`: Query database
- `@/lib/odoo/rpcClient`: Comunicazione con Odoo RPC
- Next.js 14+: App Router API routes

### Gestione Errori
- Se tabella DB non esiste: ritorna array vuoto (non error)
- Se prodotto non trovato in Odoo: viene skippato
- Se fornitore non trovato: usa "Nessun fornitore"
- Se cliente non trovato: usa "Cliente {id}"

## Changelog

### v1.0.0 (2025-11-10)
- ✅ Prima versione
- ✅ Raggruppamento per fornitore
- ✅ Calcolo statistiche aggregate
- ✅ Caricamento nomi clienti da Odoo
- ✅ Ordinamento per valore stimato
