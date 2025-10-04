import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const { cookies, uid } = await getOdooSession();
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { original_picking_id, note, photo } = body;

    console.log('📦 RESO API: Ricevuto payload:', {
      original_picking_id,
      has_note: !!note,
      has_photo: !!photo
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

    // Leggi il picking originale
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'read',
      [[original_picking_id]],
      { fields: ['name', 'note'] }
    );

    const picking = pickings[0];
    if (!picking) {
      return NextResponse.json({ error: 'Consegna non trovata' }, { status: 404 });
    }

    console.log('📦 RESO API: Picking trovato:', picking.name);

    // Aggiorna il picking con nota RESO e completalo
    const notaCompleta = `RESO - ${note}\n\n${picking.note || ''}`.trim();

    await callOdoo(
      cookies,
      'stock.picking',
      'write',
      [[original_picking_id], {
        note: notaCompleta
      }]
    );

    console.log('✅ RESO API: Nota RESO aggiunta al picking');

    // Allega la foto del danno al picking
    console.log('📸 RESO API: Allegando foto del danno...');
    const base64Data = photo.includes('base64,') ? photo.split('base64,')[1] : photo;

    await callOdoo(
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

    console.log('✅ RESO API: Foto allegata con successo');
    console.log('✅ RESO API: RESO registrato con successo per picking:', picking.name);

    return NextResponse.json({
      success: true,
      picking_id: original_picking_id,
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
