import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({
        success: false,
        error: 'Query richiesta'
      });
    }

    // ✅ Usa sessione utente loggato
    const userCookies = cookies().toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Cerca prodotti per nome, codice o barcode
    const products = await callOdoo(
      odooCookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          '|', '|',
          ['name', 'ilike', query],
          ['default_code', 'ilike', query],
          ['barcode', '=', query]
        ],
        fields: ['id', 'name', 'default_code', 'barcode', 'uom_id', 'tracking', 'image_128'],
        limit: 50
      }
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

  } catch (error: any) {
    console.error('Errore ricerca prodotti:', error);

    // ✅ Se utente non loggato, ritorna 401
    if (error.message?.includes('non autenticato') || error.message?.includes('Devi fare login')) {
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per accedere a questa funzione'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca prodotti'
    }, { status: 500 });
  }
}
