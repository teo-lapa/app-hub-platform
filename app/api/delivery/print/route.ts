import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId, authenticateWithCredentials } from '@/lib/odoo/odoo-helper';
import { injectLangContext } from '@/lib/odoo/user-lang';

const reportName = 'invoice_pdf_custom.report_deliveryslip_customization_80mm';

// Cerca il report e scarica il PDF da Odoo con la sessione fornita.
// Lancia un errore se la sessione non e' valida (report non trovato o contenuto non-PDF = pagina di login).
async function fetchDeliveryPdf(sessionId: string, deliveryId: number, odooUrl: string): Promise<Buffer> {
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
        kwargs: injectLangContext({ fields: ['id', 'report_name', 'report_type'] })
      },
      id: Date.now()
    })
  });

  const reportSearchData = await reportSearchResponse.json();
  if (reportSearchData.error) {
    throw new Error(reportSearchData.error.data?.message || reportSearchData.error.message || 'Errore ricerca report');
  }

  const reportSearch = reportSearchData.result;
  if (!Array.isArray(reportSearch) || reportSearch.length === 0) {
    throw new Error(`Report ${reportName} non trovato in Odoo`);
  }
  console.log('📄 [PRINT] Report ID:', reportSearch[0].id);

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

  // Se la sessione e' scaduta Odoo risponde con una pagina HTML invece del PDF
  if (!pdfBuffer.toString('utf8', 0, 5).startsWith('%PDF-')) {
    throw new Error('Sessione Odoo scaduta (ricevuto HTML invece del PDF)');
  }

  return pdfBuffer;
}

export async function POST(request: NextRequest) {
  let deliveryId: number | undefined;

  try {
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

    let pdfBuffer: Buffer;
    try {
      // Primo tentativo: sessione dell'utente loggato (autista)
      pdfBuffer = await fetchDeliveryPdf(sessionId, deliveryId, odooUrl);
    } catch (firstError: any) {
      // Sessione autista scaduta: ri-autentica con le credenziali di servizio e riprova una volta
      // (stesso recupero automatico che hanno gia' gli altri endpoint dell'app)
      console.warn('⚠️ [PRINT] Primo tentativo fallito, ri-autentico:', firstError?.message);
      const freshSession = await authenticateWithCredentials();
      if (!freshSession) throw firstError;
      pdfBuffer = await fetchDeliveryPdf(freshSession, deliveryId, odooUrl);
    }

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

    const errorMessage = error.message || 'Errore generazione PDF';
    const errorDetails = {
      message: errorMessage,
      type: error.constructor?.name,
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
