import { NextRequest, NextResponse } from 'next/server';
import { allApps } from '@/lib/data/apps-with-indicators';
import { saveAppVisibility, getAppVisibility, getAllAppVisibilities } from '@/lib/kv';

export const dynamic = 'force-dynamic';

// Tipi di visibilità per gruppo
export type VisibilityGroup = 'all' | 'internal' | 'portal' | 'none';

export interface AppVisibilitySettings {
  visible: boolean;
  visibilityGroup: VisibilityGroup;
  excludedUsers?: string[];      // Array di user IDs esclusi specificamente
  excludedCustomers?: string[];  // Array di customer IDs esclusi specificamente
  developmentStatus?: 'in_sviluppo' | 'pronta';  // Stato sviluppo app
}

// Carica le impostazioni di visibilità
async function loadVisibilitySettings(): Promise<Record<string, AppVisibilitySettings>> {
  try {
    const allVisibilities = await getAllAppVisibilities();
    const settings: Record<string, AppVisibilitySettings> = {};

    allVisibilities.forEach(vis => {
      settings[vis.appId] = {
        visible: vis.visible !== undefined ? vis.visible : true,
        visibilityGroup: (vis.visibilityGroup || 'all') as VisibilityGroup,
        excludedUsers: vis.excludedUsers || [],
        excludedCustomers: vis.excludedCustomers || [],
        developmentStatus: vis.developmentStatus || 'pronta'
      };
    });

    return settings;
  } catch (error) {
    console.error('⚠️ Errore lettura visibility settings da KV:', error);
    return {};
  }
}

// Salva le impostazioni di visibilità
async function saveVisibilitySettings(settings: Record<string, AppVisibilitySettings>): Promise<boolean> {
  try {
    console.log('🔷 saveVisibilitySettings - Start');
    const appIds = Object.keys(settings);
    console.log(`🔷 Apps da salvare: ${appIds.length}`);

    let savedCount = 0;
    let errorCount = 0;

    // Salva ogni app nel Vercel KV con TUTTI i campi
    for (const [appId, setting] of Object.entries(settings)) {
      try {
        console.log(`  💾 Salvando app: ${appId}`);
        const result = await saveAppVisibility(appId, {
          excludedUsers: setting.excludedUsers || [],
          excludedCustomers: setting.excludedCustomers || [],
          visible: setting.visible,
          visibilityGroup: setting.visibilityGroup,
          developmentStatus: setting.developmentStatus  // ✅ Ora salva anche questo!
        });
        console.log(`  ✅ App salvata: ${appId}`, result);
        savedCount++;
      } catch (appError) {
        console.error(`  ❌ Errore salvataggio app ${appId}:`, appError);
        errorCount++;
      }
    }

    console.log(`✅ Salvataggio completato: ${savedCount} success, ${errorCount} errors`);

    if (errorCount > 0) {
      console.warn(`⚠️ Ci sono stati ${errorCount} errori durante il salvataggio`);
    }

    return errorCount === 0;
  } catch (error) {
    console.error('❌ Errore salvataggio visibility settings in KV:', error);
    return false;
  }
}

// Determina se un'app è visibile per un determinato ruolo utente
function isAppVisibleForRole(settings: AppVisibilitySettings | undefined, userRole: string, userId?: number): boolean {
  // Se non ci sono impostazioni, l'app è visibile di default
  if (!settings) return true;

  // Se l'app è nascosta completamente
  if (!settings.visible || settings.visibilityGroup === 'none') return false;

  // Se l'app è visibile a tutti
  if (settings.visibilityGroup === 'all') {
    // Anche se visibile a tutti, controlla esclusioni specifiche
    if (userId && settings.excludedUsers?.includes(String(userId))) {
      console.log(`  ➜ User ${userId} is in excludedUsers - HIDDEN`);
      return false;
    }
    if (userId && settings.excludedCustomers?.includes(String(userId))) {
      console.log(`  ➜ User ${userId} is in excludedCustomers - HIDDEN`);
      return false;
    }
    return true;
  }

  // Determina se l'utente è interno o portale
  const isInternalUser = userRole === 'admin' || userRole === 'dipendente';

  // ✅ FIX: Riconosce TUTTI i tipi di clienti (cliente_gratuito, cliente_premium, visitor)
  // e anche ruoli custom che contengono "cliente"
  const isPortalUser = userRole === 'visitor' ||
                       userRole.includes('cliente') ||
                       userRole === 'customer' ||
                       userRole === 'portal_user';

  console.log(`🔍 isAppVisibleForRole - userId: ${userId}, userRole: ${userRole}, isInternal: ${isInternalUser}, isPortal: ${isPortalUser}, visibilityGroup: ${settings.visibilityGroup}`);

  // Controlla la visibilità in base al gruppo
  if (settings.visibilityGroup === 'internal') {
    // Solo utenti interni possono vedere
    if (!isInternalUser) {
      console.log(`  ➜ App internal-only: HIDDEN for ${userRole} (not internal)`);
      return false;
    }

    // Controlla esclusioni specifiche per dipendenti
    if (userId && settings.excludedUsers?.includes(String(userId))) {
      console.log(`  ➜ User ${userId} is in excludedUsers - HIDDEN`);
      return false;
    }

    console.log(`  ➜ App internal-only: VISIBLE for ${userRole}`);
    return true;
  }

  if (settings.visibilityGroup === 'portal') {
    // Solo utenti portal possono vedere
    if (!isPortalUser) {
      console.log(`  ➜ App portal-only: HIDDEN for ${userRole} (not portal)`);
      return false;
    }

    // Controlla esclusioni specifiche per clienti
    if (userId && settings.excludedCustomers?.includes(String(userId))) {
      console.log(`  ➜ User ${userId} is in excludedCustomers - HIDDEN`);
      return false;
    }

    console.log(`  ➜ App portal-only: VISIBLE for ${userRole}`);
    return true;
  }

  return false;
}

// GET: Carica lista app con visibilità
export async function GET(request: NextRequest) {
  try {
    const visibilitySettings = await loadVisibilitySettings();

    // Ottieni il ruolo e userId dell'utente dalla query string (opzionale, per filtrare)
    const { searchParams } = new URL(request.url);
    const userRole = searchParams.get('role');
    const userIdParam = searchParams.get('userId');
    const userId = userIdParam ? parseInt(userIdParam, 10) : undefined;

    console.log(`📋 GET /api/apps/visibility - role: ${userRole}, userId: ${userId}`);

    const apps = allApps.map(app => {
      const appSettings = visibilitySettings[app.id];

      // ✅ DEFAULT: Se l'APP non ha impostazioni in KV, è VISIBILE a tutti
      const defaultSettings: AppVisibilitySettings = {
        visible: true,
        visibilityGroup: 'all',
        developmentStatus: 'pronta'
      };
      const settings = appSettings || defaultSettings;

      // Se c'è un ruolo specificato, filtra le app in base alla visibilità
      // ✅ Se non ci sono impostazioni (appSettings === undefined), considera l'APP visibile di default
      const isVisible = userRole
        ? (appSettings ? isAppVisibleForRole(settings, userRole, userId) : true)  // Se no settings → visible
        : settings.visible;

      // Converti excludedUsers/excludedCustomers in formato groups per la pagina gestione
      // E converti visibilityGroup in enabled flags
      let dipendentiEnabled = true;
      let clientiEnabled = true;

      if (settings.visibilityGroup === 'none') {
        dipendentiEnabled = false;
        clientiEnabled = false;
      } else if (settings.visibilityGroup === 'internal') {
        dipendentiEnabled = true;
        clientiEnabled = false;  // Solo dipendenti, NON clienti
      } else if (settings.visibilityGroup === 'portal') {
        dipendentiEnabled = false;  // Solo clienti, NON dipendenti
        clientiEnabled = true;
      } else {  // 'all'
        dipendentiEnabled = true;
        clientiEnabled = true;
      }

      // 🔍 DEBUG: Verifica fix excludedEmails nel GET endpoint
      console.log(`🔍 GET /api/apps/visibility - Building groups for app ${app.id}`);
      console.log(`  settings.excludedUsers:`, settings.excludedUsers);
      console.log(`  settings.excludedCustomers:`, settings.excludedCustomers);

      const groups = {
        dipendenti: {
          enabled: dipendentiEnabled,
          excluded: (settings.excludedUsers || [])
            .map((id: string) => parseInt(id, 10))
            .filter((id: number) => !isNaN(id)), // Remove NaN from converted emails
          excludedEmails: (settings.excludedUsers || [])
            .filter((val: string) => val.includes('@')) // Keep only emails
        },
        clienti: {
          enabled: clientiEnabled,
          excluded: (settings.excludedCustomers || [])
            .map((id: string) => parseInt(id, 10))
            .filter((id: number) => !isNaN(id)), // Remove NaN from converted emails
          excludedEmails: (settings.excludedCustomers || [])
            .filter((val: string) => val.includes('@')) // Keep only emails
        }
      };

      console.log(`  groups.dipendenti.excludedEmails:`, groups.dipendenti.excludedEmails);
      console.log(`  groups.clienti.excludedEmails:`, groups.clienti.excludedEmails);

      return {
        ...app,  // ✅ Restituisci TUTTI i campi dell'app (description, badge, url, etc.)
        visible: isVisible,
        visibilityGroup: settings.visibilityGroup,
        developmentStatus: settings.developmentStatus || 'pronta',
        groups  // Aggiungi struttura groups per compatibilità con gestione-visibilita-app
      };
    });

    return NextResponse.json({
      success: true,
      apps
    });
  } catch (error) {
    console.error('Errore GET visibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore caricamento'
    }, { status: 500 });
  }
}

// POST: Salva impostazioni visibilità
export async function POST(request: NextRequest) {
  try {
    console.log('🔵 POST /api/apps/visibility - Start');
    const body = await request.json();
    console.log('📦 Body ricevuto:', JSON.stringify(body, null, 2));

    const { apps } = body;

    if (!apps || !Array.isArray(apps)) {
      console.log('❌ Dati non validi - apps:', apps);
      return NextResponse.json({
        success: false,
        error: 'Dati non validi'
      }, { status: 400 });
    }

    console.log(`📊 Numero di app da salvare: ${apps.length}`);

    // Crea oggetto con visibilità e gruppo per ogni app
    const visibilitySettings: Record<string, AppVisibilitySettings> = {};
    apps.forEach((app: any, index: number) => {
      // Estrai gli utenti esclusi dalla struttura groups se presente
      const excludedUsers: string[] = [];
      const excludedCustomers: string[] = [];

      if (app.groups) {
        // PRIORITÀ 1: Usa gli EMAIL se disponibili (più affidabili)
        if (app.groups.dipendenti?.excludedEmails && app.groups.dipendenti.excludedEmails.length > 0) {
          excludedUsers.push(...app.groups.dipendenti.excludedEmails);
          console.log(`  ✅ Using excludedEmails for dipendenti:`, app.groups.dipendenti.excludedEmails);
        } else if (app.groups.dipendenti?.excluded) {
          // FALLBACK: Usa gli ID se gli email non ci sono
          excludedUsers.push(...app.groups.dipendenti.excluded.map((id: number) => String(id)));
          console.log(`  ⚠️ Using excludedIds for dipendenti (no emails):`, app.groups.dipendenti.excluded);
        }

        if (app.groups.clienti?.excludedEmails && app.groups.clienti.excludedEmails.length > 0) {
          excludedCustomers.push(...app.groups.clienti.excludedEmails);
          console.log(`  ✅ Using excludedEmails for clienti:`, app.groups.clienti.excludedEmails);
        } else if (app.groups.clienti?.excluded) {
          excludedCustomers.push(...app.groups.clienti.excluded.map((id: number) => String(id)));
          console.log(`  ⚠️ Using excludedIds for clienti (no emails):`, app.groups.clienti.excluded);
        }
      }

      // Determina il visibilityGroup basandosi su groups.enabled
      let visibilityGroup: VisibilityGroup = 'all';

      if (app.groups) {
        const dipendentiEnabled = app.groups.dipendenti?.enabled !== false;
        const clientiEnabled = app.groups.clienti?.enabled !== false;

        if (!dipendentiEnabled && !clientiEnabled) {
          visibilityGroup = 'none';  // Nessuno può vedere
        } else if (dipendentiEnabled && !clientiEnabled) {
          visibilityGroup = 'internal';  // Solo dipendenti
        } else if (!dipendentiEnabled && clientiEnabled) {
          visibilityGroup = 'portal';  // Solo clienti
        } else {
          visibilityGroup = 'all';  // Tutti
        }
      }

      visibilitySettings[app.id] = {
        visible: app.visible,
        visibilityGroup,  // Usa il visibilityGroup derivato da groups
        excludedUsers,
        excludedCustomers,
        developmentStatus: app.developmentStatus || 'pronta'  // Salva anche lo stato sviluppo
      };

      console.log(`  App ${index + 1}/${apps.length}: ${app.id}`, {
        visible: app.visible,
        visibilityGroup,  // Mostra il visibilityGroup DERIVATO
        groups: app.groups ? {
          dipendenti: app.groups.dipendenti?.enabled,
          clienti: app.groups.clienti?.enabled
        } : null,
        developmentStatus: app.developmentStatus,
        excludedUsers: excludedUsers.length,
        excludedCustomers: excludedCustomers.length
      });
    });

    console.log('💾 Salvataggio impostazioni visibilità (totale apps):', Object.keys(visibilitySettings).length);

    // Salva le impostazioni
    console.log('🔄 Chiamata saveVisibilitySettings...');
    const saved = await saveVisibilitySettings(visibilitySettings);
    console.log('✅ saveVisibilitySettings completato:', saved);

    if (saved) {
      console.log('✅ POST /api/apps/visibility - Success');
      return NextResponse.json({
        success: true,
        message: 'Impostazioni salvate con successo',
        saved: Object.keys(visibilitySettings).length
      });
    } else {
      console.log('❌ POST /api/apps/visibility - Save failed');
      return NextResponse.json({
        success: false,
        error: 'Errore salvataggio impostazioni'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Errore POST visibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore salvataggio: ' + (error instanceof Error ? error.message : String(error))
    }, { status: 500 });
  }
}
