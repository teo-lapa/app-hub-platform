import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { locationCode } = await request.json();

    if (!locationCode) {
      return NextResponse.json(
        { success: false, error: 'Codice ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca ubicazione:', locationCode);

    const odooClient = createOdooClient();

    // Utilizza la sessione Odoo dal cookie
    const sessionCookie = request.cookies.get('odoo_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Sessione Odoo non trovata' },
        { status: 401 }
      );
    }

    const session = JSON.parse(decodeURIComponent(sessionCookie));

    // Cerca ubicazione per codice o barcode
    const locations = await odooClient.callKw(
      'stock.location',
      'search_read',
      [
        [['|'], ['barcode', '=', locationCode], ['name', 'ilike', locationCode]],
        ['id', 'name', 'complete_name', 'barcode']
      ],
      { limit: 1 },
      session
    );

    console.log('📍 Ubicazioni trovate:', locations);

    if (!locations || locations.length === 0) {
      return NextResponse.json(
        { success: false, error: `Ubicazione non trovata: ${locationCode}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: locations[0]
    });

  } catch (error: any) {
    console.error('Errore ricerca ubicazione:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}