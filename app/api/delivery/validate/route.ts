import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    // Get user cookies to use their Odoo session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, products, signature, notes, completion_type, photo } = body;

    if (!picking_id) {
      return NextResponse.json({ error: 'picking_id mancante' }, { status: 400 });
    }

    console.log('✅ VALIDATE picking_id:', picking_id, 'type:', completion_type, 'notes:', notes);
    console.log('📦 VALIDATE products:', products?.length || 0, 'prodotti');

    // AGGIORNA QUANTITÀ se necessario (VELOCE - max 2-3 sec)
    if (products && products.length > 0) {
      const productsToUpdate = products.filter((p: any) =>
        p.delivered !== undefined && p.delivered !== p.qty
      );

      if (productsToUpdate.length > 0) {
        console.log(`📝 Aggiornamento ${productsToUpdate.length} prodotti con quantità modificate...`);

        // Cerca tutti i move in una chiamata
        const allMoves = await callOdoo(cookies, 'stock.move', 'search_read', [], {
          domain: [['picking_id', '=', picking_id]],
          fields: ['id', 'product_id', 'move_line_ids']
        });

        // Aggiorna solo i prodotti modificati
        for (const product of productsToUpdate) {
          const move = allMoves.find((m: any) => m.product_id[0] === product.product_id);

          if (move?.move_line_ids?.[0]) {
            await callOdoo(cookies, 'stock.move.line', 'write', [
              [move.move_line_ids[0]],
              { qty_done: product.delivered }
            ]);
            console.log(`✅ ${product.name}: ${product.delivered}`);
          }
        }
      }
    }

    // Valida il picking
    const validateResult = await callOdoo(cookies, 'stock.picking', 'button_validate', [[picking_id]]);

    let backorder_created = false;
    if (validateResult && typeof validateResult === 'object' && validateResult.res_model) {
      const wizardId = validateResult.res_id;
      if (validateResult.res_model === 'stock.backorder.confirmation') {
        await callOdoo(cookies, validateResult.res_model, 'process', [[wizardId]], {});
        backorder_created = true;
      } else if (validateResult.res_model === 'stock.immediate.transfer') {
        await callOdoo(cookies, validateResult.res_model, 'process', [[wizardId]], {});
      } else if (validateResult.res_model === 'stock.overprocessed.transfer') {
        await callOdoo(cookies, validateResult.res_model, 'action_confirm', [[wizardId]], {});
      }
    }

    let messageHtml = '';
    const attachmentIds: number[] = [];

    if (completion_type === 'signature') {
      messageHtml = '<strong>CONSEGNA COMPLETATA CON FIRMA</strong><br/>';
    } else if (completion_type === 'photo') {
      messageHtml = '<strong>CONSEGNA COMPLETATA CON FOTO (Cliente assente)</strong><br/>';
    } else if (completion_type === 'payment') {
      messageHtml = '<strong>CONSEGNA COMPLETATA CON INCASSO PAGAMENTO</strong><br/>';
    } else {
      messageHtml = '<strong>CONSEGNA COMPLETATA</strong><br/>';
    }

    if (notes && notes.trim()) {
      messageHtml += '<strong>Note:</strong> ' + notes + '<br/>';
    }

    messageHtml += '<strong>Data:</strong> ' + new Date().toLocaleString('it-IT') + '<br/>';

    if (signature) {
      // Extract base64 data from signature (remove data:image/png;base64, prefix)
      const signatureBase64 = signature.split(',')[1];

      // Write signature to stock.picking record's signature field
      await callOdoo(cookies, 'stock.picking', 'write', [[picking_id], {
        signature: signatureBase64
      }]);

      messageHtml += '<strong>Firma salvata nel documento</strong><br/>';
      console.log('Firma salvata nel campo signature del picking:', picking_id);
    }

    // Upload photo as attachment if present
    if (photo) {
      console.log('📸 [VALIDATE] Caricamento foto come allegato...');

      // Extract base64 data from photo (remove data:image/jpeg;base64, prefix)
      const photoBase64 = photo.split(',')[1];

      // Create ir.attachment
      const attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: `Foto_Consegna_${picking_id}_${Date.now()}.jpg`,
        datas: photoBase64,
        res_model: 'stock.picking',
        res_id: picking_id,
        mimetype: 'image/jpeg',
        description: 'Foto consegna - Cliente assente'
      }]);

      attachmentIds.push(attachmentId);
      messageHtml += '<strong>📸 Foto consegna allegata</strong><br/>';
      console.log('✅ Foto caricata come allegato ID:', attachmentId);
    }

    const messageId = await callOdoo(cookies, 'mail.message', 'create', [{
      body: messageHtml,
      model: 'stock.picking',
      res_id: picking_id,
      message_type: 'comment',
      subtype_id: 1,
      attachment_ids: attachmentIds.length > 0 ? [[6, false, attachmentIds]] : false
    }]);

    console.log('Messaggio chatter creato ID:', messageId);

    return NextResponse.json({
      success: true,
      backorder_created,
      message_id: messageId,
      attachment_ids: attachmentIds
    });

  } catch (error: any) {
    console.error('ERRORE VALIDATE:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
