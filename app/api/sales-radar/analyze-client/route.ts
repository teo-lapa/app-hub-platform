import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// Lazy initialization
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
  });
}

interface AnalyzeClientBody {
  website: string;
  name: string;
  client_id?: number;
  client_type: 'lead' | 'customer';
  address?: string;
  phone?: string;
}

/**
 * POST /api/sales-radar/analyze-client
 *
 * Analizza un cliente/lead tramite il suo sito web usando AI
 * - Scrape del sito web
 * - Analisi AI per suggerimenti di vendita
 * - Per clienti esistenti: analizza anche storico ordini
 *
 * Request:
 * - website: string (URL del sito)
 * - name: string (nome azienda)
 * - client_id?: number (ID Odoo se cliente esistente)
 * - client_type: 'lead' | 'customer'
 * - address?: string
 * - phone?: string
 *
 * Response:
 * - success: boolean
 * - analysis: { summary, menu_analysis, product_suggestions, sales_tips }
 */
export async function POST(request: NextRequest) {
  try {
    // Get Odoo session from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const body: AnalyzeClientBody = await request.json();

    // Validate
    if (!body.name) {
      return NextResponse.json({
        success: false,
        error: 'Nome cliente richiesto'
      }, { status: 400 });
    }

    console.log('[ANALYZE-CLIENT] Analisi per:', body.name, body.website);

    const openai = getOpenAIClient();
    const client = createOdooRPCClient(sessionId);

    // 1. Fetch website content if available
    let websiteContent = '';
    if (body.website) {
      try {
        websiteContent = await fetchWebsiteContent(body.website);
        console.log('[ANALYZE-CLIENT] Website content fetched:', websiteContent.length, 'chars');
      } catch (error) {
        console.warn('[ANALYZE-CLIENT] Failed to fetch website:', error);
        websiteContent = 'Sito web non accessibile';
      }
    }

    // 2. Get order history if existing customer
    let orderHistory = '';
    if (body.client_type === 'customer' && body.client_id) {
      try {
        orderHistory = await getCustomerOrderHistory(client, body.client_id);
        console.log('[ANALYZE-CLIENT] Order history fetched');
      } catch (error) {
        console.warn('[ANALYZE-CLIENT] Failed to fetch order history:', error);
      }
    }

    // 3. Build AI prompt based on client type
    const systemPrompt = buildSystemPrompt(body.client_type);
    const userPrompt = buildUserPrompt(body, websiteContent, orderHistory);

    // 4. Call OpenAI for analysis
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const analysisText = completion.choices[0]?.message?.content || '';

    console.log('[ANALYZE-CLIENT] Analysis completed');

    return NextResponse.json({
      success: true,
      analysis: {
        text: analysisText,
        client_name: body.name,
        client_type: body.client_type,
        website: body.website || null,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[ANALYZE-CLIENT] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante l\'analisi'
    }, { status: 500 });
  }
}

/**
 * Fetch and extract text content from website
 */
async function fetchWebsiteContent(url: string): Promise<string> {
  // Ensure URL has protocol
  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fullUrl = 'https://' + url;
  }

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SalesRadarBot/1.0)',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  // Extract text content (basic HTML stripping)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 8000); // Limit to ~8000 chars

  return textContent;
}

/**
 * Get customer order history from Odoo
 */
async function getCustomerOrderHistory(
  client: ReturnType<typeof createOdooRPCClient>,
  partnerId: number
): Promise<string> {
  // Get last 3 months of orders
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateStr = threeMonthsAgo.toISOString().split('T')[0];

  const orders = await client.searchRead(
    'sale.order',
    [
      ['partner_id', '=', partnerId],
      ['state', 'in', ['sale', 'done']],
      ['date_order', '>=', dateStr]
    ],
    ['name', 'date_order', 'amount_total', 'order_line'],
    10,
    'date_order desc'
  );

  if (orders.length === 0) {
    return 'Nessun ordine negli ultimi 3 mesi.';
  }

  // Get order lines with products
  const orderIds = orders.map((o: any) => o.id);
  const orderLines = await client.searchRead(
    'sale.order.line',
    [['order_id', 'in', orderIds]],
    ['product_id', 'product_uom_qty', 'price_subtotal'],
    100,
    'price_subtotal desc'
  );

  // Aggregate products
  const productCounts: Record<string, { qty: number; total: number }> = {};
  for (const line of orderLines) {
    const productName = line.product_id?.[1] || 'Prodotto sconosciuto';
    if (!productCounts[productName]) {
      productCounts[productName] = { qty: 0, total: 0 };
    }
    productCounts[productName].qty += line.product_uom_qty || 0;
    productCounts[productName].total += line.price_subtotal || 0;
  }

  // Build summary
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.amount_total || 0), 0);
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, data]) => `- ${name}: ${data.qty} unità, €${data.total.toFixed(2)}`)
    .join('\n');

  return `
STORICO ORDINI (ultimi 3 mesi):
- Numero ordini: ${orders.length}
- Fatturato totale: €${totalRevenue.toFixed(2)}
- Media per ordine: €${(totalRevenue / orders.length).toFixed(2)}

TOP PRODOTTI ACQUISTATI:
${topProducts}
`;
}

/**
 * Build system prompt based on client type
 */
function buildSystemPrompt(clientType: 'lead' | 'customer'): string {
  const basePrompt = `Sei un assistente vendite esperto per LAPA, un'azienda di distribuzione alimentare specializzata nella ristorazione (ristoranti, pizzerie, bar, hotel, food truck, catering).

Il tuo compito è analizzare i potenziali clienti e fornire suggerimenti utili per la vendita.

PRODOTTI LAPA (categorie principali):
- Latticini e formaggi (mozzarella, burrata, parmigiano, gorgonzola)
- Salumi e affettati (prosciutto, speck, pancetta, salame)
- Farine e impasti (farina 00, semola, impasti per pizza)
- Olio e condimenti (olio EVO, aceto balsamico, salse)
- Conserve e pomodoro (pelati, passata, pomodori secchi)
- Pasta secca e fresca
- Prodotti surgelati
- Bevande (acqua, soft drink, birre, vini)

Rispondi SEMPRE in italiano, in modo conciso e pratico.`;

  if (clientType === 'lead') {
    return basePrompt + `

Questo è un NUOVO POTENZIALE CLIENTE (lead). Concentrati su:
1. Capire che tipo di locale è
2. Cosa potrebbe servirgli
3. Come approcciarlo
4. Prodotti chiave da proporre`;
  } else {
    return basePrompt + `

Questo è un CLIENTE ESISTENTE. Concentrati su:
1. Analizzare il suo storico acquisti
2. Identificare opportunità di upselling/cross-selling
3. Prodotti che NON compra ma potrebbe usare
4. Come aumentare il valore medio ordine`;
  }
}

/**
 * Build user prompt with all available data
 */
function buildUserPrompt(
  body: AnalyzeClientBody,
  websiteContent: string,
  orderHistory: string
): string {
  let prompt = `ANALIZZA QUESTO ${body.client_type === 'lead' ? 'POTENZIALE CLIENTE' : 'CLIENTE'}:

NOME: ${body.name}
${body.address ? `INDIRIZZO: ${body.address}` : ''}
${body.phone ? `TELEFONO: ${body.phone}` : ''}
${body.website ? `SITO WEB: ${body.website}` : 'SITO WEB: Non disponibile'}
`;

  if (websiteContent && websiteContent !== 'Sito web non accessibile') {
    prompt += `
CONTENUTO DEL SITO WEB:
${websiteContent.slice(0, 4000)}
`;
  }

  if (orderHistory) {
    prompt += `
${orderHistory}
`;
  }

  prompt += `
FORNISCI UN'ANALISI STRUTTURATA con:

1. **PROFILO LOCALE** (2-3 righe)
   Che tipo di locale è? (ristorante, pizzeria, bar, etc.)

2. **MENU/OFFERTA** (se disponibile dal sito)
   Cosa serve? Cucina italiana, pizza, gourmet, fast food?

3. **PRODOTTI CONSIGLIATI** (lista 5-7 prodotti specifici)
   Cosa potrebbe acquistare da LAPA?

4. **SUGGERIMENTI VENDITA** (2-3 consigli pratici)
   Come approcciare questo cliente?
`;

  return prompt;
}
