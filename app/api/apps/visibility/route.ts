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
}

// Carica le impostazioni di visibilità
async function loadVisibilitySettings(): Promise<Record<string, AppVisibilitySettings>> {
  try {
    const allVisibilities = await getAllAppVisibilities();
    const settings: Record<string, AppVisibilitySettings> = {};

    allVisibilities.forEach(vis => {
      settings[vis.appId] = {
        visible: true,
        visibilityGroup: 'all',
        excludedUsers: vis.excludedUsers || [],
        excludedCustomers: vis.excludedCustomers || []
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
    // Salva ogni app nel Vercel KV
    for (const [appId, setting] of Object.entries(settings)) {
      await saveAppVisibility(appId, {
        excludedUsers: setting.excludedUsers || [],
        excludedCustomers: setting.excludedCustomers || []
      });
    }
    console.log('✅ Impostazioni salvate in Vercel KV');
    return true;
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
  const isPortalUser = userRole === 'cliente_gratuito' || userRole === 'cliente_premium' || userRole === 'visitor';

  // Controlla la visibilità in base al gruppo
  if (settings.visibilityGroup === 'internal' && isInternalUser) return true;
  if (settings.visibilityGroup === 'portal' && isPortalUser) return true;

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

      return {
        id: app.id,
        name: app.name,
        icon: app.icon,
        category: app.category,
        visible: isVisible,
        visibilityGroup: settings.visibilityGroup
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
    const { apps } = await request.json();

    if (!apps || !Array.isArray(apps)) {
      return NextResponse.json({
        success: false,
        error: 'Dati non validi'
      }, { status: 400 });
    }

    // Crea oggetto con visibilità e gruppo per ogni app
    const visibilitySettings: Record<string, AppVisibilitySettings> = {};
    apps.forEach((app: any) => {
      visibilitySettings[app.id] = {
        visible: app.visible,
        visibilityGroup: app.visibilityGroup || 'all'
      };
    });

    // Salva le impostazioni
    const saved = await saveVisibilitySettings(visibilitySettings);

    if (saved) {
      return NextResponse.json({
        success: true,
        message: 'Impostazioni salvate con successo'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Errore salvataggio impostazioni'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Errore POST visibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore salvataggio'
    }, { status: 500 });
  }
}
