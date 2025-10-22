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
            kwargs: {
              fields: ['name', 'uom_id', 'default_code'],
              limit: 1
            }
          },
          id: 1
        })
      });

      const productData = await productResponse.json();
      const products = productData.result || [];

      if (products.length > 0) {
        const product = products[0];
        const lineDescription = `🎁 CAMPIONE OMAGGIO - ${product.name}${product.default_code ? ` [${product.default_code}]` : ''}`;

        orderLines.push([0, 0, {
          product_id: item.productId,
          product_uom_qty: item.quantity,
          product_uom: product.uom_id[0],
          price_unit: 0, // Price 0 for gift samples
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
💰 VALORE COMMERCIALE: Campioni Omaggio (€0)
📋 STATO: ORDINE CONFERMATO E CONSEGNATO

🤖 Ordine generato e validato automaticamente tramite Maestro AI
📱 App: Registrazione Interazione Cliente
🔗 Fonte: https://lapa-app-platform.vercel.app
`.trim();

    // 8. Create sale.order (CONFIRMED state)
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
            commitment_date: odooDate,
            state: 'sale' // CONFIRMED ORDER!
          }],
          kwargs: {}
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
    console.log(`✅ Ordine creato e confermato: ${orderId}`);

    // 9. If we have a vehicle location, create and validate picking
    if (vehicleLocationId) {
      console.log(`\n📦 Creazione picking per delivery dalla macchina...`);

      // Get picking type for delivery
      const pickingTypeResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.picking.type',
            method: 'search_read',
            args: [[['code', '=', 'outgoing']]],
            kwargs: {
              fields: ['id'],
              limit: 1
            }
          },
          id: 3
        })
      });

      const pickingTypeData = await pickingTypeResponse.json();
      const pickingTypes = pickingTypeData.result || [];

      if (pickingTypes.length > 0) {
        const pickingTypeId = pickingTypes[0].id;

        // Customer location (destination for delivery)
        const customerLocationId = 9; // Partners/Customers location

        // Create picking
        const pickingCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
              method: 'create',
              args: [{
                picking_type_id: pickingTypeId,
                location_id: vehicleLocationId,
                location_dest_id: customerLocationId,
                origin: `SO-${orderId}`,
                partner_id: odooPartnerId,
                sale_id: orderId,
                note: `Consegna campioni omaggio dalla macchina venditore`
              }],
              kwargs: {}
            },
            id: 4
          })
        });

        const pickingCreateData = await pickingCreateResponse.json();
        const pickingId = pickingCreateData.result;

        if (pickingId) {
          console.log(`📋 Picking creato: ${pickingId}`);

          // Create stock.move for each product
          for (const product of sampleProducts) {
            const moveCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
                  method: 'create',
                  args: [{
                    picking_id: pickingId,
                    product_id: product.productId,
                    name: `Campione: ${product.productName}`,
                    product_uom_qty: product.quantity,
                    location_id: vehicleLocationId,
                    location_dest_id: customerLocationId
                  }],
                  kwargs: {}
                },
                id: 5
              })
            });

            const moveCreateData = await moveCreateResponse.json();
            console.log(`  ✓ Move creato per prodotto ${product.productId}`);
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
                kwargs: {}
              },
              id: 6
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
                kwargs: {}
              },
              id: 7
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
                kwargs: {}
              },
              id: 8
            })
          });

          console.log('✅ Picking VALIDATO - prodotti consegnati!');
        }
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
            kwargs: {
              body: chatterMessage,
              message_type: 'comment',
              subtype_xmlid: 'mail.mt_note'
            }
          },
          id: 9
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
