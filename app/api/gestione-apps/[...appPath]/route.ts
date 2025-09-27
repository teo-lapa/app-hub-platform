import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { appPath: string[] } }
) {
  try {
    const appPath = params.appPath.join('/');
    console.log('🚀 Servendo app gestionale:', appPath);

    // Lista delle app disponibili
    const availableApps = [
      'app-per-inventario',
      'catalogo-venditori-completo',
      'centralino-ai-lapa-agenti',
      'clientivision',
      'controllo-consegne-per-venditore',
      'controllo-diretto',
      'dashboard-gestione-app-lapa',
      'lapa-dashboard-venditori',
      'lapa-delivery',
      'mappa-controllo-lapa',
      'operazioni-di-magazzino',
      'pick-residui',
      'prelievo-per-zone',
      'sistema-di-ordini-intelligente-lapa',
      'sistemare-ritorni-dal-furgone',
      'smart-route-ai',
      'super-utente-magazzino'
    ];

    // Estrai il nome dell'app dal path
    let appName = appPath;
    if (appPath.includes('/')) {
      appName = appPath.split('/')[0];
    }

    if (!availableApps.includes(appName)) {
      return new NextResponse(`App "${appName}" non trovata. App disponibili: ${availableApps.join(', ')}`, {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Percorsi possibili per i file HTML
    const possiblePaths = [
      join(process.cwd(), 'gestione-apps-html', appName, `${appName}.html`),
      join(process.cwd(), '..', 'gestione app generale', appName, `${appName}.html`),
      join(process.cwd(), '..', '..', 'gestione app generale', appName, `${appName}.html`)
    ];

    let htmlContent = '';
    let foundPath = '';

    for (const path of possiblePaths) {
      try {
        console.log('🔍 Provo path:', path);
        htmlContent = await readFile(path, 'utf-8');
        foundPath = path;
        console.log('✅ HTML trovato in:', foundPath);
        break;
      } catch (e) {
        console.log('❌ Non trovato in:', path);
      }
    }

    if (!htmlContent) {
      throw new Error(`HTML file not found for app: ${appName}`);
    }

    // Modifica l'HTML per usare l'URL Odoo corretto e aggiungere il header di integrazione
    let modifiedHtml = htmlContent.replace(
      /https:\/\/lapadevadmin-lapa-v2-staging-2406-24063382\.dev\.odoo\.com/g,
      process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com'
    );

    // Aggiungi header di navigazione per l'integrazione con la piattaforma
    const integrationHeader = `
      <div id="platform-header" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        border-bottom: 1px solid #475569;
        display: flex;
        align-items: center;
        padding: 0 20px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      ">
        <button onclick="window.location.href='/'" style="
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #3b82f6;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'">
          ← Home Platform
        </button>
        <div style="margin-left: 20px; color: #f1f5f9; font-weight: 500;">
          📱 ${appName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
        </div>
        <div style="margin-left: auto; color: #94a3b8; font-size: 12px;">
          LAPA Platform
        </div>
      </div>
      <div style="height: 60px;"></div>
    `;

    // Inserisci l'header dopo il tag body di apertura
    if (modifiedHtml.includes('<body')) {
      modifiedHtml = modifiedHtml.replace(
        /(<body[^>]*>)/i,
        `$1${integrationHeader}`
      );
    } else if (modifiedHtml.includes('<html')) {
      // Se non c'è body, aggiungi dopo html
      modifiedHtml = modifiedHtml.replace(
        /(<html[^>]*>)/i,
        `$1<body>${integrationHeader}`
      ) + '</body>';
    }

    return new NextResponse(modifiedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error: any) {
    console.error('Error serving gestione app:', error);

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Errore - LAPA Platform</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: 40px;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f8fafc;
            text-align: center;
            min-height: 100vh;
            margin: 0;
          }
          .error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 30px;
            border-radius: 12px;
            margin: 20px auto;
            max-width: 600px;
          }
          .back-btn {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #3b82f6;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            margin-top: 20px;
            transition: all 0.2s;
          }
          .back-btn:hover {
            background: rgba(59, 130, 246, 0.2);
          }
        </style>
      </head>
      <body>
        <h1>❌ App non trovata</h1>
        <div class="error">
          <p><strong>Errore:</strong> ${error.message}</p>
          <p>L'app richiesta non è stata trovata o non può essere caricata.</p>
        </div>
        <a href="/" class="back-btn">← Torna alla Home Platform</a>
      </body>
      </html>
    `, {
      status: 500,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
}