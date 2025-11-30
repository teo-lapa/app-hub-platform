/**
 * Vercel Cron: Social Stream Sync
 *
 * Questo endpoint viene chiamato automaticamente da Vercel ogni ora
 * per sincronizzare i post dai social network (Facebook, Instagram, ecc.) in Odoo
 *
 * OPZIONE B (Alternativa a Scheduled Action Odoo)
 *
 * Vantaggi:
 * - Indipendente da Odoo (funziona anche se Odoo ha problemi)
 * - Log centralizzati in Vercel
 * - Più facile da debuggare
 * - Può gestire token refresh e retry logic
 *
 * Configurazione:
 * - Aggiungi in vercel.json:
 *   {
 *     "path": "/api/cron/social-stream-sync",
 *     "schedule": "0 * * * *"  // Every hour
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

interface OdooAuthResponse {
  jsonrpc: string;
  id: number;
  result?: {
    uid: number;
    session_id: string;
    [key: string]: any;
  };
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface OdooRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: {
      message?: string;
      [key: string]: any;
    };
  };
}

let sessionCookies: string | null = null;

/**
 * Autentica con Odoo e ottiene i cookie di sessione
 */
async function authenticateOdoo(): Promise<void> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      },
      id: 1
    })
  });

  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) {
    sessionCookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
  }

  const data: OdooAuthResponse = await response.json();

  if (data.error || !data.result?.uid) {
    throw new Error(`Odoo authentication failed: ${data.error?.message || 'Unknown error'}`);
  }
}

/**
 * Chiama un metodo RPC di Odoo
 */
async function callOdooMethod(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {}
): Promise<any> {
  if (!sessionCookies) {
    await authenticateOdoo();
  }

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookies!
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data: OdooRpcResponse = await response.json();

  if (data.error) {
    throw new Error(`Odoo RPC error: ${data.error.data?.message || data.error.message}`);
  }

  return data.result;
}

/**
 * Sincronizza tutti gli stream social
 */
async function syncAllSocialStreams(): Promise<{
  success: boolean;
  syncedStreams: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let syncedStreams = 0;

  try {
    // Cerca tutti gli stream attivi
    const streams = await callOdooMethod('social.stream', 'search_read', [[]], {
      fields: ['id', 'name', 'media_id']
    });

    console.log(`Found ${streams.length} social streams`);

    // Prova a sincronizzare ogni stream
    for (const stream of streams) {
      try {
        console.log(`Syncing stream: ${stream.name} (ID: ${stream.id})`);

        // Prova diversi metodi di refresh a seconda di cosa è disponibile
        // NOTA: Il metodo esatto dipende dalla versione di Odoo e dal modulo Social Marketing
        try {
          // Metodo 1: refresh_posts (se disponibile)
          await callOdooMethod('social.stream', 'refresh_posts', [[stream.id]]);
          syncedStreams++;
          console.log(`✓ Synced ${stream.name} using refresh_posts`);
        } catch (e1) {
          try {
            // Metodo 2: _fetch_stream_data (privato, potrebbe non funzionare)
            await callOdooMethod('social.stream', '_fetch_stream_data', [[stream.id]]);
            syncedStreams++;
            console.log(`✓ Synced ${stream.name} using _fetch_stream_data`);
          } catch (e2) {
            // Se nessun metodo funziona, logga l'errore ma continua
            const errorMsg = `Could not sync stream ${stream.name}: No valid sync method found`;
            console.warn(errorMsg);
            errors.push(errorMsg);
          }
        }
      } catch (error: any) {
        const errorMsg = `Error syncing stream ${stream.name}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: errors.length < streams.length, // Success if at least some streams synced
      syncedStreams,
      errors
    };

  } catch (error: any) {
    console.error('Fatal error in syncAllSocialStreams:', error);
    return {
      success: false,
      syncedStreams: 0,
      errors: [error.message]
    };
  }
}

/**
 * Endpoint Vercel Cron
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verifica authorization header (Vercel Cron secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔄 Starting social stream sync...');

  try {
    const result = await syncAllSocialStreams();

    const duration = Date.now() - startTime;

    const response = {
      success: result.success,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      syncedStreams: result.syncedStreams,
      errors: result.errors.length > 0 ? result.errors : undefined
    };

    console.log('✅ Social stream sync completed:', response);

    return NextResponse.json(response, {
      status: result.success ? 200 : 207 // 207 = Multi-Status (partial success)
    });

  } catch (error: any) {
    console.error('❌ Social stream sync failed:', error);

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}

// Anche POST per supportare test manuali
export async function POST(request: NextRequest) {
  return GET(request);
}
