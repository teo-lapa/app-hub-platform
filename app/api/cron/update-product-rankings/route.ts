import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti per elaborare tutti i dati

/**
 * GET /api/cron/update-product-rankings
 *
 * Cron job notturno per aggiornare la cache degli score prodotti
 * - Calcola customer_score per ogni cliente+prodotto (ultimi 12 mesi)
 * - Calcola global_score per ogni prodotto (vendite totali LAPA ultimi 12 mesi)
 * - Aggiorna product_ranking_cache table
 *
 * Formula customer_score: (qty_purchased * 100) + (frequency * 50) + recency_bonus
 * Formula global_score: (global_qty_sold * 10) + (global_orders_count * 20)
 *
 * NOTA: Questo endpoint dovrebbe essere protetto con un secret token
 * Esempio chiamata: GET /api/cron/update-product-rankings?token=YOUR_SECRET
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verifica token di sicurezza (in production)
    const token = request.nextUrl.searchParams.get('token');
    const expectedToken = process.env.CRON_SECRET || 'dev-secret-token';

    if (token !== expectedToken) {
      console.warn('⚠️ [CRON] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🚀 [CRON] Starting product rankings update...');

    // Calculate date 12 months ago
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

    console.log(`📅 [CRON] Analyzing orders from ${twelveMonthsAgoStr} onwards`);

    // Step 1: Fetch all confirmed orders from last 12 months from Odoo
    console.log('📦 [CRON] Fetching orders from Odoo...');
    const orders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['date_order', '>=', twelveMonthsAgoStr],
          ['state', 'in', ['sale', 'done']]
        ],
        fields: ['id', 'partner_id', 'date_order'],
      }
    );

    console.log(`✅ [CRON] Found ${orders.length} orders in last 12 months`);

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orders found in last 12 months',
        stats: { orders: 0, customers: 0, products: 0 }
      });
    }

    const orderIds = orders.map((o: any) => o.id);

    // Step 2: Fetch all order lines for these orders
    console.log('📋 [CRON] Fetching order lines from Odoo...');
    const orderLines = await callOdooAsAdmin(
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_subtotal'],
      }
    );

    console.log(`✅ [CRON] Found ${orderLines.length} order lines`);

    // Step 3: Build data structures for analysis
    interface CustomerProductStats {
      total_qty: number;
      frequency: number;
      last_purchase: Date;
      total_amount: number;
    }

    interface GlobalProductStats {
      global_qty: number;
      global_orders: number;
    }

    // Map: partnerId -> productId -> stats
    const customerStats = new Map<number, Map<number, CustomerProductStats>>();

    // Map: productId -> global stats
    const globalStats = new Map<number, GlobalProductStats>();

    // Create order date map for recency calculation
    const orderDateMap = new Map<number, Date>();
    orders.forEach((order: any) => {
      orderDateMap.set(order.id, new Date(order.date_order));
    });

    // Create partner map from orders
    const orderPartnerMap = new Map<number, number>();
    orders.forEach((order: any) => {
      orderPartnerMap.set(order.id, order.partner_id[0]);
    });

    // Process each order line
    for (const line of orderLines) {
      const orderId = line.order_id[0];
      const partnerId = orderPartnerMap.get(orderId);
      const productId = line.product_id[0];
      const qty = parseFloat(line.product_uom_qty);
      const amount = parseFloat(line.price_subtotal);
      const orderDate = orderDateMap.get(orderId);

      if (!partnerId || !productId || !orderDate) continue;

      // Update customer stats
      if (!customerStats.has(partnerId)) {
        customerStats.set(partnerId, new Map());
      }

      const partnerProducts = customerStats.get(partnerId)!;

      if (!partnerProducts.has(productId)) {
        partnerProducts.set(productId, {
          total_qty: 0,
          frequency: 0,
          last_purchase: orderDate,
          total_amount: 0
        });
      }

      const stats = partnerProducts.get(productId)!;
      stats.total_qty += qty;
      stats.frequency += 1;
      stats.total_amount += amount;

      if (orderDate > stats.last_purchase) {
        stats.last_purchase = orderDate;
      }

      // Update global stats
      if (!globalStats.has(productId)) {
        globalStats.set(productId, {
          global_qty: 0,
          global_orders: 0
        });
      }

      const globalStat = globalStats.get(productId)!;
      globalStat.global_qty += qty;
      globalStat.global_orders += 1;
    }

    console.log(`📊 [CRON] Processed stats for ${customerStats.size} customers and ${globalStats.size} products`);

    // Step 4: Clear existing cache
    console.log('🗑️ [CRON] Clearing old cache...');
    await sql`TRUNCATE TABLE product_ranking_cache`;

    // Step 5: Calculate scores and insert into cache
    console.log('💾 [CRON] Inserting new cache data...');

    let insertCount = 0;
    const now = new Date();

    for (const [partnerId, productsMap] of customerStats.entries()) {
      for (const [productId, stats] of productsMap.entries()) {
        // Calculate recency bonus (0-100 points)
        const daysSinceLastPurchase = Math.floor(
          (now.getTime() - stats.last_purchase.getTime()) / (1000 * 60 * 60 * 24)
        );

        let recencyBonus = 0;
        if (daysSinceLastPurchase <= 30) {
          recencyBonus = 100; // Purchased in last month
        } else if (daysSinceLastPurchase <= 90) {
          recencyBonus = 70; // Purchased in last 3 months
        } else if (daysSinceLastPurchase <= 180) {
          recencyBonus = 40; // Purchased in last 6 months
        } else {
          recencyBonus = 10; // Purchased in last year
        }

        // Calculate customer score
        const customerScore =
          stats.total_qty * 100 +
          stats.frequency * 50 +
          recencyBonus;

        // Get global stats for this product
        const globalStat = globalStats.get(productId) || {
          global_qty: 0,
          global_orders: 0
        };

        // Calculate global score
        const globalScore =
          globalStat.global_qty * 10 +
          globalStat.global_orders * 20;

        // Insert into cache
        await sql`
          INSERT INTO product_ranking_cache (
            odoo_partner_id,
            odoo_product_id,
            customer_score,
            global_score,
            last_purchase_date,
            total_qty_purchased,
            purchase_frequency,
            total_amount_purchased,
            global_qty_sold,
            global_orders_count,
            updated_at
          ) VALUES (
            ${partnerId},
            ${productId},
            ${customerScore},
            ${globalScore},
            ${stats.last_purchase.toISOString()},
            ${stats.total_qty},
            ${stats.frequency},
            ${stats.total_amount},
            ${globalStat.global_qty},
            ${globalStat.global_orders},
            NOW()
          )
        `;

        insertCount++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`✅ [CRON] Cache update completed in ${duration}ms`);
    console.log(`📊 [CRON] Inserted ${insertCount} cache entries`);

    return NextResponse.json({
      success: true,
      message: 'Product rankings updated successfully',
      stats: {
        orders: orders.length,
        orderLines: orderLines.length,
        customers: customerStats.size,
        products: globalStats.size,
        cacheEntries: insertCount,
        durationMs: duration
      }
    });

  } catch (error: any) {
    console.error('❌ [CRON] Error updating product rankings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
