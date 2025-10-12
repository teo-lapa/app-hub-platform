import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Credenziali per login automatico (come fa catalogo-lapa)
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

/**
 * API generica per chiamare Odoo RPC
 * Fa login automatico ogni volta per avere una sessione fresca (come catalogo-lapa)
 */
export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log('🔧 [API-ODOO-RPC] Chiamata:', model, method);

    // STESSO METODO DEL CATALOGO: Fa sempre login fresco
    console.log('🔐 [API-ODOO-RPC] Autenticazione fresca a Odoo...');

    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: ODOO_DB,
          login: ODOO_LOGIN,
          password: ODOO_PASSWORD
        },
        id: 1
      })
    });

    const authData = await authResponse.json();

    if (authData.error || !authData.result || !authData.result.uid) {
      console.error('❌ [API-ODOO-RPC] Autenticazione fallita:', authData.error);
      return NextResponse.json(
        {
          success: false,
          error: 'Autenticazione Odoo fallita'
        },
        { status: 401 }
      );
    }

    // Estrai session_id dal cookie Set-Cookie (come fa catalogo)
    const setCookieHeader = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (!sessionId) {
      console.error('❌ [API-ODOO-RPC] Session ID non trovato nei cookie');
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID non trovato'
        },
        { status: 500 }
      );
    }

    console.log('✅ [API-ODOO-RPC] Autenticato! Session ID:', sessionId.substring(0, 20) + '...');

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
      const errorText = await response.text();
      console.error('❌ [API-ODOO-RPC] HTTP Error:', response.status, response.statusText);
      console.error('❌ [API-ODOO-RPC] Response body:', errorText);
      return NextResponse.json(
        {
          success: false,
          error: `Errore HTTP ${response.status}: ${response.statusText}`
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('📦 [API-ODOO-RPC] Response data:', JSON.stringify(data).substring(0, 200));

    if (data.error) {
      console.error('❌ [API-ODOO-RPC] Errore Odoo:', JSON.stringify(data.error));

      // Se la sessione è scaduta, chiediamo di rifare login
      const errorMessage = data.error.data?.message || data.error.message || 'Errore chiamata Odoo';
      if (errorMessage.includes('Session expired') || errorMessage.includes('session_id')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Sessione scaduta. Effettua nuovamente il login alla piattaforma.'
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
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
