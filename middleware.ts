import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes che richiedono autenticazione
const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/admin',
  '/api/admin',
  '/api/auth/update-profile',
  '/api/auth/me'
];

// Routes pubbliche che non richiedono autenticazione
const publicRoutes = [
  '/',
  '/auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/odoo-login',
  '/api/auth/logout'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Controlla se è una route protetta
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route)
  );

  // Se non è una route protetta, continua
  if (!isProtectedRoute || isPublicRoute) {
    return NextResponse.next();
  }

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
     * - api/auth/login, api/auth/register, api/auth/odoo-login (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};