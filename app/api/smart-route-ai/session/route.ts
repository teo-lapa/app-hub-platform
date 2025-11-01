import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check for Odoo session cookie
    const cookieStore = cookies();
    const odooSessionCookie = cookieStore.get('odoo_session');

    if (!odooSessionCookie?.value) {
      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'Nessuna sessione Odoo trovata'
      }, { status: 200 });
    }

    // Parse session data
    const sessionData = JSON.parse(odooSessionCookie.value);

    if (!sessionData.sessionId) {
      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'Session ID mancante'
      }, { status: 200 });
    }

    // Test Odoo connection
    const rpcClient = createOdooRPCClient(sessionData.sessionId);
    const isConnected = await rpcClient.testConnection();

    if (isConnected) {
      // Try to get current user info
      const user = await rpcClient.getCurrentUser();

      return NextResponse.json({
        connected: true,
        userId: user?.id || sessionData.uid || null,
        userName: user?.name || sessionData.name || 'User',
        sessionId: sessionData.sessionId
      }, { status: 200 });
    }

    return NextResponse.json({
      connected: false,
      userId: null,
      message: 'Test connessione Odoo fallito'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Smart Route AI] Session check error:', error);
    return NextResponse.json({
      connected: false,
      userId: null,
      error: error.message || 'Errore verifica sessione'
    }, { status: 200 });
  }
}
