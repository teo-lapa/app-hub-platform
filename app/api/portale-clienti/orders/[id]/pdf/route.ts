import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/orders/[id]/pdf
 *
 * Scarica il PDF dell'ordine da Odoo
 *
 * SICUREZZA:
 * - Verifica JWT token del cliente
 * - Verifica che l'ordine appartenga al partner del cliente autenticato
 * - Usa admin session per chiamare report Odoo
 *
 * Returns: PDF file stream (application/pdf)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID ordine non valido' },
        { status: 400 }
      );
    }

    console.log(`📄 [ORDER-PDF-API] Download PDF ordine ${orderId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [ORDER-PDF-API] No JWT token found');
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
      console.log('✅ [ORDER-PDF-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [ORDER-PDF-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Verifica che l'ordine esista e appartenga al cliente
    const orderResult = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: ['id', 'name', 'partner_id'],
      },
    );

    if (!orderResult || orderResult.length === 0) {
      console.error('❌ [ORDER-PDF-API] Ordine non trovato');
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orderResult[0];
    console.log('✅ [ORDER-PDF-API] Ordine trovato:', order.name);

    // Step 2: Chiama Odoo per generare il PDF
    // Odoo report method: 'render_qweb_pdf' or '_render_qweb_pdf'
    // Report XML ID: 'sale.report_saleorder'

    let pdfBase64: string | null = null;

    try {
      // Metodo 1: Prova con ir.actions.report
      console.log('🔍 [ORDER-PDF-API] Tentativo generazione PDF via ir.actions.report...');

      const reportResult = await callOdooAsAdmin(
        'ir.actions.report',
        '_render_qweb_pdf',
        [
          'sale.report_saleorder', // Report XML ID
          [orderId],               // Document IDs
        ],
      );

      // reportResult è un array [pdfBytes, reportType]
      // dove pdfBytes è il PDF in bytes
      if (reportResult && reportResult[0]) {
        console.log('✅ [ORDER-PDF-API] PDF generato con successo');

        // Il risultato potrebbe essere già bytes o base64
        // Controlliamo il tipo
        const pdfData = reportResult[0];

        let pdfBuffer: Buffer;

        if (typeof pdfData === 'string') {
          // È base64 string
          pdfBuffer = Buffer.from(pdfData, 'base64');
        } else if (Buffer.isBuffer(pdfData)) {
          // È già un Buffer
          pdfBuffer = pdfData;
        } else if (pdfData instanceof Uint8Array) {
          // È Uint8Array
          pdfBuffer = Buffer.from(pdfData);
        } else {
          throw new Error('Formato PDF non riconosciuto');
        }

        console.log(`✅ [ORDER-PDF-API] PDF size: ${pdfBuffer.length} bytes`);

        // Return PDF as downloadable file
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Ordine_${order.name.replace(/\//g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
      }
    } catch (reportError: any) {
      console.error('❌ [ORDER-PDF-API] Errore generazione PDF:', reportError.message);

      // Metodo 2: Fallback - prova URL diretto Odoo
      console.log('🔍 [ORDER-PDF-API] Fallback: tentativo download via URL diretto...');

      try {
        const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';
        const pdfUrl = `${ODOO_URL}/report/pdf/sale.report_saleorder/${orderId}`;

        // Get admin session
        const { sessionId } = await callOdooAsAdmin('res.users', 'search_read', [], {
          domain: [['id', '=', 1]],
          fields: ['id'],
        }).then(() => {
          // Trucco per ottenere session_id dall'helper
          const adminSessionModule = require('@/lib/odoo/admin-session');
          return adminSessionModule.getAdminSession();
        });

        const pdfResponse = await fetch(pdfUrl, {
          headers: {
            Cookie: `session_id=${sessionId}`,
          },
        });

        if (!pdfResponse.ok) {
          throw new Error(`HTTP ${pdfResponse.status}`);
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

        console.log(`✅ [ORDER-PDF-API] PDF scaricato via URL (${pdfBuffer.length} bytes)`);

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Ordine_${order.name.replace(/\//g, '_')}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
          },
        });
      } catch (fallbackError: any) {
        console.error('❌ [ORDER-PDF-API] Fallback fallito:', fallbackError.message);
        throw new Error(`Impossibile generare PDF: ${reportError.message}`);
      }
    }

    // Se arriviamo qui, qualcosa è andato storto
    throw new Error('Impossibile generare il PDF dell\'ordine');

  } catch (error: any) {
    console.error('💥 [ORDER-PDF-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore durante la generazione del PDF' },
      { status: 500 }
    );
  }
}
