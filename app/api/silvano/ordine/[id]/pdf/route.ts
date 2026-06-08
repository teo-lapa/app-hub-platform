import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';

/**
 * GET /api/silvano/ordine/[id]/pdf
 * Scarica il PDF dell'ordine generato da Odoo (report nativo sale.order).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const { sessionId } = await getAdminSession();
    const url = `${ODOO_URL}/report/pdf/sale.report_saleorder/${id}`;
    const res = await fetch(url, { headers: { Cookie: `session_id=${sessionId}` } });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Odoo report HTTP ${res.status}` }, { status: 502 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ordine-${id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id/pdf]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
