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
    const { picking_id, products, signature, notes, completion_type, photo, payment_data } = body;

    if (!picking_id) {
      return NextResponse.json({ error: 'picking_id mancante' }, { status: 400 });
    }

    console.log('✅ VALIDATE picking_id:', picking_id, 'type:', completion_type, 'notes:', notes);
    console.log('📦 VALIDATE products:', products?.length || 0, 'prodotti');

    // AGGIORNA QUANTITÀ in stock.move.line (VELOCE - usa move_line_id diretto)
    if (products && products.length > 0) {
      const productsToUpdate = products.filter((p: any) =>
        p.move_line_id && p.delivered !== undefined
      );

      if (productsToUpdate.length > 0) {
        console.log(`📝 Aggiornamento ${productsToUpdate.length} prodotti con quantità modificate...`);

        // Aggiorna tutti i move_line IN PARALLELO (veloce!)
        await Promise.all(productsToUpdate.map((product: any) =>
          callOdoo(cookies, 'stock.move.line', 'write', [
            [product.move_line_id],
            { qty_done: product.delivered }
          ]).then(() => {
            console.log(`✅ ${product.name}: ${product.delivered} (move_line_id: ${product.move_line_id})`);
          })
        ));
      }
    }

    // 🔥 CONTROLLA SE È UNO SCARICO PARZIALE E AGGIORNA NOTE PRIMA DELLA VALIDAZIONE
    // Così il DDT PDF avrà le note corrette
    const prodottiNonConsegnati = products
      ?.filter((p: any) => (p.delivered || 0) < (p.qty || 0))
      .map((p: any) => {
        const delivered = p.delivered || 0;
        const requested = p.qty || 0;
        if (delivered === 0) {
          return `<li>${p.name} - NON CONSEGNATO (richiesto: ${requested})</li>`;
        } else {
          return `<li>${p.name} - PARZIALE (consegnato: ${delivered}/${requested})</li>`;
        }
      })
      .join('\n') || '';

    const isPartialDelivery = prodottiNonConsegnati.length > 0;

    if (isPartialDelivery) {
      console.log('⚠️ [VALIDATE] Scarico parziale rilevato, aggiorno note del picking PRIMA della validazione...');

      const noteContent = `<p><strong>⚠️ SCARICO PARZIALE</strong></p>
<p><strong>📦 Prodotti non consegnati:</strong></p>
<ul>
${prodottiNonConsegnati}
</ul>
<p>Il prodotto è rimasto nel furgone e deve tornare in magazzino.</p>`;

      await callOdoo(
        cookies,
        'stock.picking',
        'write',
        [[picking_id], { note: noteContent }]
      );

      console.log('✅ [VALIDATE] Campo note del picking aggiornato');
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

      // Aggiungi informazioni sul pagamento
      if (payment_data) {
        const { amount, payment_method } = payment_data;
        messageHtml += `<strong>Importo:</strong> € ${amount ? amount.toFixed(2) : '0.00'}<br/>`;
        messageHtml += `<strong>Metodo:</strong> ${payment_method === 'cash' ? 'Contanti' : payment_method === 'card' ? 'Carta' : 'Bonifico'}<br/>`;
      }
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

    // Upload payment receipt photo as attachment if present
    if (payment_data && payment_data.receipt_photo) {
      console.log('💰 [VALIDATE] Caricamento ricevuta pagamento come allegato...');

      // Extract base64 data from receipt photo (remove data:image/jpeg;base64, prefix)
      const receiptBase64 = payment_data.receipt_photo.split(',')[1];

      // Create ir.attachment
      const receiptAttachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: `Ricevuta_Pagamento_${picking_id}_${Date.now()}.jpg`,
        datas: receiptBase64,
        res_model: 'stock.picking',
        res_id: picking_id,
        mimetype: 'image/jpeg',
        description: 'Ricevuta pagamento alla consegna'
      }]);

      attachmentIds.push(receiptAttachmentId);
      messageHtml += '<strong>📸 Ricevuta pagamento allegata</strong><br/>';
      console.log('✅ Ricevuta pagamento caricata come allegato ID:', receiptAttachmentId);
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

    // 🚀 SE È UNO SCARICO PARZIALE, INVIA WHATSAPP AL VENDITORE
    // Questo avviene DOPO la validazione, così il PDF ha i dati corretti
    // Le note sono già state aggiornate PRIMA della validazione
    if (isPartialDelivery) {
      try {
        console.log('📱 [WHATSAPP] Scarico parziale rilevato, invio notifica al venditore...');

        // Recupera il picking per trovare il Sale Order e il venditore
        const picking = await callOdoo(
          cookies,
          'stock.picking',
          'read',
          [[picking_id]],
          {
            fields: ['name', 'partner_id', 'sale_id', 'origin']
          }
        );

        if (picking && picking[0] && picking[0].sale_id) {
          const saleOrderId = picking[0].sale_id[0];

          // Recupera il venditore dal Sale Order
          const saleOrder = await callOdoo(
            cookies,
            'sale.order',
            'read',
            [[saleOrderId]],
            {
              fields: ['user_id']
            }
          );

          if (saleOrder && saleOrder[0] && saleOrder[0].user_id) {
            const salespersonName = saleOrder[0].user_id[1];

            console.log(`📞 [WHATSAPP] Venditore trovato: ${salespersonName}`);

            // Crea e invia WhatsApp con il template
            // Le note del picking sono già state aggiornate PRIMA della validazione
            const composerId = await callOdoo(
              cookies,
              'whatsapp.composer',
              'create',
              [{
                res_model: 'stock.picking',
                res_ids: picking_id.toString(),
                wa_template_id: 18 // Template "Sale Order Ship IT v2"
              }]
            );

            await callOdoo(
              cookies,
              'whatsapp.composer',
              'action_send_whatsapp_template',
              [[composerId]]
            );

            console.log(`✅ [WHATSAPP] Messaggio inviato a ${salespersonName}!`);
          } else {
            console.log('⚠️ [WHATSAPP] Venditore non trovato per questo ordine');
          }
        } else {
          console.log('⚠️ [WHATSAPP] Sale Order non trovato per questo picking');
        }
      } catch (whatsappError: any) {
        console.error('❌ [WHATSAPP] Errore invio WhatsApp:', whatsappError.message);
        // Non bloccare il flusso principale se WhatsApp fallisce
      }
    }

    return NextResponse.json({
      success: true,
      backorder_created,
      message_id: messageId,
      attachment_ids: attachmentIds
    });

  } catch (error: any) {
    console.error('❌ ERRORE VALIDATE:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({
      error: error.message || 'Errore validazione',
      details: error.toString(),
      stack: error.stack
    }, { status: 500 });
  }
}
