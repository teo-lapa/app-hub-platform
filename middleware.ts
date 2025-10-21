import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes pubbliche che non richiedono autenticazione
const publicRoutes = [
  '/auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout'
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
  const odooSessionCookie = request.cookies.get('odoo_session')?.value;

  if (!token) {
    // Reindirizza al login se non autenticato
    return NextResponse.redirect(new URL('/auth', request.url));
  }

  try {
    // Verifica semplice del token (senza library JWT per Edge Runtime)
    if (!token || token.length < 10) {
      throw new Error('Invalid token format');
    }

    // Per ora accetta tutti i token validi
    // La validazione JWT completa sarà fatta nelle API routes

    return NextResponse.next();

  } catch (error) {
    console.error('Token validation failed:', error);

    // Token non valido, reindirizza al login
    const response = NextResponse.redirect(new URL('/auth', request.url));
    response.cookies.delete('token');
    response.cookies.delete('odoo_session');
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