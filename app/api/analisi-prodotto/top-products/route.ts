/**
 * TOP PRODUCTS API - Analisi Top Prodotti per Periodo
 *
 * GET /api/analisi-prodotto/top-products
 *
 * Query Parameters:
 * - dateFrom: Data inizio (required)
 * - dateTo: Data fine (required)
 *
 * Recupera i top 20 prodotti venduti nel periodo specificato:
 * - Totale quantità venduta
 * - Totale fatturato
 * - Numero ordini
 * - Numero clienti unici
 * - Margine percentuale
 * - Nome prodotto, UOM, prezzi
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ========================================================================
// TYPES
// ========================================================================

interface OdooSaleOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
  purchase_price: number;
  order_id: [number, string];
  order_partner_id: [number, string];
  state: string;
}

interface OdooProduct {
  id: number;
  name: string;
  default_code: string | null;
  uom_id: [number, string];
  list_price: number;
  standard_price: number;
  categ_id: [number, string];
}

interface ProductStats {
  productId: number;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  orderIds: Set<number>;
  customerIds: Set<number>;
}

interface TopProduct {
  productName: string;
  totalRevenue: number;
  totalQuantity: number;
  marginPercent: number;
  orderCount: number;
  customerCount: number;
  uom: string;
}

interface TopProductsResponse {
  success: boolean;
  products: TopProduct[];
  period: {
    dateFrom: string;
    dateTo: string;
  };
  summary: {
    totalProducts: number;
    totalRevenue: number;
    totalQty: number;
    avgMargin: number;
  };
}

// ========================================================================
// MAIN HANDLER
// ========================================================================

export async function GET(request: NextRequest) {
  console.log('\n========================================');
  console.log('TOP PRODUCTS API - START');
  console.log('========================================\n');

  try {
    // 1. Parse query parameters
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parameters dateFrom and dateTo are required',
          example: '/api/analisi-prodotto/top-products?dateFrom=2025-05-01&dateTo=2025-11-03'
        },
        { status: 400 }
      );
    }

    console.log('Parameters:', { dateFrom, dateTo });

    // 2. Authenticate with Odoo
    console.log('\nAuthenticating with Odoo...');
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies || undefined);

    if (!odooCookies) {
      throw new Error('Failed to authenticate with Odoo');
    }

    console.log('Authenticated successfully. UID:', uid);

    // 3. Fetch sale order lines for the period
    console.log('\nFetching sale order lines...');
    console.log(`Period: ${dateFrom} to ${dateTo}`);

    const saleOrderLines = await callOdoo(
      odooCookies,
      'sale.order.line',
      'search_read',
      [
        [
          ['state', 'in', ['sale', 'done']],
          ['create_date', '>=', `${dateFrom} 00:00:00`],
          ['create_date', '<=', `${dateTo} 23:59:59`]
        ]
      ],
      {
        fields: [
          'product_id',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
          'purchase_price',
          'order_id',
          'order_partner_id',
          'state'
        ]
      }
    ) as OdooSaleOrderLine[];

    console.log(`Found ${saleOrderLines.length} sale order lines`);

    if (saleOrderLines.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        period: { dateFrom, dateTo },
        summary: {
          totalProducts: 0,
          totalRevenue: 0,
          totalQty: 0,
          avgMargin: 0
        },
        message: 'No sales found in the specified period'
      });
    }

    // 4. Aggregate by product
    console.log('\nAggregating data by product...');
    const productStatsMap = new Map<number, ProductStats>();

    saleOrderLines.forEach(line => {
      const productId = line.product_id[0];
      const orderId = line.order_id[0];
      const customerId = line.order_partner_id[0];

      if (!productStatsMap.has(productId)) {
        productStatsMap.set(productId, {
          productId,
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          orderIds: new Set(),
          customerIds: new Set()
        });
      }

      const stats = productStatsMap.get(productId)!;

      // Calculate cost using purchase_price or fallback to 0
      const purchasePrice = line.purchase_price || 0;
      const lineCost = purchasePrice * line.product_uom_qty;

      stats.quantitySold += line.product_uom_qty;
      stats.totalRevenue += line.price_subtotal;
      stats.totalCost += lineCost;
      stats.orderIds.add(orderId);
      stats.customerIds.add(customerId);
    });

    console.log(`Aggregated ${productStatsMap.size} unique products`);

    // 5. Get product IDs
    const productIds = Array.from(productStatsMap.keys());

    // 6. Fetch product details
    console.log('\nFetching product details...');
    const products = await callOdoo(
      odooCookies,
      'product.product',
      'search_read',
      [
        [['id', 'in', productIds]]
      ],
      {
        fields: [
          'id',
          'name',
          'default_code',
          'uom_id',
          'list_price',
          'standard_price',
          'categ_id'
        ]
      }
    ) as OdooProduct[];

    console.log(`Found ${products.length} product details`);

    // 7. Create product map for quick lookup
    const productMap = new Map<number, OdooProduct>();
    products.forEach(p => productMap.set(p.id, p));

    // 8. Build top products list
    console.log('\nBuilding top products list...');
    const topProducts: TopProduct[] = [];

    productStatsMap.forEach((stats, productId) => {
      const product = productMap.get(productId);
      if (!product) {
        console.warn(`Product ${productId} not found in product map`);
        return;
      }

      // Use standard_price as fallback if totalCost is 0
      let finalCost = stats.totalCost;
      if (finalCost === 0 && product.standard_price > 0) {
        finalCost = product.standard_price * stats.quantitySold;
      }

      const margin = stats.totalRevenue - finalCost;
      const marginPercent = stats.totalRevenue > 0
        ? (margin / stats.totalRevenue) * 100
        : 0;

      topProducts.push({
        productName: product.name,
        totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
        totalQuantity: Math.round(stats.quantitySold * 100) / 100,
        marginPercent: Math.round(marginPercent * 100) / 100,
        orderCount: stats.orderIds.size,
        customerCount: stats.customerIds.size,
        uom: product.uom_id[1]
      });
    });

    // 9. Sort by totalRevenue DESC and get top 20
    topProducts.sort((a, b) => b.totalRevenue - a.totalRevenue);
    const top20 = topProducts.slice(0, 20);

    // 10. Calculate summary
    const summary = {
      totalProducts: top20.length,
      totalRevenue: Math.round(top20.reduce((sum, p) => sum + p.totalRevenue, 0) * 100) / 100,
      totalQty: Math.round(top20.reduce((sum, p) => sum + p.totalQuantity, 0) * 100) / 100,
      avgMargin: top20.length > 0
        ? Math.round((top20.reduce((sum, p) => sum + p.marginPercent, 0) / top20.length) * 100) / 100
        : 0
    };

    // 11. Build response
    const response: TopProductsResponse = {
      success: true,
      products: top20,
      period: {
        dateFrom,
        dateTo
      },
      summary
    };

    console.log('\n========================================');
    console.log('TOP PRODUCTS API - SUCCESS');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`- Period: ${dateFrom} to ${dateTo}`);
    console.log(`- Total Products Analyzed: ${productStatsMap.size}`);
    console.log(`- Top 20 Products Returned: ${top20.length}`);
    console.log(`- Total Revenue (Top 20): ${summary.totalRevenue.toFixed(2)}`);
    console.log(`- Total Quantity (Top 20): ${summary.totalQty.toFixed(2)}`);
    console.log(`- Average Margin (Top 20): ${summary.avgMargin.toFixed(2)}%`);
    if (top20.length > 0) {
      console.log(`\nTop 3 Products:`);
      top20.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.productName}`);
        console.log(`   Revenue: ${p.totalRevenue.toFixed(2)} | Qty: ${p.totalQuantity} ${p.uom} | Margin: ${p.marginPercent.toFixed(2)}%`);
      });
    }
    console.log('\n');

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('\n========================================');
    console.error('TOP PRODUCTS API - ERROR');
    console.error('========================================\n');
    console.error(error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch top products data',
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
