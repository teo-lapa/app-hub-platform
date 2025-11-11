import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/controllo-prezzi/aggregate
 *
 * Aggregates ALL orders in review (draft + sent) and analyzes their prices.
 *
 * For each product in each order, calculates:
 * - If it's below critical point (PC = costPrice * 1.4)
 * - If it's between PC and average price
 * - If it's above average price
 *
 * Returns:
 * - Aggregated counts for 4 categories:
 *   - sotto_pc: products below critical point
 *   - tra_pc_medio: products between PC and average
 *   - sopra_medio: products above average
 *   - richieste_blocco: pending price lock requests (tasks)
 * - Full list of all products with their data
 */

interface ProductAnalysis {
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;
  lineId: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  currentPriceUnit: number;
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
    console.log('📊 [AGGREGATE-PRICES-API] Starting aggregation...');

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

    // Step 1: Get ALL orders in draft and sent states
    console.log('🔍 [AGGREGATE-PRICES-API] Fetching orders in draft/sent state...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['company_id', '=', 1], // Only LAPA company orders
          ['state', 'in', ['draft', 'sent']] // Orders in review
        ],
        fields: [
          'id',
          'name',
          'partner_id',
          'state',
          'order_line'
        ],
        order: 'date_order DESC'
      }
    );

    if (!orders || orders.length === 0) {
      console.log('ℹ️ [AGGREGATE-PRICES-API] No orders found in draft/sent state');
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
        products: []
      });
    }

    console.log(`✅ [AGGREGATE-PRICES-API] Found ${orders.length} orders to analyze`);

    // Step 2: For each order, fetch detailed price data
    const allProducts: ProductAnalysis[] = [];
    const stats: AggregateStats = {
      sotto_pc: 0,
      tra_pc_medio: 0,
      sopra_medio: 0,
      richieste_blocco: 0,
      total_products: 0,
      total_orders: orders.length
    };

    for (const order of orders) {
      try {
        console.log(`📋 [AGGREGATE-PRICES-API] Processing order ${order.name} (ID: ${order.id})...`);

        // Fetch order lines with product details
        const orderLines = await callOdoo(
          cookies,
          'sale.order.line',
          'search_read',
          [],
          {
            domain: [['id', 'in', order.order_line]],
            fields: [
              'id',
              'product_id',
              'name',
              'product_uom_qty',
              'price_unit',
              'discount'
            ]
          }
        );

        if (!orderLines || orderLines.length === 0) {
          console.log(`⚠️ [AGGREGATE-PRICES-API] No lines found for order ${order.name}`);
          continue;
        }

        // Fetch product details
        const productIds = orderLines.map((line: any) => line.product_id[0]);
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
            fields: [
              'id',
              'name',
              'default_code',
              'list_price',
              'standard_price'
            ]
          }
        );

        // Create product lookup map with explicit typing
        const productMap = new Map<number, any>(products.map((p: any) => [p.id, p]));

        // Fetch 3-month average prices
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const dateFromStr = threeMonthsAgo.toISOString().split('T')[0];

        const historicalLines = await callOdoo(
          cookies,
          'sale.order.line',
          'search_read',
          [],
          {
            domain: [
              ['product_id', 'in', productIds],
              ['state', 'in', ['sale', 'done']],
              ['create_date', '>=', dateFromStr]
            ],
            fields: ['product_id', 'price_unit']
          }
        );

        // Calculate average selling price per product
        const avgPriceMap = new Map<number, number>();
        const pricesByProduct = new Map<number, number[]>();

        historicalLines.forEach((line: any) => {
          const productId = line.product_id[0];
          const price = line.price_unit;

          if (!pricesByProduct.has(productId)) {
            pricesByProduct.set(productId, []);
          }
          pricesByProduct.get(productId)!.push(price);
        });

        pricesByProduct.forEach((prices, productId) => {
          const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
          avgPriceMap.set(productId, avgPrice);
        });

        // Check for locked prices in pricelist
        const lockedPricesMap = new Map<number, boolean>();
        if (order.pricelist_id && order.pricelist_id[0]) {
          const pricelistItems = await callOdoo(
            cookies,
            'product.pricelist.item',
            'search_read',
            [],
            {
              domain: [
                ['pricelist_id', '=', order.pricelist_id[0]],
                ['product_id', 'in', productIds]
              ],
              fields: ['id', 'product_id', 'compute_price', 'fixed_price']
            }
          );

          pricelistItems.forEach((item: any) => {
            const productId = item.product_id ? item.product_id[0] : null;
            if (!productId) return;
            const isLocked = item.compute_price === 'fixed';
            lockedPricesMap.set(productId, isLocked);
          });
        }

        // Analyze each product
        for (const line of orderLines) {
          const product: any = productMap.get(line.product_id[0]);
          if (!product) continue;

          const costPrice: number = product.standard_price || 0;
          const currentPrice: number = line.price_unit;
          const avgSellingPrice: number = avgPriceMap.get(line.product_id[0]) || product.list_price || 0;
          const criticalPoint = costPrice * 1.4;
          const isLocked = lockedPricesMap.get(line.product_id[0]) || false;

          // Determine category based on price thresholds (from review-prices page logic, lines 556-603)
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

          // Add to products list
          const productAnalysis: ProductAnalysis = {
            orderId: order.id,
            orderName: order.name,
            customerId: order.partner_id[0],
            customerName: order.partner_id[1],
            lineId: line.id,
            productId: line.product_id[0],
            productName: line.name || product.name,
            productCode: product.default_code || '',
            quantity: line.product_uom_qty,
            currentPriceUnit: currentPrice,
            costPrice,
            avgSellingPrice,
            criticalPoint,
            category,
            isLocked
          };

          allProducts.push(productAnalysis);
          stats.total_products++;
        }

        console.log(`✅ [AGGREGATE-PRICES-API] Processed ${orderLines.length} products from order ${order.name}`);

      } catch (orderError: any) {
        console.error(`❌ [AGGREGATE-PRICES-API] Error processing order ${order.name}:`, orderError);
        // Continue with next order
      }
    }

    // Step 3: Count pending price lock requests (tasks)
    console.log('🔍 [AGGREGATE-PRICES-API] Counting pending price lock requests...');

    // Get the model ID for 'sale.order'
    const models = await callOdoo(
      cookies,
      'ir.model',
      'search_read',
      [],
      {
        domain: [['model', '=', 'sale.order']],
        fields: ['id', 'model'],
        limit: 1
      }
    );

    if (models && models.length > 0) {
      const modelId = models[0].id;

      // Get all order IDs
      const orderIds = orders.map((o: any) => o.id);

      // Count activities related to these orders that are price lock requests
      const activities = await callOdoo(
        cookies,
        'mail.activity',
        'search_read',
        [],
        {
          domain: [
            ['res_model_id', '=', modelId],
            ['res_model', '=', 'sale.order'],
            ['res_id', 'in', orderIds],
            ['summary', 'ilike', 'Blocco Prezzo'] // Filter by summary containing "Blocco Prezzo"
          ],
          fields: ['id', 'res_id', 'summary']
        }
      );

      stats.richieste_blocco = activities ? activities.length : 0;
      console.log(`✅ [AGGREGATE-PRICES-API] Found ${stats.richieste_blocco} pending price lock requests`);
    } else {
      console.log('⚠️ [AGGREGATE-PRICES-API] Could not find sale.order model, skipping task count');
    }

    console.log('✅ [AGGREGATE-PRICES-API] Aggregation complete:', stats);

    return NextResponse.json({
      success: true,
      stats,
      products: allProducts,
      timestamp: new Date().toISOString()
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
