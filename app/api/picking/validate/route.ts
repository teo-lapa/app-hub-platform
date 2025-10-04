import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    console.log(`✅ Validazione batch ${batchId}`);

    // Simula validazione
    return NextResponse.json({
      success: true,
      message: `Batch ${batchId} validato con successo`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Errore validazione:', error);
    return NextResponse.json(
      { error: 'Errore nella validazione' },
      { status: 500 }
    );
  }
}