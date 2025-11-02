import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';

/**
 * Helper function to extract numeric customer ID from JWT decoded token
 */
function extractCustomerId(decoded: any): number {
  const rawId = decoded.odoo_partner_id || decoded.id;
  if (typeof rawId === 'string') {
    const match = rawId.match(/d+/);
    if (!match) throw new Error('ID cliente non valido');
    return parseInt(match[0], 10);
  }
  return rawId;
}

/**
 * Upload file to BOTH Vercel Blob AND Odoo as attachment
 */
async function uploadFileDual(
  file: File,
  customerId: number,
  productId: string,
  fileType: 'audio' | 'image'
): Promise<{ blobUrl: string; odooAttachmentId: number }> {
  const timestamp = Date.now();
  const extension = fileType === 'audio' ? 'webm' : file.name.split('.').pop();
  
  // 1. Upload to Vercel Blob
  const blob = await put(`reservations/${fileType}/${customerId}-${timestamp}.${extension}`, file, { 
    access: 'public' 
  });
  
  // 2. Convert to base64 for Odoo
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  
  // 3. Create Odoo attachment
  const fileName = `Prenotazione_${fileType === 'audio' ? 'Audio' : 'Foto'}_Cliente${customerId}_${timestamp}.${extension}`;
  const mimeType = fileType === 'audio' ? 'audio/webm' : file.type;
  
  const odooAttachmentId = await callOdooAsAdmin('ir.attachment', 'create', [{
    name: fileName,
    datas: base64Data,
    res_model: 'product.template',
    res_id: parseInt(productId),
    mimetype: mimeType,
    description: `Richiesta prenotazione prodotto da cliente ID ${customerId}`
  }]);
  
  console.log(`✅ ${fileType} salvato: Blob=${blob.url.substring(0,50)}..., Odoo AttachmentID=${odooAttachmentId}`);
  
  return { blobUrl: blob.url, odooAttachmentId };
}

// GET - Recupera prenotazioni del cliente
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }
    
    let customerId: number;
    try {
      customerId = extractCustomerId(decoded);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    
    const reservations = await sql`
      SELECT pr.* FROM product_reservations pr
      WHERE pr.customer_id = ${customerId}
      ORDER BY pr.created_at DESC
    `;
    
    return NextResponse.json({ reservations: reservations.rows });
  } catch (error: any) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crea nuova prenotazione (ora integrata con carrello)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    let customerId: number;
    try {
      customerId = extractCustomerId(decoded);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const formData = await request.formData();
    const productId = formData.get('productId') as string;
    const textNote = formData.get('textNote') as string;
    const quantity = formData.get('quantity') as string || '1'; // Default 1
    const audioFile = formData.get('audioFile') as File | null;
    const imageFile = formData.get('imageFile') as File | null;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID richiesto' }, { status: 400 });
    }

    if (!textNote?.trim() && !audioFile && !imageFile) {
      return NextResponse.json({ error: 'Inserisci almeno una nota, un audio o una foto' }, { status: 400 });
    }

    console.log('📝 [RESERVATION-API] Processing reservation for product:', productId);

    let audioUrl: string | null = null;
    let imageUrl: string | null = null;
    let audioOdooAttachmentId: number | null = null;
    let imageOdooAttachmentId: number | null = null;

    // Upload audio to BOTH Blob AND Odoo
    if (audioFile) {
      try {
        const result = await uploadFileDual(audioFile, customerId, productId, 'audio');
        audioUrl = result.blobUrl;
        audioOdooAttachmentId = result.odooAttachmentId;
      } catch (err) {
        console.error('Error uploading audio:', err);
        return NextResponse.json({ error: 'Errore nel caricamento audio' }, { status: 500 });
      }
    }

    // Upload image to BOTH Blob AND Odoo
    if (imageFile) {
      try {
        const result = await uploadFileDual(imageFile, customerId, productId, 'image');
        imageUrl = result.blobUrl;
        imageOdooAttachmentId = result.odooAttachmentId;
      } catch (err) {
        console.error('Error uploading image:', err);
        return NextResponse.json({ error: 'Errore nel caricamento immagine' }, { status: 500 });
      }
    }

    // Instead of saving to product_reservations table, add to cart with reservation data
    console.log('🛒 [RESERVATION-API] Adding reserved product to cart...');

    // Get partner_id from Odoo using email from JWT
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
      console.error('❌ [RESERVATION-API] No partner found for email:', decoded.email);
      return NextResponse.json({ error: 'Cliente non identificato' }, { status: 401 });
    }

    const partnerId = userPartners[0].id;

    // Fetch product info from Odoo
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', '=', parseInt(productId)]],
        fields: ['id', 'name', 'default_code', 'list_price', 'uom_id', 'active', 'sale_ok', 'image_128'],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    const product = products[0];

    if (!product.active || !product.sale_ok) {
      return NextResponse.json({ error: 'Prodotto non disponibile per la vendita' }, { status: 400 });
    }

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
        ${parseFloat(quantity)}::DECIMAL,
        ${product.list_price}::DECIMAL,
        ${product.uom_id ? product.uom_id[1] : 'Unità'}::VARCHAR
      ) as item_id
    `;

    const itemId = addResult.rows[0].item_id;
    console.log('✅ [RESERVATION-API] Product added to cart, item ID:', itemId);

    // Update image URL if available
    if (product.image_128) {
      try {
        const imageUrlData = `data:image/png;base64,${product.image_128}`;
        await sql`
          UPDATE cart_items
          SET product_image_url = ${imageUrlData},
              available_stock = 0
          WHERE id = ${itemId}
        `;
      } catch (imgError: any) {
        console.warn('⚠️ [RESERVATION-API] Failed to update image:', imgError.message);
      }
    }

    // Save reservation data to cart item
    try {
      console.log('📝 [RESERVATION-API] Saving reservation data for item', itemId);

      await sql`
        UPDATE cart_items
        SET
          is_reservation = TRUE,
          reservation_text_note = ${textNote || null},
          reservation_audio_url = ${audioUrl},
          reservation_image_url = ${imageUrl},
          reservation_audio_odoo_attachment_id = ${audioOdooAttachmentId},
          reservation_image_odoo_attachment_id = ${imageOdooAttachmentId},
          reservation_created_at = NOW()
        WHERE id = ${itemId}
      `;

      console.log('✅ [RESERVATION-API] Reservation data saved successfully');
    } catch (resError: any) {
      console.error('⚠️ [RESERVATION-API] Failed to save reservation data:', resError.message);
      return NextResponse.json({ error: 'Errore nel salvataggio dati prenotazione' }, { status: 500 });
    }

    // Get updated cart summary
    const summaryResult = await sql`
      SELECT get_cart_summary(${cartId}::BIGINT) as summary
    `;

    const summary = summaryResult.rows[0].summary;

    console.log('✅ [RESERVATION-API] Product reserved and added to cart successfully');

    return NextResponse.json({
      success: true,
      message: 'Prodotto prenotato e aggiunto al carrello',
      cart: summary.cart,
      items: summary.items || []
    });
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
