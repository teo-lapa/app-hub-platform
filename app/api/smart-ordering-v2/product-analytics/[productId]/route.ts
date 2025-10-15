import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  const productId = parseInt(params.productId);

  try {
    // Import Odoo helper
    const { callOdoo } = await import('@/lib/odoo/odoo-helper');

    // Get real analysis data
    const fs = await import('fs');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), 'lib', 'smart-ordering', 'real-analysis-data.json');
    const analysisData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Find product in analysis
    const product = analysisData.products.find((p: any) => p.id === productId);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' });
    }

    // Calculate date range (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFrom = threeMonthsAgo.toISOString().split('T')[0];

    // Get confirmed orders first
    const orders = await callOdoo('sale.order', 'search_read', [], {
      domain: [
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', dateFrom]
      ],
      fields: ['name', 'date_order', 'partner_id'],
      limit: 5000
    });

    const orderIds = orders.map((o: any) => o.id);

    // Build orders map for fast lookup
    const ordersMap: any = {};
    orders.forEach((o: any) => {
      ordersMap[o.id] = o;
    });

    // Get order lines for this product
    const orderLines = await callOdoo('sale.order.line', 'search_read', [], {
      domain: [
        ['product_id', '=', productId],
        ['order_id', 'in', orderIds]
      ],
      fields: ['order_id', 'product_uom_qty', 'price_subtotal'],
      limit: 1000
    });

    // Group by week for chart
    const weeklyData: any = {};
    const customerData: any = {};

    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      const order = ordersMap[orderId];
      if (!order) return;

      const date = new Date(order.date_order);
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate()) / 7)}`;

      // Weekly sales
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { qty: 0, revenue: 0 };
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

    // Get stock locations (stock.quant) - SOLO ubicazioni interne magazzino
    const stockLocations = await callOdoo('stock.quant', 'search_read', [], {
      domain: [
        ['product_id', '=', productId],
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal']  // SOLO ubicazioni interne
      ],
      fields: ['location_id', 'quantity', 'reserved_quantity'],
      limit: 100
    });

    // Get incoming quantity (purchase orders not yet received)
    let incomingQty = 0;
    try {
      const purchaseOrders = await callOdoo('purchase.order', 'search_read', [], {
        domain: [
          ['state', 'in', ['purchase', 'done']]  // Ordini confermati
        ],
        fields: ['name'],
        limit: 1000
      });

      const poIds = purchaseOrders.map((po: any) => po.id);

      if (poIds.length > 0) {
        const purchaseLines = await callOdoo('purchase.order.line', 'search_read', [], {
          domain: [
            ['product_id', '=', productId],
            ['order_id', 'in', poIds]
          ],
          fields: ['product_qty', 'qty_received'],
          limit: 500
        });

        // Calculate incoming = ordered - received
        purchaseLines.forEach((line: any) => {
          const notYetReceived = line.product_qty - line.qty_received;
          if (notYetReceived > 0) {
            incomingQty += notYetReceived;
          }
        });
      }
    } catch (error) {
      console.warn('⚠️ Errore caricamento ordini in arrivo:', error);
    }

    // Get product template ID from product.product
    const productDetails = await callOdoo('product.product', 'search_read', [], {
      domain: [['id', '=', productId]],
      fields: ['product_tmpl_id'],
      limit: 1
    });

    let suppliersList: any[] = [];

    if (productDetails && productDetails.length > 0) {
      const productTemplateId = productDetails[0].product_tmpl_id[0];

      // Get suppliers (product.supplierinfo) - solo fornitori attivi
      const today = new Date().toISOString().split('T')[0];
      const suppliers = await callOdoo('product.supplierinfo', 'search_read', [], {
        domain: [
          ['product_tmpl_id', '=', productTemplateId],
          '|',
          ['date_end', '=', false],  // No end date = always active
          ['date_end', '>=', today]  // Or end date in future
        ],
        fields: ['partner_id', 'delay', 'min_qty', 'price', 'date_start', 'date_end'],
        order: 'sequence, min_qty',
        limit: 10
      });

      // Format suppliers
      suppliersList = suppliers.map((s: any) => ({
        name: s.partner_id[1],
        leadTime: s.delay,
        minQty: s.min_qty,
        price: s.price
      }));
    }

    // Format weekly chart data
    const weeklyChart = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
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
          currentStock: product.currentStock,
          avgDailySales: product.avgDailySales,
          totalSold3Months: product.totalSold3Months,
          totalRevenue: product.totalRevenue,
          avgPrice: product.avgPrice,
          incomingQty: incomingQty  // Total incoming from purchase orders
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
