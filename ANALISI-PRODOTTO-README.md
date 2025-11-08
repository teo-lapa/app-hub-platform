# API Analisi Prodotto - Setup e Test

## File Creati

### 1. API Endpoint
- **Percorso**: `app/api/analisi-prodotto/route.ts`
- **Metodo**: GET
- **Descrizione**: API completa per analisi prodotto da Odoo

### 2. Script di Test
- **File**: `test-analisi-prodotto-api.js`
- **Uso**: Test dell'API endpoint
- **Comando**: `node test-analisi-prodotto-api.js`

### 3. Documentazione
- **File**: `ANALISI-PRODOTTO-API-DOC.md`
- **Contenuto**: Documentazione completa dell'API, parametri, response format, esempi

### 4. Esempio Frontend
- **File**: `ANALISI-PRODOTTO-EXAMPLE.tsx`
- **Descrizione**: Componente React/Next.js di esempio per usare l'API

## Come Testare

### Opzione 1: Via Browser (dopo aver avviato dev server)

```bash
# 1. Avvia il server Next.js
npm run dev

# 2. Apri nel browser:
http://localhost:3000/api/analisi-prodotto?productName=FIORDILATTE%20JULIENNE
```

### Opzione 2: Via Node.js Script

```bash
# Esegui lo script di test
node test-analisi-prodotto-api.js
```

Lo script:
- Chiama l'API con prodotto "FIORDILATTE JULIENNE TAGLIO NAPOLI"
- Usa periodo ultimi 6 mesi
- Stampa risultati formattati in console
- Salva il JSON completo in `analisi-prodotto-api-result.json`

### Opzione 3: Via cURL

```bash
curl "http://localhost:3000/api/analisi-prodotto?productName=FIORDILATTE%20JULIENNE&dateFrom=2024-05-01&dateTo=2024-10-31"
```

### Opzione 4: Via Postman/Insomnia

**URL**: `http://localhost:3000/api/analisi-prodotto`

**Query Parameters**:
- `productName`: FIORDILATTE JULIENNE TAGLIO NAPOLI
- `dateFrom`: 2024-05-01 (opzionale)
- `dateTo`: 2024-10-31 (opzionale)

## Parametri API

### Richiesti
- **productName** (string): Nome prodotto da cercare

### Opzionali
- **dateFrom** (string): Data inizio periodo (formato: YYYY-MM-DD)
  - Default: 6 mesi fa
- **dateTo** (string): Data fine periodo (formato: YYYY-MM-DD)
  - Default: oggi

## Response Structure

L'API ritorna un oggetto JSON con:

```typescript
{
  product: ProductInfo           // Info prodotto e giacenze
  suppliers: Supplier[]          // Lista fornitori configurati
  purchaseOrders: PurchaseOrder[] // Ordini acquisto nel periodo
  saleOrders: SaleOrder[]        // Ordini vendita nel periodo
  statistics: Statistics         // Statistiche aggregate
  topSuppliers: SupplierStats[]  // Top fornitori
  topCustomers: CustomerStats[]  // Top 10 clienti
  reorderSuggestion: ReorderSuggestion // Suggerimenti riordino
  period: { dateFrom, dateTo }   // Periodo analizzato
}
```

## Dati Calcolati

### Statistiche Principali
- Totale acquistato/ricevuto
- Totale venduto/consegnato
- Costi e fatturato
- Profitto e margini
- ROI
- Media vendite mensili/settimanali
- Giorni di copertura stock

### Suggerimenti Riordino
- Punto di riordino
- Scorta di sicurezza
- Quantità ottimale ordine
- Stock attuale (disponibile + in arrivo)
- Azione richiesta (se necessario)

## Esempio Output Console

```
========================================
PRODUCT INFO
========================================
ID: 12345
Name: FIORDILATTE JULIENNE TAGLIO NAPOLI
Code: FJTN001
Category: Latticini

PRICES:
  List Price: CHF 8.50
  Standard Price: CHF 6.20
  Theoretical Margin: 27.06%

STOCK:
  Available: 150 Units
  Virtual: 145 Units
  Incoming: 50 Units
  Outgoing: 55 Units

========================================
STATISTICS (Period: 2024-05-01 to 2024-10-31)
========================================

PURCHASES:
  Total Purchased: 500.00 Units
  Total Received: 480.00 Units
  Total Cost: CHF 3,100.00
  Average Price: CHF 6.20

SALES:
  Total Sold: 420.00 Units
  Total Delivered: 410.00 Units
  Total Revenue: CHF 3,570.00
  Average Price: CHF 8.50

PERFORMANCE:
  Profit: CHF 470.00
  Margin: 13.17%
  ROI: 15.16%

ROTATION:
  Monthly Avg Sales: 70.00 Units
  Weekly Avg Sales: 17.50 Units
  Days of Coverage: 45.7 days

========================================
REORDER SUGGESTION
========================================
Reorder Point: 55 Units
Safety Stock: 35 Units
Optimal Order Qty: 70 Units
Current Stock: 200 Units
Lead Time: 7 days

Action Required: NO
Message: Stock OK per i prossimi 46 giorni

========================================
TOP 10 CUSTOMERS
========================================

1. Ristorante Da Mario
   Orders: 12
   Quantity: 120.00 Units
   Revenue: CHF 1,020.00
   Avg Price: CHF 8.50
...
```

## Troubleshooting

### Errore "Product not found"
- Verifica che il nome prodotto sia corretto
- L'API usa ricerca case-insensitive e partial match (ilike)
- Prova con un nome parziale (es: "FIORDILATTE")

### Errore "Failed to authenticate with Odoo"
- Verifica credenziali in `.env.local`
- Controlla che Odoo sia raggiungibile
- Verifica cookie `odoo_session_id` se usi autenticazione utente

### Timeout
- L'API ha timeout di 120 secondi
- Se il periodo è molto lungo, riduci l'intervallo di date
- Verifica performance Odoo

### Dati mancanti
- Alcuni campi potrebbero essere null se non configurati in Odoo
- Fornitori: necessario configurarli in `product.supplierinfo`
- Lead time: default 7 giorni se non configurato

## Integrazione nel Frontend

### Importa il componente di esempio

```tsx
import AnalisiProdottoExample from '@/ANALISI-PRODOTTO-EXAMPLE';

export default function Page() {
  return <AnalisiProdottoExample />;
}
```

### Oppure usa direttamente l'API

```typescript
const response = await fetch(
  `/api/analisi-prodotto?productName=${encodeURIComponent(productName)}`
);
const data = await response.json();
```

## Note Tecniche

- **Autenticazione**: Usa sessione Odoo dell'utente loggato o credenziali fallback
- **Caching**: Sessione Odoo cachata per 5 minuti
- **Timeout**: 120 secondi (configurabile in `maxDuration`)
- **Modelli Odoo**: product.product, product.supplierinfo, purchase.order.line, sale.order.line

## Link Utili

- **Documentazione completa**: `ANALISI-PRODOTTO-API-DOC.md`
- **Script originale**: `analisi-prodotto-6-mesi.js`
- **Esempio frontend**: `ANALISI-PRODOTTO-EXAMPLE.tsx`

## Autore

Sviluppato da Claude Code per LAPA Platform
Data: 2025-11-03
