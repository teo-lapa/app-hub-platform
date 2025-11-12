import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import type {
  UrgentProduct,
  AddUrgentProductRequest,
  AddUrgentProductResponse,
  GetUrgentProductsResponse,
  RemoveUrgentProductResponse
} from '@/lib/types/expiry';

const URGENT_PRODUCTS_KEY = 'urgent_products';

/**
 * Calcola la quantità prenotata per un prodotto specifico
 * con lotto e ubicazione specifici usando stock.quant di Odoo
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
      return 0;
    }

    // Somma tutte le quantità prenotate
    let totalReserved = 0;
    for (const quant of quants) {
      const reserved = quant.reserved_quantity || 0;
      totalReserved += reserved;
      console.log(`📦 Quant ${quant.id}: ${reserved} reserved (${quant.quantity} total)`);
    }

    console.log(`📊 Total reserved for product ${productId}: ${totalReserved}`);
    return totalReserved;
  } catch (error) {
    console.error('❌ Error calculating reserved quantity:', error);
    return 0; // In caso di errore, assumiamo 0 prenotato
  }
}

/**
 * GET /api/urgent-products
 * Recupera tutti i prodotti urgenti da vendere con calcolo quantità prenotate
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📋 GET /api/urgent-products - Recupero prodotti urgenti...');

    // Get Odoo session per calcolare prenotazioni
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

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

    // Calcola quantità prenotate per ogni prodotto (solo se autenticato)
    if (uid && cookies) {
      console.log('🔍 Calcolo quantità prenotate per prodotti urgenti...');

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

    console.log(`✅ Trovati ${availableProducts.length} prodotti urgenti disponibili (${productsArray.length - availableProducts.length} esclusi per giacenza zero)`);

    return NextResponse.json<GetUrgentProductsResponse>({
      success: true,
      products: availableProducts,
      count: availableProducts.length
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
