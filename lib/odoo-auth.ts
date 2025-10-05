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
  console.log('🔐 [ODOO-AUTH] Autenticazione con:', ODOO_URL);
  console.log('🔐 [ODOO-AUTH] Cookies ricevuti:', userCookies ? 'SI' : 'NO');

  // Se ci sono cookies dell'utente, usali direttamente
  if (userCookies) {
    console.log('🍪 [ODOO-AUTH] Trovati cookies utente, cerco session_id');
    console.log('🍪 [ODOO-AUTH] Cookies:', userCookies.substring(0, 100) + '...');

    // Estrai session_id dai cookies
    const sessionMatch = userCookies.match(/session_id=([^;]+)/);

    if (sessionMatch) {
      console.log('✅ [ODOO-AUTH] session_id trovato:', sessionMatch[1].substring(0, 20) + '...');
      // Ritorna i cookies così come sono, senza verificare con Odoo
      // La verifica verrà fatta automaticamente quando chiamiamo Odoo
      return { cookies: userCookies, uid: 1 }; // uid fittizio, non serve
    } else {
      console.error('❌ [ODOO-AUTH] session_id NON trovato nei cookies!');
      console.error('❌ [ODOO-AUTH] Cookies completi:', userCookies);
    }
  } else {
    console.error('❌ [ODOO-AUTH] userCookies è undefined o vuoto');
  }

  // Se non ci sono cookies, usa autenticazione con credenziali
  console.warn('⚠️ [ODOO-AUTH] Nessun cookie trovato, uso credenziali fallback');

  try {
    const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          db: ODOO_DB,
          login: ODOO_LOGIN,
          password: ODOO_PASSWORD
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ [ODOO-AUTH] Autenticazione fallita:', data.error);
      throw new Error('Autenticazione Odoo fallita');
    }

    const sessionCookie = response.headers.get('set-cookie');
    const uid = data.result?.uid;

    if (!uid || !sessionCookie) {
      throw new Error('Autenticazione fallita - no uid or session');
    }

    console.log('✅ [ODOO-AUTH] Autenticazione con credenziali riuscita, uid:', uid);
    return { cookies: sessionCookie, uid };

  } catch (error: any) {
    console.error('❌ [ODOO-AUTH] Errore autenticazione:', error);
    throw new Error('Sessione Odoo non trovata. Utente non autenticato.');
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
  console.log(`🔵 [ODOO-CALL] ${model}.${method}`, { args: args.length, kwargs: Object.keys(kwargs).length });

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
    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  console.log(`✅ [ODOO-CALL] ${model}.${method} SUCCESS`);
  return data.result;
}

export { ODOO_URL, ODOO_DB };
