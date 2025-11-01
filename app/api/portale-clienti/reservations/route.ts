import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

/**
 * Helper function to extract numeric customer ID from JWT decoded token
 * Handles both numeric IDs and string IDs like "odoo-7"
 */
function extractCustomerId(decoded) {
  const rawId = decoded.odoo_partner_id || decoded.id;

  if (typeof rawId === 'string') {
    // Extract number from strings like "odoo-7" or just "7"
    const match = rawId.match(/d+/);
    if (!match) {
      throw new Error('ID cliente non valido');
    }
    return parseInt(match[0], 10);
  }

  return rawId;
}

// GET - Recupera prenotazioni del cliente
export async function GET(request) {
  try {
    // Verify JWT token
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    let customerId;
    try {
      customerId = extractCustomerId(decoded);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Recupera prenotazioni del cliente
    const reservations = await sql`
      SELECT
        pr.id,
        pr.product_id,
        pr.customer_id,
        pr.text_note,
        pr.audio_url,
        pr.image_url,
        pr.status,
        pr.created_at,
        pr.order_id
      FROM product_reservations pr
      WHERE pr.customer_id = ${customerId}
      ORDER BY pr.created_at DESC
    `;

    return NextResponse.json({
      reservations: reservations.rows,
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: error.message || 'Errore nel recupero prenotazioni' },
      { status: 500 }
    );
  }
}

// POST - Crea nuova prenotazione
export async function POST(request) {
  try {
    // Verify JWT token
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    let customerId;
    try {
      customerId = extractCustomerId(decoded);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // Parse form data
    const formData = await request.formData();
    const productId = formData.get('productId');
    const textNote = formData.get('textNote');
    const audioFile = formData.get('audioFile');
    const imageFile = formData.get('imageFile');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID richiesto' },
        { status: 400 }
      );
    }

    // Validazione: almeno un campo compilato
    if (!textNote?.trim() && !audioFile && !imageFile) {
      return NextResponse.json(
        { error: 'Inserisci almeno una nota, un audio o una foto' },
        { status: 400 }
      );
    }

    let audioUrl = null;
    let imageUrl = null;

    // Upload audio su Vercel Blob se presente
    if (audioFile) {
      try {
        const blob = await put(`reservations/audio/${customerId}-${Date.now()}.webm`, audioFile, {
          access: 'public',
        });
        audioUrl = blob.url;
      } catch (err) {
        console.error('Error uploading audio:', err);
        return NextResponse.json(
          { error: 'Errore nel caricamento audio' },
          { status: 500 }
        );
      }
    }

    // Upload immagine su Vercel Blob se presente
    if (imageFile) {
      try {
        const blob = await put(
          `reservations/images/${customerId}-${Date.now()}.${imageFile.name.split('.').pop()}`,
          imageFile,
          {
            access: 'public',
          }
        );
        imageUrl = blob.url;
      } catch (err) {
        console.error('Error uploading image:', err);
        return NextResponse.json(
          { error: 'Errore nel caricamento immagine' },
          { status: 500 }
        );
      }
    }

    // Salva la prenotazione nel database (order_id NULL per ora)
    const reservation = await sql`
      INSERT INTO product_reservations
      (product_id, customer_id, order_id, text_note, audio_url, image_url, status, created_at)
      VALUES (${productId}, ${customerId}, NULL, ${textNote || null}, ${audioUrl}, ${imageUrl}, 'pending', NOW())
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      reservation: reservation.rows[0],
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: error.message || 'Errore nel creare prenotazione' },
      { status: 500 }
    );
  }
}
