import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Tentativo di leggere HTML app...');

    // Try multiple paths
    const possiblePaths = [
      join(process.cwd(), '..', 'gestione app generale', 'app-per-inventario', 'app-per-inventario.html'),
      join(process.cwd(), 'gestione app generale', 'app-per-inventario', 'app-per-inventario.html'),
      join(process.cwd(), '..', '..', 'gestione app generale', 'app-per-inventario', 'app-per-inventario.html')
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
      throw new Error('HTML file not found in any location');
    }

    // Modify the HTML to use the correct Odoo URL from our environment
    const modifiedHtml = htmlContent.replace(
      /https:\/\/lapadevadmin-lapa-v2-staging-2406-24517859\.dev\.odoo\.com/g,
      process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com'
    );

    return new NextResponse(modifiedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error serving HTML app:', error);

    return new NextResponse(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            background: #0f172a;
            color: #f8fafc;
            text-align: center;
          }
          .error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 20px;
            border-radius: 12px;
            margin: 20px auto;
            max-width: 500px;
          }
        </style>
      </head>
      <body>
        <h1>❌ App HTML non trovata</h1>
        <div class="error">
          <p>Il file HTML originale non è stato trovato.</p>
          <p>Percorso cercato: ${join(process.cwd(), '..', 'gestione app generale', 'app-per-inventario', 'app-per-inventario.html')}</p>
        </div>
        <p><a href="/inventario" style="color: #3b82f6;">← Torna all'app Next.js</a></p>
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
