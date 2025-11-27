import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'lapa-hub-secret-key-2024';

/**
 * GET /api/inventario-vocale/history
 *
 * Get inventory history for current user
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const token = request.cookies.get('token')?.value;
    let userId: number | null = null;
    let companyName: string | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userId = decoded.odooUserId || decoded.id;
        companyName = decoded.azienda;
      } catch (e) {
        console.warn('[VOICE-INVENTORY] Invalid token:', e);
      }
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('[VOICE-INVENTORY] Loading history:', {
      userId,
      companyName,
      limit,
      offset
    });

    // Check if table exists
    try {
      await sql`SELECT 1 FROM voice_inventory_sessions LIMIT 1`;
    } catch (e) {
      // Table doesn't exist yet
      return NextResponse.json({
        success: true,
        sessions: [],
        total: 0
      });
    }

    // Get sessions - filter by company if available, otherwise by user
    let result;
    let countResult;

    if (companyName) {
      // Get all sessions for this company
      result = await sql`
        SELECT
          id,
          user_id,
          user_name,
          company_name,
          location,
          transcription,
          products,
          audio_duration,
          status,
          created_at,
          updated_at
        FROM voice_inventory_sessions
        WHERE company_name = ${companyName}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM voice_inventory_sessions
        WHERE company_name = ${companyName}
      `;
    } else if (userId) {
      // Get sessions for this user only
      result = await sql`
        SELECT
          id,
          user_id,
          user_name,
          company_name,
          location,
          transcription,
          products,
          audio_duration,
          status,
          created_at,
          updated_at
        FROM voice_inventory_sessions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM voice_inventory_sessions
        WHERE user_id = ${userId}
      `;
    } else {
      // No filter - return empty (require auth)
      return NextResponse.json({
        success: true,
        sessions: [],
        total: 0
      });
    }

    const sessions = result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      company_name: row.company_name,
      location: row.location,
      transcription: row.transcription,
      products: row.products || [],
      audio_duration: row.audio_duration,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    const total = parseInt(countResult.rows[0]?.total || '0');

    return NextResponse.json({
      success: true,
      sessions,
      total
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] History error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore nel caricamento storico';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
