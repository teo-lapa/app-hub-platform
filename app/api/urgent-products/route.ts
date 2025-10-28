import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type {
  UrgentProduct,
  AddUrgentProductRequest,
  AddUrgentProductResponse,
  GetUrgentProductsResponse,
  RemoveUrgentProductResponse
} from '@/lib/types/expiry';

const URGENT_PRODUCTS_KEY = 'urgent_products';

/**
 * GET /api/urgent-products
 * Recupera tutti i prodotti urgenti da vendere
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/urgent-products - Recupero prodotti urgenti...');

    // Recupera tutti i prodotti urgenti da Vercel KV
    const urgentProducts = await kv.hgetall<Record<string, UrgentProduct>>(URGENT_PRODUCTS_KEY);

    if (!urgentProducts) {
      return NextResponse.json<GetUrgentProductsResponse>({
        success: true,
        products: [],
        count: 0
      });
    }

    // Converte oggetto in array e ordina per urgenza (scaduti prima, poi in scadenza)
    const productsArray = Object.values(urgentProducts).sort((a, b) => {
      // Prima i scaduti
      if (a.urgencyLevel === 'expired' && b.urgencyLevel !== 'expired') return -1;
      if (a.urgencyLevel !== 'expired' && b.urgencyLevel === 'expired') return 1;
      // Poi per giorni alla scadenza (meno giorni = più urgente)
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });

    console.log(`✅ Trovati ${productsArray.length} prodotti urgenti`);

    return NextResponse.json<GetUrgentProductsResponse>({
      success: true,
      products: productsArray,
      count: productsArray.length
    });

  } catch (error: any) {
    console.error('❌ Errore GET /api/urgent-products:', error);
    return NextResponse.json<GetUrgentProductsResponse>(
      {
        success: false,
        products: [],
        count: 0,
        error: error.message || 'Errore recupero prodotti urgenti'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/urgent-products
 * Aggiunge un prodotto alla lista urgenti
 */
export async function POST(request: NextRequest) {
  try {
    const body: AddUrgentProductRequest = await request.json();

    console.log('➕ POST /api/urgent-products - Aggiunta prodotto urgente:', {
      productName: body.productName,
      lotName: body.lotName,
      daysUntilExpiry: body.daysUntilExpiry,
      note: body.note
    });

    // Validazione
    if (!body.productId || !body.lotId || !body.productName || !body.note || !body.addedBy) {
      return NextResponse.json<AddUrgentProductResponse>(
        {
          success: false,
          error: 'Campi obbligatori mancanti: productId, lotId, productName, note, addedBy'
        },
        { status: 400 }
      );
    }

    // Crea ID univoco: productId:lotId:timestamp
    const id = `${body.productId}:${body.lotId}:${Date.now()}`;
    const addedAt = new Date().toISOString();

    const urgentProduct: UrgentProduct = {
      id,
      ...body,
      addedAt
    };

    // Salva in Vercel KV usando HSET (hash set)
    await kv.hset(URGENT_PRODUCTS_KEY, {
      [id]: urgentProduct
    });

    console.log(`✅ Prodotto urgente aggiunto con ID: ${id}`);

    return NextResponse.json<AddUrgentProductResponse>({
      success: true,
      urgentProduct
    });

  } catch (error: any) {
    console.error('❌ Errore POST /api/urgent-products:', error);
    return NextResponse.json<AddUrgentProductResponse>(
      {
        success: false,
        error: error.message || 'Errore aggiunta prodotto urgente'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/urgent-products
 * Rimuove un prodotto dalla lista urgenti
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<RemoveUrgentProductResponse>(
        {
          success: false,
          error: 'ID prodotto urgente mancante'
        },
        { status: 400 }
      );
    }

    console.log(`🗑️ DELETE /api/urgent-products - Rimozione prodotto: ${id}`);

    // Rimuove da Vercel KV
    await kv.hdel(URGENT_PRODUCTS_KEY, id);

    console.log(`✅ Prodotto urgente rimosso: ${id}`);

    return NextResponse.json<RemoveUrgentProductResponse>({
      success: true
    });

  } catch (error: any) {
    console.error('❌ Errore DELETE /api/urgent-products:', error);
    return NextResponse.json<RemoveUrgentProductResponse>(
      {
        success: false,
        error: error.message || 'Errore rimozione prodotto urgente'
      },
      { status: 500 }
    );
  }
}
