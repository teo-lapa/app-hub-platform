import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';

// POST — salva nota nel chatter del partner in Odoo
export async function POST(request: NextRequest) {
  try {
    const { partnerId, note, autore } = await request.json();
    if (!partnerId || !note) {
      return NextResponse.json({ error: 'partnerId e note obbligatori' }, { status: 400 });
    }

    const cookies = request.cookies.get('odoo_session_id')?.value || null;
    const body = `<p><strong>[Recupero Clienti - ${autore || 'Mihai'}]</strong><br/>${note}</p>`;

    await callOdoo(cookies, 'res.partner', 'message_post', [[partnerId]], {
      body,
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_note',
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
