import { NextResponse } from 'next/server';
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from '@/lib/auth/google-oauth';

/**
 * GET /api/auth/google
 * Redirect l'utente a Google per l'autenticazione OAuth
 */
export async function GET() {
  try {
    // Verifica che le credenziali siano configurate
    if (!isGoogleOAuthConfigured()) {
      console.error('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.redirect(
        new URL('/?error=google_not_configured', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
      );
    }

    // Genera URL di autorizzazione Google
    const authUrl = getGoogleAuthUrl();
    console.log('Redirecting to Google OAuth:', authUrl);

    // Redirect a Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth redirect error:', error);
    return NextResponse.redirect(
      new URL('/?error=google_auth_error', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    );
  }
}
