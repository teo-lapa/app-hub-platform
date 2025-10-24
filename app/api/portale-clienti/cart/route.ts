import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

/**
 * GET /api/portale-clienti/cart
 *
 * Fetches the current cart from Odoo (sale.order in draft state)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🛒 [CART-API] Fetching cart');

    // Get Odoo session from cookies
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    // Get partner ID from user
    const userData = await callOdoo(
      odooCookies,
      'res.users',
      'read',
      [[uid]],
      { fields: ['partner_id'] }
    );

    if (!userData || !userData[0]?.partner_id) {
      throw new Error('Partner not found');
    }

    const partnerId = userData[0].partner_id[0];

    // Find draft sale order (cart) for this partner
    const orders = await callOdoo(
      odooCookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['state', '=', 'draft'],
        ],
        fields: ['id', 'name', 'order_line', 'amount_total'],
        limit: 1,
      }
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        cart: null,
        items: [],
        total: 0,
      });
    }

    const order = orders[0];

    // Get order lines
    const orderLines = await callOdoo(
      odooCookies,
      'sale.order.line',
      'read',
      [order.order_line],
      {
        fields: [
          'id',
          'product_id',
          'product_uom_qty',
          'price_unit',
          'price_subtotal',
          'name',
        ],
      }
    );

    const formattedItems = orderLines.map((line: any) => ({
      id: line.id,
      productId: line.product_id[0],
      productName: line.product_id[1],
      quantity: line.product_uom_qty,
      priceUnit: line.price_unit,
      subtotal: line.price_subtotal,
      description: line.name,
    }));

    console.log(`✅ [CART-API] Cart fetched: ${formattedItems.length} items`);

    return NextResponse.json({
      cart: {
        id: order.id,
        name: order.name,
        total: order.amount_total,
      },
      items: formattedItems,
      total: order.amount_total,
    });

  } catch (error: any) {
    console.error('❌ [CART-API] GET Error:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento carrello', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portale-clienti/cart
 *
 * Adds a product to the cart (creates/updates sale.order.line)
 *
 * Body: { productId: number, quantity: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: 'productId and quantity are required' },
        { status: 400 }
      );
    }

    console.log('🛒 [CART-API] Adding to cart:', { productId, quantity });

    // Get Odoo session from cookies
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies, uid } = await getOdooSession(userCookies);

    // Get partner ID from user
    const userData = await callOdoo(
      odooCookies,
      'res.users',
      'read',
      [[uid]],
      { fields: ['partner_id'] }
    );

    if (!userData || !userData[0]?.partner_id) {
      throw new Error('Partner not found');
    }

    const partnerId = userData[0].partner_id[0];

    // Find or create draft sale order (cart)
    let orders = await callOdoo(
      odooCookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', partnerId],
          ['state', '=', 'draft'],
        ],
        fields: ['id', 'order_line'],
        limit: 1,
      }
    );

    let orderId: number;

    if (!orders || orders.length === 0) {
      // Create new cart (draft sale order)
      const newOrderIds = await callOdoo(
        odooCookies,
        'sale.order',
        'create',
        [{
          partner_id: partnerId,
          state: 'draft',
        }],
        {}
      );
      orderId = newOrderIds[0];
      console.log('✅ [CART-API] Created new cart:', orderId);
    } else {
      orderId = orders[0].id;
      console.log('✅ [CART-API] Using existing cart:', orderId);
    }

    // Check if product already in cart
    const existingLines = await callOdoo(
      odooCookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [
          ['order_id', '=', orderId],
          ['product_id', '=', productId],
        ],
        fields: ['id', 'product_uom_qty'],
        limit: 1,
      }
    );

    if (existingLines && existingLines.length > 0) {
      // Update existing line
      const lineId = existingLines[0].id;
      const newQuantity = existingLines[0].product_uom_qty + quantity;

      await callOdoo(
        odooCookies,
        'sale.order.line',
        'write',
        [[lineId], { product_uom_qty: newQuantity }],
        {}
      );

      console.log(`✅ [CART-API] Updated line ${lineId}: qty=${newQuantity}`);
    } else {
      // Create new order line
      const lineIds = await callOdoo(
        odooCookies,
        'sale.order.line',
        'create',
        [{
          order_id: orderId,
          product_id: productId,
          product_uom_qty: quantity,
        }],
        {}
      );

      console.log(`✅ [CART-API] Created new line: ${lineIds[0]}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Prodotto aggiunto al carrello',
    });

  } catch (error: any) {
    console.error('❌ [CART-API] POST Error:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiunta al carrello', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portale-clienti/cart
 *
 * Removes an item from the cart
 *
 * Body: { lineId: number }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineId } = body;

    if (!lineId) {
      return NextResponse.json(
        { error: 'lineId is required' },
        { status: 400 }
      );
    }

    console.log('🛒 [CART-API] Removing from cart:', { lineId });

    // Get Odoo session from cookies
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Delete order line
    await callOdoo(
      odooCookies,
      'sale.order.line',
      'unlink',
      [[lineId]],
      {}
    );

    console.log(`✅ [CART-API] Removed line ${lineId}`);

    return NextResponse.json({
      success: true,
      message: 'Prodotto rimosso dal carrello',
    });

  } catch (error: any) {
    console.error('❌ [CART-API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Errore nella rimozione dal carrello', details: error.message },
      { status: 500 }
    );
  }
}
