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

      // ========== STEP 2: DETERMINA RUOLO UTENTE DA ODOO ==========
      console.log('✅ Step 2: Determining user role from Odoo groups...');

      let userRole: 'admin' | 'dipendente' | 'cliente_premium' | 'visitor' = 'visitor';
      let appPermessi: string[] = ['profile'];

      // Prima controlla is_admin nella risposta di autenticazione
      const isAdmin = odooAuthData.result.is_admin || odooAuthData.result.is_system;

      console.log(`🔍 Initial check: is_admin=${isAdmin}, uid=${odooAuthData.result.uid}`);

      try {
        // Chiama API Odoo per ottenere i gruppi dell'utente
        const userGroupsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${odooSessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'res.users',
              method: 'read',
              args: [[odooAuthData.result.uid], ['groups_id', 'share']],
              kwargs: {}
            },
            id: 2
          })
        });

        const userGroupsData = await userGroupsResponse.json();
        console.log(`🔍 User groups response:`, JSON.stringify(userGroupsData));

        const groupIds = userGroupsData.result?.[0]?.groups_id || [];
        const isShare = userGroupsData.result?.[0]?.share || false;  // share=true significa utente portale

        console.log(`🔍 User groups: groupIds=${JSON.stringify(groupIds)}, is_share=${isShare}`);

        // Determina ruolo basato sui gruppi
        // Priorità: Admin > Dipendente (Interno) > Cliente Portal > Visitor

        if (isAdmin) {
          userRole = 'admin';
          appPermessi = ['profile', 'dashboard', 'admin', 'gestione-visibilita-app'];
          console.log('👑 User is ADMIN');
        } else if (!isShare && groupIds.length > 0) {
          // share=false significa utente interno (non portale)
          // Se ha gruppi ed è NOT share → Dipendente
          userRole = 'dipendente';
          appPermessi = ['profile', 'dashboard'];
          console.log('🏢 User is DIPENDENTE (Internal User - share=false)');
        } else if (isShare) {
          // share=true significa utente portale (cliente)
          userRole = 'cliente_premium';
          appPermessi = ['profile', 'portale-clienti'];
          console.log('👤 User is CLIENTE PORTAL (share=true)');
        } else {
          // Fallback: visitor/pubblico
          userRole = 'visitor';
          appPermessi = ['profile'];
          console.log('🌐 User is VISITOR (fallback)');
        }

      } catch (groupError) {
        console.error('⚠️ Errore caricamento gruppi utente, uso fallback basato su email:', groupError);

        // Fallback: se la chiamata ai gruppi fallisce, usa logica basata su email
        if (email.includes('lapa.ch') || email.includes('@lapa.')) {
          userRole = 'dipendente';
          appPermessi = ['profile', 'dashboard'];
          console.log('🏢 FALLBACK: User is DIPENDENTE (email lapa.ch)');
        } else {
          userRole = 'cliente_premium';
          appPermessi = ['profile', 'portale-clienti'];
          console.log('👤 FALLBACK: User is CLIENTE PORTAL (external email)');
        }
      }

      // ========== STEP 3: CREA UTENTE DAI DATI ODOO ==========
      console.log('✅ Step 3: Creating user object from Odoo data...');

      const user = {
        id: `odoo-${odooAuthData.result.uid}`,
        email: email,
        name: odooAuthData.result.name || odooAuthData.result.username || 'Utente Odoo',
        role: userRole,  // ✅ FIX: Ruolo determinato dinamicamente da Odoo!
        azienda: odooAuthData.result.company_name || 'LAPA',
        abilitato: true,
        appPermessi,  // ✅ FIX: Permessi basati sul ruolo
        createdAt: new Date(),
        updatedAt: new Date(),
        telefono: '',
        indirizzo: '',
        citta: '',
        cap: '',
        partitaIva: '',
        codiceCliente: '',
        note: `Utente Odoo - Ruolo: ${userRole}`
      };

      const token = generateToken(user);
      console.log(`✅ User object created: ${user.name} - UID: ${odooAuthData.result.uid} - Role: ${userRole}`);

      // ========== STEP 4: CREA RESPONSE CON COOKIES ==========
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
