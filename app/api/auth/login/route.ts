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

    console.log('🔍 API Login: Attempting authentication for:', email);
    const user = await authenticateUser(email, password);

    if (!user) {
      console.log('❌ API Login: Authentication failed for:', email);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Credenziali non valide',
      }, { status: 401 });
    }

    console.log('✅ API Login: Authentication successful for:', user.name);

    // NUOVO: Autentica ANCHE su Odoo con le stesse credenziali dell'utente
    console.log('🔑 Authenticating on Odoo with user credentials...');
    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

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
            password: password  // USA LA PASSWORD DELL'UTENTE (quella vera!)
          },
          id: 1
        })
      });

      const odooAuthData = await odooAuthResponse.json();

      if (!odooAuthData.result || !odooAuthData.result.uid) {
        console.error('❌ Odoo authentication failed for:', email);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Credenziali Odoo non valide. Verifica che l\'account esista su Odoo con la stessa email e password.',
        }, { status: 401 });
      }

      console.log('✅ Odoo authentication successful! UID:', odooAuthData.result.uid);

      const token = generateToken(user);

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

      // NUOVO: Salva session_id Odoo in cookie separato
      // Ora tutte le API possono usare questo session_id per chiamare Odoo!
      response.cookies.set('odoo_session_id', odooAuthData.result.session_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

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
