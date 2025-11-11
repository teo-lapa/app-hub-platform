import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/controllo-prezzi/block-price
 *
 * Blocca un prezzo (impedisce ulteriori modifiche e lo rimuove dalla vista)
 * Body: { productId, orderId, blockedBy, note? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, orderId, blockedBy, note } = body;

    if (!productId || !orderId || !blockedBy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId, blockedBy sono obbligatori'
        },
        { status: 400 }
      );
    }

    // TODO: Implementare la logica per:
    // 1. Salvare in un custom model Odoo o in un file JSON:
    //    - productId
    //    - orderId
    //    - blockedBy
    //    - blockedAt (timestamp)
    //    - note (opzionale)
    //    - status = 'blocked'
    // 2. Opzionalmente, settare un flag sulla riga ordine in Odoo
    //    per impedire modifiche future al prezzo

    console.log('Block price:', { productId, orderId, blockedBy, note });

    return NextResponse.json({
      success: true,
      message: 'Prezzo bloccato con successo'
    });

  } catch (error: any) {
    console.error('Error in POST /api/controllo-prezzi/block-price:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il blocco'
      },
      { status: 500 }
    );
  }
}
