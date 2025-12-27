# Products Agent - Esempi di Utilizzo nelle API Routes

Questa guida mostra come integrare il `ProductsAgent` nelle tue API routes di Next.js.

## Esempio 1: API per ricerca prodotti

```typescript
// app/api/products/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function POST(request: NextRequest) {
  try {
    const { query, category_id, min_price, max_price, available_only, limit } = await request.json();

    // Valida input
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query troppo corta (minimo 2 caratteri)' },
        { status: 400 }
      );
    }

    // Cerca prodotti usando l'agente
    const result = await productsAgent.searchProducts(
      {
        query: query.trim(),
        category_id,
        min_price,
        max_price,
        available_only: available_only ?? true,
        active_only: true
      },
      limit || 50
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Errore durante la ricerca' },
        { status: 500 }
      );
    }

    // Arricchisci i dati con disponibilità e prezzo (opzionale)
    const enrichedProducts = await Promise.all(
      result.data.map(async (product) => {
        // Recupera disponibilità in parallelo
        const [availability, price] = await Promise.all([
          productsAgent.checkAvailability(product.id),
          productsAgent.getPrice(product.id, 'B2C', 1)
        ]);

        return {
          ...product,
          availability: availability.success ? availability.data : null,
          price: price.success ? price.data : null
        };
      })
    );

    return NextResponse.json({
      success: true,
      products: enrichedProducts,
      total: enrichedProducts.length,
      query: query.trim()
    });

  } catch (error: any) {
    console.error('Errore API search prodotti:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Esempio 2: API per dettagli prodotto completi

```typescript
// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'ID prodotto non valido' },
        { status: 400 }
      );
    }

    // Recupera tutti i dati in parallelo
    const [details, availability, suppliers, similar, b2cPrice, b2bPrice] = await Promise.all([
      productsAgent.getProductDetails(productId),
      productsAgent.checkAvailability(productId),
      productsAgent.getProductSuppliers(productId),
      productsAgent.getSimilarProducts(productId, 5),
      productsAgent.getPrice(productId, 'B2C', 1),
      productsAgent.getPrice(productId, 'B2B', 1)
    ]);

    if (!details.success) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    // Assembla risposta completa
    return NextResponse.json({
      success: true,
      product: {
        ...details.data,
        availability: availability.success ? availability.data : null,
        suppliers: suppliers.success ? suppliers.data : [],
        similar: similar.success ? similar.data : [],
        prices: {
          b2c: b2cPrice.success ? b2cPrice.data : null,
          b2b: b2bPrice.success ? b2bPrice.data : null
        }
      }
    });

  } catch (error: any) {
    console.error('Errore API dettagli prodotto:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Esempio 3: API per calcolo prezzo dinamico

```typescript
// app/api/products/price/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function POST(request: NextRequest) {
  try {
    const { product_id, customer_type, quantity, partner_id } = await request.json();

    // Validazione
    if (!product_id || !customer_type) {
      return NextResponse.json(
        { success: false, error: 'Parametri mancanti (product_id, customer_type richiesti)' },
        { status: 400 }
      );
    }

    if (!['B2B', 'B2C'].includes(customer_type)) {
      return NextResponse.json(
        { success: false, error: 'customer_type deve essere B2B o B2C' },
        { status: 400 }
      );
    }

    // Calcola prezzo
    const result = await productsAgent.getPrice(
      product_id,
      customer_type,
      quantity || 1,
      partner_id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Impossibile calcolare il prezzo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      price: result.data
    });

  } catch (error: any) {
    console.error('Errore API calcolo prezzo:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Esempio 4: API per disponibilità prodotto

```typescript
// app/api/products/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function POST(request: NextRequest) {
  try {
    const { product_ids } = await request.json();

    // Validazione
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'product_ids deve essere un array non vuoto' },
        { status: 400 }
      );
    }

    // Limita a 100 prodotti per volta
    if (product_ids.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Massimo 100 prodotti per richiesta' },
        { status: 400 }
      );
    }

    // Controlla disponibilità in parallelo
    const availabilities = await Promise.all(
      product_ids.map(async (id) => {
        const result = await productsAgent.checkAvailability(id);
        return {
          product_id: id,
          success: result.success,
          data: result.success ? result.data : null,
          error: result.error
        };
      })
    );

    return NextResponse.json({
      success: true,
      availabilities
    });

  } catch (error: any) {
    console.error('Errore API disponibilità:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Esempio 5: API per suggerimenti intelligenti

```typescript
// app/api/products/suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function POST(request: NextRequest) {
  try {
    const { product_id } = await request.json();

    if (!product_id) {
      return NextResponse.json(
        { success: false, error: 'product_id richiesto' },
        { status: 400 }
      );
    }

    // Recupera prodotto originale e simili
    const [product, similar] = await Promise.all([
      productsAgent.getProductDetails(product_id),
      productsAgent.getSimilarProducts(product_id, 10)
    ]);

    if (!product.success) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    // Arricchisci suggerimenti con disponibilità
    const enrichedSimilar = similar.success
      ? await Promise.all(
          similar.data.map(async (item) => {
            const availability = await productsAgent.checkAvailability(item.product.id);
            return {
              ...item,
              available: availability.success ? availability.data.qty_available > 0 : false,
              stock: availability.success ? availability.data.qty_available : 0
            };
          })
        )
      : [];

    // Ordina per disponibilità e similarità
    const sortedSuggestions = enrichedSimilar
      .filter(s => s.available)  // Solo prodotti disponibili
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return NextResponse.json({
      success: true,
      original_product: product.data,
      suggestions: sortedSuggestions.slice(0, 5),  // Top 5
      total_available: sortedSuggestions.length
    });

  } catch (error: any) {
    console.error('Errore API suggerimenti:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Esempio 6: Server Action per React Server Components

```typescript
// app/actions/products.ts
'use server';

import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function searchProducts(query: string, limit: number = 20) {
  'use server';

  const result = await productsAgent.searchProducts(
    {
      query,
      active_only: true,
      available_only: true
    },
    limit
  );

  return result;
}

export async function getProductWithDetails(productId: number) {
  'use server';

  const [details, availability, price] = await Promise.all([
    productsAgent.getProductDetails(productId),
    productsAgent.checkAvailability(productId),
    productsAgent.getPrice(productId, 'B2C', 1)
  ]);

  if (!details.success) {
    throw new Error('Prodotto non trovato');
  }

  return {
    product: details.data,
    availability: availability.data,
    price: price.data
  };
}

export async function comparePrices(productId: number, quantity: number = 1) {
  'use server';

  const [b2c, b2b] = await Promise.all([
    productsAgent.getPrice(productId, 'B2C', quantity),
    productsAgent.getPrice(productId, 'B2B', quantity)
  ]);

  return {
    b2c: b2c.data,
    b2b: b2b.data,
    savings: b2c.data && b2b.data ? b2c.data.finalPrice - b2b.data.finalPrice : 0
  };
}
```

## Esempio 7: Uso in componente React

```typescript
// app/products/ProductCard.tsx
'use client';

import { useState, useEffect } from 'react';
import { getProductWithDetails } from '@/app/actions/products';

export function ProductCard({ productId }: { productId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProductWithDetails(productId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <div>Caricamento...</div>;
  if (!data) return <div>Prodotto non trovato</div>;

  const { product, availability, price } = data;

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-xl font-bold">{product.name}</h2>
      <p className="text-gray-600">{product.default_code}</p>

      <div className="mt-4">
        <p className="font-semibold">
          {price?.finalPrice.toFixed(2)} {price?.currency}
        </p>

        {availability && (
          <p className="text-sm">
            {availability.qty_available > 0
              ? `${availability.qty_available} disponibili`
              : 'Non disponibile'
            }
          </p>
        )}
      </div>
    </div>
  );
}
```

## Esempio 8: Webhook per aggiornamento stock

```typescript
// app/api/webhooks/stock-update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { productsAgent } from '@/lib/lapa-agents/agents/products-agent';

export async function POST(request: NextRequest) {
  try {
    // Verifica webhook signature (esempio)
    const signature = request.headers.get('x-webhook-signature');
    if (!signature || !verifyWebhookSignature(signature)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { product_id, action } = await request.json();

    // Recupera stato attuale
    const availability = await productsAgent.checkAvailability(product_id);

    if (!availability.success) {
      return NextResponse.json(
        { error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    const stock = availability.data;

    // Logica di notifica basata sullo stock
    if (stock.qty_available <= 0) {
      console.log(`⚠️ ATTENZIONE: Prodotto ${product_id} esaurito!`);
      // Invia notifica, email, ecc.
    } else if (stock.qty_available < 10) {
      console.log(`⚠️ Stock basso: Prodotto ${product_id} - ${stock.qty_available} unità`);
      // Invia alert
    }

    return NextResponse.json({
      success: true,
      product_id,
      stock: stock.qty_available,
      status: stock.qty_available > 0 ? 'available' : 'out_of_stock'
    });

  } catch (error: any) {
    console.error('Errore webhook:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(signature: string): boolean {
  // Implementa verifica firma webhook
  return true;
}
```

## Best Practices per le API

1. **Sempre validare l'input:**
   ```typescript
   if (!product_id || isNaN(parseInt(product_id))) {
     return NextResponse.json({ error: 'Invalid product_id' }, { status: 400 });
   }
   ```

2. **Gestire gli errori in modo appropriato:**
   ```typescript
   if (!result.success) {
     return NextResponse.json(
       { success: false, error: result.error },
       { status: result.error === 'Not found' ? 404 : 500 }
     );
   }
   ```

3. **Usare Promise.all per richieste parallele:**
   ```typescript
   // ✅ Buono - parallelo
   const [details, availability] = await Promise.all([
     productsAgent.getProductDetails(id),
     productsAgent.checkAvailability(id)
   ]);

   // ❌ Evitare - sequenziale
   const details = await productsAgent.getProductDetails(id);
   const availability = await productsAgent.checkAvailability(id);
   ```

4. **Limitare il numero di risultati:**
   ```typescript
   const limit = Math.min(request.limit || 50, 100); // Max 100
   ```

5. **Cache quando possibile:**
   ```typescript
   import { unstable_cache } from 'next/cache';

   const getCachedProduct = unstable_cache(
     async (id: number) => {
       return productsAgent.getProductDetails(id);
     },
     ['product-details'],
     { revalidate: 3600 } // 1 ora
   );
   ```

6. **Logging appropriato:**
   ```typescript
   console.log(`API /products/search - Query: "${query}", Results: ${results.length}`);
   ```

7. **Rate limiting (opzionale):**
   ```typescript
   import rateLimit from 'express-rate-limit';

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minuti
     max: 100 // massimo 100 richieste per IP
   });
   ```

## Conclusione

L'agente Products fornisce un'interfaccia semplice e potente per lavorare con i dati Odoo. Usa questi esempi come punto di partenza per creare le tue API personalizzate.
