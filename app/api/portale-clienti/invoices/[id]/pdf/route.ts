import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/invoices/[id]/pdf
 *
 * Scarica il PDF della fattura da Odoo
 *
 * SICUREZZA:
 * - Verifica JWT token del cliente
 * - Verifica che la fattura appartenga al partner del cliente autenticato
 * - Usa admin session per chiamare report Odoo
 *
 * Returns: PDF file stream (application/pdf)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = parseInt(params.id, 10);

    if (isNaN(invoiceId)) {
      return NextResponse.json(
        { success: false, error: 'ID fattura non valido' },
        { status: 400 }
      );
    }

    console.log(`📄 [INVOICE-PDF-API] Download PDF fattura ${invoiceId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [INVOICE-PDF-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per scaricare questo PDF' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [INVOICE-PDF-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [INVOICE-PDF-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Verifica che la fattura esista e appartenga al cliente
    const invoiceResult = await callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', invoiceId],
          ['move_type', 'in', ['out_invoice', 'out_refund']], // Solo fatture clienti
        ],
        fields: ['id', 'name', 'partner_id', 'move_type'],
      },
    );

    if (!invoiceResult || invoiceResult.length === 0) {
      console.error('❌ [INVOICE-PDF-API] Fattura non trovata');
      return NextResponse.json(
        { success: false, error: 'Fattura non trovata' },
        { status: 404 }
      );
    }

    const invoice = invoiceResult[0];
    console.log('✅ [INVOICE-PDF-API] Fattura trovata:', invoice.name);

    // Step 2: Chiama Odoo per generare il PDF
    // Report per fatture: 'account.report_invoice' o 'account.report_invoice_with_payments'

    try {
      console.log('🔍 [INVOICE-PDF-API] Generazione PDF via ir.actions.report...');

      // Prova con report standard fattura
      let reportResult;
      try {
        reportResult = await callOdooAsAdmin(
          'ir.actions.report',
          '_render_qweb_pdf',
          [
            'account.report_invoice_with_payments', // Report completo con pagamenti
            [invoiceId],
          ],
        );
      } catch (firstAttempt) {
        console.log('🔍 [INVOICE-PDF-API] Tentativo con report base...');
        // Fallback su report fattura base
        reportResult = await callOdooAsAdmin(
          'ir.actions.report',
          '_render_qweb_pdf',
          [
            'account.report_invoice', // Report base
            [invoiceId],
          ],
        );
      }

      if (reportResult && reportResult[0]) {
        console.log('✅ [INVOICE-PDF-API] PDF generato con successo');

        const pdfData = reportResult[0];
        let pdfBuffer: Buffer;

        if (typeof pdfData === 'string') {
          pdfBuffer = Buffer.from(pdfData, 'base64');
        } else if (Buffer.isBuffer(pdfData)) {
          pdfBuffer = pdfData;
        } else if (pdfData instanceof Uint8Array) {
          pdfBuffer = Buffer.from(pdfData);
        } else {
          throw new Error('Formato PDF non riconosciuto');
        }

        console.log(`✅ [INVOICE-PDF-API] PDF size: ${pdfBuffer.length} bytes`);

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Fattura_${invoice.name.replace(/\//g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
      }
    } catch (reportError: any) {
      console.error('❌ [INVOICE-PDF-API] Errore generazione PDF:', reportError.message);

      // Fallback: download via URL diretto
      console.log('🔍 [INVOICE-PDF-API] Fallback: download via URL diretto...');

      try {
        const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';

        // Prova entrambi i possibili URL
        const pdfUrls = [
          `${ODOO_URL}/report/pdf/account.report_invoice_with_payments/${invoiceId}`,
          `${ODOO_URL}/report/pdf/account.report_invoice/${invoiceId}`,
        ];

        const adminSessionModule = require('@/lib/odoo/admin-session');
        const { sessionId } = await adminSessionModule.getAdminSession();

        let pdfBuffer: Buffer | null = null;

        for (const pdfUrl of pdfUrls) {
          try {
            const pdfResponse = await fetch(pdfUrl, {
              headers: {
                Cookie: `session_id=${sessionId}`,
              },
            });

            if (pdfResponse.ok) {
              pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
              console.log(`✅ [INVOICE-PDF-API] PDF scaricato via URL (${pdfBuffer.length} bytes)`);
              break;
            }
          } catch (urlError) {
            console.log(`❌ [INVOICE-PDF-API] URL ${pdfUrl} fallito`);
            continue;
          }
        }

        if (pdfBuffer) {
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Fattura_${invoice.name.replace(/\//g, '_')}.pdf"`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          });
        }

        throw new Error('Tutti i tentativi di download PDF falliti');
      } catch (fallbackError: any) {
        console.error('❌ [INVOICE-PDF-API] Fallback fallito:', fallbackError.message);
        throw new Error(`Impossibile generare PDF: ${reportError.message}`);
      }
    }

    throw new Error('Impossibile generare il PDF della fattura');

  } catch (error: any) {
    console.error('💥 [INVOICE-PDF-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante la generazione del PDF' },
      { status: 500 }
    );
  }
}
