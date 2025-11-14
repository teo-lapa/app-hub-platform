import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/catalogo-venditori/order-prices/[orderId]/add-line
 *
 * Adds a product line to an existing order in Odoo
 *
 * Body:
 * - productId: number
 * - quantity: number
 *
 * Returns the updated order line data
 */

interface RouteContext {
  params: {
    orderId: string;
  };
}

export async function POST(
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

    // Parse request body
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid productId or quantity' },
        { status: 400 }
      );
    }

    console.log('➕ [ADD-LINE-API] Adding product to order:', {
      orderId,
      productId,
      quantity
    });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ADD-LINE-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Verify order exists and is in draft state
    console.log('🔍 [ADD-LINE-API] Verifying order...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', orderId],
          ['company_id', '=', 1] // Only LAPA company orders
        ],
        fields: ['id', 'name', 'state', 'partner_id', 'pricelist_id'],
        limit: 1
      }
    );

    if (!orders || orders.length === 0) {
      console.error('❌ [ADD-LINE-API] Order not found:', orderId);
      return NextResponse.json(
        { success: false, error: `Order ${orderId} not found` },
        { status: 404 }
      );
    }

    const order = orders[0];

    if (order.state !== 'draft') {
      console.error('❌ [ADD-LINE-API] Order is not in draft state:', order.state);
      return NextResponse.json(
        {
          success: false,
          error: `Order ${order.name} is already confirmed and cannot be modified`
        },
        { status: 409 }
      );
    }

    // Fetch product details
    console.log('🔍 [ADD-LINE-API] Fetching product details...');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', productId],
          ['company_id', 'in', [1, false]] // LAPA company or shared products
        ],
        fields: ['id', 'name', 'list_price', 'uom_id', 'taxes_id'],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      console.error('❌ [ADD-LINE-API] Product not found:', productId);
      return NextResponse.json(
        { success: false, error: `Product ${productId} not found` },
        { status: 404 }
      );
    }

    const product = products[0];

    // Filter taxes to only use those from company 1
    let companyTaxIds: number[] = [];
    if (product.taxes_id && product.taxes_id.length > 0) {
      console.log('🔍 [ADD-LINE-API] Filtering taxes for company 1...');
      const taxes = await callOdoo(
        cookies,
        'account.tax',
        'search_read',
        [],
        {
          domain: [
            ['id', 'in', product.taxes_id],
            ['company_id', '=', 1] // Only LAPA company taxes
          ],
          fields: ['id', 'name']
        }
      );
      companyTaxIds = taxes.map((tax: any) => tax.id);
      console.log(`✅ [ADD-LINE-API] Found ${companyTaxIds.length} taxes for company 1`);
    }

    // Create order line in Odoo WITHOUT price_unit
    // Let Odoo automatically calculate the price from customer's pricelist
    // This is the same approach used by create-order API which works correctly
    console.log('➕ [ADD-LINE-API] Creating order line (Odoo will calculate price from pricelist)...');
    const lineData: any = {
      order_id: orderId,
      product_id: productId,
      product_uom_qty: quantity,
      product_uom: product.uom_id ? product.uom_id[0] : 1,
      company_id: 1, // LAPA - finest italian food GmbH
      tax_id: companyTaxIds.length > 0
        ? [[6, 0, companyTaxIds]]
        : false
    };

    // DO NOT set price_unit - Odoo will automatically use the customer's pricelist
    // when the line is created. This ensures correct prices for:
    // - Customer pricelists
    // - Locked prices
    // - Promotions
    // - Volume discounts
    console.log('ℹ️ [ADD-LINE-API] Not setting price_unit - Odoo will calculate from pricelist automatically');

    const newLineId = await callOdoo(
      cookies,
      'sale.order.line',
      'create',
      [lineData]
    );

    if (!newLineId) {
      console.error('❌ [ADD-LINE-API] Failed to create order line');
      return NextResponse.json(
        { success: false, error: 'Failed to create order line in Odoo' },
        { status: 500 }
      );
    }

    console.log(`✅ [ADD-LINE-API] Order line created successfully with ID: ${newLineId}`);

    // Trigger price calculation by calling product_id_change
    // This simulates what happens in the Odoo UI when you select a product
    try {
      console.log('🔄 [ADD-LINE-API] Triggering product_id_change to calculate price...');

      await callOdoo(
        cookies,
        'sale.order.line',
        'product_id_change',
        [[newLineId]]
      );

      console.log('✅ [ADD-LINE-API] Price calculation triggered successfully');
    } catch (error) {
      console.warn('⚠️ [ADD-LINE-API] Could not trigger product_id_change:', error);
      // Continue anyway - the line was created
    }

    // Fetch the newly created line with all details
    console.log('🔍 [ADD-LINE-API] Fetching created line details...');
    const createdLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['id', '=', newLineId]],
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
        ],
        limit: 1
      }
    );

    if (!createdLines || createdLines.length === 0) {
      console.error('❌ [ADD-LINE-API] Could not fetch created line');
      return NextResponse.json(
        { success: false, error: 'Line created but could not fetch details' },
        { status: 500 }
      );
    }

    console.log('✅ [ADD-LINE-API] Product added to order successfully');

    return NextResponse.json({
      success: true,
      lineId: newLineId,
      message: `Product added to order ${order.name}`
    });

  } catch (error: any) {
    console.error('💥 [ADD-LINE-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error adding product to order',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
