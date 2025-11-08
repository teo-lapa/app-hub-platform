import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/catalogo-venditori/order-prices/[orderId]
 *
 * Retrieves detailed price information for an order, including:
 * - Order lines with current prices
 * - Pricelist information
 * - Standard prices for comparison
 * - Price lock status
 *
 * Returns order data ready for price review page
 */

interface RouteContext {
  params: {
    orderId: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const orderId = parseInt(params.orderId);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    console.log('📊 [ORDER-PRICES-API] Fetching prices for order:', orderId);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ORDER-PRICES-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Fetch order from Odoo
    console.log('🔍 [ORDER-PRICES-API] Fetching order from Odoo...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: [
          'id',
          'name',
          'partner_id',
          'partner_shipping_id',
          'pricelist_id',
          'state',
          'amount_total',
          'amount_untaxed',
          'order_line',
          'commitment_date',
          'note'
        ],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [ORDER-PRICES-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    // Only allow editing draft orders
    if (order.state !== 'draft') {
      console.error('❌ [ORDER-PRICES-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed and cannot be edited`,
          state: order.state
        },
        { status: 409 }
      );
    }

    console.log('✅ [ORDER-PRICES-API] Order found:', {
      id: order.id,
      name: order.name,
      state: order.state,
      linesCount: order.order_line?.length || 0
    });

    // Fetch order lines with product details
    console.log('🔍 [ORDER-PRICES-API] Fetching order lines...');
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
          'discount',
          'price_subtotal',
          'price_total',
          'tax_id'
        ]
      }
    );

    console.log(`✅ [ORDER-PRICES-API] Fetched ${orderLines.length} order lines`);

    // Fetch product details for each line
    console.log('🔍 [ORDER-PRICES-API] Fetching product details...');
    const productIds = orderLines.map((line: any) => line.product_id[0]);

    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', 'in', productIds]],
        fields: [
          'id',
          'name',
          'default_code',
          'list_price',
          'standard_price',
          'image_128',
          'uom_id',
          'qty_available'
        ]
      }
    );

    // Create product lookup map
    const productMap = new Map(products.map((p: any) => [p.id, p]));

    // Get pricelist details if exists
    let pricelistInfo = null;
    if (order.pricelist_id && order.pricelist_id[0]) {
      console.log('🔍 [ORDER-PRICES-API] Fetching pricelist info...');
      const pricelists = await callOdoo(
        cookies,
        'product.pricelist',
        'search_read',
        [],
        {
          domain: [['id', '=', order.pricelist_id[0]]],
          fields: ['id', 'name', 'currency_id', 'discount_policy'],
          limit: 1
        }
      );

      if (pricelists && pricelists.length > 0) {
        pricelistInfo = {
          id: pricelists[0].id,
          name: pricelists[0].name,
          currency: pricelists[0].currency_id ? pricelists[0].currency_id[1] : 'CHF',
          discountPolicy: pricelists[0].discount_policy
        };
        console.log('✅ [ORDER-PRICES-API] Pricelist found:', pricelistInfo.name);
      }
    }

    // Enrich order lines with product data and price comparison
    const enrichedLines = orderLines.map((line: any) => {
      const product: any = productMap.get(line.product_id[0]);

      return {
        id: line.id,
        productId: line.product_id[0],
        productName: line.name || product?.name || 'Unknown Product',
        productCode: product?.default_code || '',
        quantity: line.product_uom_qty,
        uom: product?.uom_id ? product.uom_id[1] : 'Unit',

        // Current prices (from order line)
        currentPriceUnit: line.price_unit,
        currentDiscount: line.discount || 0,
        currentSubtotal: line.price_subtotal,
        currentTotal: line.price_total,

        // Standard prices (for comparison)
        standardPrice: product?.list_price || 0,
        costPrice: product?.standard_price || 0,

        // Product info
        imageUrl: product?.image_128 ? `data:image/png;base64,${product.image_128}` : null,
        qtyAvailable: product?.qty_available || 0,

        // Editable status (can be enhanced with custom logic)
        isLocked: false, // Default: all prices are editable

        // Tax info
        taxIds: line.tax_id || []
      };
    });

    // Calculate totals
    const subtotal = enrichedLines.reduce((sum: number, line: any) => sum + line.currentSubtotal, 0);
    const total = enrichedLines.reduce((sum: number, line: any) => sum + line.currentTotal, 0);
    const totalTax = total - subtotal;

    console.log('✅ [ORDER-PRICES-API] Order prices prepared successfully');

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        state: order.state,
        customerId: order.partner_id[0],
        customerName: order.partner_id[1],
        deliveryDate: order.commitment_date || null,
        notes: order.note || '',

        pricelist: pricelistInfo,

        lines: enrichedLines,

        totals: {
          subtotal,
          tax: totalTax,
          total
        }
      }
    });

  } catch (error: any) {
    console.error('💥 [ORDER-PRICES-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching order prices',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
