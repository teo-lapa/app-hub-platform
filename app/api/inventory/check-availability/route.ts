import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { productId, excludeLocationId } = await req.json();

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID richiesto'
      });
    }

    const client = await getOdooClient();

    // Cerca disponibilità in altre ubicazioni (incluso buffer)
    const domain: any[] = [
      ['product_id', '=', productId],
      ['quantity', '>', 0],
      ['location_id.usage', '=', 'internal']
    ];

    if (excludeLocationId) {
      domain.push(['location_id', '!=', excludeLocationId]);
    }

    const quants = await client.searchRead(
      'stock.quant',
      domain,
      ['id', 'location_id', 'quantity', 'lot_id', 'product_uom_id'],
      100
    );

    const totalQty = quants.reduce((sum: number, q: any) => sum + q.quantity, 0);

    return NextResponse.json({
      success: true,
      totalQty,
      quants
    });

  } catch (error) {
    console.error('Errore verifica disponibilità:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella verifica disponibilità'
    });
  }
}