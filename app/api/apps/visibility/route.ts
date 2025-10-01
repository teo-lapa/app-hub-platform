import { NextRequest, NextResponse } from 'next/server';
import { allApps } from '@/lib/data/apps-with-indicators';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const VISIBILITY_KEY = 'app_hub:visibility_settings';

// Carica le impostazioni di visibilità da Vercel KV
async function loadVisibilitySettings(): Promise<Record<string, boolean>> {
  try {
    const settings = await kv.get<Record<string, boolean>>(VISIBILITY_KEY);
    return settings || {};
  } catch (error) {
    console.error('Errore lettura visibility settings da KV:', error);
    // Default: tutte le app visibili
    return {};
  }
}

// Salva le impostazioni di visibilità in Vercel KV
async function saveVisibilitySettings(settings: Record<string, boolean>): Promise<boolean> {
  try {
    await kv.set(VISIBILITY_KEY, settings);
    return true;
  } catch (error) {
    console.error('Errore salvataggio visibility settings in KV:', error);
    return false;
  }
}

// GET: Carica lista app con visibilità
export async function GET(request: NextRequest) {
  try {
    const visibilitySettings = await loadVisibilitySettings();

    const apps = allApps.map(app => ({
      id: app.id,
      name: app.name,
      icon: app.icon,
      category: app.category,
      visible: visibilitySettings[app.id] !== undefined ? visibilitySettings[app.id] : true
    }));

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

    // Crea oggetto con visibilità per ogni app
    const visibilitySettings: Record<string, boolean> = {};
    apps.forEach(app => {
      visibilitySettings[app.id] = app.visible;
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
