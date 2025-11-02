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
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
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
  delivery_address?: string;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
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
    currency: string;
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

    // 2. Get partner_id for the logged-in user using ADMIN session
    console.log('🔍 [DASHBOARD-API] Fetching partner_id for user with admin session...');

    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name', 'property_product_pricelist', 'credit_limit', 'credit'],
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

    // Get currency from pricelist
    let currency = 'CHF'; // Default to CHF
    if (partner.property_product_pricelist && partner.property_product_pricelist[0]) {
      const pricelistId = partner.property_product_pricelist[0];
      const pricelists = await callOdooAsAdmin(
        'product.pricelist',
        'search_read',
        [],
        {
          domain: [['id', '=', pricelistId]],
          fields: ['currency_id'],
          limit: 1
        }
      );

      if (pricelists && pricelists.length > 0 && pricelists[0].currency_id) {
        const currencyName = pricelists[0].currency_id[1]; // [id, 'CHF'] or [id, 'EUR']
        // Extract currency code (CHF, EUR, etc.)
        const match = currencyName.match(/\b([A-Z]{3})\b/);
        if (match) {
          currency = match[1];
        }
      }
    }

    console.log('✅ [DASHBOARD-API] Partner found:', {
      id: partnerId,
      name: partner.name,
      currency: currency
    });

    // 4. Fetch dashboard data in parallel
    console.log('📡 [DASHBOARD-API] Fetching dashboard data from Odoo...');

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const today = new Date().toISOString().split('T')[0];

    const [
      allOrders,
      allInvoicesYTD,
      recentOrders,
      activeDeliveries,
      openInvoices
    ] = await Promise.all([
      // All confirmed orders for order count
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
          fields: ['amount_total', 'date_order'],
          order: 'date_order desc'
        }
      ),

      // All invoices YTD for revenue calculation
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
          fields: ['amount_total', 'invoice_date'],
          order: 'invoice_date desc'
        }
      ),

      // Recent 5 orders
      callOdooAsAdmin(
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
      callOdooAsAdmin(
        'stock.picking',
        'search_read',
        [],
        {
          domain: [
            ['partner_id', '=', partnerId],
            ['state', 'in', ['assigned', 'confirmed', 'waiting']],
            ['picking_type_code', '=', 'outgoing']
          ],
          fields: [
            'name',
            'scheduled_date',
            'origin',
            'state',
            'location_dest_id',
            'partner_id', // Partner info for address
            'x_studio_driver', // Custom field: driver name
            'x_studio_driver_phone', // Custom field: driver phone
            'x_studio_vehicle_plate' // Custom field: vehicle plate
          ],
          order: 'scheduled_date asc',
          limit: 10
        }
      ),

      // Open invoices
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
          fields: ['name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual', 'state', 'payment_state'],
          order: 'invoice_date desc',
          limit: 10
        }
      )
    ]);

    console.log('✅ [DASHBOARD-API] Data fetched successfully:', {
      allOrders: allOrders?.length || 0,
      allInvoicesYTD: allInvoicesYTD?.length || 0,
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

    // Calculate revenue YTD from INVOICES (not orders)
    const revenueYTD = allInvoicesYTD?.reduce((sum: number, invoice: any) => sum + (invoice.amount_total || 0), 0) || 0;

    // Average order based on ORDERS (not invoices)
    const totalOrdersAmount = allOrders?.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0) || 0;
    const avgOrder = allOrders && allOrders.length > 0 ? totalOrdersAmount / allOrders.length : 0;

    // Calculate overdue invoices
    const overdueInvoices = openInvoices?.filter((inv: any) => {
      if (!inv.invoice_date_due) return false;
      const dueDate = new Date(inv.invoice_date_due);
      return dueDate < new Date();
    }) || [];

    const overdueAmount = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_residual || 0), 0);

    // Calculate credit KPIs from partner data
    const creditLimit = partner.credit_limit || 0;
    const creditUsed = partner.credit || 0;
    const creditAvailable = Math.max(0, creditLimit - creditUsed);

    const kpis: DashboardKPIs = {
      orders_count: ordersThisMonth.length,
      revenue_ytd: revenueYTD,
      avg_order: avgOrder,
      credit_limit: creditLimit,
      credit_available: creditAvailable,
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

    // Format deliveries with additional tracking info
    const formattedDeliveries: ActiveDelivery[] = await Promise.all(
      (activeDeliveries || []).map(async (delivery: any) => {
        // Get partner address details
        let deliveryAddress = 'N/A';
        if (delivery.partner_id && delivery.partner_id[0]) {
          const partnerDetails = await callOdooAsAdmin(
            'res.partner',
            'search_read',
            [],
            {
              domain: [['id', '=', delivery.partner_id[0]]],
              fields: ['street', 'street2', 'zip', 'city', 'state_id', 'country_id'],
              limit: 1
            }
          );

          if (partnerDetails && partnerDetails.length > 0) {
            const addr = partnerDetails[0];
            const parts = [
              addr.street,
              addr.street2,
              [addr.zip, addr.city].filter(Boolean).join(' '),
              addr.state_id?.[1],
              addr.country_id?.[1]
            ].filter(Boolean);
            deliveryAddress = parts.join(', ');
          }
        }

        return {
          id: delivery.id,
          name: delivery.name,
          scheduled_date: delivery.scheduled_date,
          origin: delivery.origin || 'N/A',
          state: delivery.state,
          state_label: stateLabels[delivery.state] || delivery.state,
          location_dest: delivery.location_dest_id?.[1] || 'N/A',
          delivery_address: deliveryAddress,
          driver_name: delivery.x_studio_driver || undefined,
          driver_phone: delivery.x_studio_driver_phone || undefined,
          vehicle_plate: delivery.x_studio_vehicle_plate || undefined
        };
      })
    );

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
        currency: currency, // Add currency to response
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
