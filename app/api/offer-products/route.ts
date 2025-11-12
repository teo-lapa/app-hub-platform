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
 * Calcola quantità totale e prenotata per un prodotto con lotto/ubicazione specifici
 * Legge da stock.quant di Odoo e restituisce total, reserved e available
 */
async function calculateStockQuantities(
  cookies: string,
  productId: number,
  lotId?: number,
  locationId?: number
): Promise<{ total: number; reserved: number; available: number }> {
  try {
    if (!lotId && !locationId) {
      // Se non c'è lotto/ubicazione specifica, non possiamo calcolare
      return { total: 0, reserved: 0, available: 0 };
    }

    // Costruisci domain per cercare il quant specifico
    const domain: any[] = [
      ['product_id', '=', productId],
    ];

    if (lotId) {
      domain.push(['lot_id', '=', lotId]);
    }

    if (locationId) {
      domain.push(['location_id', '=', locationId]);
    }

    // Cerca stock.quant che ha il campo reserved_quantity
    const quants = await callOdoo(
      cookies,
      'stock.quant',
      'search_read',
      [],
      {
        domain: domain,
        fields: ['id', 'product_id', 'lot_id', 'location_id', 'quantity', 'reserved_quantity']
      }
    );

    if (!quants || quants.length === 0) {
      console.log(`📦 No quants found for product ${productId}, lot ${lotId}, location ${locationId}`);
      return { total: 0, reserved: 0, available: 0 };
    }

    // Somma tutte le quantità prenotate
    let totalReserved = 0;
    for (const quant of quants) {
      const reserved = quant.reserved_quantity || 0;
      totalReserved += reserved;
      console.log(`📦 Quant ${quant.id}: ${reserved} reserved (${quant.quantity} total)`);
    }

    // Calcola quantità totale
    let totalQty = 0;
    for (const quant of quants) {
      totalQty += quant.quantity || 0;
    }

    const available = totalQty - totalReserved;
    console.log(`📊 Product ${productId}: ${totalQty} total, ${totalReserved} reserved, ${available} available`);
    return { total: totalQty, reserved: totalReserved, available };
  } catch (error) {
    console.error('❌ Error calculating reserved quantity:', error);
    return { total: 0, reserved: 0, available: 0 }; // In caso di errore
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
        const stockQty = await calculateStockQuantities(
          cookies,
          product.productId,
          product.lotId,
          product.locationId
        );

        // Aggiungi le quantità al prodotto
        (product as any).reservedQuantity = stockQty.reserved;
        (product as any).availableQuantity = stockQty.available;
        (product as any).totalQuantity = stockQty.total;

        console.log(`📊 Prodotto ${product.productName}: ${stockQty.total} totali da Odoo, ${stockQty.reserved} prenotati, ${stockQty.available} disponibili`);
      }
    }


    // Filtra prodotti con giacenza disponibile <= 0 (venduti/esauriti)
    const availableProducts = productsArray.filter(product => {
      const availableQty = (product as any).availableQuantity;
      // Se availableQuantity non è calcolato, usa quantity originale
      const qty = availableQty !== undefined ? availableQty : product.quantity;

      if (qty <= 0) {
        console.log(`⚠️ Prodotto ${product.productName} escluso (giacenza: ${qty})`);
        return false;
      }
      return true;
    });

    console.log(`✅ Trovati ${availableProducts.length} prodotti in offerta disponibili (${productsArray.length - availableProducts.length} esclusi per giacenza zero)`);

    return NextResponse.json<GetOfferProductsResponse>({
      success: true,
      products: availableProducts,
      count: availableProducts.length
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
