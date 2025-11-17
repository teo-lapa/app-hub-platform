import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo-auth';

/**
 * GET /api/controllo-prezzi/main-pricelists
 *
 * Recupera i 5 listini principali da usare per impostare i prezzi
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    const sessionId = sessionCookie.value;
    const cookieHeader = `session_id=${sessionId}`;

    console.log('📋 Recupero listini principali...');

    // Recupera tutti i listini attivi
    const pricelists = await callOdoo(
      cookieHeader,
      'product.pricelist',
      'search_read',
      [],
      {
        domain: [
          ['active', '=', true]
        ],
        fields: ['id', 'name', 'currency_id', 'item_ids'],
        order: 'name asc',
        limit: 10 // Prendiamo i primi 10 per sicurezza
      }
    );

    if (!pricelists || pricelists.length === 0) {
      return NextResponse.json({
        success: true,
        pricelists: [],
        count: 0
      });
    }

    console.log(`✅ Trovati ${pricelists.length} listini attivi`);

    // Formatta risultati (prendi i primi 5)
    const formattedPricelists = pricelists.slice(0, 5).map((pricelist: any) => ({
      id: pricelist.id,
      name: pricelist.name,
      currency: pricelist.currency_id ? pricelist.currency_id[1] : 'CHF',
      itemCount: pricelist.item_ids ? pricelist.item_ids.length : 0
    }));

    return NextResponse.json({
      success: true,
      pricelists: formattedPricelists,
      count: formattedPricelists.length
    });

  } catch (error: any) {
    console.error('❌ Errore recupero listini principali:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei listini'
    }, { status: 500 });
  }
}
