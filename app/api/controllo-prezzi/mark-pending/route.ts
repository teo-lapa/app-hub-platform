import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/controllo-prezzi/mark-pending
 *
 * Riporta un prodotto allo stato "pending" (da controllare)
 * Body: { productId, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, orderId } = body;

    if (!productId || !orderId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parametri mancanti: productId, orderId sono obbligatori'
        },
        { status: 400 }
      );
    }

    // TODO: Implementare la logica per:
    // 1. Aggiornare il record nel custom model o file JSON
    // 2. Cambiare status da 'reviewed' o 'blocked' a 'pending'
    // 3. Rimuovere eventuali flag di blocco

    console.log('Mark as pending:', { productId, orderId });

    return NextResponse.json({
      success: true,
      message: 'Prodotto riportato a "Da Controllare"'
    });

  } catch (error: any) {
    console.error('Error in POST /api/controllo-prezzi/mark-pending:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante l\'operazione'
      },
      { status: 500 }
    );
  }
}
