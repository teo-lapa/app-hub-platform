import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/catalogo-venditori/customer-orders/[customerId]
 *
 * Retrieves all orders and quotations for a specific customer.
 * Returns both confirmed orders and draft quotations.
 *
 * Query params:
 * - limit: number of orders to return (default: 50)
 * - includeStates: comma-separated states (default: draft,sent,sale,done)
 *
 * Returns: list of orders with id, name, state, date, total amount
 */

interface RouteContext {
  params: {
    customerId: string;
  };
}

interface FormattedOrder {
  id: number;
  name: string;
  state: string;
  stateLabel: string;
  orderType: 'quotation' | 'order';
  date: string;
  amountTotal: number;
  currency: string;
  lineCount: number;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const customerId = parseInt(params.customerId);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStates = searchParams.get('includeStates') || 'draft,sent,sale,done';
    const states = includeStates.split(',');

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    console.log('📋 [CUSTOMER-ORDERS-API] Fetching orders for customer:', customerId);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CUSTOMER-ORDERS-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Fetch customer name first
    console.log('🔍 [CUSTOMER-ORDERS-API] Fetching customer info...');
    const customers = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', '=', customerId]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!customers || customers.length === 0) {
      console.error('❌ [CUSTOMER-ORDERS-API] Customer not found:', customerId);
      return NextResponse.json(
        { success: false, error: `Customer ${customerId} not found` },
        { status: 404 }
      );
    }

    const customer = customers[0];
    console.log('✅ [CUSTOMER-ORDERS-API] Customer found:', customer.name);

    // Fetch orders (both quotations and confirmed orders)
    console.log('🔍 [CUSTOMER-ORDERS-API] Fetching orders with states:', states);
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', customerId],
          ['state', 'in', states]
        ],
        fields: [
          'id',
          'name',
          'state',
          'date_order',
          'amount_total',
          'currency_id',
          'order_line'
        ],
        limit: limit,
        order: 'date_order desc'
      }
    );

    console.log(`✅ [CUSTOMER-ORDERS-API] Found ${orders.length} orders`);

    // Format orders for frontend
    const formattedOrders: FormattedOrder[] = orders.map((order: any) => {
      // Determine order type and label
      let orderType: 'quotation' | 'order' = 'order';
      let stateLabel = '';

      switch (order.state) {
        case 'draft':
          orderType = 'quotation';
          stateLabel = 'Preventivo (Bozza)';
          break;
        case 'sent':
          orderType = 'quotation';
          stateLabel = 'Preventivo (Inviato)';
          break;
        case 'sale':
          orderType = 'order';
          stateLabel = 'Ordine Confermato';
          break;
        case 'done':
          orderType = 'order';
          stateLabel = 'Ordine Completato';
          break;
        case 'cancel':
          stateLabel = 'Annullato';
          break;
        default:
          stateLabel = order.state;
      }

      return {
        id: order.id,
        name: order.name,
        state: order.state,
        stateLabel,
        orderType,
        date: order.date_order,
        amountTotal: order.amount_total,
        currency: order.currency_id ? order.currency_id[1] : 'CHF',
        lineCount: Array.isArray(order.order_line) ? order.order_line.length : 0
      };
    });

    // Separate quotations and orders
    const quotations = formattedOrders.filter((o: FormattedOrder) => o.orderType === 'quotation');
    const confirmedOrders = formattedOrders.filter((o: FormattedOrder) => o.orderType === 'order');

    console.log('✅ [CUSTOMER-ORDERS-API] Results:', {
      totalOrders: formattedOrders.length,
      quotations: quotations.length,
      confirmedOrders: confirmedOrders.length
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name
      },
      orders: formattedOrders,
      statistics: {
        total: formattedOrders.length,
        quotations: quotations.length,
        confirmedOrders: confirmedOrders.length
      }
    });

  } catch (error: any) {
    console.error('💥 [CUSTOMER-ORDERS-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching customer orders',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
