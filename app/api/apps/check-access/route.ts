import { NextRequest, NextResponse } from 'next/server';
import { getAllAppVisibilities } from '@/lib/kv';
import { allApps } from '@/lib/data/apps-with-indicators';
import { verify } from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  odooUserId?: number;
}

/**
 * Controlla se un utente può accedere a una specifica app
 * Questo è il CONTROLLO CENTRALE - ha priorità su tutto
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appId, appUrl } = body;

    // Se non specificato né ID né URL, errore
    if (!appId && !appUrl) {
      return NextResponse.json({
        success: false,
        hasAccess: false,
        reason: 'App non specificata'
      }, { status: 400 });
    }

    // Trova l'app
    const appOrUndefined = appId
      ? allApps.find(a => a.id === appId)
      : allApps.find(a => a.url === appUrl);

    if (!appOrUndefined) {
      return NextResponse.json({
        success: false,
        hasAccess: false,
        reason: 'App non trovata'
      }, { status: 404 });
    }

    // TypeScript-safe assignment after null check
    const app = appOrUndefined;

    // Ottieni il token dai cookie
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'Non autenticato'
      });
    }

    // Decodifica il token per ottenere userId e role
    let decoded: TokenPayload;
    try {
      decoded = verify(token, JWT_SECRET) as TokenPayload;
    } catch (err) {
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'Token non valido'
      });
    }

    const { userId, role, odooUserId, email } = decoded;

    console.log(`🔐 CHECK ACCESS - App: ${app.name} (${app.id}), User: ${userId} (${role}), Odoo: ${odooUserId}, Email: ${email}`);

    // LIVELLO 1: Carica impostazioni visibilità dal sistema di gestione
    let allVisibilities = [];
    let appVisibility = undefined;

    try {
      allVisibilities = await getAllAppVisibilities();
      appVisibility = allVisibilities.find(v => v.appId === app.id);
      console.log(`  📋 Visibility settings:`, appVisibility);
    } catch (error) {
      console.log(`  ⚠️ KV not available (local dev), using default role access`);
      appVisibility = undefined;
    }

    // Se NON ci sono impostazioni di visibilità, usa il requiredRole di default
    if (!appVisibility) {
      console.log(`  ℹ️ No visibility settings - using default requiredRole: ${app.requiredRole}`);
      const hasAccess = checkDefaultRoleAccess(app.requiredRole, role);
      return NextResponse.json({
        success: true,
        hasAccess,
        reason: hasAccess ? 'Accesso consentito (default)' : `Richiede ruolo: ${app.requiredRole}`,
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // LIVELLO 2: Controlla stato sviluppo
    if (appVisibility.developmentStatus === 'in_sviluppo' && !appVisibility.visible) {
      console.log(`  🚧 App in sviluppo e non visibile - ACCESSO NEGATO`);
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'App in fase di sviluppo',
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // LIVELLO 3: Controlla visibility group
    const visibilityGroup = appVisibility.visibilityGroup || 'all';
    console.log(`  👥 Visibility group: ${visibilityGroup}`);

    // Determina se l'utente è interno o portale
    const isInternalUser = role === 'admin' || role === 'dipendente';
    const isPortalUser = role === 'visitor' ||
                         role.includes('cliente') ||
                         role === 'customer' ||
                         role === 'portal_user';

    // Se visibilityGroup è 'none', nessuno può accedere
    if (visibilityGroup === 'none') {
      console.log(`  ❌ Visibility group 'none' - ACCESSO NEGATO a tutti`);
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'App disabilitata per tutti gli utenti',
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // Se visibilityGroup è 'internal', solo dipendenti/admin
    if (visibilityGroup === 'internal' && !isInternalUser) {
      console.log(`  ❌ Visibility group 'internal' - User role '${role}' non è interno - ACCESSO NEGATO`);
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'App riservata ai dipendenti interni',
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // Se visibilityGroup è 'portal', solo clienti portal
    if (visibilityGroup === 'portal' && !isPortalUser) {
      console.log(`  ❌ Visibility group 'portal' - User role '${role}' non è portal - ACCESSO NEGATO`);
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: 'App riservata ai clienti',
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // LIVELLO 4: Controlla esclusioni specifiche
    const excludedUsers = appVisibility.excludedUsers || [];
    const excludedCustomers = appVisibility.excludedCustomers || [];

    console.log(`  🔍 DEBUG ESCLUSIONI:`);
    console.log(`     userId: ${userId}`);
    console.log(`     odooUserId: ${odooUserId}`);
    console.log(`     email: ${email}`);
    console.log(`     isInternalUser: ${isInternalUser}`);
    console.log(`     excludedUsers array:`, excludedUsers);
    console.log(`     excludedCustomers array:`, excludedCustomers);

    // ✅ CONTROLLO PRIMARIO: Usa EMAIL (più affidabile)
    if (email) {
      console.log(`  🔍 Controllo esclusione per email: ${email}`);

      if (isInternalUser && excludedUsers.includes(email)) {
        console.log(`  ❌ User email ${email} è in excludedUsers - ACCESSO NEGATO`);
        return NextResponse.json({
          success: true,
          hasAccess: false,
          reason: 'Accesso negato per questo utente specifico',
          app: {
            id: app.id,
            name: app.name,
            url: app.url
          }
        });
      }

      if (isPortalUser && excludedCustomers.includes(email)) {
        console.log(`  ❌ User email ${email} è in excludedCustomers - ACCESSO NEGATO`);
        return NextResponse.json({
          success: true,
          hasAccess: false,
          reason: 'Accesso negato per questo cliente specifico',
          app: {
            id: app.id,
            name: app.name,
            url: app.url
          }
        });
      }

      console.log(`  ✅ Email ${email} NON è in esclusioni - continuo con controllo`);
    }

    // ⚠️ FALLBACK: Se excludedUsers contiene numeri (IDs), controlla anche per ID
    // Questo serve per backward compatibility
    const userIdToCheck = String(odooUserId || userId);

    if (isInternalUser && excludedUsers.some(item => !item.includes('@'))) {
      // Ci sono ID nella lista
      if (excludedUsers.includes(userIdToCheck)) {
        console.log(`  ❌ User ID ${userIdToCheck} è in excludedUsers - ACCESSO NEGATO`);
        return NextResponse.json({
          success: true,
          hasAccess: false,
          reason: 'Accesso negato per questo utente specifico',
          app: {
            id: app.id,
            name: app.name,
            url: app.url
          }
        });
      }
    }

    if (isPortalUser && excludedCustomers.some(item => !item.includes('@'))) {
      // Ci sono ID nella lista
      if (excludedCustomers.includes(userIdToCheck)) {
        console.log(`  ❌ User ID ${userIdToCheck} è in excludedCustomers - ACCESSO NEGATO`);
        return NextResponse.json({
          success: true,
          hasAccess: false,
          reason: 'Accesso negato per questo cliente specifico',
          app: {
            id: app.id,
            name: app.name,
            url: app.url
          }
        });
      }
    }

    // LIVELLO 5: Controlla requiredRole (solo se ha passato i controlli di visibilità)
    const hasRoleAccess = checkDefaultRoleAccess(app.requiredRole, role);

    if (!hasRoleAccess) {
      console.log(`  ❌ User role '${role}' non soddisfa requiredRole '${app.requiredRole}' - ACCESSO NEGATO`);
      return NextResponse.json({
        success: true,
        hasAccess: false,
        reason: `Piano richiesto: ${getRoleName(app.requiredRole)}`,
        app: {
          id: app.id,
          name: app.name,
          url: app.url
        }
      });
    }

    // ✅ ACCESSO CONSENTITO
    console.log(`  ✅ ACCESSO CONSENTITO a ${app.name} per user ${userIdToCheck} (${role})`);
    return NextResponse.json({
      success: true,
      hasAccess: true,
      reason: 'Accesso consentito',
      app: {
        id: app.id,
        name: app.name,
        url: app.url
      }
    });

  } catch (error) {
    console.error('❌ Errore check-access:', error);
    return NextResponse.json({
      success: false,
      hasAccess: false,
      reason: 'Errore di sistema'
    }, { status: 500 });
  }
}

/**
 * Controlla accesso basato su requiredRole (logica di default)
 */
function checkDefaultRoleAccess(requiredRole: string, userRole: string): boolean {
  if (requiredRole === 'visitor') return true;

  if (requiredRole === 'cliente_gratuito') {
    return ['cliente_gratuito', 'cliente_premium', 'dipendente', 'admin'].includes(userRole);
  }

  if (requiredRole === 'cliente_premium') {
    return ['cliente_premium', 'dipendente', 'admin'].includes(userRole);
  }

  if (requiredRole === 'dipendente') {
    return ['dipendente', 'admin'].includes(userRole);
  }

  if (requiredRole === 'admin') {
    return userRole === 'admin';
  }

  return false;
}

/**
 * Nome human-readable del ruolo
 */
function getRoleName(role: string): string {
  switch (role) {
    case 'visitor': return 'Pubblico';
    case 'cliente_gratuito': return 'Gratuito';
    case 'cliente_premium': return 'Premium';
    case 'dipendente': return 'Staff';
    case 'admin': return 'Admin';
    default: return role;
  }
}
