import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId richiesto'
      }, { status: 400 });
    }

    const odoo = createOdooClient();

    // Conta i prodotti (quants) nella location buffer
    const quants = await odoo.searchRead(
      'stock.quant',
      [
        ['location_id', '=', locationId],
        ['quantity', '>', 0]
      ],
      ['id'],
      false
    );

    return NextResponse.json({
      success: true,
      count: quants.length
    });

  } catch (error: any) {
    console.error('Errore buffer count:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel conteggio prodotti'
    }, { status: 500 });
  }
}
