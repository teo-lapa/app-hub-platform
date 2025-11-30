import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/auth/google-oauth';
import { sql } from '@vercel/postgres';

// Forza rendering dinamico
export const dynamic = 'force-dynamic';

/**
 * GET /api/email-ai/auth/gmail/callback
 * Callback OAuth Google Gmail - salva tokens nel database
 */
export async function GET(request: NextRequest) {
  try {
    // Costruisci BASE_URL dalla request invece di usare env var
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const BASE_URL = `${protocol}://${host}`;

    console.log('[Email-AI] 🌐 BASE_URL:', BASE_URL);

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Se Google ha restituito un errore
    if (error) {
      console.error('[Email-AI] Google OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/email-ai-monitor?error=google_${error}`, BASE_URL)
      );
    }

    // Se non c'è il code, errore
    if (!code) {
      console.error('[Email-AI] Missing authorization code');
      return NextResponse.redirect(
        new URL('/email-ai-monitor?error=missing_code', BASE_URL)
      );
    }

    console.log('[Email-AI] 🔐 Gmail OAuth callback received code');

    // Costruisci GMAIL_AI_REDIRECT_URI (deve matchare quello usato in /api/email-ai/auth/gmail)
    const gmailRedirectUri = process.env.GMAIL_AI_REDIRECT_URI || `${BASE_URL}/api/email-ai/auth/gmail/callback`;
    console.log('[Email-AI] 🔐 Using Gmail redirect URI for token exchange:', gmailRedirectUri);

    // ========== STEP 1: SCAMBIA CODE PER TOKEN ==========
    console.log('[Email-AI] 🔑 Step 1: Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code, gmailRedirectUri);
    console.log('[Email-AI] ✅ Tokens received from Google');

    if (!tokens.refresh_token) {
      console.warn('[Email-AI] ⚠️ No refresh_token received - user might have already authorized');
      // In questo caso Google non fornisce refresh_token se l'utente ha già autorizzato
      // Potremmo mostrare un messaggio all'utente di revocare l'accesso e riprovare
    }

    // Calcola scadenza token (expires_in è in secondi)
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // ========== STEP 2: OTTIENI INFO UTENTE DA GOOGLE ==========
    console.log('[Email-AI] 👤 Step 2: Getting user info from Google...');
    const googleUser = await getGoogleUserInfo(tokens.access_token);
    console.log(`[Email-AI] ✅ Google user: ${googleUser.email} (${googleUser.name})`);

    if (!googleUser.verified_email) {
      console.error('[Email-AI] Email not verified:', googleUser.email);
      return NextResponse.redirect(
        new URL('/email-ai-monitor?error=email_not_verified', BASE_URL)
      );
    }

    // ========== STEP 3: SALVA/AGGIORNA CONNESSIONE GMAIL IN DB ==========
    console.log('[Email-AI] 💾 Step 3: Saving Gmail connection to database...');

    // Verifica se esiste già una connessione per questo indirizzo Gmail
    const existingConnection = await sql`
      SELECT id, user_id FROM gmail_connections
      WHERE gmail_address = ${googleUser.email}
      LIMIT 1
    `;

    let connectionId: string;
    let userId: string;

    if (existingConnection.rows.length > 0) {
      // Aggiorna connessione esistente
      connectionId = existingConnection.rows[0].id;
      userId = existingConnection.rows[0].user_id;

      await sql`
        UPDATE gmail_connections
        SET
          access_token = ${tokens.access_token},
          refresh_token = COALESCE(${tokens.refresh_token}, refresh_token),
          token_expires_at = ${tokenExpiresAt.toISOString()},
          user_name = ${googleUser.name},
          sync_enabled = true,
          updated_at = NOW()
        WHERE id = ${connectionId}
      `;

      console.log(`[Email-AI] ✅ Gmail connection updated: ${connectionId}`);
    } else {
      // Crea nuova connessione
      // Usa l'ID Google come user_id (o potresti usare l'ID utente autenticato se hai sistema auth)
      userId = `google-${googleUser.id}`;

      const result = await sql`
        INSERT INTO gmail_connections (
          user_id,
          user_name,
          gmail_address,
          access_token,
          refresh_token,
          token_expires_at,
          sync_enabled,
          auto_classify,
          auto_summarize,
          auto_move_spam,
          auto_draft_reply
        ) VALUES (
          ${userId},
          ${googleUser.name},
          ${googleUser.email},
          ${tokens.access_token},
          ${tokens.refresh_token || null},
          ${tokenExpiresAt.toISOString()},
          true,
          true,
          true,
          false,
          false
        )
        RETURNING id
      `;

      connectionId = result.rows[0].id;
      console.log(`[Email-AI] ✅ New Gmail connection created: ${connectionId}`);
    }

    // ========== STEP 4: REDIRECT A EMAIL-AI-MONITOR CON SUCCESS ==========
    const redirectUrl = new URL('/email-ai-monitor?success=gmail_connected', BASE_URL);
    console.log('[Email-AI] 🔄 Redirecting to:', redirectUrl.toString());

    const response = NextResponse.redirect(redirectUrl);

    // Salva connection_id in cookie per accesso rapido (httpOnly: false per JS access)
    response.cookies.set('gmail_connection_id', connectionId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 giorni
      path: '/',
    });

    console.log('[Email-AI] ✅ Gmail OAuth completed successfully!');
    console.log('[Email-AI] 📍 Final redirect URL:', redirectUrl.toString());
    console.log('[Email-AI] 🍪 Set cookie: gmail_connection_id =', connectionId);
    return response;

  } catch (error: any) {
    console.error('[Email-AI] Gmail OAuth callback error:', error);
    // Costruisci BASE_URL dalla request
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const BASE_URL = `${protocol}://${host}`;

    return NextResponse.redirect(
      new URL(`/email-ai-monitor?error=callback_error&message=${encodeURIComponent(error.message)}`, BASE_URL)
    );
  }
}
