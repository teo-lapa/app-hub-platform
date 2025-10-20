import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { productId, excludeLocationId } = await req.json();

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'Product ID richiesto'
      });
    }

    // ✅ Usa sessione utente loggato
    const userCookies = cookies().toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Cerca disponibilità in altre ubicazioni (incluso buffer)
    const domain: any[] = [
      ['product_id', '=', productId],
      ['quantity', '>', 0],
      ['location_id.usage', '=', 'internal']
    ];

    if (excludeLocationId) {
      domain.push(['location_id', '!=', excludeLocationId]);
    }

    const quants = await callOdoo(
      odooCookies,
      'stock.quant',
      'search_read',
      [],
      {
        domain,
        fields: ['id', 'location_id', 'quantity', 'lot_id', 'product_uom_id'],
        limit: 100
      }
    );

    const totalQty = quants.reduce((sum: number, q: any) => sum + q.quantity, 0);

    return NextResponse.json({
      success: true,
      totalQty,
      quants
    });

  } catch (error: any) {
    console.error('Errore verifica disponibilità:', error);

    // ✅ Se utente non loggato, ritorna 401
    if (error.message?.includes('non autenticato') || error.message?.includes('Devi fare login')) {
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per accedere a questa funzione'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Errore nella verifica disponibilità'
    }, { status: 500 });
  }
}
