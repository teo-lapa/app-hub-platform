import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

/**
 * GET /api/super-dashboard/margini
 *
 * Recupera analisi margini completa da Odoo
 * Query params:
 * - period: 'week' | 'month' | 'quarter' (default: 'month')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    console.log(`📊 [MARGINI-API] Fetching margins for period: ${period}`);

    // Calcola range date
    const { startDate, endDate } = getDateRange(period);

    console.log(`   📅 Period: ${startDate} to ${endDate}`);

    // 1. Recupera ordini confermati nel periodo
    const orders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [[
        ['date_order', '>=', startDate],
        ['date_order', '<=', endDate],
        ['state', 'in', ['sale', 'done']]
      ]],
      { fields: ['name', 'partner_id', 'order_line', 'date_order'] }
    );

    console.log(`   📦 Found ${orders.length} orders`);

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalRevenue: 0,
            totalCost: 0,
            totalMargin: 0,
            marginPercentage: 0,
            orderCount: 0,
            productCount: 0,
            period: { startDate, endDate }
          },
          topProducts: [],
          lossProducts: [],
          giftsGiven: {
            totalCost: 0,
            productCount: 0,
            products: [],
            byCustomer: []
          }
        }
      });
    }

    // 2. Estrai tutti gli ID delle righe ordine
    const orderLineIds = orders.flatMap((o: any) => o.order_line || []);
    console.log(`   📋 Processing ${orderLineIds.length} order lines`);

    // 3. Recupera righe ordine con margini
    const lines = await callOdooAsAdmin(
      'sale.order.line',
      'search_read',
      [[['id', 'in', orderLineIds]]],
      {
        fields: [
          'product_id',
          'name',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
          'purchase_price',
          'order_id'
        ]
      }
    );

    console.log(`   ✅ Retrieved ${lines.length} order lines with details`);

    // 4. Estrai product IDs unici
    const productIds = [...new Set(lines.map((l: any) => l.product_id?.[0]).filter(Boolean))];

    // 5. Recupera dettagli prodotti
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [[['id', 'in', productIds]]],
      { fields: ['id', 'name', 'default_code', 'standard_price', 'list_price'] }
    );

    // Crea mappa prodotti
    const productMap = new Map();
    products.forEach((p: any) => {
      productMap.set(p.id, p);
    });

    // 6. Crea mappa ordini per recuperare i clienti
    const orderMap = new Map();
    orders.forEach((o: any) => {
      orderMap.set(o.id, {
        partnerId: o.partner_id?.[0],
        partnerName: o.partner_id?.[1] || 'Cliente Sconosciuto',
        date: o.date_order
      });
    });

    // 7. Calcola margini per prodotto
    const productStats: any = {};
    const giftsByCustomer: any = {};

    lines.forEach((line: any) => {
      const productId = line.product_id?.[0];
      if (!productId) return;

      const productName = line.product_id?.[1] || 'Prodotto Sconosciuto';
      const product = productMap.get(productId);

      const qty = line.product_uom_qty || 0;
      const revenue = line.price_subtotal || 0;
      const purchasePrice = line.purchase_price || product?.standard_price || 0;
      const cost = purchasePrice * qty;
      const margin = revenue - cost;

      // Aggrega per prodotto
      if (!productStats[productId]) {
        productStats[productId] = {
          id: productId,
          name: productName,
          default_code: product?.default_code || '',
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalMargin: 0
        };
      }

      productStats[productId].quantitySold += qty;
      productStats[productId].totalRevenue += revenue;
      productStats[productId].totalCost += cost;
      productStats[productId].totalMargin += margin;

      // Traccia prodotti regalati (revenue = 0, cost > 0)
      if (revenue === 0 && cost > 0) {
        const orderId = line.order_id?.[0];
        const orderInfo = orderMap.get(orderId);

        if (orderInfo) {
          const customerId = orderInfo.partnerId;
          const customerName = orderInfo.partnerName;

          if (!giftsByCustomer[customerId]) {
            giftsByCustomer[customerId] = {
              customerId,
              customerName,
              products: [],
              totalCost: 0
            };
          }

          giftsByCustomer[customerId].products.push({
            productName,
            quantity: qty,
            cost: cost
          });
          giftsByCustomer[customerId].totalCost += cost;
        }
      }
    });

    // 8. Converti in array e calcola percentuali
    const productsArray = Object.values(productStats).map((p: any) => ({
      ...p,
      marginPercentage: p.totalRevenue > 0
        ? ((p.totalMargin / p.totalRevenue) * 100).toFixed(2)
        : '0.00'
    }));

    // 9. Ordina prodotti
    const topProducts = productsArray
      .filter((p: any) => p.totalMargin > 0)
      .sort((a: any, b: any) => b.totalMargin - a.totalMargin);

    const lossProducts = productsArray
      .filter((p: any) => p.totalMargin < 0 && p.totalRevenue > 0) // Solo prodotti venduti sotto costo
      .sort((a: any, b: any) => a.totalMargin - b.totalMargin);

    // 10. Prodotti regalati
    const giftProducts = productsArray
      .filter((p: any) => p.totalRevenue === 0 && p.totalCost > 0);

    const giftsData = {
      totalCost: giftProducts.reduce((sum: number, p: any) => sum + p.totalCost, 0),
      productCount: giftProducts.length,
      products: giftProducts.map((p: any) => ({
        productId: p.id,
        productName: p.name,
        quantityGiven: p.quantitySold,
        totalCost: p.totalCost
      })),
      byCustomer: Object.values(giftsByCustomer).sort((a: any, b: any) => b.totalCost - a.totalCost)
    };

    // 11. Calcola summary
    const totalRevenue = productsArray.reduce((sum: number, p: any) => sum + p.totalRevenue, 0);
    const totalCost = productsArray.reduce((sum: number, p: any) => sum + p.totalCost, 0);
    const totalMargin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const summary = {
      totalRevenue,
      totalCost,
      totalMargin,
      marginPercentage,
      orderCount: orders.length,
      productCount: productsArray.length,
      period: { startDate, endDate }
    };

    console.log(`   💰 Total Revenue: CHF ${totalRevenue.toFixed(2)}`);
    console.log(`   📊 Total Margin: CHF ${totalMargin.toFixed(2)} (${marginPercentage.toFixed(2)}%)`);
    console.log(`   🎁 Gifts Given: CHF ${giftsData.totalCost.toFixed(2)} (${giftsData.productCount} products)`);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        topProducts: topProducts.slice(0, 20),
        lossProducts,
        giftsGiven: giftsData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [MARGINI-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch margins data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Calcola range date in base al periodo
 */
function getDateRange(period: string) {
  const now = new Date();
  let startDate: string, endDate: string;

  switch (period) {
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;

    case 'quarter':
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      startDate = quarterStart.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;

    case 'month':
    default:
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = monthStart.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0] + ' 23:59:59';
      break;
  }

  return { startDate, endDate };
}
