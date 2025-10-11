/**
 * 🔧 ODOO HELPER - Gestione centralizzata chiamate Odoo
 * USA IL SESSION_ID DELL'UTENTE LOGGATO (niente più credenziali hardcoded!)
 */

import { cookies } from 'next/headers';

/**
 * Ottiene il session_id Odoo dell'utente loggato
 */
export async function getOdooSessionId(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ Nessun session_id Odoo trovato. L\'utente deve fare login.');
      return null;
    }

    return sessionId;
  } catch (error) {
    console.error('❌ Errore ottenimento session_id:', error);
    return null;
  }
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
  const sessionId = await getOdooSessionId();

  if (!sessionId) {
    throw new Error('Session Odoo non valida. Effettua nuovamente il login.');
  }

  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';

  const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`  // USA IL SESSION_ID DELL'UTENTE!
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

  if (data.error) {
    console.error('❌ Odoo error:', data.error);
    throw new Error(data.error.data?.message || 'Errore chiamata Odoo');
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
