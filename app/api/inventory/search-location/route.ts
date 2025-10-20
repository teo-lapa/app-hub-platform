import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return NextResponse.json({
        success: false,
        error: 'Barcode richiesto'
      });
    }

    // ✅ Usa sessione utente loggato
    const userCookies = cookies().toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Cerca ubicazione per barcode o nome
    const locations = await callOdoo(
      odooCookies,
      'stock.location',
      'search_read',
      [],
      {
        domain: [
          '|',
          ['barcode', '=', barcode],
          ['name', 'ilike', barcode]
        ],
        fields: ['id', 'name', 'barcode', 'display_name', 'usage'],
        limit: 1
      }
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

  } catch (error: any) {
    console.error('Errore ricerca ubicazione:', error);

    // ✅ Se utente non loggato, ritorna 401
    if (error.message?.includes('non autenticato') || error.message?.includes('Devi fare login')) {
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per accedere a questa funzione'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: 'Errore nella ricerca dell\'ubicazione'
    }, { status: 500 });
  }
}
