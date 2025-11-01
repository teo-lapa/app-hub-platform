import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check for Odoo session cookie (usa odoo_session_id come le altre API)
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        connected: false,
        userId: null,
        message: 'Nessuna sessione Odoo trovata'
      }, { status: 200 });
    }

    // Test Odoo connection
    const rpcClient = createOdooRPCClient(sessionId);
    const isConnected = await rpcClient.testConnection();

    if (isConnected) {
      // Try to get current user info
      const user = await rpcClient.getCurrentUser();

      return NextResponse.json({
        connected: true,
        userId: user?.id || null,
        userName: user?.name || 'User',
        sessionId: sessionId
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
