/**
 * Odoo Admin Session Manager
 *
 * Gestisce autenticazione con credenziali ADMIN/SERVICE ACCOUNT
 * per permettere alle API del Portale Clienti di accedere ai dati Odoo
 * anche quando l'utente è un portal user (senza permessi diretti).
 *
 * SECURITY:
 * - Le API DEVONO filtrare i dati per partner_id dell'utente corrente
 * - NON esporre dati di altri clienti!
 */

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';
const ODOO_DB = process.env.ODOO_DB || '';

// Cache sessione admin (evita login ripetuti)
let adminSessionCache: {
  sessionId: string;
  uid: number;
  expiresAt: number;
} | null = null;

// Promise lock per evitare login multipli simultanei
let loginPromise: Promise<{ sessionId: string; uid: number }> | null = null;

const CACHE_DURATION = 3600000; // 1 ora

/**
 * Autentica come admin e restituisce session_id
 *
 * SCALABILITÀ:
 * - Se 60 clienti chiamano simultaneamente, SOLO 1 login viene eseguito
 * - Gli altri 59 aspettano la stessa Promise e condividono il risultato
 */
export async function getAdminSession(): Promise<{ sessionId: string; uid: number }> {
  // Check cache
  if (adminSessionCache && adminSessionCache.expiresAt > Date.now()) {
    console.log('✅ [ADMIN-SESSION] Using cached admin session');
    return {
      sessionId: adminSessionCache.sessionId,
      uid: adminSessionCache.uid,
    };
  }

  // Se c'è già un login in corso, aspetta quello invece di farne un altro
  if (loginPromise) {
    console.log('⏳ [ADMIN-SESSION] Login already in progress, waiting...');
    return await loginPromise;
  }

  console.log('🔐 [ADMIN-SESSION] Authenticating as admin/service account...');
  console.log('🔍 [ADMIN-SESSION] Config:', {
    url: ODOO_URL,
    db: ODOO_DB,
    emailSet: !!process.env.ODOO_ADMIN_EMAIL,
    passwordSet: !!process.env.ODOO_ADMIN_PASSWORD
  });

  const adminEmail = process.env.ODOO_ADMIN_EMAIL;
  const adminPassword = process.env.ODOO_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ODOO_ADMIN_EMAIL and ODOO_ADMIN_PASSWORD must be set in environment variables'
    );
  }

  // Crea Promise e salvala per altri client che arrivano contemporaneamente
  loginPromise = (async () => {
    try {
      // Login via Odoo /web/session/authenticate
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
          login: adminEmail,
          password: adminPassword,
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    });

    if (!response.ok) {
      throw new Error(`Odoo login failed: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error('❌ [ADMIN-SESSION] Odoo error:', data.error);
      throw new Error(data.error.data?.message || data.error.message);
    }

    if (!data.result || !data.result.uid) {
      console.error('❌ [ADMIN-SESSION] No UID in response:', data);
      throw new Error('Authentication failed: no UID returned');
    }

    // Estrai session_id dal cookie
    const setCookieHeader = response.headers.get('set-cookie');
    let sessionId = '';

    if (setCookieHeader) {
      const match = setCookieHeader.match(/session_id=([^;]+)/);
      if (match) {
        sessionId = match[1];
      }
    }

    if (!sessionId) {
      throw new Error('No session_id cookie received from Odoo');
    }

    const uid = data.result.uid;

    console.log('✅ [ADMIN-SESSION] Admin authenticated:', {
      uid,
      email: adminEmail,
      sessionId: sessionId.substring(0, 20) + '...',
    });

    // Cache session
    adminSessionCache = {
      sessionId,
      uid,
      expiresAt: Date.now() + CACHE_DURATION,
    };

    return { sessionId, uid };
  } catch (error: any) {
    console.error('❌ [ADMIN-SESSION] Authentication failed:', error);
    throw error;
  } finally {
    // Reset loginPromise quando finito (successo o errore)
    loginPromise = null;
  }
})();

  // Aspetta e restituisci il risultato
  return await loginPromise;
}

/**
 * Chiama Odoo API con sessione admin
 */
export async function callOdooAsAdmin(
  model: string,
  method: string,
  args: any[] = [],
  kwargs: any = {}
): Promise<any> {
  const { sessionId } = await getAdminSession();

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs,
      },
      id: Math.floor(Math.random() * 1000000),
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ [ADMIN-SESSION] Odoo API error:', data.error);
    throw new Error(data.error.data?.message || data.error.message);
  }

  return data.result;
}

/**
 * Invalida cache sessione admin (forza re-login)
 */
export function invalidateAdminSession() {
  console.log('🔄 [ADMIN-SESSION] Invalidating admin session cache');
  adminSessionCache = null;
}
