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

    const cartResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/portale-clienti/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `token=${token}` // Forward auth token
      },
      body: JSON.stringify({
        productId: parseInt(productId),
        quantity: parseFloat(quantity),
        isReservation: true,
        reservationData: {
          textNote: textNote || null,
          audioUrl,
          imageUrl,
          audioOdooAttachmentId,
          imageOdooAttachmentId
        }
      })
    });

    const cartResult = await cartResponse.json();

    if (!cartResult.success) {
      console.error('❌ [RESERVATION-API] Failed to add to cart:', cartResult.error);
      return NextResponse.json({ error: cartResult.error }, { status: 500 });
    }

    console.log('✅ [RESERVATION-API] Product reserved and added to cart successfully');

    return NextResponse.json({
      success: true,
      message: 'Prodotto prenotato e aggiunto al carrello',
      cart: cartResult.cart,
      items: cartResult.items
    });
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
