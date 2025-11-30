import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * GET /api/email-ai/debug
 * Debug endpoint per controllare lo stato della connessione Gmail
 */
export async function GET(request: NextRequest) {
  try {
    // Get connection ID from cookie
    const connectionId = request.cookies.get('gmail_connection_id')?.value;

    if (!connectionId) {
      return NextResponse.json({
        error: 'No gmail_connection_id cookie found',
        help: 'Please connect Gmail first'
      }, { status: 404 });
    }

    // Get connection details
    const result = await sql`
      SELECT
        id,
        gmail_address,
        LENGTH(access_token) as access_token_len,
        LENGTH(refresh_token) as refresh_token_len,
        token_expires_at,
        sync_enabled,
        created_at,
        updated_at
      FROM gmail_connections
      WHERE id = ${connectionId}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        error: 'Gmail connection not found',
        connectionId
      }, { status: 404 });
    }

    const conn = result.rows[0];
    const tokenExpiry = new Date(conn.token_expires_at);
    const now = new Date();
    const isExpired = tokenExpiry < now;
    const minutesUntilExpiry = Math.round((tokenExpiry.getTime() - now.getTime()) / 60000);

    const debug = {
      connection: {
        id: conn.id,
        gmail: conn.gmail_address,
        syncEnabled: conn.sync_enabled
      },
      tokens: {
        accessTokenLength: conn.access_token_len,
        refreshTokenLength: conn.refresh_token_len || null,
        hasRefreshToken: !!conn.refresh_token_len
      },
      expiry: {
        expiresAt: tokenExpiry.toISOString(),
        isExpired,
        minutesUntilExpiry: isExpired ? 'EXPIRED' : minutesUntilExpiry
      },
      dates: {
        created: conn.created_at,
        updated: conn.updated_at
      },
      diagnosis: !conn.refresh_token_len
        ? '🔴 CRITICAL: No refresh_token! User MUST disconnect and reconnect Gmail.'
        : isExpired
        ? '🟡 WARNING: Access token expired but refresh_token available - should auto-refresh'
        : '🟢 OK: Connection is healthy',
      action: !conn.refresh_token_len
        ? 'Click "Disconnetti" then "Connetti Gmail" to get a new refresh_token'
        : isExpired
        ? 'Access token expired, system should refresh automatically when fetching emails'
        : 'Connection is working - you can fetch emails'
    };

    return NextResponse.json(debug, { status: 200 });
  } catch (error: any) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error.message
    }, { status: 500 });
  }
}
