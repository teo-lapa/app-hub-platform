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
 * API: Trova prodotti ricorsivi persi
 *
 * Un prodotto è "ricorsivo" per un cliente se lo ha comprato per 3 settimane consecutive.
 * Un prodotto ricorsivo è "perso" se il cliente non lo compra più nelle ultime 2 settimane.
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
    const currentWeek = getISOWeek(new Date());

    // Analyze last 6 weeks (4 historical + 2 recent)
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

    const orders = await rpc.searchRead(
      'sale.order',
      [['id', 'in', orderIds]],
      ['id', 'name', 'effective_date', 'partner_id'],
      0
    );

    const ordersMap: any = {};
    orders.forEach((o: any) => {
      ordersMap[o.id] = o;
    });

    // Structure: productId -> customerId -> weekNumber -> { qty, revenue }
    const purchaseData: Map<number, Map<number, Map<number, { qty: number; revenue: number }>>> = new Map();
    const productNames: Map<number, string> = new Map();
    const customerNames: Map<number, string> = new Map();

    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      const order = ordersMap[orderId];
      if (!order || !order.effective_date) return;

      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const customerId = order.partner_id[0];
      const customerName = order.partner_id[1];
      const weekNumber = getISOWeek(new Date(order.effective_date));

      productNames.set(productId, productName);
      customerNames.set(customerId, customerName);

      if (!purchaseData.has(productId)) {
        purchaseData.set(productId, new Map());
      }
      const productCustomers = purchaseData.get(productId)!;

      if (!productCustomers.has(customerId)) {
        productCustomers.set(customerId, new Map());
      }
      const customerWeeks = productCustomers.get(customerId)!;

      if (!customerWeeks.has(weekNumber)) {
        customerWeeks.set(weekNumber, { qty: 0, revenue: 0 });
      }
      const weekData = customerWeeks.get(weekNumber)!;
      weekData.qty += line.product_uom_qty;
      weekData.revenue += line.price_subtotal;
    });

    // Find recurring products that are now lost
    // Recurring = bought 3 consecutive weeks in historical period
    // Lost = not bought in recent 2 weeks
    const recentWeeks = [currentWeek, currentWeek - 1];
    const historicalWeeks = [currentWeek - 2, currentWeek - 3, currentWeek - 4, currentWeek - 5];

    interface LostProduct {
      productId: number;
      productName: string;
      customerId: number;
      customerName: string;
      consecutiveWeeks: number[];
      avgQtyPerWeek: number;
      avgRevenuePerWeek: number;
      estimatedLoss: number;
    }

    const lostProducts: LostProduct[] = [];

    purchaseData.forEach((customerMap, productId) => {
      customerMap.forEach((weekMap, customerId) => {
        // Check if customer bought in recent weeks
        const boughtRecently = recentWeeks.some(w => weekMap.has(w));

        if (!boughtRecently) {
          // Find consecutive weeks in historical period
          const consecutiveWeeks: number[] = [];
          let totalQty = 0;
          let totalRevenue = 0;

          // Check for 3+ consecutive weeks
          for (let i = 0; i < historicalWeeks.length - 2; i++) {
            const week1 = historicalWeeks[i];
            const week2 = historicalWeeks[i + 1];
            const week3 = historicalWeeks[i + 2];

            if (weekMap.has(week1) && weekMap.has(week2) && weekMap.has(week3)) {
              // Found 3 consecutive weeks
              [week1, week2, week3].forEach(w => {
                if (!consecutiveWeeks.includes(w)) {
                  consecutiveWeeks.push(w);
                  const data = weekMap.get(w)!;
                  totalQty += data.qty;
                  totalRevenue += data.revenue;
                }
              });

              // Check if week before also exists (4 consecutive)
              if (i > 0 && weekMap.has(historicalWeeks[i - 1])) {
                const w = historicalWeeks[i - 1];
                if (!consecutiveWeeks.includes(w)) {
                  consecutiveWeeks.push(w);
                  const data = weekMap.get(w)!;
                  totalQty += data.qty;
                  totalRevenue += data.revenue;
                }
              }
            }
          }

          if (consecutiveWeeks.length >= 3) {
            const avgQtyPerWeek = totalQty / consecutiveWeeks.length;
            const avgRevenuePerWeek = totalRevenue / consecutiveWeeks.length;

            lostProducts.push({
              productId,
              productName: productNames.get(productId) || 'Unknown',
              customerId,
              customerName: customerNames.get(customerId) || 'Unknown',
              consecutiveWeeks: consecutiveWeeks.sort((a, b) => a - b),
              avgQtyPerWeek: Math.round(avgQtyPerWeek * 10) / 10,
              avgRevenuePerWeek: Math.round(avgRevenuePerWeek * 100) / 100,
              estimatedLoss: Math.round(avgRevenuePerWeek * 2 * 100) / 100 // 2 weeks of lost revenue
            });
          }
        }
      });
    });

    // Sort by estimated loss (highest first)
    lostProducts.sort((a, b) => b.estimatedLoss - a.estimatedLoss);

    // Group by customer for display
    const byCustomer: Map<number, {
      customerId: number;
      customerName: string;
      products: LostProduct[];
      totalLoss: number;
    }> = new Map();

    lostProducts.forEach(lp => {
      if (!byCustomer.has(lp.customerId)) {
        byCustomer.set(lp.customerId, {
          customerId: lp.customerId,
          customerName: lp.customerName,
          products: [],
          totalLoss: 0
        });
      }
      const customer = byCustomer.get(lp.customerId)!;
      customer.products.push(lp);
      customer.totalLoss += lp.estimatedLoss;
    });

    // Convert to array and sort by total loss
    const customersList = Array.from(byCustomer.values())
      .map(c => ({
        ...c,
        totalLoss: Math.round(c.totalLoss * 100) / 100
      }))
      .sort((a, b) => b.totalLoss - a.totalLoss);

    // Calculate summary stats
    const totalCustomersAffected = customersList.length;
    const totalProductsLost = lostProducts.length;
    const totalEstimatedLoss = Math.round(lostProducts.reduce((sum, lp) => sum + lp.estimatedLoss, 0) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCustomersAffected,
          totalProductsLost,
          totalEstimatedLoss,
          currentWeek,
          recentWeeks,
          historicalWeeks
        },
        customers: customersList.slice(0, 50), // Top 50 customers
        allProducts: lostProducts.slice(0, 100) // Top 100 product-customer pairs
      }
    });

  } catch (error: any) {
    console.error('Error in recurring-products-lost API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
