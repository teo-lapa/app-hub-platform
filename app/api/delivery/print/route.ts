import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');
    const { cookies } = await getOdooSession(userCookies || undefined);

    const body = await request.json();
    const { deliveryId, deliveryName } = body;

    if (!deliveryId) {
      return NextResponse.json({ error: 'ID consegna mancante' }, { status: 400 });
    }

    const odooUrl = 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const reportName = 'invoice_pdf_custom.report_deliveryslip_customization_80mm';
    const pdfUrl = `${odooUrl}/report/pdf/${reportName}/${deliveryId}`;

    console.log('📄 Download PDF da Odoo:', pdfUrl);

    // Scarica il PDF da Odoo con i cookie di sessione
    const pdfResponse = await fetch(pdfUrl, {
      headers: {
        'Cookie': cookies
      }
    });

    if (!pdfResponse.ok) {
      throw new Error(`Errore Odoo: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Ritorna il PDF con header per download forzato
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Consegna_${deliveryName || deliveryId}.pdf"`
      }
    });

  } catch (error: any) {
    console.error('❌ Errore stampa PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Errore generazione PDF' },
      { status: 500 }
    );
  }
}
