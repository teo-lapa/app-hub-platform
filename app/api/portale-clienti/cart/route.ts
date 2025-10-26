import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/cart
 *
 * Recupera il carrello attivo del cliente loggato
 * - Legge JWT token per identificare cliente (email + odoo_partner_id)
 * - Usa funzione PostgreSQL get_or_create_cart(email, partner_id)
 * - Usa funzione get_cart_summary(cart_id) per restituire carrello completo con items
 *
 * Returns: { cart: {...}, items: [{...}] }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🛒 [CART-API] GET - Recupero carrello cliente');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [CART-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare il carrello' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CART-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [CART-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Get partner_id from Odoo using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [CART-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [CART-API] Cliente identificato:', partnerId);

    // Get or create cart using PostgreSQL function
    const cartResult = await sql`
      SELECT get_or_create_cart(
        ${decoded.email}::VARCHAR,
        ${partnerId}::INTEGER,
        NULL::VARCHAR
      ) as cart_id
    `;

    const cartId = cartResult.rows[0].cart_id;
    console.log('✅ [CART-API] Cart ID:', cartId);

    // Get cart summary with items using PostgreSQL function
    const summaryResult = await sql`
      SELECT get_cart_summary(${cartId}::BIGINT) as summary
    `;

    const summary = summaryResult.rows[0].summary;
    console.log('✅ [CART-API] Cart summary retrieved:', {
      itemCount: summary.cart?.item_count,
      total: summary.cart?.total_amount
    });

    return NextResponse.json({
      success: true,
      cart: summary.cart,
      items: summary.items || []
    });

  } catch (error: any) {
    console.error('💥 [CART-API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portale-clienti/cart
 *
 * Aggiungi prodotto al carrello
 * - Body: { productId: number, quantity: number }
 * - Recupera info prodotto da Odoo (nome, prezzo, code, uom)
 * - Usa funzione add_to_cart() per aggiungere/incrementare
 * - Verifica disponibilità stock da Odoo
 *
 * Returns: { success: true, cart: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🛒 [CART-API] POST - Aggiungi prodotto al carrello');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [CART-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per aggiungere prodotti al carrello' },
        { status: 401 }
      );
    }

    // Decode JWT
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [CART-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [CART-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { productId, quantity } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { success: false, error: 'productId e quantity sono obbligatori' },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'La quantità deve essere maggiore di zero' },
        { status: 400 }
      );
    }

    console.log('📦 [CART-API] Adding product:', { productId, quantity });

    // Get partner_id from Odoo
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [CART-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;

    // Fetch product info from Odoo
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', '=', productId]],
        fields: [
          'id',
          'name',
          'default_code',
          'list_price',
          'qty_available',
          'uom_id',
          'active',
          'sale_ok',
          'image_128'
        ],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non trovato' },
        { status: 404 }
      );
    }

    const product = products[0];

    // Check if product is available for sale
    if (!product.active || !product.sale_ok) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non disponibile per la vendita' },
        { status: 400 }
      );
    }

    // Check stock availability
    if (product.qty_available < quantity) {
      return NextResponse.json(
        {
          success: false,
          error: 'Quantità richiesta non disponibile',
          availableQuantity: product.qty_available
        },
        { status: 409 }
      );
    }

    console.log('✅ [CART-API] Product validated:', {
      name: product.name,
      price: product.list_price,
      stock: product.qty_available
    });

    // Get or create cart
    const cartResult = await sql`
      SELECT get_or_create_cart(
        ${decoded.email}::VARCHAR,
        ${partnerId}::INTEGER,
        NULL::VARCHAR
      ) as cart_id
    `;

    const cartId = cartResult.rows[0].cart_id;

    // Add product to cart using PostgreSQL function
    const addResult = await sql`
      SELECT add_to_cart(
        ${cartId}::BIGINT,
        ${product.id}::INTEGER,
        ${product.name}::VARCHAR,
        ${product.default_code || null}::VARCHAR,
        ${quantity}::DECIMAL,
        ${product.list_price}::DECIMAL,
        ${product.uom_id ? product.uom_id[1] : 'Unità'}::VARCHAR
      ) as item_id
    `;

    const itemId = addResult.rows[0].item_id;

    // Update image URL and stock if available (Odoo image_128 is base64)
    if (product.image_128) {
      try {
        const imageUrl = `data:image/png;base64,${product.image_128}`;
        console.log(`📷 [CART-API] Updating image for item ${itemId}, image size: ${imageUrl.length} chars`);

        await sql`
          UPDATE cart_items
          SET product_image_url = ${imageUrl},
              available_stock = ${product.qty_available}::DECIMAL
          WHERE id = ${itemId}
        `;

        console.log('✅ [CART-API] Image updated successfully');
      } catch (imgError: any) {
        console.error('⚠️ [CART-API] Failed to update image:', imgError.message);
        // Continue anyway - image is optional
      }
    } else {
      console.log('⚠️ [CART-API] No image_128 from Odoo');
    }

    console.log('✅ [CART-API] Product added to cart');

    // Get updated cart summary
    const summaryResult = await sql`
      SELECT get_cart_summary(${cartId}::BIGINT) as summary
    `;

    const summary = summaryResult.rows[0].summary;

    return NextResponse.json({
      success: true,
      message: 'Prodotto aggiunto al carrello',
      cart: summary.cart,
      items: summary.items || []
    });

  } catch (error: any) {
    console.error('💥 [CART-API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore nell\'aggiunta del prodotto' },
      { status: 500 }
    );
  }
}
