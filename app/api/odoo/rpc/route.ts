import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * API generica per chiamare Odoo RPC
 * Usa SOLO la sessione Odoo dell'utente loggato (NO fallback ad App Hub Bot)
 */
export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log('🔧 [API-ODOO-RPC] Chiamata:', model, method);

    // Recupera session da cookies
    const cookieStore = await cookies();
    let sessionId: string | null = null;

    // Tentativo 1: Leggi da odoo_session cookie (set da /api/auth/odoo-login)
    const odooSessionCookie = cookieStore.get('odoo_session');
    if (odooSessionCookie?.value) {
      try {
        const sessionData = JSON.parse(odooSessionCookie.value);
        sessionId = sessionData.session_id || sessionData.sessionId;
        console.log('🍪 [API-ODOO-RPC] Session ID da odoo_session cookie');
      } catch (e) {
        console.log('⚠️ [API-ODOO-RPC] Errore parsing odoo_session cookie');
      }
    }

    // Tentativo 2: Estrai sessionId dal JWT token
    if (!sessionId) {
      const tokenCookie = cookieStore.get('token');
      if (tokenCookie?.value) {
        try {
          const decoded = jwt.verify(tokenCookie.value, JWT_SECRET) as any;
          sessionId = decoded.sessionId;
          console.log('🔑 [API-ODOO-RPC] Session ID da JWT token - Utente:', decoded.name, '(UID:', decoded.odooUid, ')');
        } catch (e) {
          console.log('⚠️ [API-ODOO-RPC] Errore verifica JWT token');
        }
      }
    }

    // Se non troviamo session ID, errore 401
    if (!sessionId) {
      console.error('❌ [API-ODOO-RPC] Nessuna sessione Odoo trovata');
      return NextResponse.json(
        { error: 'Non autenticato. Effettua il login alla piattaforma.' },
        { status: 401 }
      );
    }

    // Chiama Odoo con session ID dell'utente
    console.log('📡 [API-ODOO-RPC] Chiamata a Odoo:', `${ODOO_URL}/web/dataset/call_kw/${model}/${method}`);

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: kwargs || {}
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      console.error('❌ [API-ODOO-RPC] HTTP Error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Errore HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.error) {
      console.error('❌ [API-ODOO-RPC] Errore Odoo:', data.error);
      return NextResponse.json(
        { error: data.error.data?.message || data.error.message || 'Errore chiamata Odoo' },
        { status: 400 }
      );
    }

    console.log('✅ [API-ODOO-RPC] Successo');
    return NextResponse.json({
      success: true,
      result: data.result
    });

  } catch (error: any) {
    console.error('💥 [API-ODOO-RPC] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}
