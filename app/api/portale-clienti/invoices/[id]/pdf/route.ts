/**
 * INVOICE PDF DOWNLOAD API ROUTE
 *
 * GET /api/portale-clienti/invoices/[id]/pdf
 *
 * Downloads the real PDF invoice from Odoo attachments
 *
 * Steps:
 * 1. Verify user has access to invoice
 * 2. Search for PDF attachment in ir.attachment
 * 3. Return base64 decoded PDF with proper headers
 *
 * Security:
 * - Validates invoice belongs to authenticated customer
 * - Only returns customer invoices (out_invoice)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = parseInt(params.id);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    console.log(`=Ä [INVOICE-PDF] Fetching PDF for invoice ${invoiceId}...`);

    // Get Odoo session from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const { cookies } = await getOdooSession(cookieHeader);

    // Get customer ID from session
    let customerId: number;

    try {
      const sessionInfo = await callOdoo(cookies, 'res.users', 'read', [[1]], {
        fields: ['partner_id'],
      });

      if (!sessionInfo || !sessionInfo[0]?.partner_id) {
        throw new Error('Customer ID not found in session');
      }

      customerId = sessionInfo[0].partner_id[0];
      console.log('=d [INVOICE-PDF] Customer ID:', customerId);
    } catch (error) {
      console.error('L [INVOICE-PDF] Error getting customer ID:', error);
      return NextResponse.json(
        { error: 'Failed to get customer information' },
        { status: 500 }
      );
    }

    // Verify invoice belongs to customer
    const invoice = await callOdoo(
      cookies,
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', invoiceId],
          ['partner_id', '=', customerId],
          ['move_type', '=', 'out_invoice'],
        ],
        fields: ['id', 'name'],
        limit: 1,
      }
    );

    if (!invoice || invoice.length === 0) {
      console.error('L [INVOICE-PDF] Invoice not found or access denied');
      return NextResponse.json(
        { error: 'Invoice not found or access denied' },
        { status: 404 }
      );
    }

    const invoiceName = invoice[0].name;
    console.log(` [INVOICE-PDF] Invoice verified: ${invoiceName}`);

    // Search for PDF attachment
    // Try multiple search strategies to find the PDF
    let attachments = [];

    // Strategy 1: Search by res_model and res_id with PDF extension
    attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [], {
      domain: [
        ['res_model', '=', 'account.move'],
        ['res_id', '=', invoiceId],
        ['mimetype', '=', 'application/pdf'],
      ],
      fields: ['id', 'name', 'datas', 'mimetype', 'file_size'],
      limit: 1,
      order: 'id DESC', // Get the most recent
    });

    // Strategy 2: If no attachment found, search by name pattern
    if (!attachments || attachments.length === 0) {
      console.log('=Ä [INVOICE-PDF] No attachment found by model, trying by name...');
      attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [], {
        domain: [
          ['res_model', '=', 'account.move'],
          ['res_id', '=', invoiceId],
          ['name', 'ilike', '.pdf'],
        ],
        fields: ['id', 'name', 'datas', 'mimetype', 'file_size'],
        limit: 1,
        order: 'id DESC',
      });
    }

    // Strategy 3: If still no attachment, try to generate it via Odoo report
    if (!attachments || attachments.length === 0) {
      console.log('=Ä [INVOICE-PDF] No attachment found, generating from report...');

      try {
        // Call Odoo report rendering
        // This generates the PDF on-the-fly from Odoo's invoice template
        const reportData = await callOdoo(
          cookies,
          'ir.actions.report',
          'search_read',
          [],
          {
            domain: [
              ['model', '=', 'account.move'],
              ['report_type', '=', 'qweb-pdf'],
            ],
            fields: ['id', 'report_name'],
            limit: 1,
          }
        );

        if (reportData && reportData.length > 0) {
          const reportId = reportData[0].id;

          // Generate PDF
          const pdfData = await callOdoo(
            cookies,
            'ir.actions.report',
            '_render_qweb_pdf',
            [reportId, [invoiceId]],
            {}
          );

          if (pdfData && pdfData[0]) {
            // pdfData[0] contains the base64 encoded PDF
            const pdfBuffer = Buffer.from(pdfData[0], 'base64');

            console.log(` [INVOICE-PDF] Generated PDF (${pdfBuffer.length} bytes)`);

            return new Response(pdfBuffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${invoiceName}.pdf"`,
                'Content-Length': pdfBuffer.length.toString(),
              },
            });
          }
        }
      } catch (reportError) {
        console.error('L [INVOICE-PDF] Report generation failed:', reportError);
      }
    }

    if (!attachments || attachments.length === 0) {
      console.error('L [INVOICE-PDF] No PDF attachment found');
      return NextResponse.json(
        { error: 'PDF not found for this invoice' },
        { status: 404 }
      );
    }

    const attachment = attachments[0];
    console.log(` [INVOICE-PDF] Found attachment: ${attachment.name}`);

    // Decode base64 PDF data
    if (!attachment.datas) {
      console.error('L [INVOICE-PDF] Attachment has no data');
      return NextResponse.json(
        { error: 'PDF data not available' },
        { status: 500 }
      );
    }

    const pdfBuffer = Buffer.from(attachment.datas, 'base64');
    console.log(` [INVOICE-PDF] Decoded PDF (${pdfBuffer.length} bytes)`);

    // Return PDF with proper headers
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${attachment.name}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('L [INVOICE-PDF] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to download PDF',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
