import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  let deliveryId: number | undefined;

  try {
    // Ottieni session_id utente
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    deliveryId = body.deliveryId;
    const { deliveryName } = body;

    if (!deliveryId) {
      return NextResponse.json({ error: 'ID consegna mancante' }, { status: 400 });
    }

    console.log('📄 [PRINT] Generazione PDF per delivery ID:', deliveryId);

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24339752.dev.odoo.com';
    const reportName = 'invoice_pdf_custom.report_deliveryslip_customization_80mm';

    // Cerca il report per nome
    console.log('📄 [PRINT] Cerco report:', reportName);
    const reportSearchResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'ir.actions.report',
          method: 'search_read',
          args: [[['report_name', '=', reportName]]],
          kwargs: { fields: ['id', 'report_name', 'report_type'] }
        },
        id: Date.now()
      })
    });

    const reportSearchData = await reportSearchResponse.json();
    if (reportSearchData.error) {
      throw new Error(reportSearchData.error.message || 'Errore ricerca report');
    }

    const reportSearch = reportSearchData.result;
    console.log('📄 [PRINT] Report trovato:', reportSearch);

    if (!Array.isArray(reportSearch) || reportSearch.length === 0) {
      throw new Error(`Report ${reportName} non trovato in Odoo`);
    }

    const reportId = reportSearch[0].id;
    console.log('📄 [PRINT] Report ID:', reportId);

    // Scarica il PDF usando la sessione utente
    const reportUrl = `${odooUrl}/report/pdf/${reportName}/${deliveryId}`;
    console.log('📄 [PRINT] Scaricamento PDF da:', reportUrl);

    const pdfResponse = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Cookie': `session_id=${sessionId}`
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
