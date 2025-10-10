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

    // Usa sempre il nuovo URL Odoo corretto
    const odooUrl = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24339752.dev.odoo.com';
    const reportName = 'invoice_pdf_custom.report_deliveryslip_customization_80mm';
    const pdfUrl = `${odooUrl}/report/pdf/${reportName}/${deliveryId}`;

    console.log('📄 [PRINT] Download PDF da Odoo:', pdfUrl);
    console.log('📄 [PRINT] Cookie presente:', !!cookies);

    // Scarica il PDF da Odoo con i cookie di sessione
    const pdfResponse = await fetch(pdfUrl, {
      headers: cookies ? {
        'Cookie': cookies
      } : {}
    });

    console.log('📄 [PRINT] Response status:', pdfResponse.status);

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('❌ [PRINT] Errore Odoo response:', errorText.substring(0, 300));
      throw new Error(`Errore Odoo: ${pdfResponse.status} - ${errorText.substring(0, 200)}`);
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
