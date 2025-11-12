/**
 * API endpoint per gestione richieste di verifica inventario
 * GET: Lista tutte le richieste attive
 * POST: Crea nuova richiesta di verifica
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Lista richieste attive
export async function GET(req: NextRequest) {
  try {
    // Verifica se tabella esiste, altrimenti creala
    await ensureTableExists();

    const result = await db.query(`
      SELECT
        vr.id,
        vr.product_id,
        vr.product_name,
        vr.lot_id,
        vr.lot_name,
        vr.location_id,
        vr.location_name,
        vr.quantity,
        vr.expiry_date,
        vr.requested_at,
        vr.requested_by,
        vr.note,
        vr.verified_at,
        vr.verified_by
      FROM verification_requests vr
      WHERE vr.verified_at IS NULL
      ORDER BY vr.requested_at DESC
    `);

    const count = result.rows.length;

    return NextResponse.json({
      success: true,
      count,
      requests: result.rows,
    });
  } catch (error: any) {
    console.error('Errore GET verification-requests:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Crea nuova richiesta
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      productId,
      productName,
      lotId,
      lotName,
      locationId,
      locationName,
      quantity,
      expiryDate,
      requestedBy,
      note,
    } = body;

    // Validazione
    if (!productId || !locationId) {
      return NextResponse.json(
        { success: false, error: 'productId e locationId sono obbligatori' },
        { status: 400 }
      );
    }

    await ensureTableExists();

    // Verifica se esiste già una richiesta attiva per questo prodotto/lotto/ubicazione
    const existingCheck = await db.query(`
      SELECT id FROM verification_requests
      WHERE product_id = ${productId}
        AND lot_id = ${lotId || 'NULL'}
        AND location_id = ${locationId}
        AND verified_at IS NULL
      LIMIT 1
    `);

    if (existingCheck.rows.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Richiesta già esistente',
        requestId: existingCheck.rows[0].id,
      });
    }

    // Inserisci nuova richiesta
    const result = await db.query(`
      INSERT INTO verification_requests (
        product_id,
        product_name,
        lot_id,
        lot_name,
        location_id,
        location_name,
        quantity,
        expiry_date,
        requested_at,
        requested_by,
        note
      ) VALUES (
        ${productId},
        ${productName ? `'${productName.replace(/'/g, "''")}'` : 'NULL'},
        ${lotId || 'NULL'},
        ${lotName ? `'${lotName.replace(/'/g, "''")}'` : 'NULL'},
        ${locationId},
        ${locationName ? `'${locationName.replace(/'/g, "''")}'` : 'NULL'},
        ${quantity || 0},
        ${expiryDate ? `'${expiryDate}'` : 'NULL'},
        NOW(),
        ${requestedBy ? `'${requestedBy.replace(/'/g, "''")}'` : 'NULL'},
        ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'}
      )
      RETURNING id
    `);

    return NextResponse.json({
      success: true,
      requestId: result.rows[0].id,
      message: 'Richiesta di verifica creata',
    });
  } catch (error: any) {
    console.error('Errore POST verification-requests:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Assicura che la tabella esista
async function ensureTableExists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        product_name TEXT,
        lot_id INTEGER,
        lot_name TEXT,
        location_id INTEGER NOT NULL,
        location_name TEXT,
        quantity DECIMAL(16,3) DEFAULT 0,
        expiry_date DATE,
        requested_at TIMESTAMP DEFAULT NOW(),
        requested_by TEXT,
        note TEXT,
        verified_at TIMESTAMP,
        verified_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Crea indici per performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_product
      ON verification_requests(product_id, lot_id, location_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_verification_requests_verified
      ON verification_requests(verified_at)
    `);
  } catch (error: any) {
    console.error('Errore creazione tabella verification_requests:', error);
    throw error;
  }
}
