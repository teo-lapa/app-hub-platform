import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { operationId, quantity } = await request.json();

    console.log(`📝 Aggiorno quantità operazione ${operationId}: ${quantity}`);

    return NextResponse.json({
      success: true,
      operationId,
      newQuantity: quantity,
      message: 'Quantità aggiornata'
    });

  } catch (error: any) {
    console.error('❌ Errore aggiornamento:', error);
    return NextResponse.json(
      { error: 'Errore aggiornamento quantità' },
      { status: 500 }
    );
  }
}