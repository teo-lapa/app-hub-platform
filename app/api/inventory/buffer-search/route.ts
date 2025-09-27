import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { searchQuery } = await request.json();

    if (!searchQuery || searchQuery.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query di ricerca troppo corta (minimo 3 caratteri)' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca prodotti nel buffer:', searchQuery);

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

    // Buffer location ID = 8
    const BUFFER_LOCATION_ID = 8;

    // 1. Cerca prodotti per nome, codice o barcode
    const products = await odooClient.callKw(
      'product.product',
      'search_read',
      [
        [
          '|', '|', '|',
          ['name', 'ilike', searchQuery],
          ['default_code', 'ilike', searchQuery],
          ['barcode', '=', searchQuery],
          ['x_studio_codice_articolo_cliente', 'ilike', searchQuery]
        ],
        ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
      ],
      { limit: 20 },
      session
    );

    console.log(`📦 Trovati ${products.length} prodotti`);

    // 2. Per ogni prodotto, verifica disponibilità nel buffer
    const productsWithStock = [];

    for (const product of products) {
      const quants = await odooClient.callKw(
        'stock.quant',
        'search_read',
        [
          [
            ['product_id', '=', product.id],
            ['location_id', '=', BUFFER_LOCATION_ID],
            ['quantity', '>', 0]
          ],
          ['quantity', 'lot_id']
        ],
        {},
        session
      );

      const totalQuantity = quants.reduce((sum: number, q: any) => sum + q.quantity, 0);

      if (totalQuantity > 0) {
        productsWithStock.push({
          ...product,
          bufferQuantity: totalQuantity,
          lots: quants.filter((q: any) => q.lot_id).map((q: any) => ({
            id: q.lot_id[0],
            name: q.lot_id[1],
            quantity: q.quantity
          }))
        });
      }
    }

    console.log(`✅ ${productsWithStock.length} prodotti con stock nel buffer`);

    return NextResponse.json({
      success: true,
      data: productsWithStock
    });

  } catch (error: any) {
    console.error('Errore ricerca buffer:', error);

    // Gestione sessione scaduta
    if (error.message && error.message.includes('session')) {
      return NextResponse.json(
        { success: false, error: 'Odoo Session Expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}