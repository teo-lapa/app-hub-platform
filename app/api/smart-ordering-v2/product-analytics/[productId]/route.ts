import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * Helper: Calcola numero settimana ISO 8601
 * Returns real week number (1-53)
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

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const productId = parseInt(params.productId);

  try {
    // Get session from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    // Create RPC client
    const rpc = createOdooRPCClient(sessionId);

    // Load product details REAL-TIME
    const products = await rpc.searchRead(
      'product.product',
      [['id', '=', productId]],
      ['id', 'name', 'default_code', 'qty_available', 'list_price', 'product_tmpl_id'],
      1
    );

    if (!products || products.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const product = products[0];

    // Calculate date range (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFrom = threeMonthsAgo.toISOString().split('T')[0];

    // Get order lines for this product from last 3 months (REAL-TIME)
    const orderLines = await rpc.searchRead(
      'sale.order.line',
      [
        ['product_id', '=', productId],
        ['order_id.effective_date', '>=', dateFrom],
        ['order_id.state', 'in', ['sale', 'done']]
      ],
      ['order_id', 'product_uom_qty', 'price_subtotal'],
      0
    );

    // Get unique order IDs
    const orderIdsSet = new Set(orderLines.map((line: any) => line.order_id[0]));
    const orderIds = Array.from(orderIdsSet);

    // Load orders to get dates and customers
    const orders = await rpc.searchRead(
      'sale.order',
      [['id', 'in', orderIds]],
      ['id', 'name', 'effective_date', 'partner_id'],
      0
    );

    // Build orders map for fast lookup
    const ordersMap: any = {};
    orders.forEach((o: any) => {
      ordersMap[o.id] = o;
    });

    // Group by week for chart
    const weeklyData: any = {};
    const customerData: any = {};

    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      const order = ordersMap[orderId];
      if (!order || !order.effective_date) return;

      const date = new Date(order.effective_date);

      // ✅ FIXED: Usa numero settimana ISO reale
      const weekNumber = getISOWeek(date);
      const weekKey = `Settimana ${weekNumber}`;

      // Weekly sales
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { qty: 0, revenue: 0, weekNum: weekNumber };
      }
      weeklyData[weekKey].qty += line.product_uom_qty;
      weeklyData[weekKey].revenue += line.price_subtotal;

      // Customer data
      const customerId = order.partner_id[0];
      const customerName = order.partner_id[1];
      if (!customerData[customerId]) {
        customerData[customerId] = {
          id: customerId,
          name: customerName,
          qty: 0,
          revenue: 0,
          orders: 0
        };
      }
      customerData[customerId].qty += line.product_uom_qty;
      customerData[customerId].revenue += line.price_subtotal;
      customerData[customerId].orders += 1;
    });

    // Calculate avg daily sales from real data
    const totalSold = orderLines.reduce((sum: number, line: any) => sum + (line.product_uom_qty || 0), 0);
    const avgDailySales = totalSold / 90; // 3 months = ~90 days
    const totalRevenue = orderLines.reduce((sum: number, line: any) => sum + (line.price_subtotal || 0), 0);
    const avgPrice = totalSold > 0 ? totalRevenue / totalSold : product.list_price;

    // Get stock locations (stock.quant) - SOLO ubicazioni interne magazzino
    const stockLocations = await rpc.searchRead(
      'stock.quant',
      [
        ['product_id', '=', productId],
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal']  // SOLO ubicazioni interne
      ],
      ['location_id', 'quantity', 'reserved_quantity'],
      100
    );

    // Get incoming quantity (purchase orders not yet received)
    // SOLO ordini confermati ('purchase'), NON chiusi ('done')
    let incomingQty = 0;
    let incomingDate: string | null = null;
    try {
      const purchaseLines = await rpc.searchRead(
        'purchase.order.line',
        [
          ['product_id', '=', productId],
          ['order_id.state', '=', 'purchase']  // ✅ SOLO ordini confermati aperti
        ],
        ['product_qty', 'qty_received', 'date_planned', 'order_id'],
        500
      );

      // Find earliest delivery date among lines with pending qty
      let earliestDate: Date | null = null;

      purchaseLines.forEach((line: any) => {
        const notYetReceived = (line.product_qty || 0) - (line.qty_received || 0);
        if (notYetReceived > 0) {
          incomingQty += notYetReceived;

          // Track earliest delivery date
          if (line.date_planned) {
            const lineDate = new Date(line.date_planned);
            if (!earliestDate || lineDate < earliestDate) {
              earliestDate = lineDate;
            }
          }
        }
      });

      // Format date for display
      if (earliestDate) {
        incomingDate = (earliestDate as Date).toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('⚠️ Errore caricamento ordini in arrivo:', error);
    }

    // Get suppliers from product template (REAL-TIME)
    const productTemplateId = product.product_tmpl_id ? product.product_tmpl_id[0] : null;
    let suppliersList: any[] = [];

    if (productTemplateId) {
      const today = new Date().toISOString().split('T')[0];

      // 1. Get configured suppliers
      const suppliers = await rpc.searchRead(
        'product.supplierinfo',
        [
          ['product_tmpl_id', '=', productTemplateId],
          '|',
          ['date_end', '=', false],
          ['date_end', '>=', today]
        ],
        ['partner_id', 'delay', 'min_qty', 'price'],
        10,
        'sequence, min_qty'
      );

      // 2. Get REAL purchase history to find main supplier
      const purchaseHistory = await rpc.searchRead(
        'purchase.order.line',
        [
          ['product_id', '=', productId],
          ['order_id.state', 'in', ['purchase', 'done']]
        ],
        ['order_id', 'product_qty', 'price_unit', 'date_planned'],
        500
      );

      // 3. Get purchase order details to get supplier
      const poIdsSet = new Set(purchaseHistory.map((line: any) => line.order_id[0]));
      const poIds = Array.from(poIdsSet);
      const purchaseOrders = await rpc.searchRead(
        'purchase.order',
        [['id', 'in', poIds]],
        ['id', 'partner_id', 'date_order'],
        0
      );

      const poMap: any = {};
      purchaseOrders.forEach((po: any) => {
        poMap[po.id] = po;
      });

      // 4. Calculate purchase stats per supplier
      const supplierStats: any = {};

      purchaseHistory.forEach((line: any) => {
        const po = poMap[line.order_id[0]];
        if (!po || !po.partner_id) return;

        const supplierId = po.partner_id[0];
        const supplierName = po.partner_id[1];

        if (!supplierStats[supplierId]) {
          supplierStats[supplierId] = {
            id: supplierId,
            name: supplierName,
            orderCount: 0,
            totalQty: 0,
            lastOrderDate: null
          };
        }

        supplierStats[supplierId].orderCount += 1;
        supplierStats[supplierId].totalQty += line.product_qty || 0;

        if (!supplierStats[supplierId].lastOrderDate || po.date_order > supplierStats[supplierId].lastOrderDate) {
          supplierStats[supplierId].lastOrderDate = po.date_order;
        }
      });

      // 5. Merge configured suppliers with real stats
      const suppliersMap: any = {};

      // Add configured suppliers
      suppliers.forEach((s: any) => {
        const supplierId = s.partner_id[0];
        suppliersMap[supplierId] = {
          id: supplierId,
          name: s.partner_id[1],
          leadTime: s.delay || 0,
          minQty: s.min_qty || 0,
          price: s.price || 0,
          orderCount: 0,
          totalQty: 0,
          lastOrderDate: null
        };
      });

      // Merge with real stats
      Object.values(supplierStats).forEach((stat: any) => {
        if (suppliersMap[stat.id]) {
          suppliersMap[stat.id].orderCount = stat.orderCount;
          suppliersMap[stat.id].totalQty = stat.totalQty;
          suppliersMap[stat.id].lastOrderDate = stat.lastOrderDate;
        } else {
          // Supplier has purchase history but not configured
          suppliersMap[stat.id] = {
            id: stat.id,
            name: stat.name,
            leadTime: 0,
            minQty: 0,
            price: 0,
            orderCount: stat.orderCount,
            totalQty: stat.totalQty,
            lastOrderDate: stat.lastOrderDate
          };
        }
      });

      // 6. Sort by order count (main supplier first)
      suppliersList = Object.values(suppliersMap)
        .sort((a: any, b: any) => b.orderCount - a.orderCount)
        .map((s: any, index: number) => ({
          name: s.name,
          leadTime: s.leadTime,
          minQty: s.minQty,
          price: s.price,
          orderCount: s.orderCount,
          totalQty: s.totalQty,
          isMain: index === 0 && s.orderCount > 0  // ⭐ Principale se ha ordini
        }));
    }

    // Format weekly chart data - ordina per numero settimana
    const weeklyChart = Object.entries(weeklyData)
      .sort(([, a]: [string, any], [, b]: [string, any]) => a.weekNum - b.weekNum)
      .map(([week, data]: [string, any]) => ({
        week,
        qty: data.qty,
        revenue: data.revenue
      }));

    // Top customers
    const topCustomers = Object.values(customerData)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10);

    // Format locations
    const locations = stockLocations.map((loc: any) => ({
      name: loc.location_id[1],
      qty: loc.quantity,
      reserved: loc.reserved_quantity,
      available: loc.quantity - loc.reserved_quantity,
      incoming: incomingQty  // Add incoming to each location for now
    }));

    return NextResponse.json({
      success: true,
      analytics: {
        product: {
          id: product.id,
          name: product.name,
          currentStock: product.qty_available || 0,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          totalSold3Months: Math.round(totalSold),
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          avgPrice: Math.round(avgPrice * 100) / 100,
          incomingQty: incomingQty,
          incomingDate: incomingDate
        },
        weeklyChart,
        topCustomers,
        locations,
        suppliers: suppliersList,
        totalOrders: orderLines.length
      }
    });

  } catch (error: any) {
    console.error('❌ Errore API product-analytics:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
