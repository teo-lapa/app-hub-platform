/**
 * ODOO AUTHENTICATION HELPER
 *
 * Questo file contiene le funzioni per autenticarsi con Odoo
 * TUTTE le API devono usare queste funzioni per garantire coerenza
 */

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

// Credenziali Odoo - USATE DA TUTTE LE APP
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

/**
 * Autentica con Odoo e ritorna cookies e UID
 * @returns {Promise<{cookies: string | null, uid: number}>}
 */
export async function getOdooSession() {
  try {
    console.log('🔐 [ODOO-AUTH] Autenticazione con:', ODOO_URL);

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

    console.log('✅ [ODOO-AUTH] Autenticato con UID:', uid);

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
