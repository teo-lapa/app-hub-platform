import { NextRequest, NextResponse } from 'next/server';
import { createOdoo, searchReadOdoo } from '@/lib/odoo/odoo-helper';
import { getOdooSession } from '@/lib/odoo-auth';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface QuotationItem {
  productId: number;
  productName: string;
  quantity: number;
  uom: string;
}

interface CreateQuotationRequest {
  customerId: number;
  customerName: string;
  interactionType: string;
  outcome: string;
  notes: string;
  sampleProducts: QuotationItem[];
}

/**
 * POST /api/maestro/create-quotation
 *
 * Creates a draft quotation (sale.order with state='draft') for sample products
 * given during a customer interaction. This is used by the InteractionModal
 * to track sample distribution from vehicle stock.
 *
 * The quotation will be left in draft state for office review before confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateQuotationRequest = await request.json();
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

    console.log(`🎁 [Quotation] Creazione preventivo campioni per cliente ${customerName} (${customerId})`);
    console.log(`📦 [Quotation] Prodotti campioni: ${sampleProducts.length}`);

    // 1. Verify customer exists
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
    console.log(`✅ [Quotation] Cliente trovato: ${customer.name}`);

    // 2. Prepare order lines - all products at price 0 (gift samples)
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
      // Fetch product details
      const products = await searchReadOdoo('product.product', [
        ['id', '=', item.productId]
      ], ['name', 'uom_id', 'list_price', 'default_code']);

      if (products && products.length > 0) {
        const product = products[0];

        // Line description with GIFT SAMPLE indicator
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
        error: 'Nessun prodotto valido trovato'
      }, { status: 400 });
    }

    // 3. Create detailed quotation notes with full tracking
    const interactionTypeLabel = interactionType === 'visit' ? '📹 Visita' :
                                  interactionType === 'call' ? '📞 Chiamata' : '📧 Email';

    const outcomeLabel = outcome === 'positive' ? '✅ Positivo' :
                        outcome === 'negative' ? '❌ Negativo' : '⚠️ Neutrale';

    const detailedNotes = `
╔═══════════════════════════════════════════════════════════╗
║     🎁 PREVENTIVO CAMPIONI OMAGGIO - MAESTRO AI          ║
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

📦 CAMPIONI CONSEGNATI (dalla macchina):
${sampleProducts.map((p, idx) =>
  `   ${idx + 1}. ${p.productName} - ${p.quantity} ${p.uom}`
).join('\n')}

📝 NOTE VISITA:
${notes || '   Nessuna nota aggiuntiva'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚚 ORIGINE PRODOTTI: Stock Furgone Venditore
💰 VALORE COMMERCIALE: Campioni Omaggio (€0)
📋 STATO: PREVENTIVO - Richiede revisione e conferma ufficio

🤖 Preventivo generato automaticamente tramite Maestro AI
📱 App: Registrazione Interazione Cliente
🔗 Fonte: https://lapa-app-platform.vercel.app
`.trim();

    // 4. Create quotation (sale.order) in Odoo in DRAFT state
    const quotationData = {
      partner_id: customerId,
      user_id: userId, // Assign salesperson
      order_line: orderLines,
      note: detailedNotes,
      // Custom reference to identify sample quotations
      client_order_ref: `CAMPIONI-MACCHINA-${now.getTime()}`,
      // Commitment date = interaction date
      commitment_date: odooDate,
      // IMPORTANT: Do NOT set state to 'sale' - leave as 'draft'
      // This allows office to review before confirming
    };

    console.log(`🚀 [Quotation] Creazione sale.order in Odoo...`);
    const quotationId = await createOdoo('sale.order', quotationData);

    console.log(`✅ [Quotation] Preventivo campioni creato con ID: ${quotationId}`);

    // 5. DO NOT auto-confirm - leave as draft for office review
    console.log(`📋 [Quotation] Preventivo lasciato in stato BOZZA per revisione ufficio`);

    // 6. Optional: Add tag/category for easy filtering
    try {
      // Search for "Campioni Macchina" tag or create it
      const tags = await searchReadOdoo('crm.tag', [
        ['name', '=', 'Campioni Macchina']
      ], ['id', 'name']);

      let tagId;
      if (tags && tags.length > 0) {
        tagId = tags[0].id;
      } else {
        // Create tag if it doesn't exist
        tagId = await createOdoo('crm.tag', {
          name: 'Campioni Macchina',
          color: 3 // Blue
        });
      }

      console.log(`🏷️ [Quotation] Tag "Campioni Macchina" associato (ID: ${tagId})`);

    } catch (tagError) {
      console.warn('⚠️ [Quotation] Impossibile aggiungere tag:', tagError);
      // Don't block quotation creation if tags fail
    }

    return NextResponse.json({
      success: true,
      quotationId: quotationId,
      customerName: customer.name,
      itemCount: orderLines.length,
      totalQuantity: sampleProducts.reduce((sum, item) => sum + item.quantity, 0),
      message: `Preventivo campioni ${quotationId} creato per ${customer.name} con ${orderLines.length} prodotti`
    });

  } catch (error: any) {
    console.error('❌ [Quotation] Errore creazione preventivo campioni:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la creazione del preventivo campioni'
    }, { status: 500 });
  }
}
