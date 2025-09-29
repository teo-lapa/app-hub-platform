import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      // Se non c'è token, usa credenziali di default (stesso del catalogo)
      return await authenticateWithCredentials('paul@lapa.ch', 'lapa201180');
    }

    // Verifica il token JWT per ottenere le credenziali dell'utente
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    if (!decoded || !decoded.email) {
      // Se token non valido, usa credenziali di default
      return await authenticateWithCredentials('paul@lapa.ch', 'lapa201180');
    }

    // Usa le credenziali dell'utente loggato
    // Per ora usiamo la password di default, in futuro si potrebbe salvare nel JWT
    return await authenticateWithCredentials(decoded.email, decoded.password || 'lapa201180');

  } catch (error) {
    console.error('Errore autenticazione unificata:', error);
    // Fallback alle credenziali di default
    return await authenticateWithCredentials('paul@lapa.ch', 'lapa201180');
  }
}

async function authenticateWithCredentials(email: string, password: string) {
  try {
    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    console.log('🔑 Autenticazione unificata per:', email);

    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
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

    const authData = await authResponse.json();

    if (authData.result && authData.result.uid) {
      console.log('✅ Autenticazione unificata riuscita');

      return NextResponse.json({
        success: true,
        data: {
          uid: authData.result.uid,
          session_id: authData.result.session_id,
          user: authData.result
        },
        method: 'unified_authentication'
      });
    } else {
      console.error('❌ Autenticazione unificata fallita');

      return NextResponse.json({
        success: false,
        error: 'Autenticazione fallita',
        details: authData.error || 'UID non ricevuto'
      }, { status: 401 });
    }

  } catch (error) {
    console.error('❌ Errore autenticazione unificata:', error);

    return NextResponse.json({
      success: false,
      error: 'Errore di connessione',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}