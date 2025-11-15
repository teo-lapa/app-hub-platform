import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/controllo-prezzi/block-requests
 *
 * Fetches all pending price block requests from Odoo mail.activity
 * with complete product details and live price calculations.
 *
 * Returns enriched data for each request including:
 * - Activity metadata (due date, assignee, status)
 * - Parsed data from HTML note (proposed price, seller notes)
 * - Live Odoo data (product, customer, order details)
 * - Calculated metrics (cost, avg price, margin, critical price)
 */

interface BlockRequest {
  activityId: number;
  state: 'overdue' | 'today' | 'planned';
  dueDate: string;
  assignedTo: string;

  // From parsing note
  proposedPrice: number;
  sellerNotes: string;

  // Live data from Odoo
  productId: number;
  productName: string;
  productCode: string;
  orderId: number;
  orderName: string;
  customerId: number;
  customerName: string;

  // Live calculations
  costPrice: number;
  avgSellingPrice: number;
  criticalPrice: number;
  marginPercent: number;
}

interface BlockRequestsResponse {
  success: true;
  requests: BlockRequest[];
  timestamp: string;
  performanceMs: number;
}

/**
 * Parse HTML note to extract proposed price and seller notes
 */
function parseActivityNote(htmlNote: string): { proposedPrice: number; sellerNotes: string } {
  console.log('📝 [BLOCK-REQUESTS] Parsing HTML note...');

  let proposedPrice = 0;
  let sellerNotes = '';

  try {
    // Extract "Prezzo Proposto" - various possible formats
    // Look for patterns like: "Prezzo Proposto: 123.45" or "Prezzo Proposto:</strong> 123.45"
    const pricePatterns = [
      /Prezzo\s+Proposto[:\s]*<\/?\w*>\s*([\d.,]+)/i,
      /Prezzo\s+Proposto[:\s]*([\d.,]+)/i,
      /proposto[:\s]*<\/?\w*>\s*([\d.,]+)/i
    ];

    for (const pattern of pricePatterns) {
      const priceMatch = htmlNote.match(pattern);
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(',', '.');
        proposedPrice = parseFloat(priceStr);
        console.log(`✅ [BLOCK-REQUESTS] Found proposed price: ${proposedPrice}`);
        break;
      }
    }

    // Extract "Note del Venditore" - look for text after this label
    const notesPatterns = [
      /Note\s+del\s+Venditore[:\s]*<\/?\w*>\s*([^<]+)/i,
      /Note\s+Venditore[:\s]*<\/?\w*>\s*([^<]+)/i,
      /Note[:\s]*<\/?\w*>\s*([^<]+)/i
    ];

    for (const pattern of notesPatterns) {
      const notesMatch = htmlNote.match(pattern);
      if (notesMatch) {
        sellerNotes = notesMatch[1].trim();
        console.log(`✅ [BLOCK-REQUESTS] Found seller notes: ${sellerNotes.substring(0, 50)}...`);
        break;
      }
    }

    // If no structured notes found, try to extract plain text from HTML
    if (!sellerNotes) {
      // Remove HTML tags and extract text
      const plainText = htmlNote.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Get text after "Note" if present, otherwise use full text (limited)
      const noteIndex = plainText.toLowerCase().indexOf('note');
      if (noteIndex >= 0) {
        sellerNotes = plainText.substring(noteIndex + 4).trim().substring(0, 200);
      } else {
        sellerNotes = plainText.substring(0, 200);
      }
    }

  } catch (error: any) {
    console.error('❌ [BLOCK-REQUESTS] Error parsing note:', error.message);
  }

  return { proposedPrice, sellerNotes };
}

/**
 * Calculate average selling price for a product (last 3 months)
 * Reused logic from aggregate/route.ts
 */
async function calculateAveragePrice(
  cookies: string,
  productId: number
): Promise<number> {
  try {
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
          ['product_id', '=', productId],
          ['state', 'in', ['sale', 'done']],
          ['create_date', '>=', dateFromStr]
        ],
        fields: ['product_id', 'price_unit:avg'],
        groupby: ['product_id']
      }
    ) as any[];

    if (avgPrices && avgPrices.length > 0) {
      return (avgPrices[0] as any).price_unit || 0;
    }

    return 0;
  } catch (error: any) {
    console.error(`⚠️ [BLOCK-REQUESTS] Error calculating avg price for product ${productId}:`, error.message);
    return 0;
  }
}

/**
 * Determine activity state based on due date
 */
function determineActivityState(dateDeadline: string): 'overdue' | 'today' | 'planned' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(dateDeadline);
  deadline.setHours(0, 0, 0, 0);

  if (deadline < today) {
    return 'overdue';
  } else if (deadline.getTime() === today.getTime()) {
    return 'today';
  } else {
    return 'planned';
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔔 [BLOCK-REQUESTS-API] Starting to fetch price block requests...');
    const startTime = Date.now();

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [BLOCK-REQUESTS-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [BLOCK-REQUESTS-API] User authenticated, UID:', uid);

    // STEP 1: Fetch pending price block activities
    console.log('🔍 [BLOCK-REQUESTS-API] Searching for price block activities...');

    const activities = await callOdoo(
      cookies,
      'mail.activity',
      'search_read',
      [],
      {
        domain: [
          ['summary', 'ilike', 'Blocco Prezzo'],
          ['state', '!=', 'done']
        ],
        fields: ['id', 'summary', 'note', 'state', 'res_id', 'res_model', 'date_deadline', 'user_id'],
        order: 'date_deadline ASC'
      }
    ) as any[];

    if (!activities || activities.length === 0) {
      console.log('ℹ️ [BLOCK-REQUESTS-API] No pending price block requests found');
      return NextResponse.json({
        success: true,
        requests: [],
        timestamp: new Date().toISOString(),
        performanceMs: Date.now() - startTime
      });
    }

    console.log(`✅ [BLOCK-REQUESTS-API] Found ${activities.length} pending activities`);

    // Filter only sale.order activities
    const saleOrderActivities = activities.filter((a: any) => a.res_model === 'sale.order');
    console.log(`📊 [BLOCK-REQUESTS-API] ${saleOrderActivities.length} activities are for sale orders`);

    if (saleOrderActivities.length === 0) {
      return NextResponse.json({
        success: true,
        requests: [],
        timestamp: new Date().toISOString(),
        performanceMs: Date.now() - startTime
      });
    }

    // STEP 2: Batch fetch all related sale orders
    const orderIds = saleOrderActivities.map((a: any) => a.res_id);
    console.log('🛒 [BLOCK-REQUESTS-API] Fetching sale orders...');

    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', 'in', orderIds]],
        fields: ['id', 'name', 'partner_id']
      }
    ) as any[];

    const orderMap = new Map(orders.map((o: any) => [o.id, o]));
    console.log(`✅ [BLOCK-REQUESTS-API] Fetched ${orders.length} orders`);

    // STEP 3: Batch fetch all order lines
    console.log('📦 [BLOCK-REQUESTS-API] Fetching order lines...');

    const orderLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: ['id', 'order_id', 'product_id', 'name', 'price_unit']
      }
    ) as any[];

    // Group order lines by order_id
    const orderLinesMap = new Map<number, any[]>();
    orderLines.forEach((line: any) => {
      const orderId = line.order_id[0];
      if (!orderLinesMap.has(orderId)) {
        orderLinesMap.set(orderId, []);
      }
      orderLinesMap.get(orderId)!.push(line);
    });

    console.log(`✅ [BLOCK-REQUESTS-API] Fetched ${orderLines.length} order lines`);

    // STEP 4: Batch fetch all products
    const productIds = Array.from(new Set(orderLines.map((line: any) => line.product_id[0])));
    console.log('🏷️ [BLOCK-REQUESTS-API] Fetching products...');

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
        fields: ['id', 'name', 'default_code', 'standard_price']
      }
    ) as any[];

    const productMap = new Map(products.map((p: any) => [p.id, p]));
    console.log(`✅ [BLOCK-REQUESTS-API] Fetched ${products.length} products`);

    // STEP 5: Batch calculate average prices for all products
    console.log('📊 [BLOCK-REQUESTS-API] Calculating average prices...');

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
    ) as any[];

    const avgPriceMap = new Map(
      avgPrices.map((item: any) => [item.product_id[0], item.price_unit || 0])
    );
    console.log(`✅ [BLOCK-REQUESTS-API] Calculated average prices for ${avgPrices.length} products`);

    // STEP 6: Process all activities and build response
    console.log('⚡ [BLOCK-REQUESTS-API] Processing activities...');

    const requests: BlockRequest[] = [];

    for (const activity of saleOrderActivities) {
      try {
        const activityData = activity as any;
        // Get order
        const order = orderMap.get(activityData.res_id) as any;
        if (!order) {
          console.warn(`⚠️ [BLOCK-REQUESTS-API] Order ${activityData.res_id} not found for activity ${activityData.id}`);
          continue;
        }

        // Get order lines
        const lines = orderLinesMap.get(order.id);
        if (!lines || lines.length === 0) {
          console.warn(`⚠️ [BLOCK-REQUESTS-API] No order lines found for order ${order.id}`);
          continue;
        }

        // For now, take the first line (you may want to refine this logic)
        // In a real scenario, you might need to identify which line the request is about
        const line = lines[0] as any;

        // Get product
        const product = productMap.get(line.product_id[0]) as any;
        if (!product) {
          console.warn(`⚠️ [BLOCK-REQUESTS-API] Product ${line.product_id[0]} not found`);
          continue;
        }

        // Parse activity note
        const { proposedPrice, sellerNotes } = parseActivityNote(activityData.note || '');

        // Get average selling price
        const avgSellingPrice = avgPriceMap.get(product.id) || 0;

        // Calculate metrics
        const costPrice = product.standard_price || 0;
        const criticalPrice = costPrice * 1.4;
        const marginPercent = costPrice > 0
          ? ((proposedPrice - costPrice) / costPrice) * 100
          : 0;

        // Determine state
        const state = determineActivityState(activityData.date_deadline);

        // Build request object
        const blockRequest: BlockRequest = {
          activityId: activityData.id,
          state,
          dueDate: activityData.date_deadline,
          assignedTo: activityData.user_id ? activityData.user_id[1] : 'Unassigned',

          proposedPrice,
          sellerNotes,

          productId: product.id,
          productName: product.name,
          productCode: product.default_code || '',
          orderId: order.id,
          orderName: order.name,
          customerId: order.partner_id[0],
          customerName: order.partner_id[1],

          costPrice,
          avgSellingPrice,
          criticalPrice,
          marginPercent
        };

        requests.push(blockRequest);
        console.log(`✅ [BLOCK-REQUESTS-API] Processed activity ${activityData.id} - ${product.name}`);

      } catch (activityError: any) {
        console.error(`❌ [BLOCK-REQUESTS-API] Error processing activity ${(activity as any).id}:`, activityError.message);
        // Continue processing other activities
        continue;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [BLOCK-REQUESTS-API] Complete! Processed ${requests.length} requests in ${totalTime}ms`);

    const response: BlockRequestsResponse = {
      success: true,
      requests,
      timestamp: new Date().toISOString(),
      performanceMs: totalTime
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('💥 [BLOCK-REQUESTS-API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching block requests',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
