/**
 * 🔧 ODOO HELPER - Gestione centralizzata chiamate Odoo
 * USA IL SESSION_ID DELL'UTENTE LOGGATO (niente più credenziali hardcoded!)
 */

import { cookies } from 'next/headers';

/**
 * Autentica con Odoo usando credenziali (fallback)
 */
async function authenticateWithCredentials(): Promise<string | null> {
  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';
  const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24586501';

  console.log('🔐 Autenticazione Odoo con credenziali...');

  try {
    const response = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: 'paul@lapa.ch',
          password: 'lapa201180',
        },
        id: Date.now(),
      })
    });

    const data = await response.json();

    if (data.error || !data.result?.uid) {
      console.error('❌ Autenticazione fallita:', data.error);
      return null;
    }

    // Estrai session_id dal cookie di risposta
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      const sessionMatch = cookies.match(/session_id=([^;]+)/);
      if (sessionMatch) {
        console.log('✅ Nuova sessione Odoo creata');
        return sessionMatch[1];
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Errore autenticazione:', error);
    return null;
  }
}

/**
 * Ottiene il session_id Odoo dell'utente loggato
 */
export async function getOdooSessionId(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.warn('⚠️ Nessun session_id trovato - utente deve fare login');
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('❌ Errore ottenimento session_id:', error);
    return null;
  }
}

/**
 * Esegue una chiamata RPC a Odoo (implementazione interna)
 */
async function callOdooInternal(
  model: string,
  method: string,
  args: any[],
  kwargs: any,
  sessionId: string
): Promise<any> {
  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';

  const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
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
      id: Date.now()
    })
  });

  if (!response.ok) {
    throw new Error(`Odoo call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Esegue una chiamata RPC a Odoo usando il session_id dell'utente
 */
export async function callOdoo(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<any> {
  let sessionId = await getOdooSessionId();

  if (!sessionId) {
    throw new Error('Session Odoo non valida. Impossibile autenticare.');
  }

  let data = await callOdooInternal(model, method, args, kwargs, sessionId);

  if (data.error) {
    const errorMessage = data.error.data?.message || data.error.message || 'Errore chiamata Odoo';

    // Se sessione scaduta, riprova con nuova autenticazione
    if (errorMessage.includes('Session expired')) {
      console.log('⚠️ Sessione scaduta, creo nuova sessione...');
      const newSessionId = await authenticateWithCredentials();

      if (newSessionId) {
        console.log('✅ Riprovo con nuova sessione...');
        data = await callOdooInternal(model, method, args, kwargs, newSessionId);

        if (data.error) {
          console.error('❌ Odoo error (dopo retry):', data.error);
          throw new Error(data.error.data?.message || data.error.message || 'Errore chiamata Odoo');
        }
      } else {
        throw new Error('Impossibile creare nuova sessione Odoo');
      }
    } else {
      console.error('❌ Odoo error:', data.error);
      throw new Error(errorMessage);
    }
  }

  return data.result;
}

/**
 * Cerca record su Odoo
 */
export async function searchReadOdoo(
  model: string,
  domain: any[] = [],
  fields: string[] = [],
  limit?: number,
  offset?: number
): Promise<any[]> {
  return await callOdoo(model, 'search_read', [], {
    domain,
    fields,
    limit,
    offset
  });
}

/**
 * Legge record specifici su Odoo
 */
export async function readOdoo(
  model: string,
  ids: number[],
  fields: string[] = []
): Promise<any[]> {
  return await callOdoo(model, 'read', [ids], { fields });
}

/**
 * Crea un record su Odoo
 */
export async function createOdoo(
  model: string,
  values: any
): Promise<number> {
  return await callOdoo(model, 'create', [values]);
}

/**
 * Aggiorna record su Odoo
 */
export async function writeOdoo(
  model: string,
  ids: number[],
  values: any
): Promise<boolean> {
  return await callOdoo(model, 'write', [ids, values]);
}

/**
 * Elimina record su Odoo
 */
export async function unlinkOdoo(
  model: string,
  ids: number[]
): Promise<boolean> {
  return await callOdoo(model, 'unlink', [ids]);
}
