import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { productIds, searchQuery } = await request.json();

    console.log('🔍 Ricerca prodotti:', { productIds, searchQuery });

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

    let products = [];

    if (productIds && Array.isArray(productIds)) {
      // Cerca prodotti per ID specifici
      products = await odooClient.callKw(
        'product.product',
        'search_read',
        [
          [['id', 'in', productIds]],
          ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
        ],
        {},
        session
      );
    } else if (searchQuery) {
      // Cerca prodotti per query
      products = await odooClient.callKw(
        'product.product',
        'search_read',
        [
          [
            '|', '|', '|',
            ['name', 'ilike', searchQuery],
            ['default_code', 'ilike', searchQuery],
            ['barcode', '=', searchQuery],
            ['barcode', 'ilike', searchQuery]
          ],
          ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id']
        ],
        { limit: 20 },
        session
      );
    }

    console.log(`📦 Trovati ${products.length} prodotti`);

    return NextResponse.json({
      success: true,
      data: products
    });

  } catch (error: any) {
    console.error('Errore ricerca prodotti:', error);

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