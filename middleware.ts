import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes pubbliche che non richiedono autenticazione
const publicRoutes = [
  '/',  // Landing page con login integrato
  '/api/auth/login',
  '/api/auth/login-cliente',  // Customer login endpoint
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me'  // Necessario per checkAuth
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Controlla se è una route pubblica
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  // Se è una route pubblica, continua senza controlli
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // TUTTE le altre route richiedono autenticazione

  // Ottieni il token dai cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    // Nessun token - reindirizza alla home che mostra il login
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Verifica semplice del token (senza library JWT per Edge Runtime)
    if (!token || token.length < 10) {
      throw new Error('Invalid token format');
    }

    // ========== PROTEZIONE PORTALE CLIENTI ==========
    // Solo cliente_premium può accedere a /portale-clienti
    if (pathname.startsWith('/portale-clienti')) {
      // Decode token payload per verificare role
      // In Edge Runtime non possiamo usare jsonwebtoken, quindi usiamo parsing base64
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT format');
        }

        // Decode payload (second part)
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf-8')
        );

        const userRole = payload.role;

        // Permetti accesso solo a cliente_premium, dipendente, admin
        const allowedRoles = ['cliente_premium', 'dipendente', 'admin'];

        if (!allowedRoles.includes(userRole)) {
          console.log(`❌ Portale Clienti: Access denied for role "${userRole}"`);
          // Reindirizza a home con messaggio errore
          const response = NextResponse.redirect(new URL('/?error=access_denied', request.url));
          return response;
        }

        console.log(`✅ Portale Clienti: Access granted for role "${userRole}"`);
      } catch (decodeError) {
        console.error('Token decode failed for portale-clienti:', decodeError);
        const response = NextResponse.redirect(new URL('/?error=invalid_token', request.url));
        response.cookies.delete('token');
        response.cookies.delete('user');
        return response;
      }
    }

    // Per ora accetta tutti i token validi
    // La validazione JWT completa sarà fatta nelle API routes

    return NextResponse.next();

  } catch (error) {
    console.error('Token validation failed:', error);

    // Token non valido, elimina i cookie e reindirizza alla home
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('token');
    response.cookies.delete('odoo_session');
    response.cookies.delete('user');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/login, api/auth/register (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};