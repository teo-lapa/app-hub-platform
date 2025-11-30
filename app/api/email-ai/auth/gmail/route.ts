import { NextResponse } from 'next/server';
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/auth/google-oauth';

/**
 * GET /api/email-ai/auth/gmail
 * Redirect l'utente a Google OAuth con scopes Gmail
 */
export async function GET() {
  try {
    // Verifica che le credenziali siano configurate
    if (!isGoogleOAuthConfigured()) {
      console.error('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.json(
        { error: 'Google OAuth non configurato. Controlla GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.' },
        { status: 500 }
      );
    }

    // Genera URL di autorizzazione Google con scopes Gmail
    const authUrl = getGoogleAuthUrl();
    console.log('[Email-AI] Redirecting to Google OAuth for Gmail:', authUrl);

    // Redirect a Google
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[Email-AI] Google OAuth redirect error:', error);
    return NextResponse.json(
      { error: 'Errore durante redirect a Google OAuth', details: error.message },
      { status: 500 }
    );
  }
}
