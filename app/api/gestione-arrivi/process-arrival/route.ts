import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadSkill, logSkillInfo } from '@/lib/ai/skills-loader';

export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 3 minuti

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ParsedProduct {
  article_code?: string;
  description: string;
  quantity: number;
  unit: string;
  lot_number?: string;
  expiry_date?: string;
  variant?: string;
}

interface OdooMoveLine {
  id: number;
  product_id: number[];
  product_name: string;
  product_code: string;
  product_uom_qty: number;
  qty_done: number;
  lot_id: any;
  lot_name: string | false;
  expiry_date: string | false;
  move_id: number[];
  variant_ids: number[];
}

/**
 * PROCESS ARRIVAL - Flusso Completo con AI Matching
 *
 * COPIA della logica di arrivo-merce/process-reception che FUNZIONA
 *
 * 1. Carica le move lines del picking
 * 2. Arricchisce con info UoM
 * 3. Usa Claude AI con skill product-matching
 * 4. Aggiorna qty_done sulle move lines
 * 5. Mette a zero le righe non matchate
 * 6. (Opzionale) Valida il picking
 * 7. (Opzionale) Crea la fattura bozza
 * 8. Salva JSON trascrizione sul Purchase Order
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
      parsed_products,      // Prodotti estratti da Gemini (formato arrivo-merce)
      skip_validation,      // Se true, non validare il picking
      skip_invoice,         // Se true, non creare la fattura
      attachment_ids,       // IDs degli allegati da collegare alla fattura
      raw_gemini_response,  // JSON grezzo da Gemini (per salvare sul P.O.)
      invoice_info,         // Info fattura: { number, date, supplier_name }
    } = body;

    if (!picking_id) {
      return NextResponse.json({
        error: 'picking_id richiesto'
      }, { status: 400 });
    }

    if (!parsed_products || parsed_products.length === 0) {
      return NextResponse.json({
        error: 'parsed_products richiesto'
      }, { status: 400 });
    }

    console.log('🔄 [PROCESS-ARRIVAL] Inizio processamento picking ID:', picking_id);
    console.log('📦 Prodotti da fattura:', parsed_products.length);

    // ===== STEP 1: Carica dati picking =====
    const pickings = await callOdoo(cookies, 'stock.picking', 'read', [
      [picking_id],
      ['name', 'partner_id', 'origin', 'state', 'move_line_ids']
    ]);

    if (!pickings || pickings.length === 0) {
      throw new Error('Picking non trovato');
    }

    const picking = pickings[0];
    const supplierId = picking.partner_id?.[0];
    console.log(`📋 Picking: ${picking.name}, Stato: ${picking.state}, Fornitore ID: ${supplierId}`);

    // ===== Trova il Purchase Order ID dal picking.origin =====
    let purchaseOrderId: number | null = null;
    let purchaseOrderName: string | null = null;

    if (picking.origin) {
      const pos = await callOdoo(cookies, 'purchase.order', 'search_read', [
        [['name', '=', picking.origin]],
        ['id', 'name']
      ]);

      if (pos && pos.length > 0) {
        purchaseOrderId = pos[0].id;
        purchaseOrderName = pos[0].name;
        console.log(`📦 Purchase Order trovato: ${purchaseOrderName} (ID: ${purchaseOrderId})`);
      }
    }

    // ===== Aggiorna riferimento fornitore sul Purchase Order =====
    if (purchaseOrderId && invoice_info?.number) {
      console.log(`📝 Aggiornando riferimento fornitore sul P.O.: ${invoice_info.number}`);
      try {
        await callOdoo(cookies, 'purchase.order', 'write', [
          [purchaseOrderId],
          { partner_ref: invoice_info.number }
        ]);
        console.log(`✅ Riferimento fornitore aggiornato sul P.O.`);
      } catch (refError: any) {
        console.warn(`⚠️ Impossibile aggiornare riferimento fornitore: ${refError.message}`);
      }
    }

    // ===== Salva JSON trascrizione sul Purchase Order =====
    if (purchaseOrderId && raw_gemini_response) {
      console.log('💾 Salvando JSON trascrizione sul P.O....');

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const jsonFilename = `trascrizione_documenti_${timestamp}.json`;

      const jsonContent = JSON.stringify({
        timestamp: now.toISOString(),
        picking_id: picking_id,
        picking_name: picking.name,
        purchase_order: purchaseOrderName,
        parsed_products: parsed_products,
        raw_response: raw_gemini_response
      }, null, 2);

      const base64Json = Buffer.from(jsonContent).toString('base64');

      await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: jsonFilename,
        datas: base64Json,
        mimetype: 'application/json',
        res_model: 'purchase.order',
        res_id: purchaseOrderId,
      }]);

      console.log(`✅ JSON trascrizione salvato: ${jsonFilename}`);
    }

    // Flag per indicare se il picking è già completato (riprocessamento)
    const isReprocessing = picking.state === 'done';

    if (isReprocessing) {
      console.log('🔄 RIPROCESSAMENTO: Picking già completato, salto aggiornamento righe e validazione');
    }

    // ===== STEP 2: Carica move lines =====
    const moveLineIds = picking.move_line_ids || [];
    if (moveLineIds.length === 0) {
      throw new Error('Nessuna riga nel picking');
    }

    const moveLines = await callOdoo(cookies, 'stock.move.line', 'read', [
      moveLineIds,
      ['id', 'product_id', 'quantity', 'lot_id', 'lot_name', 'expiration_date', 'move_id', 'product_uom_id', 'location_id', 'location_dest_id']
    ]);

    console.log('📋 Righe Odoo:', moveLines.length);

    // ===== STEP 3: Arricchisci con info prodotto e UoM =====
    console.log('📏 Carico informazioni prodotto e UoM...');
    const enrichedMoveLines = await Promise.all(
      moveLines.map(async (line: any) => {
        try {
          // Leggi il prodotto
          const productData = await callOdoo(cookies, 'product.product', 'read', [
            [line.product_id[0]],
            ['name', 'default_code', 'uom_id', 'product_tmpl_id'] // Odoo 19: uom_po_id rimosso, UoM acquisto sulla riga PO -> fallback su uom_id
          ]);

          if (!productData || productData.length === 0) {
            return {
              ...line,
              product_name: line.product_id[1] || 'Prodotto sconosciuto',
              product_code: '',
            };
          }

          const product = productData[0];
          const uomId = product.uom_id?.[0];
          const uomPoId = uomId; // Odoo 19: uom_po_id rimosso, l'UoM d'acquisto coincide con uom_id

          // Leggi le informazioni dettagliate dell'UoM
          let uomInfo = null;
          if (uomId) {
            const uomData = await callOdoo(cookies, 'uom.uom', 'read', [
              [uomId],
              ['name', 'factor', 'relative_factor', 'relative_uom_id', 'rounding'] // Odoo 19: rimossi category_id/factor_inv/uom_type
            ]);
            uomInfo = uomData?.[0];
          }

          // Se esiste UoM acquisto diversa, leggi anche quella
          let uomPoInfo = null;
          if (uomPoId && uomPoId !== uomId) {
            const uomPoData = await callOdoo(cookies, 'uom.uom', 'read', [
              [uomPoId],
              ['name', 'factor', 'relative_factor', 'relative_uom_id', 'rounding'] // Odoo 19: rimossi category_id/factor_inv/uom_type
            ]);
            uomPoInfo = uomPoData?.[0];
          }

          return {
            ...line,
            product_name: product.name,
            product_code: product.default_code || '',
            product_tmpl_id: product.product_tmpl_id,
            uom_info: uomInfo,
            uom_po_info: uomPoInfo
          };
        } catch (error: any) {
          console.error(`⚠️ Errore caricamento prodotto ${line.product_id[0]}:`, error.message);
          return {
            ...line,
            product_name: line.product_id[1] || 'Prodotto sconosciuto',
            product_code: '',
          };
        }
      })
    );

    console.log(`✅ Info prodotto caricate per ${enrichedMoveLines.length} righe`);

    // ===== STEP 4: AI Matching con Claude =====
    const skill = loadSkill('inventory-management/product-matching');
    logSkillInfo('inventory-management/product-matching');
    console.log(`📚 Usando skill: ${skill.metadata.name} v${skill.metadata.version}`);

    const matchingData = `
PRODOTTI DALLA FATTURA:
${JSON.stringify(parsed_products, null, 2)}

RIGHE DEL SISTEMA ODOO (CON UoM):
${JSON.stringify(enrichedMoveLines, null, 2)}

Esegui il matching seguendo le regole sopra.

IMPORTANTE: Quando calcoli la quantità, DEVI fare la conversione usando le UoM di Odoo.
Esempio: se la fattura dice "3 x 10ST" e l'UoM di Odoo è KG con factor 0.1 (1 unità = 10 KG),
allora la quantità finale deve essere 30.0 KG (non 3.0).
`;

    console.log('🤖 Invio a Claude per matching intelligente...');

    let responseText = '';
    let providerUsed = 'claude';

    try {
      // Prova prima con Claude
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `${skill.content}\n\n---\n\n${matchingData}`,
          },
        ],
      });

      const firstContent = message.content[0];
      responseText = firstContent && firstContent.type === 'text' ? firstContent.text : '';

    } catch (claudeError: any) {
      // Se errore 529 (overloaded) o 429 (rate limit) → fallback a Gemini
      const isOverloaded = claudeError.status === 529 ||
                           claudeError.status === 429 ||
                           claudeError.message?.includes('Overloaded') ||
                           claudeError.message?.includes('overloaded');

      if (isOverloaded) {
        console.log('⚠️ Claude overloaded (529), switching to Gemini...');
        providerUsed = 'gemini';

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json'
          }
        });

        const geminiResult = await model.generateContent(`${skill.content}\n\n---\n\n${matchingData}`);
        responseText = geminiResult.response.text();
      } else {
        // Altri errori → propaga
        throw claudeError;
      }
    }

    console.log(`📥 Risposta ${providerUsed} matching:`, responseText.substring(0, 300) + '...');

    let matches;
    try {
      // Pulisci la risposta (rimuovi markdown code blocks se presenti)
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        matches = JSON.parse(jsonMatch[0]);
      } else {
        matches = JSON.parse(cleanedText);
      }
    } catch (parseError) {
      console.error('❌ Errore parsing matching:', parseError);
      return NextResponse.json({
        error: `Errore nel parsing del matching AI (${providerUsed})`,
        details: responseText
      }, { status: 500 });
    }

    console.log(`✅ Matches trovati: ${matches.length} (provider: ${providerUsed})`);

    // ===== STEP 5: Processa i matches =====
    const usedMoveLineIds = new Set<number>();
    const matchedProducts = matches.filter((m: any) => m.action !== 'no_match');
    const unmatchedProducts = matches.filter((m: any) => m.action === 'no_match');

    console.log(`✅ Prodotti matchati: ${matchedProducts.length}`);
    console.log(`⚠️ Prodotti NON matchati: ${unmatchedProducts.length}`);

    const results = {
      updated: 0,
      created: 0,
      no_match: unmatchedProducts.length,
      set_to_zero: 0,
      supplier_info_updated: 0,
      errors: [] as string[],
      warnings: [] as string[],
      details: [] as any[],
      unmatched_products: unmatchedProducts.map((m: any) => ({
        invoice_product: parsed_products[m.invoice_product_index],
        reason: m.match_reason,
        confidence: m.match_confidence
      }))
    };

    // Se è riprocessamento, salta l'aggiornamento delle move lines
    if (isReprocessing) {
      console.log('🔄 Riprocessamento: salto aggiornamento move lines');
      results.warnings.push('Riprocessamento: picking già completato, aggiornamento righe saltato');
    }

    // Processa solo i prodotti matchati (solo se NON è riprocessamento)
    for (const match of matchedProducts) {
      if (isReprocessing) continue; // Salta se riprocessamento
      try {
        if (match.action === 'update') {
          usedMoveLineIds.add(match.move_line_id);

          const updateData: any = {
            quantity: match.quantity
          };

          // Usa il lotto se presente, altrimenti usa la data di scadenza come lotto
          // (Odoo richiede un lotto per prodotti tracciati, la scadenza può servire come identificatore)
          if (match.lot_number) {
            updateData.lot_name = match.lot_number;
          } else if (match.expiry_date) {
            // Se non c'è lotto ma c'è scadenza, usa la scadenza come lotto (formato YYYY-MM-DD)
            updateData.lot_name = match.expiry_date;
            console.log(`⚠️ Lotto mancante, uso scadenza come lotto: ${match.expiry_date}`);
          }

          if (match.expiry_date) {
            updateData.expiration_date = `${match.expiry_date} 00:00:00`;
          }

          await callOdoo(cookies, 'stock.move.line', 'write', [
            [match.move_line_id],
            updateData
          ]);

          const moveLine = enrichedMoveLines.find((ml: any) => ml.id === match.move_line_id);
          const productName = moveLine ? moveLine.product_name : `Riga ${match.move_line_id}`;

          results.updated++;
          results.details.push({
            action: 'updated',
            move_line_id: match.move_line_id,
            product_name: productName,
            quantity: match.quantity,
            lot: match.lot_number || 'N/A',
            expiry: match.expiry_date || 'N/A'
          });

          console.log(`✅ Aggiornata riga ${match.move_line_id}: qty=${match.quantity}, lotto=${match.lot_number}`);

          // Aggiorna listino fornitore
          if (supplierId && moveLine?.product_tmpl_id) {
            await updateSupplierInfo(
              cookies,
              supplierId,
              moveLine.product_tmpl_id[0],
              parsed_products[match.invoice_product_index]
            );
            results.supplier_info_updated++;
          }

        } else if (match.action === 'create_new_line') {
          if (match.move_line_id) {
            usedMoveLineIds.add(match.move_line_id);
          }

          const originalLine = enrichedMoveLines.find((ml: any) => ml.id === match.move_line_id);

          if (!originalLine) {
            results.errors.push(`Riga originale ${match.move_line_id} non trovata`);
            continue;
          }

          const newLineData: any = {
            picking_id: picking_id,
            product_id: originalLine.product_id[0],
            product_uom_id: originalLine.product_uom_id ? originalLine.product_uom_id[0] : false,
            location_id: originalLine.location_id ? originalLine.location_id[0] : false,
            location_dest_id: originalLine.location_dest_id ? originalLine.location_dest_id[0] : false,
            move_id: originalLine.move_id[0],
            quantity: match.quantity,
          };

          // Usa il lotto se presente, altrimenti usa la data di scadenza come lotto
          if (match.lot_number) {
            newLineData.lot_name = match.lot_number;
          } else if (match.expiry_date) {
            // Se non c'è lotto ma c'è scadenza, usa la scadenza come lotto
            newLineData.lot_name = match.expiry_date;
            console.log(`⚠️ Nuova riga: lotto mancante, uso scadenza come lotto: ${match.expiry_date}`);
          }

          if (match.expiry_date) {
            newLineData.expiration_date = `${match.expiry_date} 00:00:00`;
          }

          const newLineId = await callOdoo(cookies, 'stock.move.line', 'create', [newLineData]);

          results.created++;
          results.details.push({
            action: 'created',
            move_line_id: newLineId,
            product_name: originalLine.product_name,
            quantity: match.quantity,
            lot: match.lot_number || 'N/A',
            expiry: match.expiry_date || 'N/A'
          });

          console.log(`✅ Creata nuova riga ${newLineId}: qty=${match.quantity}, lotto=${match.lot_number}`);

          // Aggiorna listino fornitore
          if (supplierId && originalLine?.product_tmpl_id) {
            await updateSupplierInfo(
              cookies,
              supplierId,
              originalLine.product_tmpl_id[0],
              parsed_products[match.invoice_product_index]
            );
            results.supplier_info_updated++;
          }
        }

      } catch (error: any) {
        console.error('❌ Errore processamento match:', error);
        results.errors.push(`Errore su riga: ${error.message}`);
      }
    }

    // ===== STEP 6: Metti a ZERO le righe non usate (salta se riprocessamento) =====
    if (!isReprocessing) {
      console.log('🔍 Verifico righe Odoo non utilizzate...');
      for (const moveLine of enrichedMoveLines) {
        if (!usedMoveLineIds.has(moveLine.id)) {
          try {
            await callOdoo(cookies, 'stock.move.line', 'write', [
              [moveLine.id],
              { quantity: 0 }
            ]);

            results.set_to_zero++;
            results.details.push({
              action: 'set_to_zero',
              move_line_id: moveLine.id,
              product_name: moveLine.product_name,
              quantity: 0,
              lot: 'N/A',
              expiry: 'N/A',
              reason: 'Riga non trovata nella fattura, impostata a zero'
            });

            console.log(`⚠️ Riga ${moveLine.id} (${moveLine.product_name}) impostata a qty_done=0`);
          } catch (error: any) {
            console.error(`❌ Errore impostazione a zero riga ${moveLine.id}:`, error);
            results.errors.push(`Errore impostazione a zero riga ${moveLine.id}: ${error.message}`);
          }
        }
      }
    }

    // ===== STEP 7: Valida il picking (opzionale, salta se riprocessamento) =====
    let pickingValidated = isReprocessing; // Se riprocessamento, è già validato
    if (!skip_validation && !isReprocessing) {
      console.log('🔐 Validazione picking...');

      try {
        // skip_backorder + cancel_backorder: Odoo valida e NON crea il backorder (annulla
        // il residuo), come faceva prima process_cancel_backorder. Senza questo
        // button_validate ritorna il wizard stock.backorder.confirmation che NON ha res_id
        // (wizard transient creato dal context): la process sotto falliva e l'arrivo non si validava.
        const validateResult = await callOdoo(
          cookies,
          'stock.picking',
          'button_validate',
          [[picking_id]],
          { context: { skip_backorder: true, cancel_backorder: true } }
        );

        if (validateResult && typeof validateResult === 'object' && validateResult.res_model) {
          console.log('⚠️ Wizard richiesto:', validateResult.res_model);

          // Fallback: il wizard backorder non ha res_id, lo creo dal context e annullo il residuo
          if (validateResult.res_model === 'stock.backorder.confirmation') {
            const wizId = await callOdoo(
              cookies,
              'stock.backorder.confirmation',
              'create',
              [{ pick_ids: [[6, 0, [picking_id]]] }]
            );
            await callOdoo(
              cookies,
              'stock.backorder.confirmation',
              'process_cancel_backorder',
              [[wizId]]
            );
            pickingValidated = true;
          } else {
            results.warnings.push(`Wizard non gestito: ${validateResult.res_model}`);
          }
        } else {
          pickingValidated = true;
        }

        console.log('✅ Picking validato');
      } catch (e: any) {
        results.errors.push(`Errore validazione: ${e.message}`);
        console.error('❌ Errore validazione:', e.message);
      }
    }

    // ===== STEP 8: Crea fattura bozza (opzionale) =====
    let invoiceId = null;
    let invoiceName = null;

    if (!skip_invoice && supplierId) {
      console.log('📄 Creazione fattura bozza...');

      try {
        const existingInvoices = await callOdoo(cookies, 'account.move', 'search_read', [
          [
            ['invoice_origin', 'ilike', picking.origin || picking.name],
            ['move_type', '=', 'in_invoice'],
            ['state', '=', 'draft']
          ],
          ['id', 'name']
        ], { limit: 1 });

        if (existingInvoices && existingInvoices.length > 0) {
          invoiceId = existingInvoices[0].id;
          invoiceName = existingInvoices[0].name;
          results.warnings.push('Fattura bozza già esistente');
          console.log(`⚠️ Fattura già esistente: ${existingInvoices[0].name}`);
        } else {
          // Crea fattura collegata al Purchase Order con tutti i dati
          const invoiceData: any = {
            move_type: 'in_invoice',
            partner_id: supplierId,
            invoice_origin: picking.origin || picking.name,
          };

          // Aggiungi riferimento fornitore (numero fattura del fornitore)
          if (invoice_info?.number) {
            invoiceData.ref = invoice_info.number;
            console.log(`📝 Riferimento fornitore: ${invoice_info.number}`);
          }

          // Aggiungi data fattura
          if (invoice_info?.date) {
            invoiceData.invoice_date = invoice_info.date;
            console.log(`📅 Data fattura: ${invoice_info.date}`);
          }

          invoiceId = await callOdoo(
            cookies,
            'account.move',
            'create',
            [invoiceData]
          );

          const createdInvoice = await callOdoo(cookies, 'account.move', 'read', [
            [invoiceId],
            ['name']
          ]);
          invoiceName = createdInvoice[0]?.name;

          console.log(`✅ Fattura creata: ${invoiceName}`);

          // Collega la fattura al Purchase Order tramite il campo purchase_id se esiste
          if (purchaseOrderId) {
            try {
              // In Odoo 16+, le fatture fornitore si collegano tramite le righe
              // Ma possiamo anche usare il messaggio per tracciare il collegamento
              await callOdoo(cookies, 'account.move', 'message_post', [
                [invoiceId]
              ], {
                body: `Fattura creata automaticamente da arrivo merce. Collegata a <a href="/web#id=${purchaseOrderId}&model=purchase.order">${purchaseOrderName}</a>`,
                message_type: 'comment'
              });
              console.log(`🔗 Fattura collegata al P.O. ${purchaseOrderName}`);
            } catch (linkError: any) {
              console.warn(`⚠️ Impossibile aggiungere messaggio di collegamento: ${linkError.message}`);
            }
          }
        }

        // Allega SOLO i documenti che sono fatture (non DDT o altri allegati)
        if (invoiceId && attachment_ids && attachment_ids.length > 0) {
          console.log(`📎 Cercando fatture tra ${attachment_ids.length} allegati...`);

          // Leggi tutti gli allegati per filtrare solo le fatture
          const allAttachments = await callOdoo(cookies, 'ir.attachment', 'read', [
            attachment_ids,
            ['id', 'name', 'datas', 'mimetype']
          ]);

          // Filtra solo i file che sembrano fatture (per nome)
          const invoiceAttachments = allAttachments.filter((att: any) => {
            const lowerName = att.name.toLowerCase();
            return lowerName.includes('fattura') ||
                   lowerName.includes('fatt') ||
                   lowerName.includes('invoice') ||
                   lowerName.includes('inv_') ||
                   lowerName.includes('inv-') ||
                   // Se c'è solo un PDF, è probabilmente la fattura
                   (allAttachments.length === 1 && att.mimetype === 'application/pdf');
          });

          if (invoiceAttachments.length === 0 && allAttachments.length > 0) {
            // Se non troviamo fatture per nome, cerca PDF (più probabile che sia fattura)
            const pdfAttachments = allAttachments.filter((att: any) =>
              att.mimetype === 'application/pdf'
            );
            if (pdfAttachments.length > 0) {
              invoiceAttachments.push(pdfAttachments[0]); // Prendi solo il primo PDF
              console.log(`📄 Nessun file "fattura" trovato, uso primo PDF: ${pdfAttachments[0].name}`);
            }
          }

          console.log(`📄 Fatture da allegare: ${invoiceAttachments.length} su ${allAttachments.length} totali`);

          for (const attachment of invoiceAttachments) {
            try {
              await callOdoo(cookies, 'ir.attachment', 'create', [{
                name: attachment.name,
                datas: attachment.datas,
                mimetype: attachment.mimetype,
                res_model: 'account.move',
                res_id: invoiceId,
              }]);
              console.log(`  ✅ Allegato: ${attachment.name}`);
            } catch (e: any) {
              results.warnings.push(`Errore allegato ${attachment.name}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        results.errors.push(`Errore creazione fattura: ${e.message}`);
        console.error('❌ Errore creazione fattura:', e.message);
      }
    }

    console.log('📊 [PROCESS-ARRIVAL] Risultati:', results);

    return NextResponse.json({
      success: true,
      picking_id,
      picking_name: picking.name,
      picking_validated: pickingValidated,
      invoice_created: invoiceId !== null,
      invoice_id: invoiceId,
      invoice_name: invoiceName,
      results,
      ai_provider: providerUsed
    });

  } catch (error: any) {
    console.error('❌ [PROCESS-ARRIVAL] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il processamento'
    }, { status: 500 });
  }
}

/**
 * Aggiorna il listino fornitore con codice e nome dalla fattura
 */
async function updateSupplierInfo(
  cookies: string,
  supplierId: number,
  productTmplId: number,
  invoiceProduct: ParsedProduct
) {
  try {
    const existingSupplierInfo = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [
      [
        ['product_tmpl_id', '=', productTmplId],
        ['partner_id', '=', supplierId]
      ],
      ['id', 'product_name', 'product_code']
    ]);

    if (existingSupplierInfo && existingSupplierInfo.length > 0) {
      const supplierInfo = existingSupplierInfo[0];
      const updateData: any = {};
      let needsUpdate = false;

      if (invoiceProduct.article_code && supplierInfo.product_code !== invoiceProduct.article_code) {
        updateData.product_code = invoiceProduct.article_code;
        needsUpdate = true;
        console.log(`  📝 Codice fornitore: "${supplierInfo.product_code}" → "${invoiceProduct.article_code}"`);
      }

      if (invoiceProduct.description && supplierInfo.product_name !== invoiceProduct.description) {
        updateData.product_name = invoiceProduct.description;
        needsUpdate = true;
        console.log(`  📝 Nome fornitore: "${supplierInfo.product_name}" → "${invoiceProduct.description}"`);
      }

      if (needsUpdate) {
        await callOdoo(cookies, 'product.supplierinfo', 'write', [
          [supplierInfo.id],
          updateData
        ]);
        console.log(`  ✅ Listino fornitore aggiornato per supplierinfo ID ${supplierInfo.id}`);
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Errore aggiornamento listino fornitore:`, error.message);
  }
}
