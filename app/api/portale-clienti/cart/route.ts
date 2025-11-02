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
    const {
      productId,
      quantity,
      isReservation = false,
      reservationData // { textNote, audioUrl, imageUrl, audioOdooAttachmentId, imageOdooAttachmentId }
    } = body;

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

    console.log('📦 [CART-API] Adding product:', {
      productId,
      quantity,
      isReservation,
      hasReservationData: !!reservationData
    });

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
          'image_128',
          'packaging_ids'  // Per recuperare i cartoni
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

    // Fetch packaging info (cartoni) if available
    let packagingQty = null;
    let packagingName = null;

    if (product.packaging_ids && product.packaging_ids.length > 0) {
      try {
        const packagingResult = await callOdooAsAdmin(
          'product.packaging',
          'search_read',
          [],
          {
            domain: [['id', 'in', product.packaging_ids]],
            fields: ['id', 'name', 'qty'],
            limit: 1  // Prendi solo il primo packaging (cartone)
          }
        );

        if (packagingResult && packagingResult.length > 0) {
          packagingQty = packagingResult[0].qty;
          packagingName = packagingResult[0].name;
          console.log(`📦 [CART-API] Packaging found: ${packagingName} = ${packagingQty} units`);
        }
      } catch (pkgError) {
        console.error('⚠️ [CART-API] Failed to fetch packaging:', pkgError);
        // Continue anyway - packaging is optional
      }
    }

    // Check if product is available for sale
    if (!product.active || !product.sale_ok) {
      return NextResponse.json(
        { success: false, error: 'Prodotto non disponibile per la vendita' },
        { status: 400 }
      );
    }

    // Check stock availability ONLY if NOT a reservation
    if (!isReservation && product.qty_available < quantity) {
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
      stock: product.qty_available,
      isReservation
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

    // Update image, stock, and packaging info
    try {
      const updateData: any = {
        available_stock: product.qty_available
      };

      if (product.image_128) {
        updateData.product_image_url = `data:image/png;base64,${product.image_128}`;
        console.log(`📷 [CART-API] Updating image for item ${itemId}`);
      }

      // Add packaging data if available
      if (packagingQty !== null) {
        console.log(`📦 [CART-API] Updating packaging: ${packagingName} = ${packagingQty} units`);
      }

      await sql`
        UPDATE cart_items
        SET
          product_image_url = COALESCE(${updateData.product_image_url || null}, product_image_url),
          available_stock = ${updateData.available_stock}::DECIMAL,
          packaging_qty = ${packagingQty}::DECIMAL,
          packaging_name = ${packagingName}::VARCHAR
        WHERE id = ${itemId}
      `;

      console.log('✅ [CART-API] Cart item updated with image, stock, and packaging');
    } catch (updateError: any) {
      console.error('⚠️ [CART-API] Failed to update cart item:', updateError.message);
      // Continue anyway - these fields are optional
    }

    // If this is a reservation, save reservation data
    if (isReservation && reservationData) {
      try {
        console.log('📝 [CART-API] Saving reservation data for item', itemId);

        await sql`
          UPDATE cart_items
          SET
            is_reservation = TRUE,
            reservation_text_note = ${reservationData.textNote || null},
            reservation_audio_url = ${reservationData.audioUrl || null},
            reservation_image_url = ${reservationData.imageUrl || null},
            reservation_audio_odoo_attachment_id = ${reservationData.audioOdooAttachmentId || null},
            reservation_image_odoo_attachment_id = ${reservationData.imageOdooAttachmentId || null},
            reservation_created_at = NOW()
          WHERE id = ${itemId}
        `;

        console.log('✅ [CART-API] Reservation data saved successfully');
      } catch (resError: any) {
        console.error('⚠️ [CART-API] Failed to save reservation data:', resError.message);
        // Continue anyway - reservation data is optional
      }
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
