/**
 * Helper per autenticazione Odoo in ambiente locale
 * Crea una sessione temporanea usando username/password
 */

let cachedSession: { session_id: string; expires: number } | null = null;

export async function getLocalOdooSession(): Promise<string | null> {
  const odooUrl = process.env.ODOO_URL;
  const odooDb = process.env.ODOO_DB;

  // In locale, usiamo credenziali admin per testing
  const username = 'admin';
  const password = 'admin';

  // Cache la sessione per 1 ora
  if (cachedSession && cachedSession.expires > Date.now()) {
    console.log('🔄 [Odoo Local Auth] Usando sessione cached');
    return cachedSession.session_id;
  }

  try {
    console.log('🔐 [Odoo Local Auth] Creazione nuova sessione...');

    // Fai login su Odoo
    const loginResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: username,
          password: password
        }
      })
    });

    const loginData = await loginResponse.json();

    if (loginData.error) {
      console.error('❌ [Odoo Local Auth] Errore login:', loginData.error);
      return null;
    }

    if (!loginData.result || !loginData.result.session_id) {
      console.error('❌ [Odoo Local Auth] Nessun session_id ricevuto');
      return null;
    }

    const sessionId = loginData.result.session_id;

    // Cache la sessione per 1 ora
    cachedSession = {
      session_id: sessionId,
      expires: Date.now() + (60 * 60 * 1000) // 1 ora
    };

    console.log('✅ [Odoo Local Auth] Sessione creata con successo');
    return sessionId;

  } catch (error) {
    console.error('❌ [Odoo Local Auth] Errore:', error);
    return null;
  }
}
