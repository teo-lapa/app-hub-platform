/**
 * MARGINI API - Analisi Margini Prodotti da Odoo
 *
 * GET /api/margini
 *
 * Query Parameters:
 * - startDate: Data inizio (default: primo giorno mese corrente)
 * - endDate: Data fine (default: oggi)
 * - groupBy: 'product' | 'category' | 'customer' (opzionale)
 *
 * Recupera e analizza i margini dei prodotti venduti da Odoo:
 * - Fatturato totale
 * - Costo totale
 * - Margine totale e percentuale
 * - Top 10 prodotti per margine
 * - Prodotti in perdita
 * - Prodotti regalati (revenue = 0)
 * - Dettagli prodotti regalati per cliente
 * - Trend giornalieri
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

// ========================================================================
// TYPES
// ========================================================================

interface OdooOrder {
  id: number;
  name: string;
  date_order: string;
  partner_id: [number, string];
  amount_total: number;
  order_line: number[];
  state: string;
}

interface OdooOrderLine {
  id: number;
  product_id: [number, string];
  name: string;
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
  purchase_price: number;
  margin: number;
  order_id: [number, string];
}

interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  standard_price: number;
  list_price: number;
  categ_id: [number, string];
}

interface ProductStats {
  id: number;
  name: string;
  defaultCode: string;
  category: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPercentage: number;
  avgSalePrice: number;
  avgCostPrice: number;
}

interface GiftProduct {
  id: number;
  name: string;
  defaultCode: string;
  quantity: number;
  cost: number;
  date: string;
  orderName: string;
}

interface GiftByCustomer {
  customerId: number;
  customerName: string;
  products: GiftProduct[];
  totalCost: number;
}

interface TrendData {
  date: string;
  revenue: number;
  margin: number;
  cost: number;
  orders: number;
}

interface MarginiResponse {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    marginPercentage: number;
    orderCount: number;
    productCount: number;
    period: {
      startDate: string;
      endDate: string;
    };
  };
  topProducts: ProductStats[];
  lossProducts: ProductStats[];
  giftsGiven: {
    totalCost: number;
    productCount: number;
    products: GiftProduct[];
    byCustomer: GiftByCustomer[];
  };
  trends: TrendData[];
  groupedData?: {
    groupBy: string;
    groups: Array<{
      name: string;
      revenue: number;
      cost: number;
      margin: number;
      marginPercentage: number;
      productCount: number;
    }>;
  };
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

export async function GET(request: NextRequest) {
  console.log('\n========================================');
  console.log('MARGINI API - START');
  console.log('========================================\n');

  try {
    // 1. Parse query parameters
    const { searchParams } = new URL(request.url);

    // Default date range: primo giorno del mese corrente fino a oggi
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const startDate = searchParams.get('startDate') || firstDayOfMonth.toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || today.toISOString().split('T')[0];
    const groupBy = searchParams.get('groupBy') as 'product' | 'category' | 'customer' | null;

    console.log('Parameters:', { startDate, endDate, groupBy });

    // 2. Authenticate with Odoo
    console.log('\nAuthenticating with Odoo...');
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies || undefined);

    if (!odooCookies) {
      throw new Error('Failed to authenticate with Odoo');
    }

    console.log('Authenticated successfully. UID:', uid);

    // 3. Fetch sales orders
    console.log('\nFetching sales orders...');
    const orders = await callOdoo(
      odooCookies,
      'sale.order',
      'search_read',
      [
        [
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', `${startDate} 00:00:00`],
          ['date_order', '<=', `${endDate} 23:59:59`]
        ]
      ],
      {
        fields: ['name', 'date_order', 'partner_id', 'amount_total', 'order_line', 'state']
      }
    ) as OdooOrder[];

    console.log(`Found ${orders.length} orders`);

    if (orders.length === 0) {
      return NextResponse.json({
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
        },
        trends: [],
        message: 'No orders found in the specified period'
      });
    }

    // 4. Extract order line IDs
    const orderLineIds = orders.flatMap(order => order.order_line || []);
    console.log(`Total order lines: ${orderLineIds.length}`);

    // 5. Fetch order lines with margin details
    console.log('\nFetching order lines...');
    const orderLines = await callOdoo(
      odooCookies,
      'sale.order.line',
      'search_read',
      [
        [['id', 'in', orderLineIds]]
      ],
      {
        fields: [
          'product_id',
          'name',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
          'purchase_price',
          'margin',
          'order_id'
        ]
      }
    ) as OdooOrderLine[];

    console.log(`Found ${orderLines.length} order lines`);

    // 6. Extract unique product IDs
    const productIds = Array.from(new Set(orderLines.map(line => line.product_id[0])));
    console.log(`Unique products: ${productIds.length}`);

    // 7. Fetch product details
    console.log('\nFetching product details...');
    const products = await callOdoo(
      odooCookies,
      'product.product',
      'search_read',
      [
        [['id', 'in', productIds]]
      ],
      {
        fields: ['id', 'name', 'default_code', 'standard_price', 'list_price', 'categ_id']
      }
    ) as OdooProduct[];

    console.log(`Found ${products.length} products`);

    // Create product map for quick lookup
    const productMap = new Map<number, OdooProduct>();
    products.forEach(p => productMap.set(p.id, p));

    // 8. Create order map for gift tracking
    const orderMap = new Map<number, OdooOrder>();
    orders.forEach(o => orderMap.set(o.id, o));

    // 9. Analyze margins
    console.log('\nAnalyzing margins...');
    const analysis = analyzeMargins(orderLines, productMap, orderMap, groupBy);

    // 10. Calculate trends (daily)
    console.log('\nCalculating trends...');
    const trends = calculateTrends(orders, orderLines, productMap);

    // 11. Build response
    const response: MarginiResponse = {
      summary: {
        totalRevenue: analysis.totalRevenue,
        totalCost: analysis.totalCost,
        totalMargin: analysis.totalMargin,
        marginPercentage: analysis.marginPercentage,
        orderCount: orders.length,
        productCount: analysis.products.length,
        period: { startDate, endDate }
      },
      topProducts: analysis.topProducts,
      lossProducts: analysis.lossProducts,
      giftsGiven: analysis.giftsGiven,
      trends,
      ...(analysis.groupedData && { groupedData: analysis.groupedData })
    };

    console.log('\n========================================');
    console.log('MARGINI API - SUCCESS');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`- Total Revenue: ${response.summary.totalRevenue.toFixed(2)}`);
    console.log(`- Total Cost: ${response.summary.totalCost.toFixed(2)}`);
    console.log(`- Total Margin: ${response.summary.totalMargin.toFixed(2)} (${response.summary.marginPercentage.toFixed(2)}%)`);
    console.log(`- Orders: ${response.summary.orderCount}`);
    console.log(`- Products: ${response.summary.productCount}`);
    console.log(`- Top Products: ${response.topProducts.length}`);
    console.log(`- Loss Products: ${response.lossProducts.length}`);
    console.log(`- Gifts Given: ${response.giftsGiven.products.length} (Cost: ${response.giftsGiven.totalCost.toFixed(2)})`);
    console.log('\n');

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('\n========================================');
    console.error('MARGINI API - ERROR');
    console.error('========================================\n');
    console.error(error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch margin data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// ========================================================================
// ANALYSIS FUNCTIONS
// ========================================================================

function analyzeMargins(
  orderLines: OdooOrderLine[],
  productMap: Map<number, OdooProduct>,
  orderMap: Map<number, OdooOrder>,
  groupBy: 'product' | 'category' | 'customer' | null
) {
  // Aggregate by product
  const productStats = new Map<number, ProductStats>();
  const giftProducts: GiftProduct[] = [];
  const giftsByCustomer = new Map<number, GiftByCustomer>();

  orderLines.forEach(line => {
    const productId = line.product_id[0];
    const productName = line.product_id[1];
    const product = productMap.get(productId);
    const order = orderMap.get(line.order_id[0]);

    // Calculate costs
    const purchasePrice = line.purchase_price || product?.standard_price || 0;
    const lineCost = purchasePrice * line.product_uom_qty;
    const lineRevenue = line.price_subtotal;
    const lineMargin = lineRevenue - lineCost;

    // Track gifts (revenue = 0 but product has cost)
    if (lineRevenue === 0 && lineCost > 0 && order) {
      const gift: GiftProduct = {
        id: productId,
        name: productName,
        defaultCode: product?.default_code || 'N/A',
        quantity: line.product_uom_qty,
        cost: lineCost,
        date: order.date_order,
        orderName: order.name
      };
      giftProducts.push(gift);

      // Group by customer
      const customerId = order.partner_id[0];
      const customerName = order.partner_id[1];

      if (!giftsByCustomer.has(customerId)) {
        giftsByCustomer.set(customerId, {
          customerId,
          customerName,
          products: [],
          totalCost: 0
        });
      }

      const customerGifts = giftsByCustomer.get(customerId)!;
      customerGifts.products.push(gift);
      customerGifts.totalCost += lineCost;
    }

    // Aggregate product stats
    if (!productStats.has(productId)) {
      productStats.set(productId, {
        id: productId,
        name: productName,
        defaultCode: product?.default_code || 'N/A',
        category: product?.categ_id?.[1] || 'N/A',
        quantitySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalMargin: 0,
        marginPercentage: 0,
        avgSalePrice: 0,
        avgCostPrice: 0
      });
    }

    const stats = productStats.get(productId)!;
    stats.quantitySold += line.product_uom_qty;
    stats.totalRevenue += lineRevenue;
    stats.totalCost += lineCost;
    stats.totalMargin += lineMargin;
  });

  // Calculate averages and percentages
  const products = Array.from(productStats.values()).map(stats => {
    stats.avgSalePrice = stats.quantitySold > 0 ? stats.totalRevenue / stats.quantitySold : 0;
    stats.avgCostPrice = stats.quantitySold > 0 ? stats.totalCost / stats.quantitySold : 0;
    stats.marginPercentage = stats.totalRevenue > 0
      ? (stats.totalMargin / stats.totalRevenue) * 100
      : 0;
    return stats;
  });

  // Sort by margin
  products.sort((a, b) => b.totalMargin - a.totalMargin);

  // Top 10 products
  const topProducts = products.slice(0, 10);

  // Loss products (negative margin)
  const lossProducts = products.filter(p => p.totalMargin < 0);

  // Global stats
  const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalCost = products.reduce((sum, p) => sum + p.totalCost, 0);
  const totalMargin = totalRevenue - totalCost;
  const marginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

  // Gifts summary
  const giftTotalCost = giftProducts.reduce((sum, g) => sum + g.cost, 0);
  const giftsByCustomerArray = Array.from(giftsByCustomer.values())
    .sort((a, b) => b.totalCost - a.totalCost);

  // Optional grouping
  let groupedData;
  if (groupBy) {
    groupedData = groupData(products, groupBy);
  }

  return {
    products,
    topProducts,
    lossProducts,
    totalRevenue,
    totalCost,
    totalMargin,
    marginPercentage,
    giftsGiven: {
      totalCost: giftTotalCost,
      productCount: giftProducts.length,
      products: giftProducts.sort((a, b) => b.cost - a.cost),
      byCustomer: giftsByCustomerArray
    },
    groupedData
  };
}

function groupData(
  products: ProductStats[],
  groupBy: 'product' | 'category' | 'customer'
) {
  if (groupBy === 'product') {
    // Already grouped by product, return as-is
    return {
      groupBy: 'product',
      groups: products.map(p => ({
        name: p.name,
        revenue: p.totalRevenue,
        cost: p.totalCost,
        margin: p.totalMargin,
        marginPercentage: p.marginPercentage,
        productCount: 1
      }))
    };
  }

  if (groupBy === 'category') {
    const categoryMap = new Map<string, {
      revenue: number;
      cost: number;
      margin: number;
      productCount: number;
    }>();

    products.forEach(p => {
      const category = p.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          revenue: 0,
          cost: 0,
          margin: 0,
          productCount: 0
        });
      }

      const cat = categoryMap.get(category)!;
      cat.revenue += p.totalRevenue;
      cat.cost += p.totalCost;
      cat.margin += p.totalMargin;
      cat.productCount++;
    });

    const groups = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        cost: data.cost,
        margin: data.margin,
        marginPercentage: data.revenue > 0 ? (data.margin / data.revenue) * 100 : 0,
        productCount: data.productCount
      }))
      .sort((a, b) => b.margin - a.margin);

    return {
      groupBy: 'category',
      groups
    };
  }

  // Customer grouping would require order line data with customer info
  // For now, return empty
  return {
    groupBy: 'customer',
    groups: []
  };
}

function calculateTrends(
  orders: OdooOrder[],
  orderLines: OdooOrderLine[],
  productMap: Map<number, OdooProduct>
): TrendData[] {
  // Group orders by date
  const trendMap = new Map<string, {
    revenue: number;
    cost: number;
    margin: number;
    orders: Set<number>;
  }>();

  // Create order line map
  const linesByOrder = new Map<number, OdooOrderLine[]>();
  orderLines.forEach(line => {
    const orderId = line.order_id[0];
    if (!linesByOrder.has(orderId)) {
      linesByOrder.set(orderId, []);
    }
    linesByOrder.get(orderId)!.push(line);
  });

  orders.forEach(order => {
    const date = order.date_order.split(' ')[0]; // Extract date only
    const lines = linesByOrder.get(order.id) || [];

    if (!trendMap.has(date)) {
      trendMap.set(date, {
        revenue: 0,
        cost: 0,
        margin: 0,
        orders: new Set()
      });
    }

    const trend = trendMap.get(date)!;
    trend.orders.add(order.id);

    lines.forEach(line => {
      const product = productMap.get(line.product_id[0]);
      const purchasePrice = line.purchase_price || product?.standard_price || 0;
      const lineCost = purchasePrice * line.product_uom_qty;

      trend.revenue += line.price_subtotal;
      trend.cost += lineCost;
      trend.margin += (line.price_subtotal - lineCost);
    });
  });

  // Convert to array and sort by date
  const trends = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      cost: data.cost,
      margin: data.margin,
      orders: data.orders.size
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return trends;
}
