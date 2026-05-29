import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { checkPickingOwnership, assertBase64Size } from '@/lib/delivery-auth';

export async function POST(request: NextRequest) {
  try {
    // Passa i cookies dell'utente per usare la sua sessione Odoo
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { original_picking_id, note, photo, products } = body;

    console.log('📦 RESO API: Ricevuto payload:', {
      original_picking_id,
      has_note: !!note,
      has_photo: !!photo,
      products_count: products?.length || 0
    });

    if (!original_picking_id) {
      console.log('❌ RESO API: ID consegna mancante');
      return NextResponse.json({ error: 'ID consegna mancante' }, { status: 400 });
    }

    if (!note || note.trim() === '') {
      console.log('❌ RESO API: Motivo reso mancante');
      return NextResponse.json({ error: 'Motivo reso obbligatorio' }, { status: 400 });
    }

    if (!photo) {
      console.log('❌ RESO API: Foto danno mancante');
      return NextResponse.json({ error: 'Foto del danno obbligatoria' }, { status: 400 });
    }

    const ownership = await checkPickingOwnership(cookies, userCookies, uid, original_picking_id);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }
    assertBase64Size(photo);

    // Leggi il picking originale
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'read',
      [[original_picking_id]],
      { fields: ['name', 'note', 'picking_type_id', 'location_id', 'location_dest_id'] }
    );

    const picking = pickings[0];
    if (!picking) {
      return NextResponse.json({ error: 'Consegna non trovata' }, { status: 404 });
    }

    console.log('📦 RESO API: Picking trovato:', picking.name);

    // VERSIONE SEMPLICE: Aggiungi solo nota al picking originale
    const notaCompleta = `RESO - ${note}\n\n${picking.note || ''}`.trim();
    await callOdoo(
      cookies,
      'stock.picking',
      'write',
      [[original_picking_id], { note: notaCompleta }]
    );

    console.log('✅ RESO API: Nota aggiunta al picking originale');

    // Allega la foto del danno al picking originale
    console.log('📸 RESO API: Allegando foto del danno...');
    const base64Data = photo.includes('base64,') ? photo.split('base64,')[1] : photo;

    const attachmentId = await callOdoo(
      cookies,
      'ir.attachment',
      'create',
      [{
        name: `RESO_Foto_Danno_${picking.name}.jpg`,
        type: 'binary',
        datas: base64Data,
        res_model: 'stock.picking',
        res_id: original_picking_id,
        mimetype: 'image/jpeg'
      }]
    );

    console.log('✅ RESO API: Foto allegata con ID:', attachmentId);

    // Crea messaggio nel chatter
    const messageHtml = `<p><strong>📦 RESO REGISTRATO</strong></p>
<p><strong>Motivo:</strong> ${note}</p>
<p><strong>Data:</strong> ${new Date().toLocaleString('it-IT')}</p>`;

    await callOdoo(
      cookies,
      'mail.message',
      'create',
      [{
        body: messageHtml,
        message_type: 'comment',
        model: 'stock.picking',
        res_id: original_picking_id,
        attachment_ids: [[6, 0, [attachmentId]]]
      }]
    );

    console.log('✅ RESO API: Messaggio chatter creato');
    console.log('✅ RESO API: RESO registrato con successo');

    return NextResponse.json({
      success: true,
      original_picking_id: original_picking_id,
      message: 'Reso registrato con successo'
    });
  } catch (error: any) {
    console.error('❌ RESO API: Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore registrazione reso' },
      { status: 500 }
    );
  }
}
