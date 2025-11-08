import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

// GET - Recupera prenotazioni del cliente
export async function GET(request: NextRequest) {
  try {
    // Verify JWT token
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const customerId = decoded.odoo_partner_id || decoded.id;

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
  } catch (error: any) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: error.message || 'Errore nel recupero prenotazioni' },
      { status: 500 }
    );
  }
}

// POST - Crea nuova prenotazione
export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const customerId = decoded.odoo_partner_id || decoded.id;

    // Parse form data
    const formData = await request.formData();
    const productId = formData.get('productId') as string;
    const textNote = formData.get('textNote') as string;
    const audioFile = formData.get('audioFile') as File | null;
    const imageFile = formData.get('imageFile') as File | null;

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

    let audioUrl: string | null = null;
    let imageUrl: string | null = null;

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
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: error.message || 'Errore nel creare prenotazione' },
      { status: 500 }
    );
  }
}
