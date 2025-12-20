# Products Agent - Quick Start Guide

Guida rapida per iniziare ad usare il Products Agent in 5 minuti.

## 1. Installazione

Il Products Agent è già incluso nel progetto. Non serve installare nulla.

```typescript
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';
```

## 2. Primo Utilizzo

### Ricerca Prodotti

```typescript
// Ricerca semplice
const result = await productsAgent.searchProducts({
  query: 'vino rosso',
  active_only: true,
}, 10);

if (result.success) {
  console.log(`Trovati ${result.data.length} prodotti`);
  result.data.forEach(p => console.log(p.name, p.list_price));
}
```

### Dettagli Prodotto

```typescript
const product = await productsAgent.getProductDetails(123);
console.log(product.data.name);
```

### Verifica Disponibilità

```typescript
const stock = await productsAgent.checkAvailability(123);
console.log(`Disponibili: ${stock.data.qty_available} pz`);
```

### Calcolo Prezzo

```typescript
// B2C (cliente retail)
const priceB2C = await productsAgent.getPrice(123, 'B2C', 1);

// B2B (cliente business)
const priceB2B = await productsAgent.getPrice(123, 'B2B', 10);

console.log(`B2C: ${priceB2C.data.finalPrice}€`);
console.log(`B2B: ${priceB2B.data.finalPrice}€`);
```

## 3. Integrazione in API Route

```typescript
// app/api/products/search/route.ts
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  const result = await productsAgent.searchProducts({
    query,
    active_only: true,
  });

  return Response.json(result);
}
```

## 4. Integrazione in Component React

```typescript
// app/products/page.tsx
'use client';

import { useState } from 'react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchProducts = async (query: string) => {
    setLoading(true);

    const res = await fetch(`/api/products/search?q=${query}`);
    const result = await res.json();

    if (result.success) {
      setProducts(result.data);
    }

    setLoading(false);
  };

  return (
    <div>
      <input
        type="text"
        onChange={(e) => searchProducts(e.target.value)}
        placeholder="Cerca prodotti..."
      />

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              {p.name} - {p.list_price}€
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

## 5. Workflow E-commerce Completo

```typescript
async function handleProductPage(productId: number) {
  // 1. Carica dettagli prodotto
  const product = await productsAgent.getProductDetails(productId);

  // 2. Verifica disponibilità
  const stock = await productsAgent.checkAvailability(productId);

  // 3. Calcola prezzo per cliente
  const price = await productsAgent.getPrice(productId, 'B2C', 1);

  // 4. Carica prodotti simili per "Potrebbe interessarti"
  const similar = await productsAgent.getSimilarProducts(productId, 4);

  // 5. Verifica se ci sono promozioni
  const promos = await productsAgent.getPromotions(productId);

  return {
    product: product.data,
    inStock: stock.data.qty_available > 0,
    price: price.data.finalPrice,
    discount: promos.data[0]?.discount_value,
    recommendations: similar.data.map(s => s.product),
  };
}
```

## 6. Test Rapido

```bash
# Test connessione e funzionalità base
npx ts-node lib/lapa-agents/agents/products-agent.test.ts

# Test filtri avanzati
npx ts-node lib/lapa-agents/agents/products-agent.test.ts --filters

# Test confronto prezzi
npx ts-node lib/lapa-agents/agents/products-agent.test.ts --prices

# Tutti i test
npx ts-node lib/lapa-agents/agents/products-agent.test.ts --all
```

## 7. Esempi Pratici

Vedi file completo con 8 esempi:

```bash
npx ts-node lib/lapa-agents/agents/products-agent.example.ts
```

## 8. Troubleshooting

### Errore connessione Odoo

```typescript
// Verifica connessione
const isConnected = await productsAgent.testConnection();
if (!isConnected) {
  console.error('Odoo non raggiungibile!');
}
```

Verifica:
- File `.env` contiene `ODOO_URL`, `ODOO_USERNAME`, `ODOO_PASSWORD`
- L'URL Odoo è corretto e raggiungibile
- Le credenziali sono valide

### Prodotti non trovati

```typescript
// Prova ricerca generica
const all = await productsAgent.searchProducts({}, 10);
console.log(`Totale prodotti: ${all.data?.length}`);
```

Se ritorna 0 prodotti:
- Verifica che ci siano prodotti attivi in Odoo
- Verifica permessi utente Odoo
- Prova con `active_only: false`

## 9. Best Practices

### Caching

```typescript
// Cache prezzi per evitare chiamate ripetute
const priceCache = new Map();

async function getCachedPrice(productId: number) {
  if (!priceCache.has(productId)) {
    const result = await productsAgent.getPrice(productId, 'B2C', 1);
    priceCache.set(productId, result.data);
  }
  return priceCache.get(productId);
}
```

### Error Handling

```typescript
try {
  const result = await productsAgent.searchProducts({ query: 'test' });

  if (result.success) {
    // OK
    console.log(result.data);
  } else {
    // Errore gestito
    console.warn(result.message);
  }
} catch (error) {
  // Errore non gestito (connessione, etc)
  console.error('Errore critico:', error);
}
```

### Limita Risultati

```typescript
// ✅ BUONO - limita in query
await productsAgent.searchProducts({ query: 'vino' }, 20);

// ❌ LENTO - carica tutto poi filtra
const all = await productsAgent.searchProducts({ query: 'vino' }, 999);
const limited = all.data.slice(0, 20);
```

## 10. Links Utili

- **Documentazione completa**: `README.md`
- **Esempi**: `products-agent.example.ts`
- **Test**: `products-agent.test.ts`
- **Tipi TypeScript**: `products-agent.types.ts`

## Supporto

Per domande o problemi: paul@lapa.ch
