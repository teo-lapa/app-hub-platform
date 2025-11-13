import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/catalogo-venditori/last-delivery
 * Recupera l'ultima data di consegna effettiva per un cliente
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId è richiesto' },
        { status: 400 }
      );
    }

    const customerIdNum = parseInt(customerId);
    if (isNaN(customerIdNum)) {
      return NextResponse.json(
        { success: false, error: 'customerId deve essere un numero' },
        { status: 400 }
      );
    }

    console.log(`🚚 [LAST-DELIVERY] Recupero ultima consegna per cliente ${customerIdNum}`);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [LAST-DELIVERY] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Cerca l'ultimo ordine confermato con data di consegna
    const orders = await callOdoo(cookies, 'sale.order', 'search_read', [], {
      domain: [
        ['partner_id', '=', customerIdNum],
        ['state', 'in', ['sale', 'done']], // Solo ordini confermati o completati
        ['commitment_date', '!=', false]    // Solo con data di consegna
      ],
      fields: ['commitment_date'],
      limit: 1,
      order: 'commitment_date desc'  // Ordina per data più recente
    });

    if (orders && orders.length > 0 && orders[0].commitment_date) {
      const lastDeliveryDate = orders[0].commitment_date.split(' ')[0]; // Prendi solo la data (YYYY-MM-DD)
      console.log(`✅ [LAST-DELIVERY] Trovata ultima consegna: ${lastDeliveryDate}`);

      return NextResponse.json({
        success: true,
        lastDeliveryDate: lastDeliveryDate
      });
    }

    console.log(`ℹ️ [LAST-DELIVERY] Nessuna consegna trovata per cliente ${customerIdNum}`);
    return NextResponse.json({
      success: true,
      lastDeliveryDate: null
    });

  } catch (error: any) {
    console.error('❌ [LAST-DELIVERY] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nel recupero ultima consegna'
      },
      { status: 500 }
    );
  }
}
