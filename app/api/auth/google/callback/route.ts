import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/auth/google-oauth';
import { generateToken } from '@/lib/auth';

// Forza rendering dinamico (necessario per searchParams)
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * GET /api/auth/google/callback
 * Callback OAuth Google - riceve il code, autentica l'utente e lo logga
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Se Google ha restituito un errore
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(new URL(`/?error=google_${error}`, BASE_URL));
    }

    // Se non c'è il code, errore
    if (!code) {
      console.error('Missing authorization code');
      return NextResponse.redirect(new URL('/?error=missing_code', BASE_URL));
    }

    console.log('🔐 Google OAuth callback received code');

    // ========== STEP 1: SCAMBIA CODE PER TOKEN ==========
    console.log('🔑 Step 1: Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code);
    console.log('✅ Tokens received from Google');

    // ========== STEP 2: OTTIENI INFO UTENTE DA GOOGLE ==========
    console.log('👤 Step 2: Getting user info from Google...');
    const googleUser = await getGoogleUserInfo(tokens.access_token);
    console.log(`✅ Google user: ${googleUser.email} (${googleUser.name})`);

    if (!googleUser.verified_email) {
      console.error('Email not verified:', googleUser.email);
      return NextResponse.redirect(new URL('/?error=email_not_verified', BASE_URL));
    }

    // ========== STEP 3: CERCA/CREA PARTNER IN ODOO ==========
    console.log('🔍 Step 3: Searching for partner in Odoo...');

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';
    const odooAdminEmail = process.env.ODOO_ADMIN_EMAIL || 'apphubplatform@lapa.ch';
    const odooAdminPassword = process.env.ODOO_ADMIN_PASSWORD || 'apphubplatform2025';

    // Prima autentichiamo come admin per poter cercare/creare partner
    const adminAuthResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: odooAdminEmail,
          password: odooAdminPassword
        },
        id: 1
      })
    });

    const adminAuthData = await adminAuthResponse.json();

    if (!adminAuthData.result || !adminAuthData.result.uid) {
      console.error('❌ Odoo admin authentication failed');
      return NextResponse.redirect(new URL('/?error=odoo_connection_error', BASE_URL));
    }

    // Ottieni session_id admin
    let adminSessionId = adminAuthData.result.session_id;
    if (!adminSessionId) {
      const setCookieHeader = adminAuthResponse.headers.get('set-cookie');
      if (setCookieHeader) {
        const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
        if (sessionMatch) {
          adminSessionId = sessionMatch[1];
        }
      }
    }

    if (!adminSessionId) {
      console.error('❌ Odoo admin session_id missing');
      return NextResponse.redirect(new URL('/?error=odoo_session_error', BASE_URL));
    }

    console.log('✅ Odoo admin authenticated');

    // Cerca partner con questa email
    const searchPartnerResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${adminSessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [[['email', '=', googleUser.email]]],
          kwargs: {
            fields: ['id', 'name', 'email', 'user_ids'],
            limit: 1
          }
        },
        id: 2
      })
    });

    const searchPartnerData = await searchPartnerResponse.json();
    let partnerId: number | null = null;
    let odooUserId: number | null = null;
    let userRole: 'admin' | 'dipendente' | 'cliente_premium' | 'visitor' = 'visitor';
    let appPermessi: string[] = ['profile'];
    let userName = googleUser.name;

    if (searchPartnerData.result && searchPartnerData.result.length > 0) {
      // Partner esistente trovato!
      const existingPartner = searchPartnerData.result[0];
      partnerId = existingPartner.id;
      userName = existingPartner.name || googleUser.name;
      console.log(`✅ Partner esistente trovato: ID ${partnerId} - ${userName}`);

      // Se ha un utente collegato, ottieni i suoi permessi
      if (existingPartner.user_ids && existingPartner.user_ids.length > 0) {
        odooUserId = existingPartner.user_ids[0];
        console.log(`✅ Utente Odoo collegato: ID ${odooUserId}`);

        // Ottieni i gruppi dell'utente per determinare il ruolo
        const userGroupsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${adminSessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'res.users',
              method: 'read',
              args: [[odooUserId], ['groups_id', 'share']],
              kwargs: {}
            },
            id: 3
          })
        });

        const userGroupsData = await userGroupsResponse.json();
        const groupIds = userGroupsData.result?.[0]?.groups_id || [];
        const isShare = userGroupsData.result?.[0]?.share || false;

        console.log(`🔍 User groups: ${groupIds.length} groups, share=${isShare}`);

        // Determina ruolo
        if (!isShare && groupIds.length > 0) {
          userRole = 'dipendente';
          appPermessi = ['profile', 'dashboard'];
          console.log('🏢 User is DIPENDENTE (Internal User)');
        } else if (isShare) {
          userRole = 'cliente_premium';
          appPermessi = ['profile', 'portale-clienti'];
          console.log('👤 User is CLIENTE PORTAL');
        } else {
          userRole = 'visitor';
          appPermessi = ['profile'];
          console.log('🌐 User is VISITOR');
        }
      } else {
        // Partner senza utente = visitor
        console.log('⚠️ Partner senza utente Odoo collegato - ruolo: visitor');
        userRole = 'visitor';
        appPermessi = ['profile'];
      }
    } else {
      // Partner NON esistente - CREALO come visitor
      console.log('🆕 Partner non trovato, creazione nuovo partner...');

      const createPartnerResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${adminSessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'res.partner',
            method: 'create',
            args: [{
              name: googleUser.name,
              email: googleUser.email,
              image_1920: googleUser.picture ? await fetchImageAsBase64(googleUser.picture) : false,
              comment: `Creato via Google OAuth il ${new Date().toISOString()}`,
              is_company: false,
              customer_rank: 1,  // Marca come cliente
            }],
            kwargs: {}
          },
          id: 4
        })
      });

      const createPartnerData = await createPartnerResponse.json();

      if (createPartnerData.result) {
        partnerId = createPartnerData.result;
        console.log(`✅ Nuovo partner creato: ID ${partnerId}`);
      } else {
        console.error('❌ Errore creazione partner:', createPartnerData);
        // Continua comunque - l'utente può accedere come visitor senza partner
      }

      // Nuovo utente = sempre visitor
      userRole = 'visitor';
      appPermessi = ['profile'];
      console.log('👤 Nuovo utente - ruolo: visitor (non può fare quasi nulla)');
    }

    // ========== STEP 4: CREA UTENTE E GENERA JWT ==========
    console.log('✅ Step 4: Creating user object and JWT...');

    const user = {
      id: odooUserId ? `odoo-${odooUserId}` : `google-${googleUser.id}`,
      email: googleUser.email,
      name: userName,
      role: userRole,
      azienda: '',
      abilitato: true,
      appPermessi,
      avatar: googleUser.picture,
      createdAt: new Date(),
      updatedAt: new Date(),
      telefono: '',
      indirizzo: '',
      citta: '',
      cap: '',
      partitaIva: '',
      codiceCliente: partnerId ? `PARTNER-${partnerId}` : '',
      note: `Login via Google - Partner ID: ${partnerId || 'N/A'}`
    };

    const token = generateToken(user, odooUserId || undefined);
    console.log(`✅ JWT generato per: ${user.email} - Ruolo: ${userRole}`);

    // ========== STEP 5: REDIRECT CON COOKIE ==========
    const response = NextResponse.redirect(new URL('/dashboard', BASE_URL));

    // Imposta il cookie JWT
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: true, // Sempre true per HTTPS (staging e production)
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 giorni
      path: '/',
    });

    // IMPORTANTE: Salva anche la sessione Odoo per permettere chiamate API
    // Usa la sessione admin che abbiamo già autenticato
    response.cookies.set('odoo_session_id', adminSessionId, {
      httpOnly: true,
      secure: true, // Sempre true per HTTPS (staging e production)
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 giorni
      path: '/',
    });

    console.log('✅ Google OAuth login completato! Redirect a dashboard...');
    console.log('✅ Cookie odoo_session_id salvato:', adminSessionId.substring(0, 20) + '...');
    return response;

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=google_callback_error', BASE_URL));
  }
}

/**
 * Helper per convertire immagine URL in base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | false> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error fetching image:', error);
    return false;
  }
}
