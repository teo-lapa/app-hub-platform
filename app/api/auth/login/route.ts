import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';
import { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    console.log('🔐 API Login: Received login request for:', email);

    if (!email || !password) {
      console.log('❌ API Login: Missing credentials');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Email e password sono obbligatori',
      }, { status: 400 });
    }

    // ========== STEP 1: AUTENTICA SU ODOO (PRIORITÀ) ==========
    console.log('🔑 Step 1: Authenticating on Odoo with user credentials...');
    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24517859';

    try {
      const odooAuthResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            db: odooDb,
            login: email,
            password: password
          },
          id: 1
        })
      });

      const odooAuthData = await odooAuthResponse.json();

      console.log('🔍 Odoo full response:', JSON.stringify(odooAuthData, null, 2));

      if (!odooAuthData.result || !odooAuthData.result.uid) {
        console.error('❌ Odoo authentication failed for:', email);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Credenziali non valide. Verifica email e password.',
        }, { status: 401 });
      }

      console.log('✅ Odoo authentication successful! UID:', odooAuthData.result.uid);

      // Prova a prendere session_id da diversi posti
      let odooSessionId = odooAuthData.result.session_id;

      // Se non c'è nel result, prova nei cookie della risposta
      if (!odooSessionId) {
        console.log('⚠️ session_id non trovato in result, controllo i cookie HTTP...');
        const setCookieHeader = odooAuthResponse.headers.get('set-cookie');
        console.log('🍪 Set-Cookie header:', setCookieHeader);

        if (setCookieHeader) {
          const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
          if (sessionMatch) {
            odooSessionId = sessionMatch[1];
            console.log('✅ session_id trovato nei cookie:', odooSessionId.substring(0, 20) + '...');
          }
        }
      }

      if (!odooSessionId) {
        console.error('❌ Odoo session_id mancante nella risposta');
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Errore autenticazione Odoo: session_id mancante',
        }, { status: 500 });
      }

      // ========== STEP 2: CREA UTENTE DAI DATI ODOO ==========
      console.log('✅ Step 2: Creating user object from Odoo data...');

      const user = {
        id: `odoo-${odooAuthData.result.uid}`,
        email: email,
        name: odooAuthData.result.name || odooAuthData.result.username || 'Utente Odoo',
        role: 'admin' as const,  // Gli utenti Odoo sono admin per default
        azienda: odooAuthData.result.company_name || 'LAPA',
        abilitato: true,
        appPermessi: ['profile', 'dashboard', 'admin'],
        createdAt: new Date(),
        updatedAt: new Date(),
        telefono: '',
        indirizzo: '',
        citta: '',
        cap: '',
        partitaIva: '',
        codiceCliente: '',
        note: 'Utente autenticato tramite Odoo'
      };

      const token = generateToken(user);
      console.log('✅ User object created:', user.name, '- UID:', odooAuthData.result.uid);

      // ========== STEP 3: CREA RESPONSE CON COOKIES ==========
      const response = NextResponse.json<ApiResponse>({
        success: true,
        data: { user, token },
        message: 'Login effettuato con successo',
      });

      // Imposta il cookie JWT
      response.cookies.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 giorni
        path: '/',
      });

      console.log('✅ Salvando cookie odoo_session_id:', odooSessionId.substring(0, 20) + '...');

      // Salva session_id Odoo in cookie separato
      response.cookies.set('odoo_session_id', odooSessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      console.log('✅ Login completato con successo! JWT token e Odoo session_id salvati.');
      return response;

    } catch (odooError) {
      console.error('❌ Odoo connection error:', odooError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Impossibile connettersi a Odoo. Riprova più tardi.',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Errore interno del server',
    }, { status: 500 });
  }
}
