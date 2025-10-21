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
function isAppVisibleForRole(settings: AppVisibilitySettings | undefined, userRole: string): boolean {
  // Se non ci sono impostazioni, l'app è visibile di default
  if (!settings) return true;

  // Se l'app è nascosta completamente
  if (!settings.visible || settings.visibilityGroup === 'none') return false;

  // Se l'app è visibile a tutti
  if (settings.visibilityGroup === 'all') return true;

  // Determina se l'utente è interno o portale
  const isInternalUser = userRole === 'admin' || userRole === 'dipendente';

  // ✅ FIX: Riconosce TUTTI i tipi di clienti (cliente_gratuito, cliente_premium, visitor)
  // e anche ruoli custom che contengono "cliente"
  const isPortalUser = userRole === 'visitor' ||
                       userRole.includes('cliente') ||
                       userRole === 'customer' ||
                       userRole === 'portal_user';

  console.log(`🔍 isAppVisibleForRole - userRole: ${userRole}, isInternal: ${isInternalUser}, isPortal: ${isPortalUser}, visibilityGroup: ${settings.visibilityGroup}`);

  // Controlla la visibilità in base al gruppo
  if (settings.visibilityGroup === 'internal') {
    // Solo utenti interni possono vedere
    console.log(`  ➜ App internal-only: ${isInternalUser ? 'VISIBLE' : 'HIDDEN'} for ${userRole}`);
    return isInternalUser;
  }

  if (settings.visibilityGroup === 'portal') {
    // Solo utenti portal possono vedere
    console.log(`  ➜ App portal-only: ${isPortalUser ? 'VISIBLE' : 'HIDDEN'} for ${userRole}`);
    return isPortalUser;
  }

  return false;
}

// GET: Carica lista app con visibilità
export async function GET(request: NextRequest) {
  try {
    const visibilitySettings = await loadVisibilitySettings();

    // Ottieni il ruolo dell'utente dalla query string (opzionale, per filtrare)
    const { searchParams } = new URL(request.url);
    const userRole = searchParams.get('role');

    const apps = allApps.map(app => {
      const appSettings = visibilitySettings[app.id];
      const defaultSettings: AppVisibilitySettings = { visible: true, visibilityGroup: 'all' };
      const settings = appSettings || defaultSettings;

      // Se c'è un ruolo specificato, filtra le app in base alla visibilità
      const isVisible = userRole ? isAppVisibleForRole(settings, userRole) : settings.visible;

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

      const groups = {
        dipendenti: {
          enabled: dipendentiEnabled,
          excluded: (settings.excludedUsers || []).map((id: string) => parseInt(id, 10))
        },
        clienti: {
          enabled: clientiEnabled,
          excluded: (settings.excludedCustomers || []).map((id: string) => parseInt(id, 10))
        }
      };

      return {
        id: app.id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        visible: isVisible,
        visibilityGroup: settings.visibilityGroup,
        developmentStatus: settings.developmentStatus || 'pronta',  // Restituisci stato sviluppo
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
        // Converti gli ID numerici in stringhe
        if (app.groups.dipendenti?.excluded) {
          excludedUsers.push(...app.groups.dipendenti.excluded.map((id: number) => String(id)));
        }
        if (app.groups.clienti?.excluded) {
          excludedCustomers.push(...app.groups.clienti.excluded.map((id: number) => String(id)));
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
