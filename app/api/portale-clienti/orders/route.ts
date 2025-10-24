import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

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

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [ORDERS-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare gli ordini' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [ORDERS-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [ORDERS-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Estrai parametri query
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';
    const stateFilter = searchParams.get('state') || '';

    console.log('📅 [ORDERS-API] Filtri:', { fromDate, toDate, stateFilter });

    // Step 1: Get partner_id using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [ORDERS-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;
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

    // Step 3: Recupera gli ordini da Odoo usando admin session
    const ordersResult = await callOdooAsAdmin(
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

    const orders = ordersResult || [];
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
