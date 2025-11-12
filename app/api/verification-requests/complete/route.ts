/**
 * API endpoint per completare una richiesta di verifica
 * POST: Marca una richiesta come verificata
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, verifiedBy, note } = body;

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'requestId è obbligatorio' },
        { status: 400 }
      );
    }

    // Marca come verificata
    const result = await db.query(`
      UPDATE verification_requests
      SET
        verified_at = NOW(),
        verified_by = ${verifiedBy ? `'${verifiedBy.replace(/'/g, "''")}'` : 'NULL'},
        note = CASE
          WHEN ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'} IS NOT NULL
          THEN COALESCE(note, '') || ' | Verifica: ' || ${note ? `'${note.replace(/'/g, "''")}'` : "''"}
          ELSE note
        END,
        updated_at = NOW()
      WHERE id = ${requestId}
        AND verified_at IS NULL
      RETURNING id, product_name, location_name
    `);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Richiesta non trovata o già verificata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Richiesta completata',
      request: result.rows[0],
    });
  } catch (error: any) {
    console.error('Errore POST verification-requests/complete:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
