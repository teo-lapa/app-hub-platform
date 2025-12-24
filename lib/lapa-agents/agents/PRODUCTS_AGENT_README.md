# Products Agent - Documentazione

## Panoramica

L'agente `ProductsAgent` fornisce un'interfaccia intelligente per gestire i prodotti in Odoo, con supporto multilingua e integrazione completa con i dati reali.

## Installazione e Import

```typescript
import { ProductsAgent } from '@/lib/lapa-agents/agents/products-agent';

// Crea istanza (lingua: 'it', 'en', 'fr', 'de')
const agent = new ProductsAgent('it');

// Oppure usa singleton preconfigurato
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';
```

## Metodi Principali

### 1. Ricerca Prodotti - `searchProducts()`

Cerca prodotti per nome, codice, barcode, categoria o prezzo.

**Esempio - Ricerca per nome:**
```typescript
const result = await agent.searchProducts({
  query: 'mozzarella',
  active_only: true
}, 20);

if (result.success) {
  console.log(`Trovati ${result.data.length} prodotti`);
  result.data.forEach(product => {
    console.log(`- ${product.name} (${product.default_code}) - €${product.list_price}`);
  });
}
```

**Esempio - Ricerca per categoria:**
```typescript
const result = await agent.searchProducts({
  category_id: 15,  // ID categoria Odoo
  min_price: 5,
  max_price: 50,
  available_only: true  // Solo prodotti con stock > 0
}, 50);
```

**Esempio - Ricerca per barcode:**
```typescript
const result = await agent.searchProducts({
  barcode: '8001520002501'
});

if (result.success && result.data.length > 0) {
  const product = result.data[0];
  console.log(`Prodotto: ${product.name}`);
}
```

### 2. Dettagli Prodotto - `getProductDetails()`

Recupera informazioni complete su un prodotto specifico.

```typescript
const result = await agent.getProductDetails(1234);

if (result.success) {
  const product = result.data;
  console.log(`Nome: ${product.name}`);
  console.log(`Codice: ${product.default_code}`);
  console.log(`Categoria: ${product.categ_id[1]}`);
  console.log(`Prezzo: €${product.list_price}`);
  console.log(`Tipo: ${product.type}`);  // 'product', 'consu', 'service'

  // Immagine base64 (se disponibile)
  if (product.image_1920) {
    console.log('Immagine disponibile');
  }
}
```

### 3. Verifica Disponibilità - `checkAvailability()`

Controlla la disponibilità in magazzino con dettaglio ubicazioni.

```typescript
const result = await agent.checkAvailability(1234);

if (result.success) {
  const availability = result.data;

  console.log(`Prodotto: ${availability.productName}`);
  console.log(`Disponibile: ${availability.qty_available} unità`);
  console.log(`Previsto: ${availability.virtual_available} unità`);
  console.log(`In uscita: ${availability.outgoing_qty} unità`);
  console.log(`In arrivo: ${availability.incoming_qty} unità`);
  console.log(`Quantità libera: ${availability.free_qty} unità`);

  // Dettaglio ubicazioni
  if (availability.locations && availability.locations.length > 0) {
    console.log('\nStock per ubicazione:');
    availability.locations.forEach(loc => {
      console.log(`  - ${loc.locationName}: ${loc.quantity} unità`);
    });
  }
}
```

### 4. Calcolo Prezzo - `getPrice()`

Calcola il prezzo considerando listini B2B/B2C e regole di sconto.

**Esempio - Prezzo B2C (pubblico):**
```typescript
const result = await agent.getPrice(
  1234,       // productId
  'B2C',      // customerType
  1           // quantity
);

if (result.success) {
  const price = result.data;

  console.log(`Prodotto: ${price.productName}`);
  console.log(`Listino: ${price.pricelistName}`);
  console.log(`Prezzo base: €${price.basePrice.toFixed(2)}`);

  if (price.discountPercent) {
    console.log(`Sconto: ${price.discountPercent.toFixed(1)}%`);
  }

  console.log(`Prezzo finale: €${price.finalPrice.toFixed(2)} ${price.currency}`);
  console.log(`IVA inclusa: ${price.taxIncluded ? 'Sì' : 'No'}`);
}
```

**Esempio - Prezzo B2B con cliente specifico:**
```typescript
// Il listino del cliente verrà utilizzato automaticamente
const result = await agent.getPrice(
  1234,       // productId
  'B2B',      // customerType
  50,         // quantity
  456         // partnerId (opzionale)
);

// Odoo applicherà automaticamente:
// 1. Il listino del cliente (property_product_pricelist)
// 2. Le regole di sconto per quantità
// 3. Gli sconti specifici del listino
```

**Esempio - Calcolo prezzo per quantità diverse:**
```typescript
// Verifica sconti quantità
const quantities = [1, 10, 50, 100];

for (const qty of quantities) {
  const result = await agent.getPrice(1234, 'B2B', qty);

  if (result.success) {
    console.log(`Quantità ${qty}: €${result.data.finalPrice.toFixed(2)}`);
  }
}
```

### 5. Fornitori Prodotto - `getProductSuppliers()`

Recupera la lista dei fornitori con prezzi di acquisto.

```typescript
const result = await agent.getProductSuppliers(1234);

if (result.success) {
  console.log(`Trovati ${result.data.length} fornitori:`);

  result.data.forEach(supplier => {
    console.log(`\nFornitore: ${supplier.partner_id[1]}`);
    console.log(`  Nome prodotto: ${supplier.product_name || 'N/A'}`);
    console.log(`  Codice: ${supplier.product_code || 'N/A'}`);
    console.log(`  Prezzo: ${supplier.price} ${supplier.currency_id[1]}`);
    console.log(`  Quantità minima: ${supplier.min_qty}`);
    console.log(`  Tempo consegna: ${supplier.delay} giorni`);
  });
}
```

### 6. Prodotti Simili - `getSimilarProducts()`

Suggerisce prodotti simili basandosi su categoria, prezzo e nome.

```typescript
const result = await agent.getSimilarProducts(1234, 10);

if (result.success) {
  console.log(`Trovati ${result.data.length} prodotti simili:`);

  result.data.forEach(similar => {
    const product = similar.product;

    console.log(`\n${product.name}`);
    console.log(`  Similarità: ${similar.similarityScore}%`);
    console.log(`  Motivo: ${similar.reason}`);
    console.log(`  Prezzo: €${product.list_price.toFixed(2)}`);
  });
}
```

### 7. Categorie - `getCategories()`

Recupera le categorie prodotti disponibili.

```typescript
// Tutte le categorie
const result = await agent.getCategories();

// Categorie figlie di una categoria specifica
const childrenResult = await agent.getCategories(15);

if (result.success) {
  result.data.forEach(category => {
    console.log(`${category.complete_name} (${category.product_count} prodotti)`);
  });
}
```

### 8. Promozioni - `getPromotions()`

Recupera le promozioni attive.

```typescript
// Tutte le promozioni attive
const result = await agent.getPromotions();

// Promozioni per prodotto specifico
const productPromotions = await agent.getPromotions(1234);

// Promozioni per categoria
const categoryPromotions = await agent.getPromotions(undefined, 15);

if (result.success) {
  result.data.forEach(promo => {
    console.log(`${promo.name}`);
    console.log(`  Sconto: ${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : '€'}`);
    console.log(`  Valido: ${promo.start_date} - ${promo.end_date}`);
  });
}
```

## Funzionalità Multilingua

L'agente supporta 4 lingue: Italiano, Inglese, Francese, Tedesco.

```typescript
const agent = new ProductsAgent('it');  // Italiano
agent.setLanguage('en');  // Cambia in Inglese

const result = await agent.searchProducts({ query: 'test' });
console.log(result.message);  // Messaggio in inglese
```

## Gestione Errori

Tutti i metodi restituiscono un oggetto `AgentResponse` con struttura uniforme:

```typescript
interface AgentResponse<T> {
  success: boolean;
  data?: T;
  message: string;
  error?: string;
  timestamp: Date;
  language: 'it' | 'en' | 'fr' | 'de';
}
```

**Esempio gestione errori:**
```typescript
const result = await agent.getProductDetails(9999999);

if (!result.success) {
  console.error(`Errore: ${result.message}`);
  if (result.error) {
    console.error(`Dettagli: ${result.error}`);
  }
}
```

## Test Connessione

Verifica che la connessione a Odoo funzioni correttamente:

```typescript
const isConnected = await agent.testConnection();

if (isConnected) {
  console.log('Connessione a Odoo OK');
} else {
  console.error('Impossibile connettersi a Odoo');
}
```

## Integrazione con Odoo

L'agente utilizza `createOdooRPCClient()` per comunicare con Odoo tramite XML-RPC.

### Modelli Odoo utilizzati:
- `product.product` - Prodotti (varianti)
- `product.template` - Template prodotti
- `product.category` - Categorie
- `product.pricelist` - Listini prezzi
- `product.pricelist.item` - Regole listini
- `product.supplierinfo` - Info fornitori
- `stock.quant` - Stock per ubicazione
- `res.partner` - Clienti/Fornitori
- `loyalty.program` / `sale.coupon.program` - Promozioni

### Campi principali:
```typescript
// product.product
{
  id: number;
  name: string;
  default_code: string;      // Codice interno/SKU
  barcode: string;
  list_price: number;        // Prezzo vendita
  standard_price: number;    // Costo
  categ_id: [number, string];
  type: 'product' | 'consu' | 'service';
  qty_available: number;
  virtual_available: number;
  image_1920: string;        // Base64
}
```

## Best Practices

1. **Usa il singleton per istanze singole:**
   ```typescript
   import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';
   ```

2. **Verifica sempre `result.success`:**
   ```typescript
   if (result.success && result.data) {
     // Usa i dati
   }
   ```

3. **Gestisci gli errori di connessione:**
   ```typescript
   try {
     const result = await agent.searchProducts({ query: 'test' });
   } catch (error) {
     console.error('Errore di rete:', error);
   }
   ```

4. **Limita i risultati per performance:**
   ```typescript
   // Evita
   await agent.searchProducts({ query: 'a' }, 1000);

   // Preferisci
   await agent.searchProducts({ query: 'a' }, 50);
   ```

5. **Usa filtri specifici quando possibile:**
   ```typescript
   // Evita ricerche troppo generiche
   await agent.searchProducts({ query: 'a' });

   // Preferisci ricerche mirate
   await agent.searchProducts({
     query: 'mozzarella',
     category_id: 15,
     available_only: true
   });
   ```

## Esempi Pratici Completi

### Scenario 1: Ricerca e visualizzazione prodotti

```typescript
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

async function searchAndDisplay(searchQuery: string) {
  // Cerca prodotti
  const searchResult = await productsAgent.searchProducts({
    query: searchQuery,
    available_only: true,
    active_only: true
  }, 20);

  if (!searchResult.success) {
    console.error('Errore ricerca:', searchResult.error);
    return;
  }

  // Per ogni prodotto, recupera disponibilità e prezzo
  for (const product of searchResult.data) {
    console.log(`\n=== ${product.name} ===`);
    console.log(`Codice: ${product.default_code || 'N/A'}`);

    // Disponibilità
    const availability = await productsAgent.checkAvailability(product.id);
    if (availability.success) {
      console.log(`Stock: ${availability.data.qty_available} unità`);
    }

    // Prezzo B2C
    const price = await productsAgent.getPrice(product.id, 'B2C', 1);
    if (price.success) {
      console.log(`Prezzo: €${price.data.finalPrice.toFixed(2)}`);
    }
  }
}

// Usa la funzione
await searchAndDisplay('mozzarella');
```

### Scenario 2: Comparazione prezzi B2B vs B2C

```typescript
async function comparePrices(productId: number, quantity: number = 1) {
  const b2cResult = await productsAgent.getPrice(productId, 'B2C', quantity);
  const b2bResult = await productsAgent.getPrice(productId, 'B2B', quantity);

  if (b2cResult.success && b2bResult.success) {
    console.log(`\n${b2cResult.data.productName}`);
    console.log(`Quantità: ${quantity}`);
    console.log(`\nB2C (${b2cResult.data.pricelistName}):`);
    console.log(`  €${b2cResult.data.finalPrice.toFixed(2)} (IVA inclusa)`);
    console.log(`\nB2B (${b2bResult.data.pricelistName}):`);
    console.log(`  €${b2bResult.data.finalPrice.toFixed(2)} (IVA esclusa)`);

    const savings = b2cResult.data.finalPrice - b2bResult.data.finalPrice;
    console.log(`\nRisparmio B2B: €${savings.toFixed(2)}`);
  }
}

await comparePrices(1234, 50);
```

### Scenario 3: Suggerimenti intelligenti

```typescript
async function suggestAlternatives(productId: number) {
  // Recupera prodotto originale
  const productResult = await productsAgent.getProductDetails(productId);

  if (!productResult.success) {
    console.error('Prodotto non trovato');
    return;
  }

  console.log(`Prodotto originale: ${productResult.data.name}`);
  console.log(`Prezzo: €${productResult.data.list_price.toFixed(2)}`);

  // Verifica disponibilità
  const availability = await productsAgent.checkAvailability(productId);

  if (availability.success && availability.data.qty_available <= 0) {
    console.log('\n⚠️ Prodotto non disponibile\n');

    // Cerca alternative
    const similars = await productsAgent.getSimilarProducts(productId, 5);

    if (similars.success && similars.data.length > 0) {
      console.log('Alternative disponibili:');

      for (const similar of similars.data) {
        const altAvailability = await productsAgent.checkAvailability(similar.product.id);

        if (altAvailability.success && altAvailability.data.qty_available > 0) {
          console.log(`\n  ✓ ${similar.product.name}`);
          console.log(`    Prezzo: €${similar.product.list_price.toFixed(2)}`);
          console.log(`    Stock: ${altAvailability.data.qty_available} unità`);
          console.log(`    Similarità: ${similar.similarityScore}%`);
        }
      }
    }
  } else {
    console.log(`\n✓ Disponibile: ${availability.data.qty_available} unità`);
  }
}

await suggestAlternatives(1234);
```

## Note Tecniche

- Tutti i metodi sono asincroni e restituiscono Promise
- L'agente gestisce automaticamente la sessione Odoo tramite `createOdooRPCClient()`
- I messaggi sono tradotti automaticamente in base alla lingua impostata
- Le query sono ottimizzate per performance con limite di risultati
- Il calcolo prezzi rispetta le regole di listino configurate in Odoo

## Supporto

Per problemi o domande sull'uso dell'agente:
1. Verifica la connessione a Odoo con `testConnection()`
2. Controlla i log della console per dettagli errori
3. Verifica che i dati richiesti esistano in Odoo
