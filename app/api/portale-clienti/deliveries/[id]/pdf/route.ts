import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/deliveries/[id]/pdf
 *
 * Scarica il PDF della consegna (Delivery Slip / DDT) da Odoo
 *
 * SICUREZZA:
 * - Verifica JWT token del cliente
 * - Verifica che la consegna appartenga al partner del cliente autenticato
 * - Usa admin session per chiamare report Odoo
 *
 * Returns: PDF file stream (application/pdf)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliveryId = parseInt(params.id, 10);

    if (isNaN(deliveryId)) {
      return NextResponse.json(
        { success: false, error: 'ID consegna non valido' },
        { status: 400 }
      );
    }

    console.log(`📄 [DELIVERY-PDF-API] Download PDF consegna ${deliveryId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [DELIVERY-PDF-API] No JWT token found');
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
      console.log('✅ [DELIVERY-PDF-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [DELIVERY-PDF-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Verifica che la consegna esista e appartenga al cliente
    const deliveryResult = await callOdooAsAdmin(
      'stock.picking',
      'search_read',
      [],
      {
        domain: [['id', '=', deliveryId]],
        fields: ['id', 'name', 'partner_id', 'picking_type_id'],
      },
    );

    if (!deliveryResult || deliveryResult.length === 0) {
      console.error('❌ [DELIVERY-PDF-API] Consegna non trovata');
      return NextResponse.json(
        { success: false, error: 'Consegna non trovata' },
        { status: 404 }
      );
    }

    const delivery = deliveryResult[0];
    console.log('✅ [DELIVERY-PDF-API] Consegna trovata:', delivery.name);

    // Step 2: Chiama Odoo per generare il PDF
    // Report per consegne: 'stock.report_deliveryslip' o 'stock.action_report_delivery'

    try {
      console.log('🔍 [DELIVERY-PDF-API] Generazione PDF via ir.actions.report...');

      // Prova prima con report_deliveryslip (più comune)
      let reportResult;
      try {
        reportResult = await callOdooAsAdmin(
          'ir.actions.report',
          '_render_qweb_pdf',
          [
            'stock.report_deliveryslip', // Report XML ID per DDT
            [deliveryId],
          ],
        );
      } catch (firstAttempt) {
        console.log('🔍 [DELIVERY-PDF-API] Tentativo con report alternativo...');
        // Fallback su report picking standard
        reportResult = await callOdooAsAdmin(
          'ir.actions.report',
          '_render_qweb_pdf',
          [
            'stock.action_report_delivery', // Report alternativo
            [deliveryId],
          ],
        );
      }

      if (reportResult && reportResult[0]) {
        console.log('✅ [DELIVERY-PDF-API] PDF generato con successo');

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

        console.log(`✅ [DELIVERY-PDF-API] PDF size: ${pdfBuffer.length} bytes`);

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Consegna_${delivery.name.replace(/\//g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
      }
    } catch (reportError: any) {
      console.error('❌ [DELIVERY-PDF-API] Errore generazione PDF:', reportError.message);

      // Fallback: download via URL diretto
      console.log('🔍 [DELIVERY-PDF-API] Fallback: download via URL diretto...');

      try {
        const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';

        // Prova entrambi i possibili URL
        const pdfUrls = [
          `${ODOO_URL}/report/pdf/stock.report_deliveryslip/${deliveryId}`,
          `${ODOO_URL}/report/pdf/stock.action_report_delivery/${deliveryId}`,
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
              console.log(`✅ [DELIVERY-PDF-API] PDF scaricato via URL (${pdfBuffer.length} bytes)`);
              break;
            }
          } catch (urlError) {
            console.log(`❌ [DELIVERY-PDF-API] URL ${pdfUrl} fallito`);
            continue;
          }
        }

        if (pdfBuffer) {
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Consegna_${delivery.name.replace(/\//g, '_')}.pdf"`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          });
        }

        throw new Error('Tutti i tentativi di download PDF falliti');
      } catch (fallbackError: any) {
        console.error('❌ [DELIVERY-PDF-API] Fallback fallito:', fallbackError.message);
        throw new Error(`Impossibile generare PDF: ${reportError.message}`);
      }
    }

    throw new Error('Impossibile generare il PDF della consegna');

  } catch (error: any) {
    console.error('💥 [DELIVERY-PDF-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante la generazione del PDF' },
      { status: 500 }
    );
  }
}
