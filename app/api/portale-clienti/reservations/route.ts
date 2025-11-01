import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerToken } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { put } from '@vercel/blob';

// GET - Recupera prenotazioni del cliente
export async function GET(request: NextRequest) {
  try {
    const payload = await verifyCustomerToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const customerId = payload.customerId;

    // Recupera prenotazioni del cliente
    const reservations = await db.query(
      `SELECT
        pr.id,
        pr.product_id,
        pr.customer_id,
        pr.text_note,
        pr.audio_url,
        pr.image_url,
        pr.status,
        pr.created_at,
        pr.order_id,
        p.name as product_name,
        p.code as product_code,
        p.image as product_image
      FROM product_reservations pr
      LEFT JOIN products p ON pr.product_id = p.id
      WHERE pr.customer_id = $1
      ORDER BY pr.created_at DESC`,
      [customerId]
    );

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
    const payload = await verifyCustomerToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const customerId = payload.customerId;

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

    // Verifica se esiste già un ordine "draft" per questo cliente
    let orderId: number | null = null;

    const existingDraftOrder = await db.query(
      `SELECT id FROM orders
       WHERE customer_id = $1
       AND status = 'draft'
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId]
    );

    if (existingDraftOrder.rows.length > 0) {
      orderId = existingDraftOrder.rows[0].id;
    } else {
      // Crea un nuovo ordine draft se non esiste
      const newOrder = await db.query(
        `INSERT INTO orders (customer_id, status, notes, created_at)
         VALUES ($1, 'draft', 'Ordine con prodotti prenotati', NOW())
         RETURNING id`,
        [customerId]
      );
      orderId = newOrder.rows[0].id;
    }

    // Salva la prenotazione nel database
    const reservation = await db.query(
      `INSERT INTO product_reservations
       (product_id, customer_id, order_id, text_note, audio_url, image_url, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
       RETURNING *`,
      [productId, customerId, orderId, textNote || null, audioUrl, imageUrl]
    );

    // Aggiorna le note dell'ordine con la prenotazione
    const reservationNote = `
📦 Prodotto Prenotato - ID: ${productId}
${textNote ? `📝 Nota: ${textNote}` : ''}
${audioUrl ? `🎤 Audio: ${audioUrl}` : ''}
${imageUrl ? `📷 Foto: ${imageUrl}` : ''}
---
`;

    await db.query(
      `UPDATE orders
       SET notes = COALESCE(notes, '') || $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reservationNote, orderId]
    );

    return NextResponse.json({
      success: true,
      reservation: reservation.rows[0],
      orderId,
    });
  } catch (error: any) {
    console.error('Error creating reservation:', error);
    return NextResponse.json(
      { error: error.message || 'Errore nel creare prenotazione' },
      { status: 500 }
    );
  }
}
