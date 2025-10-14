/**
 * ODOO AUTHENTICATION HELPER
 *
 * Questo file contiene le funzioni per autenticarsi con Odoo
 * TUTTE le API devono usare queste funzioni per garantire coerenza
 *
 * IMPORTANTE: Usa la sessione Odoo dell'utente loggato dal cookie 'odoo_session'
 * Se non disponibile, usa credenziali di fallback (solo per sviluppo)
 */

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24517859';

// Credenziali Odoo FALLBACK - solo se utente non loggato
const ODOO_LOGIN = process.env.ODOO_USERNAME || 'paul@lapa.ch';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'lapa201180';

// Cache sessione fallback per evitare re-autenticazioni multiple
let cachedFallbackSession: { cookie: string; expires: number } | null = null;

/**
 * Autentica con Odoo usando la sessione dell'utente loggato
 * @param userCookies - Cookies dalla richiesta (contiene odoo_session_id se utente loggato)
 * @returns {Promise<{cookies: string | null, uid: number}>}
 */
export async function getOdooSession(userCookies?: string) {
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

  // Se non ci sono cookies validi, USA CREDENZIALI DI FALLBACK
  console.log('🔑 [ODOO-AUTH] Usando credenziali di fallback:', ODOO_LOGIN);

  // Controlla cache
  if (cachedFallbackSession && cachedFallbackSession.expires > Date.now()) {
    console.log('✅ [ODOO-AUTH] Usando sessione fallback cached');
    return { cookies: cachedFallbackSession.cookie, uid: 1 };
  }

  // Autentica con credenziali fallback
  try {
    const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
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

    const authData = await authResponse.json();

    if (authData.error || !authData.result?.uid) {
      console.error('❌ [ODOO-AUTH] Autenticazione fallback fallita:', authData.error);
      throw new Error('Autenticazione Odoo fallita');
    }

    // Estrai il cookie dalla risposta
    const setCookie = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

    if (!sessionMatch) {
      throw new Error('Nessun session_id ricevuto da Odoo');
    }

    const sessionCookie = `session_id=${sessionMatch[1]}`;

    // Salva in cache per 5 minuti
    cachedFallbackSession = {
      cookie: sessionCookie,
      expires: Date.now() + 5 * 60 * 1000
    };

    console.log('✅ [ODOO-AUTH] Autenticazione fallback riuscita! UID:', authData.result.uid);
    return { cookies: sessionCookie, uid: authData.result.uid };

  } catch (error: any) {
    console.error('❌ [ODOO-AUTH] Errore autenticazione fallback:', error);
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
  kwargs: any = {},
  retryWithFallback: boolean = true
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

    // Se la sessione è scaduta E abbiamo credenziali fallback, prova a riautenticare
    if (retryWithFallback && data.error.data?.name === 'odoo.http.SessionExpiredException') {
      console.warn('⚠️ [ODOO-CALL] Sessione scaduta, tentativo autenticazione fallback...');

      try {
        let newCookie: string;

        // Usa sessione cached se ancora valida (cache 5 minuti)
        if (cachedFallbackSession && cachedFallbackSession.expires > Date.now()) {
          console.log('✅ [ODOO-CALL] Uso sessione fallback cached');
          newCookie = cachedFallbackSession.cookie;
        } else {
          // Autentica con credenziali
          const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
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

          const authData = await authResponse.json();

          if (authData.error || !authData.result?.uid) {
            throw new Error('Autenticazione fallback fallita');
          }

          // Estrai il cookie dalla risposta
          const setCookie = authResponse.headers.get('set-cookie');
          const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

          if (!sessionMatch) {
            throw new Error('Nessun session_id ricevuto');
          }

          newCookie = `session_id=${sessionMatch[1]}`;

          // Salva in cache per 5 minuti
          cachedFallbackSession = {
            cookie: newCookie,
            expires: Date.now() + 5 * 60 * 1000 // 5 minuti
          };

          console.log('✅ [ODOO-CALL] Autenticazione fallback riuscita e cached');
        }

        // Riprova la chiamata con la nuova sessione (senza retry per evitare loop infinito)
        return await callOdoo(newCookie, model, method, args, kwargs, false);

      } catch (fallbackError: any) {
        console.error('❌ [ODOO-CALL] Autenticazione fallback fallita:', fallbackError);
        // Invalida cache se fallisce
        cachedFallbackSession = null;
      }
    }

    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  console.log(`✅ [ODOO-CALL] ${model}.${method} SUCCESS`);
  return data.result;
}

export { ODOO_URL, ODOO_DB };
