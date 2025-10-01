import { NextRequest, NextResponse } from 'next/server';
import { allApps } from '@/lib/data/apps-with-indicators';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const VISIBILITY_KEY = 'app_hub:visibility_settings';

// Tipi di visibilità per gruppo
export type VisibilityGroup = 'all' | 'internal' | 'portal' | 'none';

export interface AppVisibilitySettings {
  visible: boolean;
  visibilityGroup: VisibilityGroup;
}

// Carica le impostazioni di visibilità da Vercel KV
async function loadVisibilitySettings(): Promise<Record<string, AppVisibilitySettings>> {
  try {
    const settings = await kv.get<Record<string, AppVisibilitySettings>>(VISIBILITY_KEY);
    return settings || {};
  } catch (error) {
    console.error('Errore lettura visibility settings da KV:', error);
    // Default: tutte le app visibili per tutti
    return {};
  }
}

// Salva le impostazioni di visibilità in Vercel KV
async function saveVisibilitySettings(settings: Record<string, AppVisibilitySettings>): Promise<boolean> {
  try {
    await kv.set(VISIBILITY_KEY, settings);
    return true;
  } catch (error) {
    console.error('Errore salvataggio visibility settings in KV:', error);
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

    // Salva in Vercel KV
    const saved = await saveVisibilitySettings(visibilitySettings);

    if (saved) {
      console.log('✅ Impostazioni visibilità salvate in Vercel KV:', visibilitySettings);
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
