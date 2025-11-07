import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/test-ai-matching
 *
 * Test AI matching prodotti da messaggio cliente
 *
 * Body:
 * {
 *   customerName: string,
 *   message: string,
 *   historyMonths?: number (default 6)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, message, historyMonths = 6 } = body;

    console.log('🧪 [TEST-AI-MATCHING] Inizio test matching');
    console.log('👤 Cliente:', customerName);
    console.log('💬 Messaggio:', message);

    // STEP 1: Cerca cliente in Odoo
    console.log('\n📍 STEP 1: Ricerca cliente in Odoo...');
    const customers = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [
          '|',
          ['name', 'ilike', customerName],
          ['ref', '=', customerName]
        ],
        fields: ['id', 'name', 'ref', 'email', 'phone'],
        limit: 5
      }
    );

    if (!customers || customers.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Cliente "${customerName}" non trovato in Odoo`
      });
    }

    const customer = customers[0];
    console.log('✅ Cliente trovato:', customer);

    // STEP 2: Prendi storico ordini cliente (ultimi X mesi)
    console.log('\n📍 STEP 2: Caricamento storico ordini...');
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - historyMonths);
    const dateFrom = monthsAgo.toISOString().split('T')[0];

    const orders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', customer.id],
          ['date_order', '>=', dateFrom],
          ['state', 'in', ['sale', 'done']]
        ],
        fields: ['id', 'name', 'date_order'],
        limit: 100
      }
    );

    console.log(`✅ Trovati ${orders?.length || 0} ordini negli ultimi ${historyMonths} mesi`);

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Nessun ordine trovato per ${customer.name} negli ultimi ${historyMonths} mesi`
      });
    }

    // STEP 3: Prendi tutte le righe ordine (prodotti acquistati)
    console.log('\n📍 STEP 3: Caricamento prodotti dallo storico...');
    const orderIds = orders.map((o: any) => o.id);

    const orderLines = await callOdooAsAdmin(
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: [
          'product_id',
          'name',
          'product_uom_qty',
          'price_unit',
          'order_id'
        ],
        limit: 1000
      }
    );

    console.log(`✅ Trovate ${orderLines?.length || 0} righe ordine (prodotti)`);

    // Raggruppa prodotti per frequenza
    const productFrequency = new Map<number, {
      product_id: number,
      product_name: string,
      count: number,
      total_qty: number,
      last_price: number
    }>();

    orderLines?.forEach((line: any) => {
      const productId = line.product_id[0];
      const existing = productFrequency.get(productId);

      if (existing) {
        existing.count++;
        existing.total_qty += line.product_uom_qty;
      } else {
        productFrequency.set(productId, {
          product_id: productId,
          product_name: line.product_id[1],
          count: 1,
          total_qty: line.product_uom_qty,
          last_price: line.price_unit
        });
      }
    });

    // Converti in array e ordina per frequenza
    const productHistory = Array.from(productFrequency.values())
      .sort((a, b) => b.count - a.count);

    console.log(`✅ Trovati ${productHistory.length} prodotti unici nello storico`);
    console.log('📊 Top 10 prodotti più ordinati:');
    productHistory.slice(0, 10).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.product_name} (ordinato ${p.count}x, tot: ${p.total_qty})`);
    });

    // STEP 4: Usa AI per matchare prodotti dal messaggio
    console.log('\n📍 STEP 4: AI Matching prodotti...');

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const prompt = `Sei un assistente AI che aiuta a processare ordini di prodotti alimentari italiani.

STORICO ACQUISTI CLIENTE "${customer.name}":
${productHistory.map((p, i) => `${i + 1}. ${p.product_name} (ID: ${p.product_id}) - Ordinato ${p.count} volte`).join('\n')}

MESSAGGIO ORDINE RICEVUTO:
"""
${message}
"""

COMPITO:
Estrai dal messaggio i prodotti richiesti e le quantità, poi fai il MATCH con lo storico acquisti del cliente.

REGOLE MATCHING:
1. Cerca nel nome del prodotto parole chiave dal messaggio
2. Considera sinonimi (es. "parmigiano" = "parmigiano reggiano")
3. Ignora dettagli non critici (es. "DOP", "24 mesi", ecc.)
4. Se trovi più match, scegli il prodotto ordinato PIÙ FREQUENTEMENTE
5. Se NON trovi match nello storico, segnalalo come "NON_TROVATO"

FORMATO OUTPUT (JSON):
{
  "matches": [
    {
      "richiesta_originale": "testo estratto dal messaggio",
      "quantita": numero,
      "product_id": numero o null,
      "product_name": "nome prodotto" o null,
      "confidence": "ALTA" | "MEDIA" | "BASSA" | "NON_TROVATO",
      "reasoning": "spiegazione breve del match"
    }
  ],
  "note_generali": "eventuali note o ambiguità"
}`;

    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const aiContent = aiResponse.content[0];
    let aiResult;

    if (aiContent.type === 'text') {
      // Estrai JSON dalla risposta
      const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0]);
      } else {
        aiResult = { error: 'AI non ha restituito JSON valido', raw: aiContent.text };
      }
    }

    console.log('✅ AI Matching completato!');
    console.log(JSON.stringify(aiResult, null, 2));

    // STEP 5: Ritorna risultati
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        ref: customer.ref
      },
      history: {
        orders_count: orders.length,
        products_count: productHistory.length,
        months: historyMonths,
        top_products: productHistory.slice(0, 20)
      },
      ai_matching: aiResult,
      message_analyzed: message
    });

  } catch (error: any) {
    console.error('❌ [TEST-AI-MATCHING] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
