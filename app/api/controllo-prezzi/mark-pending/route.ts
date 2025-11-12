import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { PriceReviewService } from '@/lib/services/price-review-service';

/**
 * POST /api/controllo-prezzi/mark-pending
 *
 * Riporta un prodotto allo stato "pending" (da controllare)
 * Rimuove anche eventuale prezzo bloccato dal listino
 * Body: { productId, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, orderId } = body;

    // Validation
    if (!productId || !orderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId sono obbligatori'
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

    console.log(`⏳ [MARK-PENDING-API] Product ${productId} in order ${orderId}`);

    // Get order line ID and pricelist ID
    const service = new PriceReviewService();

    const lineId = await service.getOrderLineId(cookies, productId, orderId);
    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Riga ordine non trovata' },
        { status: 404 }
      );
    }

    // Get pricelist (optional - se non esiste non è un errore)
    const pricelistId = await service.getPricelistId(cookies, orderId);

    // Mark as pending (reset status + remove pricelist item if exists)
    await service.markAsPending(
      cookies,
      productId,
      orderId,
      lineId,
      pricelistId || undefined
    );

    console.log(`✅ [MARK-PENDING-API] Successfully marked as pending`);

    return NextResponse.json({
      success: true,
      message: 'Prodotto riportato a "Da Controllare"',
      pricelistItemRemoved: !!pricelistId
    });

  } catch (error: any) {
    console.error('❌ [MARK-PENDING-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'operazione'
      },
      { status: 500 }
    );
  }
}
