import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 3 minuti

/**
 * PROCESS ARRIVAL - Flusso Completo
 *
 * 1. Aggiorna qty_done sulle move lines
 * 2. Valida il picking (button_validate)
 * 3. Crea la fattura bozza (account.move)
 * 4. Allega i documenti alla fattura
 */
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const {
      picking_id,
      extracted_lines,      // Righe estratte dai documenti
      skip_validation,      // Se true, non validare il picking
      skip_invoice,         // Se true, non creare la fattura
      attachment_ids,       // IDs degli allegati da collegare alla fattura
      transcription_json,   // JSON di trascrizione da allegare
    } = body;

    if (!picking_id) {
      return NextResponse.json({
        error: 'picking_id richiesto'
      }, { status: 400 });
    }

    console.log(`🔄 [PROCESS-ARRIVAL] Inizio processing picking ${picking_id}`);

    const result = {
      success: true,
      picking_id,
      picking_name: '',
      picking_validated: false,
      invoice_created: false,
      invoice_id: null as number | null,
      invoice_name: null as string | null,
      lines_updated: 0,
      lines_set_to_zero: 0,
      unmatched_products: [] as any[],
      documents_attached: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // ===== STEP 1: Carica dati picking =====
    console.log('📦 Carico dati picking...');

    const pickings = await callOdoo(cookies, 'stock.picking', 'read', [
      [picking_id],
      ['name', 'partner_id', 'origin', 'state', 'move_line_ids_without_package']
    ]);

    if (!pickings || pickings.length === 0) {
      throw new Error('Picking non trovato');
    }

    const picking = pickings[0];
    result.picking_name = picking.name;

    console.log(`📋 Picking: ${picking.name}, Stato: ${picking.state}`);

    // Se già completato, salta
    if (picking.state === 'done') {
      result.warnings.push('Picking già completato');
      console.log('⚠️ Picking già completato');
    }

    // ===== STEP 2: Aggiorna qty_done (se ci sono righe estratte) =====
    if (extracted_lines && extracted_lines.length > 0 && picking.state !== 'done') {
      console.log(`📝 Aggiorno ${extracted_lines.length} righe...`);

      // Carica move lines esistenti
      const moveLineIds = picking.move_line_ids_without_package || [];
      if (moveLineIds.length > 0) {
        const moveLines = await callOdoo(cookies, 'stock.move.line', 'read', [
          moveLineIds,
          ['id', 'product_id', 'qty_done', 'lot_id', 'move_id']
        ]);

        // Per ora, aggiorniamo in modo semplice
        // TODO: Implementare matching AI come in process-reception
        for (const moveLine of moveLines) {
          // Cerca corrispondenza nelle righe estratte
          const matchingLine = extracted_lines.find((el: any) =>
            el.product_code && moveLine.product_id
          );

          if (matchingLine) {
            try {
              await callOdoo(cookies, 'stock.move.line', 'write', [
                [moveLine.id],
                { qty_done: matchingLine.quantity }
              ]);
              result.lines_updated++;
            } catch (e: any) {
              result.errors.push(`Errore aggiornamento riga ${moveLine.id}: ${e.message}`);
            }
          }
        }
      }

      console.log(`✅ Aggiornate ${result.lines_updated} righe`);
    }

    // ===== STEP 3: Valida il picking =====
    if (!skip_validation && picking.state !== 'done') {
      console.log('🔐 Validazione picking...');

      try {
        // Chiama button_validate
        const validateResult = await callOdoo(
          cookies,
          'stock.picking',
          'button_validate',
          [[picking_id]]
        );

        // button_validate può ritornare un wizard per gestire casi speciali
        if (validateResult && typeof validateResult === 'object' && validateResult.res_model) {
          console.log('⚠️ Wizard richiesto:', validateResult.res_model);

          // Gestisci i wizard più comuni
          if (validateResult.res_model === 'stock.immediate.transfer') {
            // Trasferimento immediato - conferma
            await callOdoo(
              cookies,
              'stock.immediate.transfer',
              'process',
              [[validateResult.res_id]]
            );
            result.picking_validated = true;
          } else if (validateResult.res_model === 'stock.backorder.confirmation') {
            // Backorder - conferma senza backorder
            await callOdoo(
              cookies,
              'stock.backorder.confirmation',
              'process_cancel_backorder',
              [[validateResult.res_id]]
            );
            result.picking_validated = true;
          } else {
            result.warnings.push(`Wizard non gestito: ${validateResult.res_model}`);
          }
        } else {
          result.picking_validated = true;
        }

        console.log('✅ Picking validato');
      } catch (e: any) {
        result.errors.push(`Errore validazione: ${e.message}`);
        console.error('❌ Errore validazione:', e.message);
      }
    }

    // ===== STEP 4: Crea fattura bozza =====
    if (!skip_invoice) {
      console.log('📄 Creazione fattura bozza...');

      try {
        const partnerId = picking.partner_id?.[0];
        if (!partnerId) {
          throw new Error('Partner non trovato nel picking');
        }

        // Cerca se esiste già una fattura collegata
        const existingInvoices = await callOdoo(cookies, 'account.move', 'search_read', [
          [
            ['invoice_origin', 'ilike', picking.origin || picking.name],
            ['move_type', '=', 'in_invoice'],
            ['state', '=', 'draft']
          ],
          ['id', 'name']
        ], { limit: 1 });

        if (existingInvoices && existingInvoices.length > 0) {
          result.invoice_id = existingInvoices[0].id;
          result.invoice_name = existingInvoices[0].name;
          result.warnings.push('Fattura bozza già esistente');
          console.log(`⚠️ Fattura già esistente: ${existingInvoices[0].name}`);
        } else {
          // Crea nuova fattura
          const invoiceData: any = {
            move_type: 'in_invoice',
            partner_id: partnerId,
            invoice_origin: picking.origin || picking.name,
          };

          // Aggiungi data fattura se presente nelle righe estratte
          if (extracted_lines?.[0]?.invoice_date) {
            invoiceData.invoice_date = extracted_lines[0].invoice_date;
          }

          // Aggiungi riferimento fattura fornitore se presente
          if (extracted_lines?.[0]?.invoice_number) {
            invoiceData.ref = extracted_lines[0].invoice_number;
          }

          const invoiceId = await callOdoo(
            cookies,
            'account.move',
            'create',
            [invoiceData]
          );

          result.invoice_id = invoiceId;
          result.invoice_created = true;

          // Leggi il nome della fattura creata
          const createdInvoice = await callOdoo(cookies, 'account.move', 'read', [
            [invoiceId],
            ['name']
          ]);
          result.invoice_name = createdInvoice[0]?.name;

          console.log(`✅ Fattura creata: ${result.invoice_name}`);

          // Crea le righe fattura dalle righe estratte
          if (extracted_lines && extracted_lines.length > 0) {
            console.log(`📝 Creazione ${extracted_lines.length} righe fattura...`);

            for (const line of extracted_lines) {
              try {
                const lineData: any = {
                  move_id: invoiceId,
                  name: line.description || 'Prodotto',
                  quantity: line.quantity || 1,
                  price_unit: line.unit_price || 0,
                };

                // Cerca il prodotto se abbiamo un codice
                if (line.product_code) {
                  const products = await callOdoo(cookies, 'product.product', 'search_read', [
                    [['default_code', '=', line.product_code]],
                    ['id', 'uom_id', 'supplier_taxes_id']
                  ], { limit: 1 });

                  if (products && products.length > 0) {
                    lineData.product_id = products[0].id;
                    lineData.product_uom_id = products[0].uom_id?.[0];
                    if (products[0].supplier_taxes_id?.length > 0) {
                      lineData.tax_ids = [[6, 0, products[0].supplier_taxes_id]];
                    }
                  }
                }

                await callOdoo(
                  cookies,
                  'account.move.line',
                  'create',
                  [lineData]
                );
              } catch (e: any) {
                result.warnings.push(`Errore riga fattura: ${e.message}`);
              }
            }
          }
        }
      } catch (e: any) {
        result.errors.push(`Errore creazione fattura: ${e.message}`);
        console.error('❌ Errore creazione fattura:', e.message);
      }
    }

    // ===== STEP 5: Allega documenti alla fattura =====
    if (result.invoice_id && attachment_ids && attachment_ids.length > 0) {
      console.log(`📎 Allegando ${attachment_ids.length} documenti...`);

      for (const attId of attachment_ids) {
        try {
          // Copia l'allegato sulla fattura
          const attachment = await callOdoo(cookies, 'ir.attachment', 'read', [
            [attId],
            ['name', 'datas', 'mimetype']
          ]);

          if (attachment && attachment.length > 0) {
            await callOdoo(cookies, 'ir.attachment', 'create', [{
              name: attachment[0].name,
              datas: attachment[0].datas,
              mimetype: attachment[0].mimetype,
              res_model: 'account.move',
              res_id: result.invoice_id,
            }]);
            result.documents_attached++;
          }
        } catch (e: any) {
          result.warnings.push(`Errore allegato ${attId}: ${e.message}`);
        }
      }

      console.log(`✅ Allegati ${result.documents_attached} documenti`);
    }

    // ===== STEP 6: Allega JSON trascrizione =====
    if (result.invoice_id && transcription_json) {
      console.log('📝 Allegando JSON trascrizione...');

      try {
        const jsonString = JSON.stringify(transcription_json, null, 2);
        const base64Json = Buffer.from(jsonString).toString('base64');

        await callOdoo(cookies, 'ir.attachment', 'create', [{
          name: `trascrizione_${picking.name}.json`,
          datas: base64Json,
          mimetype: 'application/json',
          res_model: 'account.move',
          res_id: result.invoice_id,
        }]);

        result.documents_attached++;
        console.log('✅ JSON trascrizione allegato');
      } catch (e: any) {
        result.warnings.push(`Errore allegato JSON: ${e.message}`);
      }
    }

    console.log(`🎉 [PROCESS-ARRIVAL] Completato:`, {
      picking: result.picking_name,
      validated: result.picking_validated,
      invoice: result.invoice_name,
      lines_updated: result.lines_updated,
      docs_attached: result.documents_attached
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ [PROCESS-ARRIVAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il processamento'
    }, { status: 500 });
  }
}
