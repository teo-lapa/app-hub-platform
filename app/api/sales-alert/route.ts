import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * Helper: Calcola numero settimana ISO 8601
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Helper: Get year-week key for cross-year comparisons
 */
function getYearWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Status types for customers and products
 */
type AlertStatus = 'critical' | 'warning' | 'ok';

/**
 * Customer alert data structure
 */
interface CustomerAlert {
  customerId: number;
  customerName: string;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  salesPersonId: number | null;
  salesPersonName: string | null;
  status: AlertStatus;
  historicalRevenue: number;
  recentRevenue: number;
  revenueChange: number;
  revenueChangePercent: number;
  daysSinceLastOrder: number;
  lastOrderDate: string | null;
  lostProducts: {
    productId: number;
    productName: string;
    lastPurchasedWeek: string;
    avgQtyPerWeek: number;
    avgRevenuePerWeek: number;
  }[];
}

/**
 * Product alert data structure
 */
interface ProductAlert {
  productId: number;
  productName: string;
  status: AlertStatus;
  historicalQty: number;
  recentQty: number;
  qtyChange: number;
  qtyChangePercent: number;
  historicalCustomerCount: number;
  recentCustomerCount: number;
  customerLoss: number;
  historicalRevenue: number;
  recentRevenue: number;
}

/**
 * API: Sales Alert Analysis
 *
 * Analyzes last 6 weeks of orders to identify:
 * 1. Customers at risk (declining or lost)
 * 2. Products in decline
 * 3. Summary statistics
 *
 * Historical period: W-6 to W-3 (4 weeks)
 * Recent period: W-2 to W0 (3 weeks, including current)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const rpc = createOdooRPCClient(sessionId);
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = now.getFullYear();

    // Calculate date 6 weeks ago
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const dateFrom = sixWeeksAgo.toISOString().split('T')[0];

    // Get all order lines from last 6 weeks
    const orderLines = await rpc.searchRead(
      'sale.order.line',
      [
        ['order_id.effective_date', '>=', dateFrom],
        ['order_id.state', 'in', ['sale', 'done']]
      ],
      ['order_id', 'product_id', 'product_uom_qty', 'price_subtotal'],
      0
    );

    // Get orders to map dates and customers
    const orderIdsSet = new Set(orderLines.map((line: any) => line.order_id[0]));
    const orderIds = Array.from(orderIdsSet);

    if (orderIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            customersAtRisk: { critical: 0, warning: 0, ok: 0 },
            productsAtRisk: { critical: 0, warning: 0, ok: 0 },
            totalRevenueAtRisk: 0,
            currentWeek,
            dateRange: { from: dateFrom, to: now.toISOString().split('T')[0] }
          },
          customers: [],
          products: []
        }
      });
    }

    const orders = await rpc.searchRead(
      'sale.order',
      [['id', 'in', orderIds]],
      ['id', 'name', 'effective_date', 'partner_id'],
      0
    );

    const ordersMap: Record<number, any> = {};
    orders.forEach((o: any) => {
      ordersMap[o.id] = o;
    });

    // Get unique partner IDs to fetch phone numbers
    const partnerIdsSet = new Set<number>();
    orders.forEach((o: any) => {
      if (o.partner_id) partnerIdsSet.add(o.partner_id[0]);
    });
    const partnerIds = Array.from(partnerIdsSet);

    // Fetch partner details including phone
    const partners = await rpc.searchRead(
      'res.partner',
      [['id', 'in', partnerIds]],
      ['id', 'name', 'phone', 'mobile', 'email', 'user_id'],
      0
    );

    const partnersMap: Record<number, any> = {};
    partners.forEach((p: any) => {
      partnersMap[p.id] = p;
    });

    // Define week ranges
    // Recent: W0 (current), W-1, W-2 (3 weeks)
    // Historical: W-3, W-4, W-5, W-6 (4 weeks)
    const recentWeekKeys: string[] = [];
    const historicalWeekKeys: string[] = [];

    for (let i = 0; i <= 2; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      recentWeekKeys.push(getYearWeekKey(d));
    }

    for (let i = 3; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      historicalWeekKeys.push(getYearWeekKey(d));
    }

    // Data structures for analysis
    // Customer -> { weekKey -> { revenue, products: Set, orderDates } }
    const customerData: Map<number, {
      name: string;
      weeks: Map<string, { revenue: number; products: Set<number>; lastOrderDate: Date }>;
    }> = new Map();

    // Product -> { weekKey -> { qty, revenue, customers: Set } }
    const productData: Map<number, {
      name: string;
      weeks: Map<string, { qty: number; revenue: number; customers: Set<number> }>;
    }> = new Map();

    // Customer -> Product -> { weekKey -> { qty, revenue } }
    const customerProductData: Map<number, Map<number, Map<string, { qty: number; revenue: number }>>> = new Map();

    // Track last order date per customer
    const customerLastOrder: Map<number, Date> = new Map();

    // Process all order lines
    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      const order = ordersMap[orderId];
      if (!order || !order.effective_date) return;

      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const customerId = order.partner_id[0];
      const customerName = order.partner_id[1];
      const orderDate = new Date(order.effective_date);
      const weekKey = getYearWeekKey(orderDate);
      const qty = line.product_uom_qty;
      const revenue = line.price_subtotal;

      // Update customer data
      if (!customerData.has(customerId)) {
        customerData.set(customerId, { name: customerName, weeks: new Map() });
      }
      const customer = customerData.get(customerId)!;
      if (!customer.weeks.has(weekKey)) {
        customer.weeks.set(weekKey, { revenue: 0, products: new Set(), lastOrderDate: orderDate });
      }
      const customerWeek = customer.weeks.get(weekKey)!;
      customerWeek.revenue += revenue;
      customerWeek.products.add(productId);
      if (orderDate > customerWeek.lastOrderDate) {
        customerWeek.lastOrderDate = orderDate;
      }

      // Update customer last order date
      const existingLastOrder = customerLastOrder.get(customerId);
      if (!existingLastOrder || orderDate > existingLastOrder) {
        customerLastOrder.set(customerId, orderDate);
      }

      // Update product data
      if (!productData.has(productId)) {
        productData.set(productId, { name: productName, weeks: new Map() });
      }
      const product = productData.get(productId)!;
      if (!product.weeks.has(weekKey)) {
        product.weeks.set(weekKey, { qty: 0, revenue: 0, customers: new Set() });
      }
      const productWeek = product.weeks.get(weekKey)!;
      productWeek.qty += qty;
      productWeek.revenue += revenue;
      productWeek.customers.add(customerId);

      // Update customer-product data
      if (!customerProductData.has(customerId)) {
        customerProductData.set(customerId, new Map());
      }
      const custProducts = customerProductData.get(customerId)!;
      if (!custProducts.has(productId)) {
        custProducts.set(productId, new Map());
      }
      const prodWeeks = custProducts.get(productId)!;
      if (!prodWeeks.has(weekKey)) {
        prodWeeks.set(weekKey, { qty: 0, revenue: 0 });
      }
      const prodWeekData = prodWeeks.get(weekKey)!;
      prodWeekData.qty += qty;
      prodWeekData.revenue += revenue;
    });

    // Analyze customers
    const customerAlerts: CustomerAlert[] = [];

    customerData.forEach((data, customerId) => {
      // Calculate historical revenue (W-6 to W-3)
      let historicalRevenue = 0;
      const historicalProducts: Set<number> = new Set();
      historicalWeekKeys.forEach(wk => {
        const week = data.weeks.get(wk);
        if (week) {
          historicalRevenue += week.revenue;
          week.products.forEach(p => historicalProducts.add(p));
        }
      });

      // Calculate recent revenue (W-2 to W0)
      let recentRevenue = 0;
      const recentProducts: Set<number> = new Set();
      recentWeekKeys.forEach(wk => {
        const week = data.weeks.get(wk);
        if (week) {
          recentRevenue += week.revenue;
          week.products.forEach(p => recentProducts.add(p));
        }
      });

      // Skip customers with no historical data (new customers)
      if (historicalRevenue === 0) return;

      // Normalize to weekly average for fair comparison
      const historicalWeeklyAvg = historicalRevenue / historicalWeekKeys.length;
      const recentWeeklyAvg = recentRevenue / recentWeekKeys.length;

      const revenueChange = recentWeeklyAvg - historicalWeeklyAvg;
      const revenueChangePercent = historicalWeeklyAvg > 0
        ? (revenueChange / historicalWeeklyAvg) * 100
        : 0;

      // Determine status
      let status: AlertStatus = 'ok';
      if (revenueChangePercent <= -35) {
        status = 'critical';
      } else if (revenueChangePercent <= -15) {
        status = 'warning';
      }

      // Find lost products (bought historically, not recently)
      const lostProducts: CustomerAlert['lostProducts'] = [];
      const custProdData = customerProductData.get(customerId);

      if (custProdData) {
        historicalProducts.forEach(productId => {
          if (!recentProducts.has(productId)) {
            const prodData = custProdData.get(productId);
            if (prodData) {
              let totalQty = 0;
              let totalRevenue = 0;
              let weekCount = 0;
              let lastWeek = '';

              historicalWeekKeys.forEach(wk => {
                const weekData = prodData.get(wk);
                if (weekData) {
                  totalQty += weekData.qty;
                  totalRevenue += weekData.revenue;
                  weekCount++;
                  if (!lastWeek || wk > lastWeek) lastWeek = wk;
                }
              });

              if (weekCount > 0) {
                lostProducts.push({
                  productId,
                  productName: productData.get(productId)?.name || 'Unknown',
                  lastPurchasedWeek: lastWeek,
                  avgQtyPerWeek: Math.round((totalQty / weekCount) * 10) / 10,
                  avgRevenuePerWeek: Math.round((totalRevenue / weekCount) * 100) / 100
                });
              }
            }
          }
        });
      }

      // Sort lost products by revenue
      lostProducts.sort((a, b) => b.avgRevenuePerWeek - a.avgRevenuePerWeek);

      // Calculate days since last order
      const lastOrderDate = customerLastOrder.get(customerId);
      const daysSinceLastOrder = lastOrderDate
        ? Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        : -1;

      // Get partner contact info
      const partner = partnersMap[customerId];
      const phone = partner?.phone || null;
      const mobile = partner?.mobile || null;
      const email = partner?.email || null;
      const salesPersonId = partner?.user_id ? partner.user_id[0] : null;
      const salesPersonName = partner?.user_id ? partner.user_id[1] : null;

      customerAlerts.push({
        customerId,
        customerName: data.name,
        phone,
        mobile,
        email,
        salesPersonId,
        salesPersonName,
        status,
        historicalRevenue: Math.round(historicalRevenue * 100) / 100,
        recentRevenue: Math.round(recentRevenue * 100) / 100,
        revenueChange: Math.round(revenueChange * 100) / 100,
        revenueChangePercent: Math.round(revenueChangePercent * 10) / 10,
        daysSinceLastOrder,
        lastOrderDate: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : null,
        lostProducts: lostProducts.slice(0, 10) // Top 10 lost products
      });
    });

    // Analyze products
    const productAlerts: ProductAlert[] = [];

    productData.forEach((data, productId) => {
      // Calculate historical stats (W-6 to W-3)
      let historicalQty = 0;
      let historicalRevenue = 0;
      const historicalCustomers: Set<number> = new Set();
      historicalWeekKeys.forEach(wk => {
        const week = data.weeks.get(wk);
        if (week) {
          historicalQty += week.qty;
          historicalRevenue += week.revenue;
          week.customers.forEach(c => historicalCustomers.add(c));
        }
      });

      // Calculate recent stats (W-2 to W0)
      let recentQty = 0;
      let recentRevenue = 0;
      const recentCustomers: Set<number> = new Set();
      recentWeekKeys.forEach(wk => {
        const week = data.weeks.get(wk);
        if (week) {
          recentQty += week.qty;
          recentRevenue += week.revenue;
          week.customers.forEach(c => recentCustomers.add(c));
        }
      });

      // Skip products with no historical data
      if (historicalQty === 0) return;

      // Normalize to weekly average for fair comparison
      const historicalWeeklyQty = historicalQty / historicalWeekKeys.length;
      const recentWeeklyQty = recentQty / recentWeekKeys.length;

      const qtyChange = recentWeeklyQty - historicalWeeklyQty;
      const qtyChangePercent = historicalWeeklyQty > 0
        ? (qtyChange / historicalWeeklyQty) * 100
        : 0;

      // Determine status
      let status: AlertStatus = 'ok';
      if (qtyChangePercent <= -35) {
        status = 'critical';
      } else if (qtyChangePercent <= -15) {
        status = 'warning';
      }

      productAlerts.push({
        productId,
        productName: data.name,
        status,
        historicalQty: Math.round(historicalQty * 10) / 10,
        recentQty: Math.round(recentQty * 10) / 10,
        qtyChange: Math.round(qtyChange * 10) / 10,
        qtyChangePercent: Math.round(qtyChangePercent * 10) / 10,
        historicalCustomerCount: historicalCustomers.size,
        recentCustomerCount: recentCustomers.size,
        customerLoss: historicalCustomers.size - recentCustomers.size,
        historicalRevenue: Math.round(historicalRevenue * 100) / 100,
        recentRevenue: Math.round(recentRevenue * 100) / 100
      });
    });

    // Sort customers: critical first, then by absolute revenue loss
    customerAlerts.sort((a, b) => {
      const statusOrder = { critical: 0, warning: 1, ok: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // Within same status, sort by revenue loss (most negative first)
      return a.revenueChange - b.revenueChange;
    });

    // Sort products: critical first, then by qty loss
    productAlerts.sort((a, b) => {
      const statusOrder = { critical: 0, warning: 1, ok: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.qtyChangePercent - b.qtyChangePercent;
    });

    // Calculate summary counts - use filter().length for guaranteed consistency
    // This ensures the counts ALWAYS match the actual customers in the response array
    const verifiedCustomerCounts = {
      critical: customerAlerts.filter(c => c.status === 'critical').length,
      warning: customerAlerts.filter(c => c.status === 'warning').length,
      ok: customerAlerts.filter(c => c.status === 'ok').length
    };

    const verifiedProductCounts = {
      critical: productAlerts.filter(p => p.status === 'critical').length,
      warning: productAlerts.filter(p => p.status === 'warning').length,
      ok: productAlerts.filter(p => p.status === 'ok').length
    };

    // Calculate total revenue at risk (from critical and warning customers)
    const totalRevenueAtRisk = customerAlerts
      .filter(c => c.status === 'critical' || c.status === 'warning')
      .reduce((sum, c) => sum + Math.abs(c.revenueChange), 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          customersAtRisk: verifiedCustomerCounts,
          productsAtRisk: verifiedProductCounts,
          totalRevenueAtRisk: Math.round(totalRevenueAtRisk * 100) / 100,
          currentWeek,
          currentYear,
          dateRange: {
            from: dateFrom,
            to: now.toISOString().split('T')[0]
          },
          periods: {
            historical: historicalWeekKeys,
            recent: recentWeekKeys
          }
        },
        customers: customerAlerts, // All customers (summary counts match)
        products: productAlerts // All products
      }
    });

  } catch (error: any) {
    console.error('Error in sales-alert API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
