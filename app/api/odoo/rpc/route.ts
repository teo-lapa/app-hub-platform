import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

// Configurazione timeout per route API - 2 minuti
export const maxDuration = 120; // Timeout 2 minuti per chiamate Odoo pesanti
export const dynamic = 'force-dynamic';

/**
 * API generica per chiamare Odoo RPC
 * USA IL SESSION_ID DELL'UTENTE LOGGATO (no credenziali hardcoded!)
 */
export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log('🔧 [API-ODOO-RPC] Chiamata:', model, method);

    // NUOVO: Usa il session_id dell'utente loggato
    const sessionId = await getOdooSessionId();

    if (!sessionId) {
      console.error('❌ [API-ODOO-RPC] Nessun session_id trovato. L\'utente deve fare login.');
      return NextResponse.json(
        {
          success: false,
          error: 'Sessione non valida. Effettua nuovamente il login alla piattaforma.'
        },
        { status: 401 }
      );
    }

    console.log('✅ [API-ODOO-RPC] Usando session_id dell\'utente loggato');

    // Chiama Odoo con session ID dell'utente
    console.log('📡 [API-ODOO-RPC] Chiamata a Odoo:', `${ODOO_URL}/web/dataset/call_kw/${model}/${method}`);

    // Timeout controller per chiamate RPC - 60 secondi
    const rpcController = new AbortController();
    const rpcTimeout = setTimeout(() => rpcController.abort(), 60000); // 60 secondi per chiamate pesanti

    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      signal: rpcController.signal,
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

    clearTimeout(rpcTimeout);

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
