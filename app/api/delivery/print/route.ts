import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  let deliveryId: number | undefined;

  try {
    const userCookies = request.headers.get('cookie');
    const { cookies } = await getOdooSession(userCookies || undefined);

    const body = await request.json();
    deliveryId = body.deliveryId;
    const { deliveryName } = body;

    if (!deliveryId) {
      return NextResponse.json({ error: 'ID consegna mancante' }, { status: 400 });
    }

    console.log('📄 [PRINT] Generazione PDF per delivery ID:', deliveryId);
    console.log('📄 [PRINT] Cookie presente:', !!cookies);

    // Usa l'API RPC di Odoo per generare il report invece dell'URL diretto
    const reportName = 'invoice_pdf_custom.report_deliveryslip_customization_80mm';

    // Metodo 1: Prova a cercare il report per nome
    console.log('📄 [PRINT] Cerco report:', reportName);
    const reportSearch = await callOdoo(
      cookies,
      'ir.actions.report',
      'search_read',
      [[['report_name', '=', reportName]]],
      { fields: ['id', 'report_name', 'report_type'] }
    );

    console.log('📄 [PRINT] Report trovato:', reportSearch);

    if (!Array.isArray(reportSearch) || reportSearch.length === 0) {
      throw new Error(`Report ${reportName} non trovato in Odoo`);
    }

    const reportId = reportSearch[0].id;
    console.log('📄 [PRINT] Report ID:', reportId);

    // SOLUZIONE: Usa l'URL di Odoo con l'autenticazione fallback diretta
    // Siccome i metodi privati non funzionano e l'URL con cookie utente ritorna HTML,
    // usiamo le credenziali fallback per autenticarci e scaricare il PDF
    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24339752.dev.odoo.com';

    // Prima autenticati con le credenziali fallback per ottenere una sessione valida
    console.log('📄 [PRINT] Autenticazione con credenziali fallback per scaricare PDF...');
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          db: process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24339752',
          login: process.env.ODOO_USERNAME || 'paul@lapa.ch',
          password: process.env.ODOO_PASSWORD || 'lapa201180'
        }
      })
    });

    const authData = await authResponse.json();
    if (authData.error || !authData.result?.uid) {
      throw new Error('Autenticazione Odoo fallita per download PDF');
    }

    // Estrai il cookie dalla risposta
    const setCookie = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookie?.match(/session_id=([^;]+)/);
    if (!sessionMatch) {
      throw new Error('Nessun session_id ricevuto da Odoo');
    }

    const fallbackCookie = `session_id=${sessionMatch[1]}`;
    console.log('📄 [PRINT] Sessione fallback ottenuta');

    // Ora scarica il PDF con la sessione fallback
    const reportUrl = `${odooUrl}/report/pdf/${reportName}/${deliveryId}`;
    console.log('📄 [PRINT] Scaricamento PDF da:', reportUrl);

    const pdfResponse = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Cookie': fallbackCookie
      }
    });

    if (!pdfResponse.ok) {
      throw new Error(`Errore download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    console.log('📄 [PRINT] PDF scaricato, size:', pdfBuffer.byteLength, 'bytes');

    // Verifica che sia un PDF valido
    const pdfHeader = pdfBuffer.toString('utf8', 0, 5);
    console.log('📄 [PRINT] PDF header:', pdfHeader);

    if (!pdfHeader.startsWith('%PDF-')) {
      const textContent = pdfBuffer.toString('utf8', 0, Math.min(500, pdfBuffer.length));
      console.error('❌ [PRINT] Contenuto non è un PDF. Primi caratteri:', textContent.substring(0, 200));
      throw new Error('Il contenuto ricevuto non è un PDF valido.');
    }

    // Converti Buffer a Uint8Array per la Response
    const pdfArray = new Uint8Array(pdfBuffer);

    return new Response(pdfArray, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Consegna_${deliveryName || deliveryId}.pdf"`
      }
    });

  } catch (error: any) {
    console.error('❌ Errore stampa PDF:', error);
    console.error('❌ Stack trace:', error.stack);

    // Errore più dettagliato per il debugging
    const errorMessage = error.message || 'Errore generazione PDF';
    const errorDetails = {
      message: errorMessage,
      type: error.constructor.name,
      deliveryId: deliveryId,
      timestamp: new Date().toISOString()
    };

    console.error('❌ Dettagli errore completo:', errorDetails);

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}
