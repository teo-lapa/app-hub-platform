/**
 * ODOO AUTHENTICATION HELPER
 *
 * Questo file contiene le funzioni per autenticarsi con Odoo
 * TUTTE le API devono usare queste funzioni per garantire coerenza
 *
 * IMPORTANTE: Usa la sessione Odoo dell'utente loggato dal cookie 'odoo_session'
 * Se non disponibile, usa credenziali di fallback (solo per sviluppo)
 */

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

// Credenziali Odoo FALLBACK - solo se utente non loggato
const ODOO_LOGIN = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

/**
 * Autentica con Odoo usando la sessione dell'utente loggato
 * @param userCookies - Cookies dalla richiesta (contiene odoo_session se utente loggato)
 * @returns {Promise<{cookies: string | null, uid: number}>}
 */
export async function getOdooSession(userCookies?: string) {
  try {
    console.log('🔐 [ODOO-AUTH] Autenticazione con:', ODOO_URL);

    // Se ci sono cookies dell'utente, prova a usare la sessione esistente
    if (userCookies) {
      console.log('🍪 [ODOO-AUTH] Trovati cookies utente, verifico sessione esistente');

      // Prova a usare la sessione esistente
      const sessionCheck = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': userCookies
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {}
        })
      });

      if (sessionCheck.ok) {
        const sessionData = await sessionCheck.json();
        if (sessionData.result?.uid) {
          console.log('✅ [ODOO-AUTH] Sessione utente valida, UID:', sessionData.result.uid);
          return { cookies: userCookies, uid: sessionData.result.uid };
        }
      }
    }

    // Fallback: autentica con credenziali di default
    console.log('⚠️ [ODOO-AUTH] Nessuna sessione utente, uso credenziali fallback');

    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
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

    if (!authResponse.ok) {
      console.error('❌ [ODOO-AUTH] HTTP error:', authResponse.status, authResponse.statusText);
      throw new Error(`Errore HTTP ${authResponse.status}: ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();

    if (authData.error) {
      console.error('❌ [ODOO-AUTH] Errore Odoo:', authData.error);
      throw new Error(authData.error.data?.message || authData.error.message || 'Errore autenticazione Odoo');
    }

    if (!authData.result) {
      console.error('❌ [ODOO-AUTH] Risposta senza result:', authData);
      throw new Error('Risposta autenticazione non valida');
    }

    const cookies = authResponse.headers.get('set-cookie');
    const uid = authData.result.uid;

    console.log('✅ [ODOO-AUTH] Autenticato con credenziali fallback, UID:', uid);

    return { cookies, uid };
  } catch (error: any) {
    console.error('❌ [ODOO-AUTH] Errore completo:', error);
    throw error;
  }
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
    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  return data.result;
}

export { ODOO_URL, ODOO_DB };
