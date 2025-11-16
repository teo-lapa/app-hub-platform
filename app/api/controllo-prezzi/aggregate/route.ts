import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Reduced from 120s due to optimization

/**
 * GET /api/controllo-prezzi/aggregate
 *
 * OPTIMIZED VERSION - Batch fetching to eliminate N+1 query problem
 *
 * Aggregates ALL orders in review (draft + sent) and analyzes their prices.
 * From 400+ queries to 7 queries total!
 *
 * Returns aggregated counts and full product list.
 */

interface ProductAnalysis {
  orderId: number;
  orderName: string;
  orderDate: string; // YYYY-MM-DD format (data consegna / commitment_date)
  customerId: number;
  customerName: string;
  lineId: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  currentPriceUnit: number;
  discount: number;
  costPrice: number;
  avgSellingPrice: number;
  criticalPoint: number; // costPrice * 1.4
  category: 'sotto_pc' | 'tra_pc_medio' | 'sopra_medio';
  isLocked: boolean;
}

interface AggregateStats {
  sotto_pc: number;
  tra_pc_medio: number;
  sopra_medio: number;
  richieste_blocco: number;
  total_products: number;
  total_orders: number;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [AGGREGATE-PRICES-API] Starting OPTIMIZED aggregation...');
    const startTime = Date.now();

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [AGGREGATE-PRICES-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // STEP 1: Fetch confirmed/delivered orders with delivery in last 28 days (SINGLE QUERY)
    console.log('🔍 [AGGREGATE-PRICES-API] Fetching confirmed orders with recent delivery...');

    // Calcola data 28 giorni fa
    const twentyEightDaysAgo = new Date();
    twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
    const dateFromStr = twentyEightDaysAgo.toISOString().split('T')[0];

    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['company_id', '=', 1],
          ['state', 'in', ['sale', 'done']],  // Solo ordini confermati/consegnati
          ['commitment_date', '>=', dateFromStr],  // Consegna negli ultimi 28 giorni
          ['picking_ids', '!=', false]  // DEVE avere consegne (esclude preventivi confermati)
        ],
        fields: ['id', 'name', 'partner_id', 'pricelist_id', 'date_order', 'commitment_date'],
        order: 'commitment_date DESC'
      }
    );

    if (!orders || orders.length === 0) {
      console.log('ℹ️ [AGGREGATE-PRICES-API] No orders found');
      return NextResponse.json({
        success: true,
        stats: {
          sotto_pc: 0,
          tra_pc_medio: 0,
          sopra_medio: 0,
          richieste_blocco: 0,
          total_products: 0,
          total_orders: 0
        },
        products: [],
        timestamp: new Date().toISOString()
      });
    }

    const orderIds = orders.map((o: any) => o.id);
    const pricelistIds = Array.from(new Set(orders.map((o: any) => o.pricelist_id?.[0]).filter(Boolean)));

    console.log(`✅ Found ${orders.length} orders to analyze`);

    // STEP 2: Batch fetch ALL order lines (SINGLE QUERY)
    console.log('📦 [AGGREGATE-PRICES-API] Batch fetching order lines...');
    const orderLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: ['id', 'order_id', 'product_id', 'name', 'product_uom_qty', 'price_unit', 'discount']
      }
    );

    if (!orderLines || orderLines.length === 0) {
      console.log('⚠️ [AGGREGATE-PRICES-API] No order lines found');
      return NextResponse.json({
        success: true,
        stats: {
          sotto_pc: 0,
          tra_pc_medio: 0,
          sopra_medio: 0,
          richieste_blocco: 0,
          total_products: 0,
          total_orders: orders.length
        },
        products: [],
        timestamp: new Date().toISOString()
      });
    }

    const productIds = Array.from(new Set(orderLines.map((line: any) => line.product_id[0])));
    console.log(`✅ Found ${orderLines.length} order lines with ${productIds.length} unique products`);

    // STEP 3: Batch fetch ALL products (SINGLE QUERY)
    console.log('🏷️ [AGGREGATE-PRICES-API] Batch fetching products...');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          ['id', 'in', productIds],
          ['company_id', 'in', [1, false]]
        ],
        fields: ['id', 'name', 'default_code', 'list_price', 'standard_price']
      }
    );

    const productMap = new Map(products.map((p: any) => [p.id, p]));
    console.log(`✅ Fetched ${products.length} products`);

    // STEP 4: Batch fetch average prices using read_group (SINGLE QUERY - optimized with PostgreSQL AVG)
    console.log('📊 [AGGREGATE-PRICES-API] Calculating average prices with read_group...');
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFromStr = threeMonthsAgo.toISOString().split('T')[0];

    const avgPrices = await callOdoo(
      cookies,
      'sale.order.line',
      'read_group',
      [],
      {
        domain: [
          ['product_id', 'in', productIds],
          ['state', 'in', ['sale', 'done']],
          ['create_date', '>=', dateFromStr]
        ],
        fields: ['product_id', 'price_unit:avg'],
        groupby: ['product_id']
      }
    );

    const avgPriceMap = new Map(
      avgPrices.map((item: any) => [item.product_id[0], item.price_unit])
    );
    console.log(`✅ Calculated average prices for ${avgPrices.length} products`);

    // STEP 5: Batch fetch ALL pricelist items (SINGLE QUERY)
    console.log('💰 [AGGREGATE-PRICES-API] Batch fetching pricelist items...');
    const pricelistItems = await callOdoo(
      cookies,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['pricelist_id', 'in', pricelistIds],
          ['product_id', 'in', productIds]
        ],
        fields: ['id', 'pricelist_id', 'product_id', 'compute_price', 'fixed_price']
      }
    );

    // Create lookup map: "pricelistId-productId" -> item
    const pricelistMap = new Map<string, any>();
    pricelistItems.forEach((item: any) => {
      const pricelistId = item.pricelist_id[0];
      const productId = item.product_id[0];
      const key = `${pricelistId}-${productId}`;
      pricelistMap.set(key, item);
    });
    console.log(`✅ Found ${pricelistItems.length} pricelist items`);

    // STEP 6: Create order lookup map
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));

    // STEP 7: Process ALL data in-memory (FAST!)
    console.log('⚡ [AGGREGATE-PRICES-API] Processing data in-memory...');
    const allProducts: ProductAnalysis[] = [];
    const stats: AggregateStats = {
      sotto_pc: 0,
      tra_pc_medio: 0,
      sopra_medio: 0,
      richieste_blocco: 0,
      total_products: 0,
      total_orders: orders.length
    };

    for (const line of orderLines) {
      const order: any = orderMap.get(line.order_id[0]);
      if (!order) continue;

      const product: any = productMap.get(line.product_id[0]);
      if (!product) continue;

      const costPrice = product.standard_price || 0;
      const currentPrice = line.price_unit;
      const avgSellingPrice = avgPriceMap.get(line.product_id[0]) || product.list_price || 0;
      const criticalPoint = costPrice * 1.4;

      // Check if locked
      const pricelistKey = `${order.pricelist_id?.[0] || 0}-${line.product_id[0]}`;
      const pricelistItem = pricelistMap.get(pricelistKey);
      const isLocked = pricelistItem?.compute_price === 'fixed';

      // Determine category
      let category: 'sotto_pc' | 'tra_pc_medio' | 'sopra_medio';
      if (currentPrice < criticalPoint) {
        category = 'sotto_pc';
        stats.sotto_pc++;
      } else if (avgSellingPrice > 0 && currentPrice < avgSellingPrice) {
        category = 'tra_pc_medio';
        stats.tra_pc_medio++;
      } else {
        category = 'sopra_medio';
        stats.sopra_medio++;
      }

      allProducts.push({
        orderId: order.id,
        orderName: order.name,
        orderDate: order.commitment_date || order.date_order || '', // Usa data consegna, altrimenti data creazione
        customerId: order.partner_id[0],
        customerName: order.partner_id[1],
        lineId: line.id,
        productId: line.product_id[0],
        productName: line.name || product.name,
        productCode: product.default_code || '',
        quantity: line.product_uom_qty,
        currentPriceUnit: currentPrice,
        discount: line.discount || 0,
        costPrice,
        avgSellingPrice,
        criticalPoint,
        category,
        isLocked
      });

      stats.total_products++;
    }

    console.log(`✅ Processed ${allProducts.length} products`);

    // STEP 8: Count pending price lock requests (SINGLE QUERY)
    console.log('🔍 [AGGREGATE-PRICES-API] Counting price lock requests...');
    try {
      const models = await callOdoo(cookies, 'ir.model', 'search_read', [], {
        domain: [['model', '=', 'sale.order']],
        fields: ['id'],
        limit: 1
      });

      if (models && models.length > 0) {
        const activities = await callOdoo(cookies, 'mail.activity', 'search_read', [], {
          domain: [
            ['res_model_id', '=', models[0].id],
            ['res_id', 'in', orderIds],
            ['summary', 'ilike', 'Blocco Prezzo']
          ],
          fields: ['id']
        });
        stats.richieste_blocco = activities?.length || 0;
      }
    } catch (activityError: any) {
      console.error('⚠️ [AGGREGATE-PRICES-API] Failed to count activities:', activityError);
      stats.richieste_blocco = 0;
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [AGGREGATE-PRICES-API] Complete in ${totalTime}ms:`, stats);

    return NextResponse.json({
      success: true,
      stats,
      products: allProducts,
      timestamp: new Date().toISOString(),
      performanceMs: totalTime
    });

  } catch (error: any) {
    console.error('💥 [AGGREGATE-PRICES-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error aggregating prices',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
