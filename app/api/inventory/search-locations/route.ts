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

    // Cerca ubicazioni per nome o barcode
    const locations = await callOdoo(
      odooCookies,
      'stock.location',
      'search_read',
      [],
      {
        domain: [
          ['usage', '=', 'internal'],
          '|',
          ['name', 'ilike', query],
          ['barcode', 'ilike', query]
        ],
        fields: ['id', 'name', 'barcode', 'display_name'],
        limit: 50
      }
    );

    return NextResponse.json({
      success: true,
      locations: locations || []
    });

  } catch (error: any) {
    console.error('Errore ricerca ubicazioni:', error);

    // ✅ Se utente non loggato, ritorna 401
    if (error.message?.includes('non autenticato') || error.message?.includes('Devi fare login')) {
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per accedere a questa funzione'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca ubicazioni'
    }, { status: 500 });
  }
}
