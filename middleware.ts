import { NextRequest, NextResponse } from 'next/server';
import { getAllAppVisibilities } from '@/lib/kv';
import { allApps } from '@/lib/data/apps-with-indicators';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Routes pubbliche che non richiedono autenticazione
const publicRoutes = [
  '/',  // Landing page con login integrato
  '/api/auth/login',
  '/api/auth/login-cliente',  // Customer login endpoint
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',  // Necessario per checkAuth
  '/w',  // LAPA WINE - cliente al tavolo via QR (route pubblica /w/[slug]/[tavolo])
  '/api/wine/sommelier',  // LAPA WINE - endpoint AI sommelier (chiamato dalla web app cliente)
  '/api/wine/order',  // LAPA WINE - invio comanda al ristoratore
  '/api/wine/auth/google',  // LAPA WINE - login Google opt-in cliente al tavolo
];

// Routes escluse dal controllo app (admin, dashboard, profile, ecc.)
const excludedAppRoutes = [
  '/dashboard',
  '/profile',
  '/pricing',
  '/admin',
  '/gestione-visibilita-app',
  '/email-ai-monitor',  // Email AI Monitor - has internal OAuth
  '/silvano',  // Area Agente Commerciale - protetta da JWT
  '/w',  // LAPA WINE cliente al tavolo - già whitelisted come pubblico, escluso da app check
  '/api',
  '/_next'
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

    // ========== CONTROLLO ACCESSO APP ==========
    // Controlla se la route corrisponde a un'app
    const isExcludedRoute = excludedAppRoutes.some(route => pathname.startsWith(route));

    if (!isExcludedRoute) {
      // Trova l'app corrispondente al pathname
      const app = allApps.find(a => a.url === pathname);

      if (app) {
        console.log(`🔐 MIDDLEWARE - Controllo accesso app: ${app.name} (${app.id})`);

        // Decode token per ottenere userId e role
        try {
          const parts = token.split('.');
          if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
          }

          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf-8')
          );

          const { userId, role, odooUserId, email } = payload;

          console.log(`🔐 MIDDLEWARE - Token payload completo:`, {
            userId,
            role,
            odooUserId,
            email,
            'tutte le chiavi': Object.keys(payload)
          });

          // Carica impostazioni visibilità
          const allVisibilities = await getAllAppVisibilities();
          const appVisibility = allVisibilities.find(v => v.appId === app.id);

          // Se ci sono impostazioni di visibilità, applicale
          if (appVisibility) {
            console.log(`  📋 Visibility settings trovate per ${app.name}`);

            // Controlla stato sviluppo
            if (appVisibility.developmentStatus === 'in_sviluppo' && !appVisibility.visible) {
              console.log(`  🚧 App in sviluppo e non visibile - BLOCCO ACCESSO`);
              return NextResponse.redirect(new URL('/?error=app_unavailable', request.url));
            }

            // Controlla visibility group
            const visibilityGroup = appVisibility.visibilityGroup || 'all';
            const isInternalUser = role === 'admin' || role === 'dipendente';
            const isPortalUser = role === 'visitor' || role.includes('cliente') || role === 'customer' || role === 'portal_user';

            console.log(`  👤 User info: role=${role}, isInternal=${isInternalUser}, email=${email}`);

            if (visibilityGroup === 'none') {
              console.log(`  ❌ Visibility group 'none' - BLOCCO ACCESSO`);
              return NextResponse.redirect(new URL('/?error=access_denied', request.url));
            }

            if (visibilityGroup === 'internal' && !isInternalUser) {
              console.log(`  ❌ App solo per interni, user role: ${role} - BLOCCO ACCESSO`);
              return NextResponse.redirect(new URL('/?error=access_denied', request.url));
            }

            if (visibilityGroup === 'portal' && !isPortalUser) {
              console.log(`  ❌ App solo per clienti, user role: ${role} - BLOCCO ACCESSO`);
              return NextResponse.redirect(new URL('/?error=access_denied', request.url));
            }

            // Controlla esclusioni specifiche
            const userIdToCheck = String(odooUserId || userId);
            const excludedUsers = appVisibility.excludedUsers || [];
            const excludedCustomers = appVisibility.excludedCustomers || [];

            console.log(`  🔍 DEBUG ESCLUSIONI:`);
            console.log(`     userId: ${userId}`);
            console.log(`     odooUserId: ${odooUserId}`);
            console.log(`     userIdToCheck: ${userIdToCheck}`);
            console.log(`     email: ${email}`);
            console.log(`     isInternalUser: ${isInternalUser}`);
            console.log(`     excludedUsers array:`, excludedUsers);
            console.log(`     excludedCustomers array:`, excludedCustomers);

            // ✅ CONTROLLO PRIMARIO: Usa EMAIL (più affidabile)
            // IMPORTANTE: Controlla ANCHE gli admin! Non bypassano le esclusioni specifiche!
            if (email) {
              console.log(`  🔍 Controllo esclusione per email: ${email}`);
              console.log(`  📋 excludedUsers contiene:`, excludedUsers);

              if (isInternalUser && excludedUsers.includes(email)) {
                console.log(`  ❌ User email ${email} è in excludedUsers - BLOCCO ACCESSO`);
                return NextResponse.redirect(new URL('/?error=access_denied', request.url));
              }

              if (isPortalUser && excludedCustomers.includes(email)) {
                console.log(`  ❌ User email ${email} è in excludedCustomers - BLOCCO ACCESSO`);
                return NextResponse.redirect(new URL('/?error=access_denied', request.url));
              }

              console.log(`  ✅ Email ${email} NON è in excludedUsers - ACCESSO CONSENTITO`);
            }

            // ⚠️ FALLBACK: Se excludedUsers contiene numeri (IDs), controlla anche per ID
            // Questo serve per backward compatibility
            if (isInternalUser && excludedUsers.some(item => !item.includes('@'))) {
              // Ci sono ID nella lista
              if (excludedUsers.includes(userIdToCheck)) {
                console.log(`  ❌ User ID ${userIdToCheck} è in excludedUsers - BLOCCO ACCESSO`);
                return NextResponse.redirect(new URL('/?error=access_denied', request.url));
              }
            }

            if (isPortalUser && excludedCustomers.some(item => !item.includes('@'))) {
              // Ci sono ID nella lista
              if (excludedCustomers.includes(userIdToCheck)) {
                console.log(`  ❌ User ID ${userIdToCheck} è in excludedCustomers - BLOCCO ACCESSO`);
                return NextResponse.redirect(new URL('/?error=access_denied', request.url));
              }
            }
          }

          console.log(`  ✅ Accesso consentito a ${app.name}`);
        } catch (decodeError) {
          console.error('❌ Errore decode token per controllo app:', decodeError);
          const response = NextResponse.redirect(new URL('/?error=invalid_token', request.url));
          response.cookies.delete('token');
          response.cookies.delete('user');
          return response;
        }
      }
    }

    // ========== PROTEZIONE PORTALE CLIENTI ==========
    // Solo cliente_premium può accedere a /portale-clienti
    if (pathname.startsWith('/portale-clienti')) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid JWT format');
        }

        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64').toString('utf-8')
        );

        const userRole = payload.role;
        const allowedRoles = ['cliente_premium', 'dipendente', 'admin'];

        if (!allowedRoles.includes(userRole)) {
          console.log(`❌ Portale Clienti: Access denied for role "${userRole}"`);
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

    return NextResponse.next();

  } catch (error) {
    console.error('Token validation failed:', error);

    // Token non valido, elimina i cookie e reindirizza alla home
    // NOTA: Non cancelliamo odoo_session_id per permettere ri-autenticazione più fluida
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('token');
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