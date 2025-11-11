import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type {
  OfferProduct,
  AddOfferProductRequest,
  AddOfferProductResponse,
  GetOfferProductsResponse,
  RemoveOfferProductResponse
} from '@/lib/types/expiry';

const OFFER_PRODUCTS_KEY = 'offer_products';

/**
 * GET /api/offer-products
 * Recupera tutti i prodotti in offerta
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/offer-products - Recupero prodotti in offerta...');

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
