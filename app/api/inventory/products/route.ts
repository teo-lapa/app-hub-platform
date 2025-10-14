import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { productIds, searchQuery } = await request.json();
    console.log('🔍 Ricerca prodotti inventario:', { productIds, searchQuery });

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

    // STEP 2: Costruisci la query di ricerca
    let domain: any[] = [];

    if (productIds && productIds.length > 0) {
      // Ricerca per ID specifici
      domain = [['id', 'in', productIds]];
    } else if (searchQuery && searchQuery.trim()) {
      // Ricerca per testo
      const search = searchQuery.trim();
      domain = [
        '|', '|', '|',
        ['name', 'ilike', search],
        ['default_code', 'ilike', search],
        ['barcode', '=', search],
        ['barcode', 'ilike', search]
      ];
    } else {
      // Ricerca generica - primi prodotti
      domain = [['active', '=', true]];
    }

    // STEP 3: Cerca prodotti
    const productsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'search_read',
          args: [domain],
          kwargs: {
            fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id'],
            limit: 20
          }
        },
        id: Math.random()
      })
    });

    const productsData = await productsResponse.json();

    if (productsData.error) {
      throw new Error(productsData.error.message || 'Errore ricerca prodotti');
    }

    console.log(`📦 Trovati ${productsData.result.length} prodotti per inventario`);

    return NextResponse.json({
      success: true,
      data: productsData.result || [],
      products: productsData.result || [],
      method: 'authenticated_session'
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca prodotti inventario:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}
