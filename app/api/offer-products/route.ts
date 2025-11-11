import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import type {
  OfferProduct,
  AddOfferProductRequest,
  AddOfferProductResponse,
  GetOfferProductsResponse,
  RemoveOfferProductResponse
} from '@/lib/types/expiry';

const OFFER_PRODUCTS_KEY = 'offer_products';

/**
 * Calcola la quantità prenotata in ordini draft/sent per un prodotto specifico
 * con lotto e ubicazione specifici
 */
async function calculateReservedQuantity(
  cookies: string,
  productId: number,
  lotId?: number,
  locationId?: number
): Promise<number> {
  try {
    if (!lotId && !locationId) {
      // Se non c'è lotto/ubicazione specifica, non calcoliamo prenotazioni
      return 0;
    }

    // Cerca ordini in stato draft/sent che contengono questo prodotto
    const orderLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [
          ['product_id', '=', productId],
          ['state', 'in', ['draft', 'sale']], // draft o confermato ma non ancora consegnato
        ],
        fields: ['id', 'product_uom_qty', 'name', 'order_id']
      }
    );

    if (!orderLines || orderLines.length === 0) {
      return 0;
    }

    // Filtra le righe che hanno il lotto/ubicazione nelle note
    let reservedQty = 0;
    for (const line of orderLines) {
      const lineName = line.name || '';

      // Cerca il lotId o locationId nelle note del prodotto
      let isMatch = false;

      if (lotId && lineName.includes(`Lotto: ${lotId}`)) {
        isMatch = true;
      }

      if (locationId && lineName.includes(`Ubicazione:`)) {
        // Può contenere ID o nome, per ora matchiamo genericamente
        isMatch = true;
      }

      if (isMatch) {
        reservedQty += line.product_uom_qty || 0;
        console.log(`📦 Found reserved qty: ${line.product_uom_qty} in order line ${line.id}`);
      }
    }

    return reservedQty;
  } catch (error) {
    console.error('❌ Error calculating reserved quantity:', error);
    return 0; // In caso di errore, assumiamo 0 prenotato
  }
}

/**
 * GET /api/offer-products
 * Recupera tutti i prodotti in offerta con calcolo quantità prenotate
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/offer-products - Recupero prodotti in offerta...');

    // Get Odoo session per calcolare prenotazioni
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    // Recupera tutti i prodotti in offerta da Vercel KV
    const offerProducts = await kv.hgetall<Record<string, OfferProduct>>(OFFER_PRODUCTS_KEY);

    if (!offerProducts) {
      return NextResponse.json<GetOfferProductsResponse>({
        success: true,
        products: [],
        count: 0
      });
    }

    // Converte oggetto in array e ordina per data aggiunta (più recenti prima)
    const productsArray = Object.values(offerProducts).sort((a, b) => {
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    // Calcola quantità prenotate per ogni prodotto (solo se autenticato)
    if (uid && cookies) {
      console.log('🔍 Calcolo quantità prenotate per prodotti in offerta...');

      for (const product of productsArray) {
        const reservedQty = await calculateReservedQuantity(
          cookies,
          product.productId,
          product.lotId,
          product.locationId
        );

        // Aggiungi la quantità prenotata al prodotto
        (product as any).reservedQuantity = reservedQty;
        (product as any).availableQuantity = product.quantity - reservedQty;

        console.log(`📊 Prodotto ${product.productName}: ${product.quantity} totali, ${reservedQty} prenotati, ${product.quantity - reservedQty} disponibili`);
      }
    }

    console.log(`✅ Trovati ${productsArray.length} prodotti in offerta`);

    return NextResponse.json<GetOfferProductsResponse>({
      success: true,
      products: productsArray,
      count: productsArray.length
    });

  } catch (error: any) {
    console.error('❌ Errore GET /api/offer-products:', error);
    return NextResponse.json<GetOfferProductsResponse>(
      {
        success: false,
        products: [],
        count: 0,
        error: error.message || 'Errore recupero prodotti in offerta'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/offer-products
 * Aggiunge un prodotto alla lista offerte
 */
export async function POST(request: NextRequest) {
  try {
    const body: AddOfferProductRequest = await request.json();

    console.log('➕ POST /api/offer-products - Aggiunta prodotto in offerta:', {
      productName: body.productName,
      quantity: body.quantity,
      note: body.note,
      offerPrice: body.offerPrice,
      discountPercentage: body.discountPercentage
    });

    // Validazione
    if (!body.productId || !body.productName || !body.note || !body.addedBy) {
      return NextResponse.json<AddOfferProductResponse>(
        {
          success: false,
          error: 'Campi obbligatori mancanti: productId, productName, note, addedBy'
        },
        { status: 400 }
      );
    }

    // Crea ID univoco: productId:lotId:timestamp (lotId opzionale)
    const lotPart = body.lotId ? `:${body.lotId}` : '';
    const id = `${body.productId}${lotPart}:${Date.now()}`;
    const addedAt = new Date().toISOString();

    const offerProduct: OfferProduct = {
      id,
      ...body,
      addedAt
    };

    // Salva in Vercel KV usando HSET (hash set)
    await kv.hset(OFFER_PRODUCTS_KEY, {
      [id]: offerProduct
    });

    console.log(`✅ Prodotto in offerta aggiunto con ID: ${id}`);

    return NextResponse.json<AddOfferProductResponse>({
      success: true,
      offerProduct
    });

  } catch (error: any) {
    console.error('❌ Errore POST /api/offer-products:', error);
    return NextResponse.json<AddOfferProductResponse>(
      {
        success: false,
        error: error.message || 'Errore aggiunta prodotto in offerta'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/offer-products
 * Rimuove un prodotto dalla lista offerte
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<RemoveOfferProductResponse>(
        {
          success: false,
          error: 'ID prodotto offerta mancante'
        },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/offer-products - Rimozione prodotto: ${id}`);

    // Rimuove da Vercel KV
    await kv.hdel(OFFER_PRODUCTS_KEY, id);

    console.log(`✅ Prodotto offerta rimosso: ${id}`);

    return NextResponse.json<RemoveOfferProductResponse>({
      success: true
    });

  } catch (error: any) {
    console.error('❌ Errore DELETE /api/offer-products:', error);
    return NextResponse.json<RemoveOfferProductResponse>(
      {
        success: false,
        error: error.message || 'Errore rimozione prodotto offerta'
      },
      { status: 500 }
    );
  }
}
