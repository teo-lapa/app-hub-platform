import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { checkPickingOwnership } from '@/lib/delivery-auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      return NextResponse.json({
        error: 'Devi effettuare il login'
      }, { status: 401 });
    }

    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid || !cookies) {
      return NextResponse.json({
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    // Estrai odooUserId dal JWT se presente
    let realUid = uid;
    const tokenMatch = userCookies.match(/token=([^;]+)/);
    if (tokenMatch) {
      try {
        const decoded = jwt.verify(tokenMatch[1], JWT_SECRET) as any;
        if (decoded.odooUserId) {
          realUid = decoded.odooUserId;
        }
      } catch (e) {
        console.log('⚠️ JWT non valido');
      }
    }

    const body = await request.json();
    const { picking_id, note, photo } = body;

    if (!picking_id) {
      return NextResponse.json({
        error: 'ID picking mancante'
      }, { status: 400 });
    }

    const ownership = await checkPickingOwnership(cookies, userCookies, uid, picking_id);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }

    console.log('📥 [CONFIRM-PICKUP] Confermando ritiro:', picking_id);

    // Trova il nome del driver
    const uidNum = typeof realUid === 'string' ? parseInt(realUid) : realUid;
    const employees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [['user_id', '=', uidNum]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    let driverName = 'Driver';
    if (employees.length > 0) {
      driverName = employees[0].name;
    } else {
      const users = await callOdoo(
        cookies,
        'res.users',
        'read',
        [[uidNum]],
        { fields: ['name'] }
      );
      if (users.length > 0) {
        driverName = users[0].name;
      }
    }

    // 1. Imposta qty_done = quantity per tutti i move lines
    const moveLines = await callOdoo(
      cookies,
      'stock.move.line',
      'search_read',
      [],
      {
        domain: [['picking_id', '=', picking_id]],
        fields: ['id', 'quantity', 'picked']
      }
    );

    console.log('📦 [CONFIRM-PICKUP] Move lines trovate:', moveLines.length);

    for (const moveLine of moveLines) {
      if (!moveLine.picked) {
        await callOdoo(
          cookies,
          'stock.move.line',
          'write',
          [[moveLine.id], { quantity: moveLine.quantity, picked: true }]
        );
      }
    }

    // 2. Valida il picking (button_validate)
    let validated = true;
    try {
      await callOdoo(
        cookies,
        'stock.picking',
        'button_validate',
        [[picking_id]]
      );
      console.log('✅ [CONFIRM-PICKUP] Picking validato');
    } catch (validateError: any) {
      console.log('⚠️ [CONFIRM-PICKUP] Errore validazione (potrebbe richiedere conferma):', validateError.message);
      // Prova con action_confirm se button_validate fallisce
      try {
        await callOdoo(
          cookies,
          'stock.picking',
          'action_confirm',
          [[picking_id]]
        );
        await callOdoo(
          cookies,
          'stock.picking',
          'action_assign',
          [[picking_id]]
        );
        await callOdoo(
          cookies,
          'stock.picking',
          'button_validate',
          [[picking_id]]
        );
      } catch (e) {
        validated = false;
        console.log('⚠️ [CONFIRM-PICKUP] Fallback validazione fallito: il ritiro viene registrato ma il picking NON è validato');
      }
    }

    // 3. Scrivi messaggio nel chatter
    const now = new Date();
    const dateStr = now.toLocaleString('it-IT', {
      timeZone: 'Europe/Zurich',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let messageBody = `<p><strong>✅ MERCE RITIRATA</strong></p>
<p>📅 Data: ${dateStr}</p>
<p>👤 Driver: ${driverName}</p>`;

    if (note && note.trim()) {
      messageBody += `<p>📝 Nota: ${note}</p>`;
    }

    await callOdoo(
      cookies,
      'stock.picking',
      'message_post',
      [[picking_id]],
      {
        body: messageBody,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      }
    );

    console.log('💬 [CONFIRM-PICKUP] Messaggio scritto nel chatter');

    // 4. Se c'è una foto, allegala
    if (photo) {
      try {
        // Rimuovi il prefisso data:image/...;base64, se presente
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');

        await callOdoo(
          cookies,
          'ir.attachment',
          'create',
          [{
            name: `Ritiro_${picking_id}_${Date.now()}.jpg`,
            type: 'binary',
            datas: base64Data,
            res_model: 'stock.picking',
            res_id: picking_id,
            mimetype: 'image/jpeg'
          }]
        );
        console.log('📸 [CONFIRM-PICKUP] Foto allegata');
      } catch (photoError: any) {
        console.error('⚠️ [CONFIRM-PICKUP] Errore allegando foto:', photoError.message);
      }
    }

    return NextResponse.json({
      success: true,
      validated,
      message: validated
        ? 'Ritiro confermato'
        : 'Ritiro registrato, ma la validazione del picking non è riuscita: verifica in Odoo'
    });

  } catch (error: any) {
    console.error('[CONFIRM-PICKUP] Errore:', error.message);
    return NextResponse.json(
      { error: error.message || 'Errore conferma ritiro' },
      { status: 500 }
    );
  }
}
