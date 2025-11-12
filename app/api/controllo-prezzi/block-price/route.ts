import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { PriceReviewService } from '@/lib/services/price-review-service';

/**
 * POST /api/controllo-prezzi/block-price
 *
 * Blocca un prezzo (crea prezzo fisso nel listino cliente)
 * Body: { productId, orderId, currentPrice, blockedBy, note? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, orderId, currentPrice, blockedBy, note } = body;

    // Validation
    if (!productId || !orderId || currentPrice === undefined || !blockedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId, currentPrice, blockedBy sono obbligatori'
        },
        { status: 400 }
      );
    }

    // Get Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida' },
        { status: 401 }
      );
    }

    console.log(`🔒 [BLOCK-PRICE-API] Product ${productId} in order ${orderId} at price ${currentPrice} by ${blockedBy}`);

    // Get order line ID and pricelist ID
    const service = new PriceReviewService();

    const lineId = await service.getOrderLineId(cookies, productId, orderId);
    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Riga ordine non trovata' },
        { status: 404 }
      );
    }

    const pricelistId = await service.getPricelistId(cookies, orderId);
    if (!pricelistId) {
      return NextResponse.json(
        { success: false, error: 'Listino non trovato per questo ordine' },
        { status: 404 }
      );
    }

    // Block price (mark as blocked + create pricelist item)
    await service.blockPrice(
      cookies,
      productId,
      orderId,
      lineId,
      pricelistId,
      currentPrice,
      blockedBy,
      note
    );

    console.log(`✅ [BLOCK-PRICE-API] Successfully blocked price`);

    return NextResponse.json({
      success: true,
      message: 'Prezzo bloccato con successo',
      pricelistItemCreated: true
    });

  } catch (error: any) {
    console.error('❌ [BLOCK-PRICE-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il blocco'
      },
      { status: 500 }
    );
  }
}
