/**
 * PORTALE CLIENTI - Dashboard Details API Endpoint
 *
 * GET /api/portale-clienti/dashboard/details?type={orders|revenue|avg|credit|overdue}
 *
 * Fetches detailed data for each dashboard card:
 * - orders: Last 20 orders of current month
 * - revenue: Monthly breakdown YTD + previous year comparison
 * - avg: Average order analysis with comparison and recent orders
 * - credit: Detailed credit information and usage
 * - overdue: Overdue invoices list or recent invoices if none overdue
 */

import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface MonthlyRevenue {
  month: string;
  month_name: string;
  revenue: number;
}

interface DetailedOrder {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  state_label: string;
}

interface DetailedInvoice {
  id: number;
  name: string;
  invoice_date: string;
  invoice_date_due: string;
  amount_total: number;
  amount_residual: number;
  is_overdue: boolean;
  days_overdue: number;
}

export async function GET(request: NextRequest) {
  console.log('\n📋 [DASHBOARD-DETAILS-API] Request received');

  try {
    // 1. Extract query parameter
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type || !['orders', 'revenue', 'avg', 'credit', 'overdue'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid type parameter. Must be: orders, revenue, avg, credit, or overdue'
      }, { status: 400 });
    }

    console.log('📊 [DASHBOARD-DETAILS-API] Type requested:', type);

    // 2. Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [DASHBOARD-DETAILS-API] No JWT token found');
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
      console.log('✅ [DASHBOARD-DETAILS-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [DASHBOARD-DETAILS-API] JWT verification failed:', jwtError.message);
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication token'
      }, { status: 401 });
    }

    // 3. Get partner_id for the logged-in user
    console.log('🔍 [DASHBOARD-DETAILS-API] Fetching partner_id...');

    const userPartners = await callOdooAsAdmin(
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
      console.error('❌ [DASHBOARD-DETAILS-API] No partner found');
      return NextResponse.json({
        success: false,
        error: 'Customer account not found'
      }, { status: 404 });
    }

    const partner = userPartners[0];
    const partnerId = partner.id;
    console.log('✅ [DASHBOARD-DETAILS-API] Partner found:', partnerId);

    // 4. Fetch type-specific data
    let responseData: any = {};

    try {
      console.log(`🔍 [DASHBOARD-DETAILS-API] Fetching data for type: ${type}`);

      switch (type) {
        case 'orders':
          responseData = await fetchOrdersDetails(partnerId);
          break;
        case 'revenue':
          responseData = await fetchRevenueDetails(partnerId);
          break;
        case 'avg':
          responseData = await fetchAvgOrderDetails(partnerId);
          break;
        case 'credit':
          responseData = await fetchCreditDetails(partner);
          break;
        case 'overdue':
          responseData = await fetchOverdueDetails(partnerId);
          break;
      }

      console.log('✅ [DASHBOARD-DETAILS-API] Data fetched successfully:', Object.keys(responseData));

      return NextResponse.json({
        success: true,
        data: responseData
      });

    } catch (fetchError: any) {
      console.error(`❌ [DASHBOARD-DETAILS-API] Error fetching ${type} data:`, fetchError);
      console.error('Stack:', fetchError.stack);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch ${type} details: ${fetchError.message}`
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ [DASHBOARD-DETAILS-API] General error:', error);
    console.error('Stack:', error.stack);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch details'
    }, { status: 500 });
  }
}

/**
 * Fetch orders details - Last 20 orders of current month
 */
async function fetchOrdersDetails(partnerId: number) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const orders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['draft', 'sent', 'sale', 'done']],
        ['date_order', '>=', monthStart]
      ],
      fields: ['name', 'date_order', 'amount_total', 'state'],
      order: 'date_order desc',
      limit: 20
    }
  );

  const stateLabels: Record<string, string> = {
    draft: 'Bozza',
    sent: 'Inviato',
    sale: 'Confermato',
    done: 'Completato',
    cancel: 'Annullato'
  };

  const formattedOrders: DetailedOrder[] = orders?.map((order: any) => ({
    id: order.id,
    name: order.name,
    date_order: order.date_order,
    amount_total: order.amount_total,
    state: order.state,
    state_label: stateLabels[order.state] || order.state
  })) || [];

  return { orders: formattedOrders };
}

/**
 * Fetch revenue details - Monthly breakdown YTD + previous year
 */
async function fetchRevenueDetails(partnerId: number) {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  // Current year orders
  const currentYearOrders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', `${currentYear}-01-01`]
      ],
      fields: ['date_order', 'amount_total'],
      order: 'date_order asc'
    }
  );

  // Previous year total
  const previousYearOrders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', `${previousYear}-01-01`],
        ['date_order', '<', `${currentYear}-01-01`]
      ],
      fields: ['amount_total']
    }
  );

  // Calculate monthly breakdown
  const monthlyRevenue: Record<string, number> = {};
  currentYearOrders?.forEach((order: any) => {
    const date = new Date(order.date_order);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + order.amount_total;
  });

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const formattedMonthly: MonthlyRevenue[] = Object.entries(monthlyRevenue).map(([month, revenue]) => {
    const [year, monthNum] = month.split('-');
    return {
      month,
      month_name: monthNames[parseInt(monthNum) - 1],
      revenue
    };
  });

  const previousYearTotal = previousYearOrders?.reduce(
    (sum: number, order: any) => sum + order.amount_total,
    0
  ) || 0;

  return {
    monthly_revenue: formattedMonthly,
    previous_year_total: previousYearTotal
  };
}

/**
 * Fetch average order details - Comparison and recent orders
 */
async function fetchAvgOrderDetails(partnerId: number) {
  const currentYear = new Date().getFullYear();

  // All confirmed orders YTD
  const currentYearOrders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', `${currentYear}-01-01`]
      ],
      fields: ['name', 'date_order', 'amount_total', 'state']
    }
  );

  // Historical orders (last 2 years for comparison)
  const twoYearsAgo = currentYear - 2;
  const historicalOrders = await callOdooAsAdmin(
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', partnerId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', `${twoYearsAgo}-01-01`],
        ['date_order', '<', `${currentYear}-01-01`]
      ],
      fields: ['amount_total']
    }
  );

  const currentTotal = currentYearOrders?.reduce(
    (sum: number, order: any) => sum + order.amount_total,
    0
  ) || 0;
  const currentAvg = currentYearOrders && currentYearOrders.length > 0
    ? currentTotal / currentYearOrders.length
    : 0;

  const historicalTotal = historicalOrders?.reduce(
    (sum: number, order: any) => sum + order.amount_total,
    0
  ) || 0;
  const historicalAvg = historicalOrders && historicalOrders.length > 0
    ? historicalTotal / historicalOrders.length
    : 0;

  const percentageDiff = historicalAvg > 0
    ? ((currentAvg - historicalAvg) / historicalAvg) * 100
    : 0;

  const stateLabels: Record<string, string> = {
    draft: 'Bozza',
    sent: 'Inviato',
    sale: 'Confermato',
    done: 'Completato',
    cancel: 'Annullato'
  };

  const recentOrders: DetailedOrder[] = currentYearOrders
    ?.slice(0, 10)
    .map((order: any) => ({
      id: order.id,
      name: order.name,
      date_order: order.date_order,
      amount_total: order.amount_total,
      state: order.state,
      state_label: stateLabels[order.state] || order.state
    })) || [];

  return {
    avg_comparison: {
      current_avg: currentAvg,
      historical_avg: historicalAvg,
      percentage_diff: percentageDiff
    },
    recent_orders_for_avg: recentOrders
  };
}

/**
 * Fetch credit details - Usage and limits
 */
async function fetchCreditDetails(partner: any) {
  const creditLimit = partner.credit_limit || 0;
  const usedCredit = partner.credit || 0;
  const availableCredit = Math.max(0, creditLimit - usedCredit);
  const usagePercentage = creditLimit > 0 ? (usedCredit / creditLimit) * 100 : 0;

  return {
    credit_info: {
      total_limit: creditLimit,
      used_credit: usedCredit,
      available_credit: availableCredit,
      usage_percentage: usagePercentage
    }
  };
}

/**
 * Fetch overdue invoices or recent invoices if none overdue
 */
async function fetchOverdueDetails(partnerId: number) {
  // All open invoices
  const openInvoices = await callOdooAsAdmin(
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
      order: 'invoice_date_due asc',
      limit: 20
    }
  );

  const today = new Date();

  const overdueInvoices: DetailedInvoice[] = [];
  const allRecentInvoices: DetailedInvoice[] = [];

  openInvoices?.forEach((invoice: any) => {
    const dueDate = invoice.invoice_date_due ? new Date(invoice.invoice_date_due) : null;
    const isOverdue = dueDate ? dueDate < today : false;
    const daysOverdue = isOverdue && dueDate
      ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const formattedInvoice: DetailedInvoice = {
      id: invoice.id,
      name: invoice.name,
      invoice_date: invoice.invoice_date,
      invoice_date_due: invoice.invoice_date_due || '',
      amount_total: invoice.amount_total,
      amount_residual: invoice.amount_residual,
      is_overdue: isOverdue,
      days_overdue: daysOverdue
    };

    if (isOverdue) {
      overdueInvoices.push(formattedInvoice);
    }

    allRecentInvoices.push(formattedInvoice);
  });

  return {
    invoices: overdueInvoices,
    all_recent_invoices: allRecentInvoices.slice(0, 10)
  };
}
