import { NextRequest, NextResponse } from 'next/server';
import { allApps } from '@/lib/data/apps-with-indicators';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// File per salvare le impostazioni di visibilità
const VISIBILITY_FILE = path.join(process.cwd(), 'data', 'app-visibility.json');

// Assicura che la directory data esista
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Carica le impostazioni di visibilità
function loadVisibilitySettings(): Record<string, boolean> {
  try {
    ensureDataDirectory();
    if (fs.existsSync(VISIBILITY_FILE)) {
      const data = fs.readFileSync(VISIBILITY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Errore lettura visibility settings:', error);
  }
  // Default: tutte le app visibili
  return {};
}

// Salva le impostazioni di visibilità
function saveVisibilitySettings(settings: Record<string, boolean>) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(VISIBILITY_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Errore salvataggio visibility settings:', error);
    throw error;
  }
}

// GET: Carica lista app con visibilità
export async function GET(request: NextRequest) {
  try {
    const visibilitySettings = loadVisibilitySettings();

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

    // Salva su file
    saveVisibilitySettings(visibilitySettings);

    console.log('✅ Impostazioni visibilità salvate:', visibilitySettings);

    return NextResponse.json({
      success: true,
      message: 'Impostazioni salvate'
    });
  } catch (error) {
    console.error('Errore POST visibility:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore salvataggio'
    }, { status: 500 });
  }
}
