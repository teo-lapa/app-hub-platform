import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

// API semplificata per aggiornare business senza usare db-service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, ownerEmail, ownerName } = body;

    if (!businessId) {
      return NextResponse.json({
        success: false,
        error: 'businessId richiesto'
      }, { status: 400 });
    }

    const result = await sql`
      UPDATE rm_businesses
      SET
        owner_email = ${ownerEmail || null},
        owner_name = ${ownerName || null},
        updated_at = NOW()
      WHERE id = ${businessId}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Business non trovato'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Errore update-business:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nell\'aggiornamento'
    }, { status: 500 });
  }
}
