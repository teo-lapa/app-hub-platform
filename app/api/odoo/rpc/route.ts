import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

// Configurazione timeout per route API - 2 minuti
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * ⚠️⚠️⚠️ IMPORTANTE - SISTEMA DI AUTENTICAZIONE ODOO ⚠️⚠️⚠️
 *
 * QUESTA API USA **SOLO** LE CREDENZIALI DELL'UTENTE LOGGATO.
 *
 * ❌ NON ESISTE NESSUN FALLBACK
 * ❌ NON ESISTONO CREDENZIALI HARDCODED
 * ❌ SE L'UTENTE NON È LOGGATO → 401 UNAUTHORIZED
 *
 * COME FUNZIONA:
 * 1. L'utente fa login sulla piattaforma con email/password
 * 2. Il sistema verifica le credenziali sulla piattaforma
 * 3. Il sistema autentica ANCHE su Odoo con le STESSE credenziali
 * 4. Salva il session_id di Odoo in un cookie (odoo_session_id)
 * 5. Questa API usa quel session_id per tutte le chiamate Odoo
 *
 * REQUISITO FONDAMENTALE:
 * - Le credenziali dell'utente DEVONO essere uguali su Piattaforma e Odoo
 * - Stesso email, stessa password
 * - Se l'utente esiste solo sulla piattaforma ma non su Odoo, il login fallisce
 * - Se l'utente non è loggato, TUTTE le chiamate falliscono con 401
 */
export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log('🔧 [API-ODOO-RPC] Chiamata:', model, method);

    // ========== OTTIENI SESSION_ID DELL'UTENTE LOGGATO ==========
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [API-ODOO-RPC] Utente NON loggato - accesso negato');
      return NextResponse.json(
        {
          success: false,
          error: 'Devi fare login per accedere a questa risorsa'
        },
        { status: 401 }
      );
    }

    console.log('✅ [API-ODOO-RPC] Usando session_id dell\'utente loggato');

    // Fai la chiamata con il session_id dell'utente
    const result = await makeOdooCall(model, method, args, kwargs, sessionId);

    if (!result.success) {
      // Se la sessione è scaduta, ritorna 401
      if (result.error?.includes('scaduta') || result.error?.includes('expired')) {
        return NextResponse.json(result, { status: 401 });
      }
      // Altri errori
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('💥 [API-ODOO-RPC] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore server'
      },
      { status: 500 }
    );
  }
}

/**
 * Funzione helper per fare chiamate RPC a Odoo
 */
async function makeOdooCall(
  model: string,
  method: string,
  args: any[],
  kwargs: any,
  sessionId: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
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
      return {
        success: false,
        error: `Errore HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    console.log('📦 [API-ODOO-RPC] Response data:', JSON.stringify(data).substring(0, 200));

    if (data.error) {
      console.error('❌ [API-ODOO-RPC] Errore Odoo:', JSON.stringify(data.error));

      // Se la sessione è scaduta, ritorna un errore specifico
      const errorMessage = data.error.data?.message || data.error.message || 'Errore chiamata Odoo';
      if (errorMessage.includes('Session expired') ||
          errorMessage.includes('session_id') ||
          errorMessage.includes('SessionExpiredException')) {
        return {
          success: false,
          error: 'Sessione Odoo scaduta. Effettua nuovamente il login alla piattaforma.'
        };
      }

      return {
        success: false,
        error: errorMessage
      };
    }

    console.log('✅ [API-ODOO-RPC] Successo');
    return {
      success: true,
      result: data.result
    };

  } catch (error: any) {
    console.error('💥 [API-ODOO-RPC] Errore nella chiamata:', error);
    return {
      success: false,
      error: error.message || 'Errore nella chiamata Odoo'
    };
  }
}
