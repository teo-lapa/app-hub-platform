import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/orders
 *
 * Recupera la lista degli ordini del cliente loggato da Odoo
 *
 * Query params:
 * - from: data inizio (YYYY-MM-DD)
 * - to: data fine (YYYY-MM-DD)
 * - state: filtro per stato (sale, done, etc.)
 *
 * Returns: Array di ordini con dati completi
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🛒 [ORDERS-API] Inizio recupero ordini cliente');

    // Ottieni session_id dell'utente loggato
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [ORDERS-API] Utente non loggato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare gli ordini' },
        { status: 401 }
      );
    }

    // Estrai parametri query
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';
    const stateFilter = searchParams.get('state') || '';

    console.log('📅 [ORDERS-API] Filtri:', { fromDate, toDate, stateFilter });

    // Step 1: Ottieni l'utente corrente per recuperare il partner_id
    const userInfo = await getCurrentUserInfo(sessionId);

    if (!userInfo.success || !userInfo.partnerId) {
      console.error('❌ [ORDERS-API] Impossibile identificare il cliente');
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userInfo.partnerId;
    console.log('✅ [ORDERS-API] Cliente identificato:', partnerId);

    // Step 2: Costruisci domain per la ricerca ordini
    const domain: any[] = [
      ['partner_id', '=', partnerId],
      ['state', 'in', ['sale', 'done']], // Solo ordini confermati
    ];

    // Aggiungi filtro date se presenti
    if (fromDate) {
      domain.push(['date_order', '>=', fromDate]);
    }
    if (toDate) {
      domain.push(['date_order', '<=', toDate]);
    }

    // Aggiungi filtro stato specifico se richiesto
    if (stateFilter) {
      // Rimuovi il filtro generico e aggiungi quello specifico
      const stateIndex = domain.findIndex(d => d[0] === 'state');
      if (stateIndex >= 0) {
        domain.splice(stateIndex, 1);
      }
      domain.push(['state', '=', stateFilter]);
    }

    console.log('🔍 [ORDERS-API] Domain ricerca:', JSON.stringify(domain));

    // Step 3: Recupera gli ordini da Odoo
    const ordersResult = await callOdoo(
      sessionId,
      'sale.order',
      'search_read',
      [],
      {
        domain,
        fields: [
          'id',
          'name',
          'date_order',
          'amount_total',
          'amount_untaxed',
          'amount_tax',
          'state',
          'order_line',
          'invoice_status',
          'delivery_status',
          'partner_id',
          'user_id',
          'commitment_date',
          'note',
        ],
        order: 'date_order DESC',
        limit: 100,
      }
    );

    if (!ordersResult.success) {
      console.error('❌ [ORDERS-API] Errore recupero ordini:', ordersResult.error);
      return NextResponse.json(
        { success: false, error: ordersResult.error },
        { status: 500 }
      );
    }

    const orders = ordersResult.result || [];
    console.log(`✅ [ORDERS-API] Recuperati ${orders.length} ordini`);

    // Step 4: Per ogni ordine, recupera info aggiuntive (conteggio prodotti)
    const enrichedOrders = orders.map((order: any) => ({
      id: order.id,
      name: order.name,
      date: order.date_order,
      total: order.amount_total,
      totalUntaxed: order.amount_untaxed,
      tax: order.amount_tax,
      state: order.state,
      stateLabel: getStateLabel(order.state),
      productsCount: order.order_line?.length || 0,
      invoiceStatus: order.invoice_status,
      deliveryStatus: order.delivery_status,
      salesperson: order.user_id?.[1] || 'N/A',
      commitmentDate: order.commitment_date || null,
      hasNotes: !!order.note,
    }));

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
      count: enrichedOrders.length,
    });

  } catch (error: any) {
    console.error('💥 [ORDERS-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * Recupera informazioni utente corrente e partner_id
 */
async function getCurrentUserInfo(sessionId: string): Promise<{
  success: boolean;
  partnerId?: number;
  error?: string;
}> {
  try {
    // Chiama Odoo per ottenere l'utente corrente
    const userResult = await callOdoo(
      sessionId,
      'res.users',
      'read',
      [[]], // Empty array per current user
      { fields: ['partner_id'] }
    );

    if (!userResult.success || !userResult.result || userResult.result.length === 0) {
      return { success: false, error: 'Utente non trovato' };
    }

    const partnerId = userResult.result[0].partner_id?.[0];

    if (!partnerId) {
      return { success: false, error: 'Partner ID non trovato' };
    }

    return { success: true, partnerId };

  } catch (error: any) {
    console.error('❌ [GET-USER-INFO] Errore:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function per chiamate RPC a Odoo
 */
async function callOdoo(
  sessionId: string,
  model: string,
  method: string,
  args: any[],
  kwargs: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: kwargs || {},
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Errore HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.data?.message || data.error.message || 'Errore chiamata Odoo',
      };
    }

    return {
      success: true,
      result: data.result,
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Mapping stato ordine → label italiana
 */
function getStateLabel(state: string): string {
  const stateMap: Record<string, string> = {
    draft: 'Bozza',
    sent: 'Inviato',
    sale: 'Confermato',
    done: 'Completato',
    cancel: 'Annullato',
  };

  return stateMap[state] || state.toUpperCase();
}
