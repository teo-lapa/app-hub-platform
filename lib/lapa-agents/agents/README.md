# Products Agent - Documentazione

Agente intelligente per la gestione delle informazioni sui prodotti tramite Odoo XML-RPC.

## Caratteristiche Principali

- **Ricerca Prodotti**: Ricerca avanzata per nome, categoria, codice, barcode, prezzo
- **Disponibilità**: Verifica stock in tempo reale con dettaglio ubicazioni
- **Prezzi**: Calcolo prezzi differenziati B2B vs B2C con sconti quantità
- **Prodotti Simili**: Suggerimenti intelligenti basati su categoria, prezzo, attributi
- **Promozioni**: Gestione offerte e sconti attivi
- **Multi-lingua**: Supporto IT, EN, FR, DE

## Installazione

```typescript
import { productsAgent, ProductsAgent } from '@/lib/lapa-agents/agents/products-agent';
```

## Utilizzo Base

### 1. Ricerca Prodotti

```typescript
// Ricerca semplice
const result = await productsAgent.searchProducts({
  query: 'vino',
  active_only: true,
}, 10);

if (result.success) {
  result.data?.forEach(product => {
    console.log(product.name, product.list_price);
  });
}

// Ricerca avanzata
const result = await productsAgent.searchProducts({
  query: 'champagne',
  category_id: 5,
  min_price: 20,
  max_price: 100,
  available_only: true,
});
```

### 2. Dettagli Prodotto

```typescript
const result = await productsAgent.getProductDetails(123);

if (result.success && result.data) {
  console.log('Nome:', result.data.name);
  console.log('Prezzo:', result.data.list_price);
  console.log('Categoria:', result.data.categ_id[1]);
}
```

### 3. Verifica Disponibilità

```typescript
const result = await productsAgent.checkAvailability(123);

if (result.success && result.data) {
  console.log('Disponibile:', result.data.qty_available);
  console.log('In arrivo:', result.data.incoming_qty);

  // Dettaglio ubicazioni
  result.data.locations?.forEach(loc => {
    console.log(`${loc.locationName}: ${loc.quantity} pz`);
  });
}
```

### 4. Calcolo Prezzo

```typescript
// Prezzo B2C (retail)
const priceB2C = await productsAgent.getPrice(123, 'B2C', 1);

// Prezzo B2B (business)
const priceB2B = await productsAgent.getPrice(123, 'B2B', 10);

// Con ID cliente specifico
const price = await productsAgent.getPrice(123, 'B2B', 50, partnerId);

if (price.success && price.data) {
  console.log('Prezzo:', price.data.finalPrice);
  console.log('Sconto:', price.data.discountPercent);
}
```

### 5. Prodotti Simili

```typescript
const result = await productsAgent.getSimilarProducts(123, 5);

if (result.success && result.data) {
  result.data.forEach(similar => {
    console.log(similar.product.name);
    console.log('Similarità:', similar.similarityScore, '%');
    console.log('Motivo:', similar.reason);
  });
}
```

### 6. Promozioni Attive

```typescript
// Tutte le promozioni
const promos = await productsAgent.getPromotions();

// Promozioni per prodotto specifico
const promos = await productsAgent.getPromotions(123);

// Promozioni per categoria
const promos = await productsAgent.getPromotions(undefined, 5);
```

## API Reference

### SearchFilters

```typescript
interface SearchFilters {
  query?: string;              // Ricerca testuale
  category_id?: number;        // ID categoria
  barcode?: string;            // Barcode esatto
  default_code?: string;       // SKU/codice prodotto
  min_price?: number;          // Prezzo minimo
  max_price?: number;          // Prezzo massimo
  available_only?: boolean;    // Solo disponibili
  active_only?: boolean;       // Solo attivi (default: true)
}
```

### Product

```typescript
interface Product {
  id: number;
  name: string;
  default_code?: string;       // SKU
  barcode?: string;
  categ_id: [number, string];  // [id, nome]
  list_price: number;
  standard_price: number;      // Costo
  type: 'product' | 'consu' | 'service';
  description?: string;
  description_sale?: string;
  uom_id: [number, string];    // Unità di misura
  active: boolean;
}
```

### ProductAvailability

```typescript
interface ProductAvailability {
  productId: number;
  productName: string;
  qty_available: number;       // Disponibile ora
  virtual_available: number;   // Prevista (con ordini)
  outgoing_qty: number;        // In uscita
  incoming_qty: number;        // In arrivo
  free_qty: number;            // Libera
  locations?: LocationStock[]; // Dettaglio ubicazioni
}
```

### ProductPrice

```typescript
interface ProductPrice {
  productId: number;
  productName: string;
  customerType: 'B2B' | 'B2C';
  basePrice: number;
  discountPercent?: number;
  finalPrice: number;
  currency: string;
  pricelistName?: string;
  taxIncluded: boolean;        // true per B2C
  minQuantity?: number;
}
```

## Workflow Completo

Esempio di workflow e-commerce completo:

```typescript
async function ecommerceWorkflow() {
  // 1. Cliente cerca prodotto
  const searchResult = await productsAgent.searchProducts({
    query: 'vino rosso',
    available_only: true,
  });

  const product = searchResult.data?.[0];
  if (!product) return;

  // 2. Verifica disponibilità
  const availability = await productsAgent.checkAvailability(product.id);

  if (availability.data.qty_available === 0) {
    console.log('Prodotto non disponibile');
    return;
  }

  // 3. Calcola prezzo
  const price = await productsAgent.getPrice(product.id, 'B2C', 2);
  console.log('Totale:', price.data.finalPrice * 2);

  // 4. Suggerisci prodotti simili
  const similar = await productsAgent.getSimilarProducts(product.id, 3);
  console.log('Potrebbe interessarti:', similar.data);

  // 5. Verifica promozioni
  const promos = await productsAgent.getPromotions(product.id);
  if (promos.data.length > 0) {
    console.log('OFFERTA:', promos.data[0].name);
  }
}
```

## Multi-lingua

```typescript
// Cambia lingua all'istanza singleton
productsAgent.setLanguage('en');

// Oppure crea istanza con lingua specifica
const agentEN = new ProductsAgent('en');
const agentFR = new ProductsAgent('fr');
const agentDE = new ProductsAgent('de');
```

Lingue supportate:
- `it` - Italiano (default)
- `en` - English
- `fr` - Français
- `de` - Deutsch

## Gestione Errori

Tutte le funzioni ritornano un `AgentResponse`:

```typescript
interface AgentResponse<T> {
  success: boolean;
  data?: T;
  message: string;      // Messaggio localizzato
  error?: string;       // Dettaglio errore
  timestamp: Date;
  language: string;
}
```

Esempio:

```typescript
const result = await productsAgent.searchProducts({ query: 'test' });

if (result.success) {
  // OK - usa result.data
  console.log(result.data);
} else {
  // Errore - gestisci
  console.error(result.message);
  console.error(result.error);
}
```

## Performance Tips

1. **Limit risultati**: Usa `limit` per evitare query pesanti

```typescript
await productsAgent.searchProducts({ query: 'vino' }, 20); // Max 20 risultati
```

2. **Available only**: Filtra lato Odoo invece che client-side

```typescript
// ✅ BUONO - filtra in Odoo
await productsAgent.searchProducts({ available_only: true });

// ❌ LENTO - filtra dopo
const all = await productsAgent.searchProducts({});
const available = all.data.filter(p => checkStock(p));
```

3. **Cache prezzi**: Memorizza prezzi calcolati se usi lo stesso prodotto più volte

```typescript
const priceCache = new Map<number, ProductPrice>();

async function getCachedPrice(productId: number) {
  if (priceCache.has(productId)) {
    return priceCache.get(productId);
  }

  const result = await productsAgent.getPrice(productId, 'B2C', 1);
  if (result.data) {
    priceCache.set(productId, result.data);
  }
  return result.data;
}
```

## Testing

```typescript
// Test connessione
const isConnected = await productsAgent.testConnection();
if (!isConnected) {
  console.error('Odoo non raggiungibile');
}
```

## Esempi Avanzati

Vedi `products-agent.example.ts` per esempi completi di:
- Ricerca multi-criterio
- Calcolo prezzi con sconti volume
- Workflow e-commerce completo
- Integrazione con chatbot
- Dashboard prodotti

## Troubleshooting

### "Prodotto non trovato"
- Verifica che l'ID prodotto esista in Odoo
- Controlla che il prodotto sia attivo (`active = true`)

### "Errore calcolo prezzo"
- Verifica che esistano listini B2B/B2C configurati in Odoo
- Controlla che il prodotto abbia un `list_price` valido

### "Errore verifica disponibilità"
- Assicurati che il modello `stock.quant` sia accessibile
- Verifica permessi utente Odoo

### "Connessione fallita"
- Verifica credenziali Odoo in `.env`
- Controlla che l'URL Odoo sia raggiungibile
- Verifica che il database Odoo sia corretto

## Integrazione con Altri Agenti

```typescript
// Esempio: Integra con CustomerAgent
import { productsAgent } from './products-agent';
import { customerAgent } from './customer-agent';

async function personalizedRecommendations(customerId: number) {
  // 1. Analizza storico cliente
  const history = await customerAgent.getPurchaseHistory(customerId);

  // 2. Trova categorie preferite
  const preferredCategory = history.mostPurchasedCategory;

  // 3. Suggerisci prodotti simili
  const recommendations = await productsAgent.searchProducts({
    category_id: preferredCategory,
    available_only: true,
  }, 10);

  return recommendations.data;
}
```

## License

MIT - Lapa.ch

## Support

Per supporto: paul@lapa.ch
