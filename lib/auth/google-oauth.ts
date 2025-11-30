/**
 * Google OAuth Helper Functions
 * Per login con Google integrato con Odoo
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ||
  (process.env.NEXT_PUBLIC_BASE_URL
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`
    : 'http://localhost:3000/api/auth/google/callback');

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Genera l'URL per il redirect a Google OAuth
 * @param customRedirectUri - Redirect URI custom (opzionale). Se non fornito, usa GOOGLE_REDIRECT_URI
 */
export function getGoogleAuthUrl(customRedirectUri?: string): string {
  const redirectUri = customRedirectUri || GOOGLE_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
    access_type: 'offline',
    prompt: 'consent', // Forza consenso per garantire refresh_token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Scambia il code di autorizzazione per i token
 * @param code - Authorization code da Google
 * @param customRedirectUri - Redirect URI custom (opzionale). Deve matchare quello usato in getGoogleAuthUrl
 */
export async function exchangeCodeForTokens(
  code: string,
  customRedirectUri?: string
): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const redirectUri = customRedirectUri || GOOGLE_REDIRECT_URI;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google token exchange error:', error);
    throw new Error('Failed to exchange code for tokens');
  }

  return response.json();
}

/**
 * Ottiene le informazioni dell'utente da Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google userinfo error:', error);
    throw new Error('Failed to get user info from Google');
  }

  return response.json();
}

/**
 * Verifica se le credenziali Google sono configurate
 */
export function isGoogleOAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

/**
 * Refresh del token di accesso usando il refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google token refresh error:', error);
    throw new Error('Failed to refresh access token');
  }

  return response.json();
}
