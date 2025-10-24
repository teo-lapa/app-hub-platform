/**
 * PORTALE CLIENTI - Dashboard API Endpoint
 *
 * GET /api/portale-clienti/dashboard
 *
 * Fetches real-time customer dashboard data from Odoo:
 * - KPIs: orders count, revenue YTD, avg order, credit available, overdue invoices
 * - Recent orders (last 5)
 * - Active deliveries (today)
 * - Open invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

interface DashboardKPIs {
  orders_count: number;
  revenue_ytd: number;
  avg_order: number;
  credit_available: number;
  credit_limit: number;
  overdue_invoices: number;
  overdue_amount: number;
}

interface RecentOrder {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  state_label: string;
  delivery_status?: string;
}

interface ActiveDelivery {
  id: number;
  name: string;
  scheduled_date: string;
  origin: string;
  state: string;
  state_label: string;
  location_dest: string;
}

interface OpenInvoice {
  id: number;
  name: string;
  invoice_date: string;
  invoice_date_due: string;
  amount_total: number;
  amount_residual: number;
  state: string;
  payment_state: string;
  is_overdue: boolean;
}

interface DashboardResponse {
  success: boolean;
  data?: {
    kpis: DashboardKPIs;
    recent_orders: RecentOrder[];
    active_deliveries: ActiveDelivery[];
    open_invoices: OpenInvoice[];
    last_sync: string;
  };
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<DashboardResponse>> {
  console.log('\n📊 [DASHBOARD-API] Customer dashboard request received');

  try {
    // 1. Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [DASHBOARD-API] No JWT token found');
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [DASHBOARD-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id,
        name: decoded.name
      });
    } catch (jwtError: any) {
      console.error('❌ [DASHBOARD-API] JWT verification failed:', jwtError.message);
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    // 2. Get Odoo session from cookies (same system as products/orders APIs)
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // 3. Get partner_id for the logged-in user
    console.log('🔍 [DASHBOARD-API] Fetching partner_id for user...');

    const userPartners = await callOdoo(
      odooCookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name', 'credit_limit', 'credit'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [DASHBOARD-API] No partner found for email:', decoded.email);
      return NextResponse.json({
        success: false,
        error: 'Customer account not found in Odoo'
      }, { status: 404 });
    }

    const partner = userPartners[0];
    const partnerId = partner.id;
    console.log('✅ [DASHBOARD-API] Partner found:', {
      id: partnerId,
      name: partner.name,
      credit_limit: partner.credit_limit,
      credit: partner.credit
    });

    // 4. Fetch dashboard data in parallel
    console.log('📡 [DASHBOARD-API] Fetching dashboard data from Odoo...');

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const today = new Date().toISOString().split('T')[0];

    const [
      allOrders,
      recentOrders,
      activeDeliveries,
      openInvoices
    ] = await Promise.all([
      // All confirmed orders for YTD calculations
      callOdoo(
        odooCookies,
        'sale.order',
        'search_read',
        [],
        {
          domain: [
            ['partner_id', '=', partnerId],
            ['state', 'in', ['sale', 'done']],
            ['date_order', '>=', yearStart]
          ],
          fields: ['amount_total', 'date_order'],
          order: 'date_order desc'
        }
      ),

      // Recent 5 orders
      callOdoo(
        odooCookies,
        'sale.order',
        'search_read',
        [],
        {
          domain: [
            ['partner_id', '=', partnerId],
            ['state', 'in', ['draft', 'sent', 'sale', 'done']]
          ],
          fields: ['name', 'date_order', 'amount_total', 'state'],
          order: 'date_order desc',
          limit: 5
        }
      ),

      // Active deliveries (scheduled for today or in progress)
      callOdoo(
        odooCookies,
        'stock.picking',
        'search_read',
        [],
        {
          domain: [
            ['partner_id', '=', partnerId],
            ['state', 'in', ['assigned', 'confirmed', 'waiting']],
            ['picking_type_code', '=', 'outgoing']
          ],
          fields: ['name', 'scheduled_date', 'origin', 'state', 'location_dest_id'],
          order: 'scheduled_date asc',
          limit: 10
        }
      ),

      // Open invoices
      callOdoo(
        odooCookies,
        'account.move',
        'search_read',
        [],
        {
          domain: [
            ['partner_id', '=', partnerId],
            ['move_type', '=', 'out_invoice'],
            ['state', '=', 'posted'],
            ['payment_state', 'in', ['not_paid', 'partial']]
          ],
          fields: ['name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual', 'state', 'payment_state'],
          order: 'invoice_date desc',
          limit: 10
        }
      )
    ]);

    console.log('✅ [DASHBOARD-API] Data fetched successfully:', {
      allOrders: allOrders?.length || 0,
      recentOrders: recentOrders?.length || 0,
      activeDeliveries: activeDeliveries?.length || 0,
      openInvoices: openInvoices?.length || 0
    });

    // 5. Calculate KPIs
    const ordersThisMonth = allOrders?.filter((order: any) => {
      const orderDate = new Date(order.date_order);
      const now = new Date();
      return orderDate.getMonth() === now.getMonth() &&
             orderDate.getFullYear() === now.getFullYear();
    }) || [];

    const revenueYTD = allOrders?.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0) || 0;
    const avgOrder = allOrders && allOrders.length > 0 ? revenueYTD / allOrders.length : 0;

    // Calculate overdue invoices
    const overdueInvoices = openInvoices?.filter((inv: any) => {
      if (!inv.invoice_date_due) return false;
      const dueDate = new Date(inv.invoice_date_due);
      return dueDate < new Date();
    }) || [];

    const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_residual || 0), 0);

    const kpis: DashboardKPIs = {
      orders_count: ordersThisMonth.length,
      revenue_ytd: revenueYTD,
      avg_order: avgOrder,
      credit_limit: partner.credit_limit || 0,
      credit_available: Math.max(0, (partner.credit_limit || 0) - (partner.credit || 0)),
      overdue_invoices: overdueInvoices.length,
      overdue_amount: overdueAmount
    };

    console.log('📊 [DASHBOARD-API] KPIs calculated:', kpis);

    // 6. Format response data
    const stateLabels: Record<string, string> = {
      draft: 'Bozza',
      sent: 'Inviato',
      sale: 'Confermato',
      done: 'Completato',
      cancel: 'Annullato',
      assigned: 'Pronto',
      confirmed: 'In attesa',
      waiting: 'In attesa',
      posted: 'Confermata'
    };

    const formattedRecentOrders: RecentOrder[] = recentOrders?.map((order: any) => ({
      id: order.id,
      name: order.name,
      date_order: order.date_order,
      amount_total: order.amount_total,
      state: order.state,
      state_label: stateLabels[order.state] || order.state
    })) || [];

    const formattedDeliveries: ActiveDelivery[] = activeDeliveries?.map((delivery: any) => ({
      id: delivery.id,
      name: delivery.name,
      scheduled_date: delivery.scheduled_date,
      origin: delivery.origin || 'N/A',
      state: delivery.state,
      state_label: stateLabels[delivery.state] || delivery.state,
      location_dest: delivery.location_dest_id?.[1] || 'N/A'
    })) || [];

    const formattedInvoices: OpenInvoice[] = openInvoices?.map((invoice: any) => {
      const dueDate = invoice.invoice_date_due ? new Date(invoice.invoice_date_due) : null;
      const isOverdue = dueDate ? dueDate < new Date() : false;

      return {
        id: invoice.id,
        name: invoice.name,
        invoice_date: invoice.invoice_date,
        invoice_date_due: invoice.invoice_date_due || '',
        amount_total: invoice.amount_total,
        amount_residual: invoice.amount_residual,
        state: invoice.state,
        payment_state: invoice.payment_state,
        is_overdue: isOverdue
      };
    }) || [];

    // 7. Return response
    console.log('✅ [DASHBOARD-API] Dashboard data prepared successfully');

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        recent_orders: formattedRecentOrders,
        active_deliveries: formattedDeliveries,
        open_invoices: formattedInvoices,
        last_sync: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ [DASHBOARD-API] Error fetching dashboard data:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch dashboard data'
    }, { status: 500 });
  }
}
