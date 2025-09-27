import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the original HTML file
    const htmlPath = join(process.cwd(), '..', 'gestione app generale', 'app-per-inventario', 'app-per-inventario.html');
    const htmlContent = await readFile(htmlPath, 'utf-8');

    // Modify the HTML to use the correct Odoo URL from our environment
    const modifiedHtml = htmlContent.replace(
      /https:\/\/lapadevadmin-lapa-v2-staging-2406-24063382\.dev\.odoo\.com/g,
      process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com'
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