import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { cookies } from 'next/headers';

/**
 * POST /api/email-ai/disconnect
 * Disconnetti connessione Gmail e cancella cookie
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      // Prova a prendere da cookie
      const cookieStore = await cookies();
      const gmailConnectionId = cookieStore.get('gmail_connection_id')?.value;

      if (!gmailConnectionId) {
        return NextResponse.json({ error: 'No connection to disconnect' }, { status: 400 });
      }
    }

    const idToDisconnect = connectionId || (await cookies()).get('gmail_connection_id')?.value;

    console.log('[DISCONNECT] Disconnecting Gmail connection:', idToDisconnect);

    // Disabilita connessione nel database
    await sql`
      UPDATE gmail_connections
      SET sync_enabled = false,
          updated_at = NOW()
      WHERE id = ${idToDisconnect}
    `;

    console.log('[DISCONNECT] ✅ Gmail connection disabled');

    // Cancella cookie
    const response = NextResponse.json({
      success: true,
      message: 'Gmail disconnesso con successo'
    });

    response.cookies.delete('gmail_connection_id');

    return response;
  } catch (error: any) {
    console.error('[DISCONNECT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail', details: error.message },
      { status: 500 }
    );
  }
}
