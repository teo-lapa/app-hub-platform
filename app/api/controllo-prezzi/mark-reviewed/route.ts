import { NextRequest, NextResponse } from 'next/server';

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

    if (!productId || !orderId || !reviewedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId, reviewedBy sono obbligatori'
        },
        { status: 400 }
      );
    }

    // TODO: Implementare la logica per:
    // 1. Salvare in un custom model Odoo o in un file JSON:
    //    - productId
    //    - orderId
    //    - reviewedBy
    //    - reviewedAt (timestamp)
    //    - note (opzionale)
    //    - status = 'reviewed'
    // 2. Questo serve per tracciare chi ha controllato quale prezzo

    console.log('Mark as reviewed:', { productId, orderId, reviewedBy, note });

    return NextResponse.json({
      success: true,
      message: 'Prodotto marcato come controllato'
    });

  } catch (error: any) {
    console.error('Error in POST /api/controllo-prezzi/mark-reviewed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la marcatura'
      },
      { status: 500 }
    );
  }
}
