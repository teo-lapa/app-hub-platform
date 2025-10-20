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

    // Cerca prodotti per nome, codice o barcode
    const products = await client.searchRead(
      'product.product',
      [
        '|', '|',
        ['name', 'ilike', query],
        ['default_code', 'ilike', query],
        ['barcode', '=', query]
      ],
      ['id', 'name', 'default_code', 'barcode', 'uom_id', 'tracking', 'image_128'],
      50
    );

    const formattedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.default_code,
      barcode: p.barcode,
      uom: p.uom_id ? p.uom_id[1] : 'Unit',
      tracking: p.tracking || 'none',
      image: p.image_128 ? `data:image/png;base64,${p.image_128}` : null,
      totalQty: 0,
      lots: []
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts
    });

  } catch (error) {
    console.error('Errore ricerca prodotti:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca prodotti'
    });
  }
}