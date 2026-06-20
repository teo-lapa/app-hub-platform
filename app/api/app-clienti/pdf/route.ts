import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, getAdminSession } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/app-clienti/pdf?type=order|invoice|delivery&id=ID
 *
 * PDF coi report GIUSTI di LAPA:
 * - order    -> "Sales Order Report" Studio (con Ordinato/Consegnato)
 * - invoice  -> fattura con QR pagamento svizzero
 * - delivery -> DDT italiano (l10n_it_stock_ddt)
 * Fallback ai report standard se quello custom non rende.
 */
const CONF: Record<string, { model: string; reports: string[]; prefix: string }> = {
  order: {
    model: 'sale.order',
    reports: ['studio_customization.studio_report_docume_2779be89-6820-4e11-a211-6440e0f3fbe8', 'sale.report_saleorder'],
    prefix: 'Ordine',
  },
  invoice: {
    model: 'account.move',
    reports: ['account.report_invoice_with_payments', 'account.report_invoice'],
    prefix: 'Fattura',
  },
  delivery: {
    model: 'stock.picking',
    reports: ['l10n_it_stock_ddt.report_ddt', 'stock.report_deliveryslip'],
    prefix: 'DDT',
  },
};

function toBuf(d: any): Buffer | null {
  if (!d) return null;
  if (typeof d === 'string') return Buffer.from(d, 'base64');
  if (Buffer.isBuffer(d)) return d;
  if (d instanceof Uint8Array) return Buffer.from(d);
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Login richiesto' }, { status: 401 });
    try { jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key'); } catch { return NextResponse.json({ error: 'Token non valido' }, { status: 401 }); }

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || '';
    const id = parseInt(url.searchParams.get('id') || '', 10);
    const conf = CONF[type];
    if (!conf || isNaN(id)) return NextResponse.json({ error: 'Parametri non validi' }, { status: 400 });

    // Nome documento (per il filename)
    let docName = String(id);
    try {
      const rec = await callOdooAsAdmin(conf.model, 'search_read', [], { domain: [['id', '=', id]], fields: ['name'], limit: 1 });
      if (rec && rec[0]?.name) docName = rec[0].name;
    } catch { /* ignora */ }

    // Render via _render_qweb_pdf (prova report custom, poi standard)
    let pdf: Buffer | null = null;
    for (const rep of conf.reports) {
      try {
        const res = await callOdooAsAdmin('ir.actions.report', '_render_qweb_pdf', [rep, [id]]);
        pdf = toBuf(res && res[0]);
        if (pdf) break;
      } catch { /* prova il prossimo */ }
    }

    // Fallback: URL /report/pdf con sessione admin
    if (!pdf) {
      const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';
      try {
        const { sessionId } = await getAdminSession();
        for (const rep of conf.reports) {
          try {
            const r = await fetch(`${ODOO_URL}/report/pdf/${rep}/${id}`, { headers: { Cookie: `session_id=${sessionId}` } });
            if (r.ok) { pdf = Buffer.from(await r.arrayBuffer()); break; }
          } catch { /* prova il prossimo */ }
        }
      } catch { /* ignora */ }
    }

    if (!pdf) return NextResponse.json({ error: 'PDF non disponibile' }, { status: 500 });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${conf.prefix}_${docName.replace(/[\/\\]/g, '_')}.pdf"`,
        'Content-Length': pdf.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Errore' }, { status: 500 });
  }
}
