import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query richiesta'
      });
    }

    const client = await getOdooClient();

    // Cerca ubicazioni per nome o barcode
    const locations = await client.searchRead(
      'stock.location',
      [
        ['usage', '=', 'internal'],
        '|',
        ['name', 'ilike', query],
        ['barcode', 'ilike', query]
      ],
      ['id', 'name', 'barcode', 'display_name'],
      50
    );

    return NextResponse.json({
      success: true,
      locations: locations || []
    });

  } catch (error) {
    console.error('Errore ricerca ubicazioni:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca ubicazioni'
    });
  }
}