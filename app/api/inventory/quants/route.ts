import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json(
        { success: false, error: 'ID ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('📦 Caricamento quants per ubicazione:', locationId);

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

    // Ottieni quants dell'ubicazione
    const quants = await odooClient.callKw(
      'stock.quant',
      'search_read',
      [
        [
          ['location_id', '=', locationId],
          ['quantity', '>', 0]
        ],
        [
          'id',
          'product_id',
          'quantity',
          'lot_id',
          'inventory_quantity',
          'inventory_date',
          'inventory_diff_quantity',
          'user_id',
          'package_id',
          'product_uom_id',
          'location_id'
        ]
      ],
      {},
      session
    );

    console.log(`📋 Trovati ${quants.length} quants`);

    return NextResponse.json({
      success: true,
      data: quants
    });

  } catch (error: any) {
    console.error('Errore caricamento quants:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}