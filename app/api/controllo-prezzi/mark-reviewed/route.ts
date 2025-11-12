import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { PriceReviewService } from '@/lib/services/price-review-service';

/**
 * POST /api/controllo-prezzi/mark-reviewed
 *
 * Marca un prodotto come "controllato"
 * Body: { productId, orderId, reviewedBy, note? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, orderId, reviewedBy, note } = body;

    // Validation
    if (!productId || !orderId || !reviewedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId, reviewedBy sono obbligatori'
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

    console.log(`📝 [MARK-REVIEWED-API] Product ${productId} in order ${orderId} by ${reviewedBy}`);

    // Get order line ID
    const service = new PriceReviewService();
    const lineId = await service.getOrderLineId(cookies, productId, orderId);

    if (!lineId) {
      return NextResponse.json(
        { success: false, error: 'Riga ordine non trovata' },
        { status: 404 }
      );
    }

    // Mark as reviewed
    await service.markAsReviewed(
      cookies,
      productId,
      orderId,
      lineId,
      reviewedBy,
      note
    );

    console.log(`✅ [MARK-REVIEWED-API] Successfully marked as reviewed`);

    return NextResponse.json({
      success: true,
      message: 'Prodotto marcato come controllato'
    });

  } catch (error: any) {
    console.error('❌ [MARK-REVIEWED-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la marcatura'
      },
      { status: 500 }
    );
  }
}
