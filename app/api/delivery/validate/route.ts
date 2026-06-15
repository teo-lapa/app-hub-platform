import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { checkPickingOwnership, assertBase64Size, stripBase64Prefix } from '@/lib/delivery-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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

    // Autorizzazione: il picking deve appartenere all'autista loggato
    const ownership = await checkPickingOwnership(cookies, cookieHeader, uid, picking_id);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }

    // Limiti dimensione allegati (anti-DoS / timeout Odoo)
    assertBase64Size(signature);
    assertBase64Size(photo);
    assertBase64Size(payment_data?.receipt_photo);

    console.log('✅ VALIDATE picking_id:', picking_id, 'type:', completion_type, 'notes:', notes);
    console.log('📦 VALIDATE products:', products?.length || 0, 'prodotti');

    // AGGIORNA QUANTITÀ in stock.move.line (VELOCE - usa move_line_id diretto)
    if (products && products.length > 0) {
      const productsToUpdate = products.filter((p: any) =>
        p.move_line_id && p.delivered !== undefined
      );

      if (productsToUpdate.length > 0) {
        console.log(`📝 Aggiornamento ${productsToUpdate.length} prodotti con quantità modificate...`);

        // Aggiorna tutti i move_line IN PARALLELO (veloce!) - allSettled per non lasciare update parziali silenziosi
        const updateResults = await Promise.allSettled(productsToUpdate.map((product: any) =>
          callOdoo(cookies, 'stock.move.line', 'write', [
            [product.move_line_id],
            { quantity: product.delivered, picked: true }
          ]).then(() => {
            console.log(`✅ ${product.name}: ${product.delivered} (move_line_id: ${product.move_line_id})`);
          })
        ));
        const failedUpdates = updateResults.filter(r => r.status === 'rejected').length;
        if (failedUpdates > 0) {
          throw new Error(`Aggiornamento quantità fallito per ${failedUpdates}/${productsToUpdate.length} prodotti: validazione annullata per evitare dati parziali.`);
        }
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

    // Idempotenza: se il picking è già 'done' (es. retry dopo timeout di rete), non rivalidare
    const pickingStateRead = await callOdoo(cookies, 'stock.picking', 'read', [[picking_id]], { fields: ['state'] });
    const alreadyValidated = pickingStateRead?.[0]?.state === 'done';

    let validateResult: any = false;
    let backorder_created = false;
    if (alreadyValidated) {
      console.warn('⚠️ [VALIDATE] Picking già in stato "done": salto button_validate (idempotenza retry)');
    } else {
      // skip_backorder: true => Odoo valida e crea il backorder automaticamente senza
      // ritornare il wizard. Senza questo, button_validate ritorna l'azione
      // stock.backorder.confirmation che NON ha res_id (wizard transient creato dal
      // context): il process sotto falliva e la consegna dava "Errore validazione consegna".
      validateResult = await callOdoo(cookies, 'stock.picking', 'button_validate', [[picking_id]], { context: { skip_backorder: true } });
      backorder_created = isPartialDelivery;
    }
    // Fallback: se una versione di Odoo ritorna comunque il wizard, lo creo dal context
    // (pick_ids) e lo processo, invece di usare res_id inesistente.
    if (validateResult && typeof validateResult === 'object' && validateResult.res_model === 'stock.backorder.confirmation') {
      const wizardId = await callOdoo(cookies, 'stock.backorder.confirmation', 'create', [{ pick_ids: [[6, 0, [picking_id]]] }], {});
      await callOdoo(cookies, 'stock.backorder.confirmation', 'process', [[wizardId]], {});
      backorder_created = true;
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
      const signatureBase64 = stripBase64Prefix(signature);

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
      const photoBase64 = stripBase64Prefix(photo);

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
      const receiptBase64 = stripBase64Prefix(payment_data.receipt_photo);

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

    // Per 'validate_only' (flusso incasso alla consegna) NON creare il messaggio generico:
    // il messaggio con i dati dell'incasso sarà creato dalla chiamata finale (evita doppio chatter).
    let messageId: any = null;
    if (completion_type !== 'validate_only') {
      messageId = await callOdoo(cookies, 'mail.message', 'create', [{
        body: messageHtml,
        model: 'stock.picking',
        res_id: picking_id,
        message_type: 'comment',
        subtype_id: 1,
        attachment_ids: attachmentIds.length > 0 ? [[6, false, attachmentIds]] : false
      }]);
      console.log('Messaggio chatter creato ID:', messageId);
    }

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

            // Crea e invia WhatsApp con il template DDT
            // Le note del picking sono già state aggiornate PRIMA della validazione
            const composerId = await callOdoo(
              cookies,
              'whatsapp.composer',
              'create',
              [{
                res_model: 'stock.picking',
                res_ids: picking_id.toString(),
                wa_template_id: 32 // Template "Sale Order Ship IT v2 (copia)" - DDT al venditore
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
    return NextResponse.json({
      error: error.message || 'Errore validazione'
    }, { status: 500 });
  }
}
