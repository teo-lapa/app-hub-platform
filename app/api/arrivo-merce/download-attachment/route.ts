import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * DOWNLOAD ATTACHMENT
 *
 * Scarica un allegato da Odoo per anteprima
 * Ritorna il base64 del file
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { attachment_id } = body;

    if (!attachment_id) {
      return NextResponse.json({ error: 'attachment_id richiesto' }, { status: 400 });
    }

    console.log('📥 [DOWNLOAD-ATTACHMENT] ID:', attachment_id);

    // Scarica allegato
    const attachments = await callOdoo(cookies, 'ir.attachment', 'read', [
      [attachment_id],
      ['id', 'name', 'mimetype', 'datas', 'file_size']
    ]);

    if (attachments.length === 0) {
      return NextResponse.json({ error: 'Allegato non trovato' }, { status: 404 });
    }

    const attachment = attachments[0];

    if (!attachment.datas) {
      return NextResponse.json({ error: 'Contenuto file non disponibile' }, { status: 400 });
    }

    console.log('✅ Allegato scaricato:', attachment.name);

    return NextResponse.json({
      success: true,
      id: attachment.id,
      name: attachment.name,
      mimetype: attachment.mimetype,
      file_size: attachment.file_size,
      base64: attachment.datas
    });

  } catch (error: any) {
    console.error('❌ [DOWNLOAD-ATTACHMENT] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante il download dell\'allegato',
      details: error.toString()
    }, { status: 500 });
  }
}
