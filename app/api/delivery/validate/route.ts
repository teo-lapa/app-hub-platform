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
    console.log('📦 VALIDATE products:', products);

    // Aggiorna quantità consegnate nelle Operazioni Dettagliate (stock.move.line)
    if (products && products.length > 0) {
      console.log(`📝 Aggiornamento quantità per ${products.length} prodotti...`);

      for (const product of products) {
        try {
          // Cerca lo stock.move per questo prodotto in questo picking
          const moves = await callOdoo(cookies, 'stock.move', 'search_read', [], {
            domain: [
              ['picking_id', '=', picking_id],
              ['product_id', '=', product.product_id || product.id]
            ],
            fields: ['id', 'move_line_ids'],
            limit: 1
          });

          if (moves && moves.length > 0) {
            const move = moves[0];
            console.log(`📦 Trovato stock.move ID ${move.id} per prodotto ${product.name || product.product_id}`);

            // Cerca le move_line associate a questo move
            const moveLineIds = move.move_line_ids || [];

            if (moveLineIds.length > 0) {
              // Aggiorna la prima move_line (caso standard)
              const qtyToSet = product.delivered !== undefined ? product.delivered : (product.qty || 0);

              console.log(`✍️ Aggiorno stock.move.line ${moveLineIds[0]} con qty_done: ${qtyToSet}`);

              await callOdoo(cookies, 'stock.move.line', 'write', [
                [moveLineIds[0]],
                { qty_done: qtyToSet }
              ]);

              console.log(`✅ Quantità aggiornata: ${qtyToSet}`);
            } else {
              console.warn(`⚠️ Nessuna move_line trovata per move ${move.id}, creo nuova move_line...`);

              // Se non esiste move_line, creala
              const qtyToSet = product.delivered !== undefined ? product.delivered : (product.qty || 0);

              // Recupera info picking per location_id e location_dest_id
              const pickingData = await callOdoo(cookies, 'stock.picking', 'read', [[picking_id]], {
                fields: ['location_id', 'location_dest_id']
              });

              if (pickingData && pickingData[0]) {
                const newMoveLine = await callOdoo(cookies, 'stock.move.line', 'create', [{
                  move_id: move.id,
                  product_id: product.product_id || product.id,
                  qty_done: qtyToSet,
                  location_id: pickingData[0].location_id[0],
                  location_dest_id: pickingData[0].location_dest_id[0],
                  picking_id: picking_id
                }]);

                console.log(`✅ Creata nuova move_line ${newMoveLine}`);
              }
            }
          } else {
            console.warn(`⚠️ Stock.move non trovato per prodotto ${product.name || product.product_id} nel picking ${picking_id}`);
          }
        } catch (error) {
          console.error(`❌ Errore aggiornamento prodotto ${product.name}:`, error);
          // Continua con i prossimi prodotti invece di bloccare tutto
        }
      }
    }

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
