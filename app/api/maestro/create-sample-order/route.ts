/**
 * MAESTRO AI - Create Sample Order API
 *
 * POST /api/maestro/create-sample-order
 * Creates a CONFIRMED sale.order with VALIDATED picking for gift samples
 *
 * WORKFLOW:
 * 1. Create sale.order (state='sale' = confirmed)
 * 2. Create stock.picking for delivery (from vehicle location)
 * 3. Create stock.move for each product
 * 4. Confirm picking (action_confirm)
 * 5. Assign picking (action_assign)
 * 6. Validate picking (button_validate) - products delivered!
 * 7. Post message to Chatter with full interaction details
 */

import { NextRequest, NextResponse } from 'next/server';
import { injectLangContext } from '@/lib/odoo/user-lang';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vehicle location mappings (same as vehicle-stock-service.ts)
const SALESPERSON_VEHICLE_MAPPING: Record<number, number> = {
  121: 607,  // Alessandro Motta → WH/BMW ZH542378 A
  407: 605,  // Domingos Ferreira → WH/BMW ZH638565 D
  14: 606,   // Mihai Nita → WH/BMW ZH969307 M
  249: 608,  // Gregorio Buccolieri → WH/COMO 6278063 G
};

interface SampleProduct {
  productId: number;
  productName: string;
  quantity: number;
  uom: string;
}

interface CreateSampleOrderRequest {
  odooPartnerId: number;
  customerName: string;
  salesPersonId?: number;
  interactionType: string;
  outcome: string;
  sampleFeedback?: string;
  notes?: string;
  sampleProducts: SampleProduct[];
}

export async function POST(request: NextRequest) {
  console.log('\n🎁 [API] POST /api/maestro/create-sample-order');

  try {
    // 1. Get Odoo session
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: { message: 'Sessione non valida. Effettua il login.' }
      }, { status: 401 });
    }

    console.log('✅ Session ID ottenuto');

    // 2. Get Odoo URL
    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
    if (!odooUrl) {
      throw new Error('ODOO_URL non configurato');
    }

    // 3. Parse request body
    const body: CreateSampleOrderRequest = await request.json();
    const {
      odooPartnerId,
      customerName,
      salesPersonId,
      interactionType,
      outcome,
      sampleFeedback,
      notes,
      sampleProducts
    } = body;

    if (!odooPartnerId || !sampleProducts || sampleProducts.length === 0) {
      return NextResponse.json({
        success: false,
        error: { message: 'odooPartnerId e sampleProducts sono richiesti' }
      }, { status: 400 });
    }

    console.log(`🎁 Creazione ordine campioni per cliente ${customerName} (Odoo ID: ${odooPartnerId})`);
    console.log(`📦 Prodotti: ${sampleProducts.length}`);
    console.log(`👤 Venditore: ${salesPersonId || 'N/A'}`);

    // 4. Get vehicle location for this salesperson
    let vehicleLocationId: number | null = null;
    if (salesPersonId && SALESPERSON_VEHICLE_MAPPING[salesPersonId]) {
      vehicleLocationId = SALESPERSON_VEHICLE_MAPPING[salesPersonId];
      console.log(`🚚 Vehicle location: ${vehicleLocationId}`);
    }

    // 5. Format date for Odoo
    const now = new Date();
    const odooDate = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    // 6. Prepare order lines
    const orderLines = [];
    for (const item of sampleProducts) {
      // Fetch product details
      const productResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'product.product',
            method: 'search_read',
            args: [[['id', '=', item.productId]]],
            kwargs: injectLangContext({
              fields: ['name', 'uom_id', 'default_code'],
              limit: 1
            })
          },
          id: 1
        })
      });

      const productData = await productResponse.json();
      console.log(`📦 Product response for ID ${item.productId}:`, JSON.stringify(productData).substring(0, 200));
      const products = productData.result || [];

      if (products.length > 0) {
        const product = products[0];
        const lineDescription = `🎁 CAMPIONE OMAGGIO - ${product.name}${product.default_code ? ` [${product.default_code}]` : ''}`;

        orderLines.push([0, 0, {
          product_id: item.productId,
          product_uom_qty: item.quantity,
          product_uom: product.uom_id[0],
          discount: 100, // 100% discount for gift samples (price from pricelist)
          name: lineDescription,
          customer_lead: 0
        }]);
      }
    }

    if (orderLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: { message: 'Nessun prodotto valido trovato' }
      }, { status: 400 });
    }

    // 7. Create detailed notes
    const interactionTypeLabel = interactionType === 'visit' ? '📹 Visita' :
                                  interactionType === 'call' ? '📞 Chiamata' : '📧 Email';

    const outcomeLabel = outcome === 'positive' ? '✅ Positivo' :
                        outcome === 'negative' ? '❌ Negativo' : '⚠️ Neutrale';

    const feedbackLabel = sampleFeedback === 'good' ? '😊 Ottimo' :
                         sampleFeedback === 'bad' ? '😞 Negativo' : '😐 Indifferente';

    const detailedNotes = `
╔═══════════════════════════════════════════════════════════╗
║     🎁 ORDINE CAMPIONI OMAGGIO - MAESTRO AI              ║
╚═══════════════════════════════════════════════════════════╝

📅 DATA E ORA:
   ${now.toLocaleDateString('it-IT', {
     weekday: 'long',
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   })} - ${now.toLocaleTimeString('it-IT')}

${interactionTypeLabel} TIPO INTERAZIONE:
   ${interactionType.toUpperCase()}

${outcomeLabel} ESITO INTERAZIONE:
   ${outcome.toUpperCase()}

${feedbackLabel} FEEDBACK CAMPIONI:
   ${sampleFeedback?.toUpperCase() || 'N/A'}

📦 CAMPIONI CONSEGNATI (dalla macchina):
${sampleProducts.map((p, idx) =>
  `   ${idx + 1}. ${p.productName} - ${p.quantity} ${p.uom}`
).join('\n')}

📝 NOTE VISITA:
${notes || '   Nessuna nota aggiuntiva'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚚 ORIGINE PRODOTTI: Stock Furgone Venditore
💰 VALORE COMMERCIALE: Listino Cliente con Sconto 100%
📋 STATO: ORDINE CONFERMATO E CONSEGNATO

🤖 Ordine generato e validato automaticamente tramite Maestro AI
📱 App: Registrazione Interazione Cliente
🔗 Fonte: https://lapa-app-platform.vercel.app
`.trim();

    // 8. Create sale.order (DRAFT first, then confirm)
    const orderCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'create',
          args: [{
            partner_id: odooPartnerId,
            user_id: salesPersonId || false,
            order_line: orderLines,
            note: detailedNotes,
            client_order_ref: `CAMPIONI-${now.getTime()}`,
            commitment_date: odooDate
            // NO state - viene creato come draft
          }],
          kwargs: injectLangContext({})
        },
        id: 2
      })
    });

    const orderCreateData = await orderCreateResponse.json();

    if (!orderCreateData.result) {
      console.error('❌ Errore creazione ordine:', orderCreateData);
      throw new Error('Errore nella creazione dell\'ordine');
    }

    const orderId = orderCreateData.result;
    console.log(`✅ Ordine creato (draft): ${orderId}`);

    // 8.5 Confirm the order (draft → sale)
    const confirmResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'sale.order',
          method: 'action_confirm',
          args: [[orderId]],
          kwargs: injectLangContext({})
        },
        id: 3
      })
    });

    const confirmData = await confirmResponse.json();
    console.log(`✅ Ordine confermato: ${orderId}`);

    // 9. Find the auto-created picking and modify it to use vehicle location
    if (vehicleLocationId) {
      console.log(`\n📦 Ricerca picking auto-creato da sale.order...`);

      // Find picking created by sale.order
      const pickingSearchResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.picking',
            method: 'search_read',
            args: [[['sale_id', '=', orderId]]],
            kwargs: injectLangContext({
              fields: ['id', 'move_ids'],
              limit: 1
            })
          },
          id: 4
        })
      });

      const pickingSearchData = await pickingSearchResponse.json();
      const pickings = pickingSearchData.result || [];

      if (pickings.length > 0) {
        const pickingId = pickings[0].id;
        const moveIds = pickings[0].move_ids || [];
        console.log(`📋 Picking trovato: ${pickingId} con ${moveIds.length} moves`);

        // First: unreserve the picking to allow modifications
        await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking',
              method: 'do_unreserve',
              args: [[pickingId]],
              kwargs: injectLangContext({})
            },
            id: 4
          })
        });
        console.log(`🔓 Picking unreserved per permettere modifiche`);

        // Update picking location_id to vehicle location
        await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking',
              method: 'write',
              args: [[pickingId], {
                location_id: vehicleLocationId
              }],
              kwargs: injectLangContext({})
            },
            id: 5
          })
        });
        console.log(`✅ Picking location_id aggiornata a veicolo (${vehicleLocationId})`);

        // Update all move location_id to vehicle location
        if (moveIds.length > 0) {
          await fetch(`${odooUrl}/web/dataset/call_kw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `session_id=${sessionId}`
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'call',
              params: {
                model: 'stock.move',
                method: 'write',
                args: [moveIds, {
                  location_id: vehicleLocationId
                }],
                kwargs: injectLangContext({})
              },
              id: 6
            })
          });
          console.log(`✅ ${moveIds.length} moves aggiornati con location_id veicolo`);
        }

        // Confirm picking
        await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking',
              method: 'action_confirm',
              args: [[pickingId]],
              kwargs: injectLangContext({})
            },
            id: 7
          })
        });

        console.log('✅ Picking confermato');

        // Assign picking
        await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking',
              method: 'action_assign',
              args: [[pickingId]],
              kwargs: injectLangContext({})
            },
            id: 8
          })
        });

        console.log('✅ Picking assigned');

        // VALIDATE picking - products delivered!
        await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.picking',
              method: 'button_validate',
              args: [[pickingId]],
              kwargs: injectLangContext({})
            },
            id: 9
          })
        });

        console.log('✅ Picking VALIDATO - prodotti consegnati!');
      }
    }

    // 10. Post message to Chatter
    const chatterMessage = `
🎁 <strong>Campioni Omaggio Consegnati</strong>

<ul>
<li><strong>Tipo:</strong> ${interactionTypeLabel}</li>
<li><strong>Esito:</strong> ${outcomeLabel}</li>
<li><strong>Feedback:</strong> ${feedbackLabel}</li>
<li><strong>Prodotti:</strong> ${sampleProducts.length} campioni dalla macchina</li>
</ul>

${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}

<p><em>🤖 Registrato automaticamente tramite Maestro AI</em></p>
`.trim();

    try {
      await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'sale.order',
            method: 'message_post',
            args: [[orderId]],
            kwargs: injectLangContext({
              body: chatterMessage,
              message_type: 'comment',
              subtype_xmlid: 'mail.mt_note'
            })
          },
          id: 10
        })
      });

      console.log('📝 Messaggio aggiunto al Chatter');
    } catch (chatterError) {
      console.warn('⚠️ Impossibile aggiungere messaggio al Chatter:', chatterError);
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      customerName,
      itemCount: orderLines.length,
      totalQuantity: sampleProducts.reduce((sum, item) => sum + item.quantity, 0),
      message: `Ordine campioni ${orderId} creato, confermato e consegnato per ${customerName}`
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [API] Error creating sample order:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Errore durante la creazione dell\'ordine campioni',
        details: error.message
      }
    }, { status: 500 });
  }
}
