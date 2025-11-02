import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * PORTALE CLIENTI - Dashboard Details API
 * Fetches detailed data from Odoo for each card type
 *
 * GET /api/portale-clienti/dashboard/details?type={orders|revenue|avg|credit|overdue}
 */
export async function GET(request: NextRequest) {
  console.log('📋 [DASHBOARD-DETAILS-API] Request received');

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'orders' | 'revenue' | 'avg' | 'credit' | 'overdue';

    console.log('📋 [DASHBOARD-DETAILS-API] Type:', type);

    // 1. Authenticate user
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError: any) {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    // 2. Get partner_id
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
      return NextResponse.json({
        success: false,
        error: 'Customer account not found'
      }, { status: 404 });
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [DASHBOARD-DETAILS-API] Partner ID:', partnerId);

    // 3. Fetch data based on type
    let data: any;

    switch (type) {
      case 'orders':
        data = await fetchOrdersDetails(partnerId);
        break;
      case 'revenue':
        data = await fetchRevenueDetails(partnerId);
        break;
      case 'avg':
        data = await fetchAvgOrderDetails(partnerId);
        break;
      case 'credit':
        data = await fetchCreditDetails(partnerId);
        break;
      case 'overdue':
        data = await fetchOverdueDetails(partnerId);
        break;
      default:
        data = await fetchOrdersDetails(partnerId);
    }

    console.log('✅ [DASHBOARD-DETAILS-API] Data fetched successfully');

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('❌ [DASHBOARD-DETAILS-API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch details'
    }, { status: 500 });
  }
}

/**
 * Fetch orders for current month
 */
async function fetchOrdersDetails(partnerId: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  const orders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', monthStartStr]
      ],
      fields: ['name', 'date_order', 'amount_total', 'state'],
      order: 'date_order desc'
    }
  );

  const stateLabels: Record<string, string> = {
    sale: 'Confermato',
    done: 'Completato'
  };

  return {
    orders: orders?.map((order: any) => ({
      id: order.id,
      name: order.name,
      date_order: order.date_order,
      amount_total: order.amount_total,
      state: order.state,
      state_label: stateLabels[order.state] || order.state
    })) || []
  };
}

/**
 * Fetch revenue breakdown by month (YTD) - FROM INVOICES
 */
async function fetchRevenueDetails(partnerId: number) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const previousYearStart = `${currentYear - 1}-01-01`;
  const previousYearEnd = `${currentYear - 1}-12-31`;

  const [currentYearInvoices, previousYearInvoices] = await Promise.all([
    callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'posted'],
          ['invoice_date', '>=', yearStart]
        ],
        fields: ['invoice_date', 'amount_total'],
        order: 'invoice_date asc'
      }
    ),
    callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'posted'],
          ['invoice_date', '>=', previousYearStart],
          ['invoice_date', '<=', previousYearEnd]
        ],
        fields: ['amount_total'],
        order: 'invoice_date asc'
      }
    )
  ]);

  // Group by month
  const monthlyRevenue: Record<string, number> = {};
  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  currentYearInvoices?.forEach((invoice: any) => {
    const date = new Date(invoice.invoice_date);
    const monthKey = `${currentYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + invoice.amount_total;
  });

  const monthly_revenue = Object.entries(monthlyRevenue).map(([month, revenue]) => {
    const monthNum = parseInt(month.split('-')[1]) - 1;
    return {
      month,
      month_name: monthNames[monthNum],
      revenue
    };
  });

  const previous_year_total = previousYearInvoices?.reduce((sum: number, invoice: any) => sum + invoice.amount_total, 0) || 0;

  return {
    monthly_revenue,
    previous_year_total
  };
}

/**
 * Fetch average order comparison
 */
async function fetchAvgOrderDetails(partnerId: number) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const previousYearStart = `${currentYear - 1}-01-01`;

  const [currentOrders, historicalOrders] = await Promise.all([
    callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', yearStart]
        ],
        fields: ['name', 'date_order', 'amount_total'],
        order: 'date_order desc',
        limit: 10
      }
    ),
    callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['state', 'in', ['sale', 'done']],
          ['date_order', '<', yearStart],
          ['date_order', '>=', previousYearStart]
        ],
        fields: ['amount_total'],
        order: 'date_order desc'
      }
    )
  ]);

  const current_avg = currentOrders?.length > 0
    ? currentOrders.reduce((sum: number, o: any) => sum + o.amount_total, 0) / currentOrders.length
    : 0;

  const historical_avg = historicalOrders?.length > 0
    ? historicalOrders.reduce((sum: number, o: any) => sum + o.amount_total, 0) / historicalOrders.length
    : 0;

  const percentage_diff = historical_avg > 0
    ? ((current_avg - historical_avg) / historical_avg) * 100
    : 0;

  return {
    avg_comparison: {
      current_avg,
      historical_avg,
      percentage_diff
    },
    recent_orders_for_avg: currentOrders?.map((order: any) => ({
      id: order.id,
      name: order.name,
      date_order: order.date_order,
      amount_total: order.amount_total
    })) || []
  };
}

/**
 * Fetch credit information
 */
async function fetchCreditDetails(partnerId: number) {
  const partner = await callOdooAsAdmin(
    'res.partner',
    'search_read',
    [],
    {
      domain: [['id', '=', partnerId]],
      fields: ['credit_limit', 'credit'],
      limit: 1
    }
  );

  if (!partner || partner.length === 0) {
    return {
      credit_info: {
        total_limit: 0,
        used_credit: 0,
        available_credit: 0,
        usage_percentage: 0
      }
    };
  }

  const total_limit = partner[0].credit_limit || 0;
  const used_credit = partner[0].credit || 0;
  const available_credit = Math.max(0, total_limit - used_credit);
  const usage_percentage = total_limit > 0 ? (used_credit / total_limit) * 100 : 0;

  return {
    credit_info: {
      total_limit,
      used_credit,
      available_credit,
      usage_percentage
    }
  };
}

/**
 * Fetch overdue invoices
 */
async function fetchOverdueDetails(partnerId: number) {
  const today = new Date().toISOString().split('T')[0];

  const [overdueInvoices, allRecentInvoices] = await Promise.all([
    callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'posted'],
          ['payment_state', 'in', ['not_paid', 'partial']],
          ['invoice_date_due', '<', today]
        ],
        fields: ['name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual'],
        order: 'invoice_date_due asc'
      }
    ),
    callOdooAsAdmin(
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
        fields: ['name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual'],
        order: 'invoice_date desc',
        limit: 10
      }
    )
  ]);

  const formatInvoice = (invoice: any) => {
    const dueDate = new Date(invoice.invoice_date_due);
    const today = new Date();
    const days_overdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: invoice.id,
      name: invoice.name,
      invoice_date: invoice.invoice_date,
      invoice_date_due: invoice.invoice_date_due,
      amount_total: invoice.amount_total,
      amount_residual: invoice.amount_residual,
      is_overdue: days_overdue > 0,
      days_overdue: Math.max(0, days_overdue)
    };
  };

  return {
    invoices: overdueInvoices?.map(formatInvoice) || [],
    all_recent_invoices: allRecentInvoices?.map(formatInvoice) || []
  };
}
