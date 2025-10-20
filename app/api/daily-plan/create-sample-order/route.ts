import { NextRequest, NextResponse } from 'next/server';
import { createOdoo, searchReadOdoo, callOdoo } from '@/lib/odoo/odoo-helper';
import { getOdooSession } from '@/lib/odoo-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface SampleOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  uom: string;
}

interface CreateSampleOrderRequest {
  customerId: number;
  customerName: string;
  interactionType: string;
  outcome: string;
  notes: string;
  sampleProducts: SampleOrderItem[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSampleOrderRequest = await request.json();
    const {
      customerId,
      customerName,
      interactionType,
      outcome,
      notes,
      sampleProducts
    } = body;

    // Get current user from session
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    // Fetch user info from Odoo
    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;
    const users = await searchReadOdoo('res.users', [
      ['id', '=', uidNum]
    ], ['name']);

    const userName = users && users.length > 0 ? users[0].name : 'Venditore';
    const userId = uidNum;

    if (!customerId || !sampleProducts || sampleProducts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'customerId e sampleProducts sono richiesti'
      }, { status: 400 });
    }

    console.log(`🎁 Creazione ordine campioni per cliente ${customerName} (${customerId})`);
    console.log(`📦 Prodotti campioni: ${sampleProducts.length}`);

    // 1. Verifica esistenza cliente
    const customers = await searchReadOdoo('res.partner', [
      ['id', '=', customerId]
    ], ['name', 'email']);

    if (!customers || customers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente non trovato'
      }, { status: 404 });
    }

    const customer = customers[0];
    console.log(`✅ Cliente trovato: ${customer.name}`);

    // 2. Prepara le righe ordine - tutti i prodotti a prezzo 0 (omaggio)
    const orderLines = [];

    // Format date for Odoo: 'YYYY-MM-DD HH:MM:SS'
    const now = new Date();
    const odooDate = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    for (const item of sampleProducts) {
      // Cerca il prodotto per ottenere le info necessarie
      const products = await searchReadOdoo('product.product', [
        ['id', '=', item.productId]
      ], ['name', 'uom_id', 'list_price', 'default_code']);

      if (products && products.length > 0) {
        const product = products[0];

        // Descrizione riga con indicazione CAMPIONE OMAGGIO
        const lineDescription = `🎁 CAMPIONE OMAGGIO - ${product.name}${product.default_code ? ` [${product.default_code}]` : ''}`;

        orderLines.push([0, 0, {
          product_id: item.productId,
          product_uom_qty: item.quantity,
          product_uom: product.uom_id[0],
          price_unit: 0, // Prezzo 0 per campioni omaggio
          name: lineDescription,
          customer_lead: 0
        }]);
      }
    }

    if (orderLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun prodotto valido trovato'
      }, { status: 400 });
    }

    // 3. Crea descrizione dettagliata dell'ordine con tracciatura completa
    const interactionTypeLabel = interactionType === 'visita' ? '📹 Visita' :
                                  interactionType === 'chiamata' ? '📞 Chiamata' : '📧 Email';

    const outcomeLabel = outcome === 'positivo' ? '✅ Positivo' :
                        outcome === 'negativo' ? '❌ Negativo' : '⚠️ Neutrale';

    const detailedNotes = `
╔═══════════════════════════════════════════════════════════╗
║          🎁 ORDINE CAMPIONI OMAGGIO - LAPA APP           ║
╚═══════════════════════════════════════════════════════════╝

📅 DATA E ORA:
   ${now.toLocaleDateString('it-IT', {
     weekday: 'long',
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   })} - ${now.toLocaleTimeString('it-IT')}

👤 VENDITORE:
   ${userName} (ID: ${userId})

🏢 CLIENTE:
   ${customerName} (ID: ${customerId})

${interactionTypeLabel} TIPO INTERAZIONE:
   ${interactionType.toUpperCase()}

${outcomeLabel} ESITO:
   ${outcome.toUpperCase()}

📦 CAMPIONI CONSEGNATI:
${sampleProducts.map((p, idx) =>
  `   ${idx + 1}. ${p.productName} - ${p.quantity} ${p.uom}`
).join('\n')}

📝 NOTE VISITA:
${notes || '   Nessuna nota aggiuntiva'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Ordine generato automaticamente tramite LAPA App Platform
📱 App: Piano Giornaliero - Registrazione Interazione
🔗 Fonte: https://lapa-app-platform.vercel.app
`.trim();

    // 4. Crea l'ordine di vendita in Odoo (preventivo con prezzo 0)
    const orderData = {
      partner_id: customerId,
      user_id: userId, // Assegna il venditore
      order_line: orderLines,
      note: detailedNotes,
      // Tag personalizzato per identificare ordini campioni
      client_order_ref: `CAMPIONI-${now.getTime()}`,
      // Pricelist standard (anche se i prezzi sono 0)
      commitment_date: odooDate // Data di consegna = data visita
    };

    console.log(`🚀 Creazione sale.order in Odoo...`);
    const orderId = await createOdoo('sale.order', orderData);

    console.log(`✅ Ordine campioni creato con ID: ${orderId}`);

    // 5. NON confermiamo automaticamente - resta come preventivo/bozza
    // In questo modo l'ufficio può revisionare prima di confermare
    console.log(`📋 Ordine lasciato in stato BOZZA per revisione ufficio`);

    // 6. Opzionale: aggiungi tag/categoria per filtrare facilmente questi ordini
    try {
      // Cerca tag "Campioni Omaggio" o crealo
      const tags = await searchReadOdoo('crm.tag', [
        ['name', '=', 'Campioni Omaggio']
      ], ['id', 'name']);

      let tagId;
      if (tags && tags.length > 0) {
        tagId = tags[0].id;
      } else {
        // Crea il tag se non esiste
        tagId = await createOdoo('crm.tag', {
          name: 'Campioni Omaggio',
          color: 5 // Verde
        });
      }

      // Associa il tag all'ordine tramite campo tag_ids (se disponibile)
      // Nota: sale.order potrebbe non avere tag_ids, dipende dalla configurazione Odoo
      // In alternativa, usiamo client_order_ref per identificare questi ordini

    } catch (tagError) {
      console.warn('⚠️ Impossibile aggiungere tag (campo potrebbe non esistere):', tagError);
      // Non bloccare l'ordine se i tag non sono disponibili
    }

    return NextResponse.json({
      success: true,
      orderId: orderId,
      customerName: customer.name,
      itemCount: orderLines.length,
      totalQuantity: sampleProducts.reduce((sum, item) => sum + item.quantity, 0),
      message: `Ordine campioni ${orderId} creato per ${customer.name} con ${orderLines.length} prodotti`
    });

  } catch (error: any) {
    console.error('❌ Errore creazione ordine campioni:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la creazione dell\'ordine campioni'
    }, { status: 500 });
  }
}
