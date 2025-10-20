import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return NextResponse.json({
        success: false,
        error: 'Barcode richiesto'
      });
    }

    const client = await getOdooClient();

    // Cerca ubicazione per barcode o nome
    const locations = await client.searchRead(
      'stock.location',
      [
        '|',
        ['barcode', '=', barcode],
        ['name', 'ilike', barcode]
      ],
      ['id', 'name', 'barcode', 'display_name', 'usage'],
      1
    );

    if (locations && locations.length > 0) {
      const location = locations[0];

      // Verifica che sia un'ubicazione interna
      if (location.usage !== 'internal') {
        return NextResponse.json({
          success: false,
          error: 'L\'ubicazione deve essere di tipo interno'
        });
      }

      return NextResponse.json({
        success: true,
        location: {
          id: location.id,
          name: location.name,
          barcode: location.barcode,
          display_name: location.display_name
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Ubicazione non trovata'
    });

  } catch (error) {
    console.error('Errore ricerca ubicazione:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca dell\'ubicazione'
    });
  }
}