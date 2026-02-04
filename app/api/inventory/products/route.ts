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

    // STEP 3: Cerca prodotti in entrambe le lingue (italiano e inglese)
    const searchFields = ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id'];

    const makeRequest = (lang: string) => fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            fields: searchFields,
            limit: 20,
            context: { lang }
          }
        },
        id: Math.random()
      })
    }).then(r => r.json());

    const [dataIt, dataEn] = await Promise.all([
      makeRequest('it_IT'),
      makeRequest('en_US'),
    ]);

    if (dataIt.error && dataEn.error) {
      throw new Error(dataIt.error.message || 'Errore ricerca prodotti');
    }

    // Merge and deduplicate by product ID (Italian results take priority)
    const seenIds = new Set<number>();
    const mergedProducts: any[] = [];
    for (const p of [...(dataIt.result || []), ...(dataEn.result || [])]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        mergedProducts.push(p);
      }
    }

    // Override productsData format for compatibility
    const productsData = { result: mergedProducts };

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
