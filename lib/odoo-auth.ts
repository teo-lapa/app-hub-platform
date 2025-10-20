/**
 * ODOO AUTHENTICATION HELPER
 *
 * Questo file contiene le funzioni per autenticarsi con Odoo
 * TUTTE le API devono usare queste funzioni per garantire coerenza
 *
 * IMPORTANTE: Usa la sessione Odoo dell'utente loggato dal cookie 'odoo_session'
 * Se non disponibile, usa credenziali di fallback (solo per sviluppo)
 *
 * NEW: Now integrated with SessionManager for automatic session refresh
 */

import { getOdooSessionManager } from './odoo/sessionManager';

// Lazy eval env vars to allow dotenv to load first
const getOdooUrl = () => process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
const getOdooDb = () => process.env.ODOO_DB;

/**
 * Autentica con Odoo usando la sessione dell'utente loggato
 * @param userCookies - Cookies dalla richiesta (contiene odoo_session_id se utente loggato)
 * @returns {Promise<{cookies: string | null, uid: number}>}
 */
export async function getOdooSession(userCookies?: string) {
  const ODOO_URL = getOdooUrl();
  const ODOO_DB = getOdooDb();

  console.log('🔐 [ODOO-AUTH] Autenticazione con:', ODOO_URL);
  console.log('🔐 [ODOO-AUTH] Cookies ricevuti:', userCookies ? 'SI' : 'NO');

  // Se ci sono cookies dell'utente, usali direttamente
  if (userCookies) {
    console.log('🍪 [ODOO-AUTH] Trovati cookies utente');

    // NUOVO: Prima prova a cercare il cookie odoo_session_id (salvato dal login NEW SYSTEM)
    const odooSessionIdMatch = userCookies.match(/odoo_session_id=([^;]+)/);

    if (odooSessionIdMatch) {
      const sessionId = odooSessionIdMatch[1];
      console.log('✅ [ODOO-AUTH] Trovata sessione Odoo dal cookie odoo_session_id (NEW SYSTEM)');
      const odooCookie = `session_id=${sessionId}`;

      // Estrai UID dalla sessione Odoo chiamando l'endpoint /web/session/get_session_info
      try {
        const sessionInfoResponse = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': odooCookie
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {},
            id: Math.floor(Math.random() * 1000000000)
          })
        });

        const sessionInfo = await sessionInfoResponse.json();

        if (sessionInfo.result && sessionInfo.result.uid) {
          const uid = sessionInfo.result.uid;
          console.log('✅ [ODOO-AUTH] UID estratto dalla sessione Odoo:', uid);
          return { cookies: odooCookie, uid };
        } else {
          console.warn('⚠️ [ODOO-AUTH] Nessun UID nella risposta di session_info, uso fallback');
          return { cookies: odooCookie, uid: 1 };
        }
      } catch (e) {
        console.warn('⚠️ [ODOO-AUTH] Errore chiamata session_info:', e);
        return { cookies: odooCookie, uid: 1 };
      }
    }

    // FALLBACK: Prova a cercare il cookie odoo_session (vecchio formato JSON)
    const odooSessionMatch = userCookies.match(/odoo_session=([^;]+)/);

    if (odooSessionMatch) {
      try {
        // Decodifica il JSON del cookie odoo_session
        const sessionData = JSON.parse(decodeURIComponent(odooSessionMatch[1]));
        const sessionId = sessionData.session_id;

        if (sessionId) {
          console.log('✅ [ODOO-AUTH] Trovata sessione Odoo dal cookie odoo_session (OLD SYSTEM)');
          // Costruisci il cookie nel formato che Odoo si aspetta
          const odooCookie = `session_id=${sessionId}`;
          return { cookies: odooCookie, uid: sessionData.uid || 1 };
        }
      } catch (e) {
        console.warn('⚠️ [ODOO-AUTH] Errore parsing odoo_session cookie:', e);
      }
    }

    // Altrimenti cerca session_id direttamente
    const sessionMatch = userCookies.match(/session_id=([^;]+)/);
    if (sessionMatch) {
      console.log('✅ [ODOO-AUTH] session_id trovato direttamente');
      return { cookies: userCookies, uid: 1 };
    }

    console.warn('⚠️ [ODOO-AUTH] Nessuna sessione Odoo trovata nei cookies');
  } else {
    console.warn('⚠️ [ODOO-AUTH] userCookies è undefined o vuoto');
  }

  // 🚨 NESSUN FALLBACK - Se l'utente non ha cookie, non può accedere
  console.error('❌ [ODOO-AUTH] Nessuna sessione valida trovata - Utente non loggato');
  throw new Error('Utente non autenticato - Devi fare login');
}

/**
 * Chiama un metodo Odoo
 * @param cookies - Cookies della sessione Odoo (può essere null)
 * @param model - Nome del modello Odoo (es: 'stock.picking')
 * @param method - Nome del metodo (es: 'search_read')
 * @param args - Array di argomenti posizionali
 * @param kwargs - Oggetto con argomenti nominali
 * @returns {Promise<any>}
 */
export async function callOdoo(
  cookies: string | null,
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
) {
  const ODOO_URL = getOdooUrl();

  console.log(`🔵 [ODOO-CALL] ${model}.${method}`, { args: args.length, kwargs: Object.keys(kwargs).length });

  // 🚨 Se non ci sono cookies, l'utente non è loggato
  if (!cookies) {
    console.error('❌ [ODOO-CALL] Nessun cookie fornito - Utente non loggato');
    throw new Error('Utente non autenticato - Devi fare login');
  }

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies || ''
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
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error(`❌ [ODOO-CALL] ${model}.${method} FAILED:`, data.error);
    console.error(`❌ [ODOO-CALL] Error data:`, JSON.stringify(data.error, null, 2));

    // 🚨 Se la sessione è scaduta, l'utente deve rifare login
    if (data.error.data?.name === 'odoo.http.SessionExpiredException') {
      console.error('❌ [ODOO-CALL] Sessione scaduta - Utente deve rifare login');
      throw new Error('Sessione scaduta - Devi rifare login');
    }

    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  console.log(`✅ [ODOO-CALL] ${model}.${method} SUCCESS`);
  return data.result;
}

export { getOdooUrl as ODOO_URL, getOdooDb as ODOO_DB };
