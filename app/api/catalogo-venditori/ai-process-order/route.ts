import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '');

/**
 * AI ORDER PROCESSING ENDPOINT
 * POST /api/catalogo-venditori/ai-process-order
 *
 * Uses Claude AI to match products from customer messages (text, audio, or image).
 *
 * Body:
 * {
 *   customerId: number,        // Odoo partner ID
 *   message: string,           // Customer order message
 *   messageType: 'text' | 'audio' | 'image'
 * }
 *
 * Flow:
 * 1. Fetch customer purchase history (last 6 months)
 * 2. Build AI prompt with customer history and message
 * 3. Call Claude AI with smart fuzzy matching instructions
 * 4. Parse AI response JSON with product matches
 * 5. Return matches with customer info and notes
 */

interface ProcessOrderRequest {
  customerId: number;
  message: string;
  messageType: string;
}

interface ProductMatch {
  richiesta_originale: string;
  quantita: number;
  product_id: number | null;
  product_name: string | null;
  confidence: 'ALTA' | 'MEDIA' | 'BASSA' | 'NON_TROVATO';
  reasoning: string;
  image_url?: string | null;
  qty_available?: number;
  uom_name?: string;
  incoming_qty?: number;
  incoming_date?: string | null;
}

interface AIMatchingResult {
  matches: ProductMatch[];
  note_generali?: string;
}

interface CustomerHistoryProduct {
  product_id: number;
  product_name: string;
  count: number;
  total_qty: number;
  last_price: number;
}

/**
 * Extract text from media files
 * - Images & PDF: Uses Gemini 1.5 Flash (native support for both)
 * - Audio/Video: Uses OpenAI Whisper (transcription)
 */
async function extractTextFromMedia(
  fileBase64: string,
  mimeType: string
): Promise<string> {
  console.log(`🔍 [MEDIA-EXTRACT] Extracting text from ${mimeType}...`);
  console.log(`🔍 [MEDIA-EXTRACT] File size: ${fileBase64.length} chars (base64)`);

  try {
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      // Use Gemini for PDF and images (supports both natively)
      console.log(`📄 [GEMINI] Using Gemini for ${mimeType === 'application/pdf' ? 'PDF' : 'image'} extraction`);
      console.log(`🔍 [GEMINI] API Key configured: ${!!process.env.GEMINI_API_KEY && !!process.env.GOOGLE_GEMINI_API_KEY}`);
      console.log(`🔍 [GEMINI] File size (base64): ${fileBase64.length} chars (~${Math.round(fileBase64.length * 0.75 / 1024)} KB)`);

      if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      try {
        console.log(`📤 [GEMINI] Sending file to Gemini...`);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const result = await model.generateContent([
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          'Estrai il testo completo da questo documento. Se è un ordine o lista prodotti, trascrivi tutto esattamente come appare. Includi quantità, nomi prodotti, note. Rispondi SOLO con il testo estratto, senza commenti aggiuntivi.',
        ]);

        const extractedText = result.response.text();

        console.log(`✅ [GEMINI] Text extracted (${extractedText.length} chars)`);
        console.log(`📝 [GEMINI] Preview: ${extractedText.substring(0, 200)}...`);
        return extractedText;
      } catch (geminiError: any) {
        console.error(`❌ [GEMINI] Error:`, geminiError);
        throw new Error(`Gemini extraction failed: ${geminiError?.message || geminiError}`);
      }
    } else if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
      // Use OpenAI Whisper for audio/video (better format support)
      console.log(`🎤 [WHISPER] Using Whisper for audio transcription`);
      console.log(`🔍 [WHISPER] API Key configured: ${!!process.env.OPENAI_API_KEY}`);

      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(fileBase64, 'base64');

      // Create form data for Whisper API
      const formData = new FormData();
      const blob = new Blob([buffer], { type: mimeType });
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'it'); // Italian
      formData.append('prompt', 'Questo è un ordine di prodotti alimentari. Trascrivi con precisione quantità e nomi prodotti.');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [WHISPER] API error: ${response.status} - ${errorText}`);
        throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const transcription = result.text;

      console.log(`✅ [WHISPER] Transcription completed (${transcription.length} chars)`);
      console.log(`📝 [WHISPER] Preview: ${transcription.substring(0, 200)}...`);

      return transcription;
    } else {
      throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  } catch (error) {
    console.error('❌ [MEDIA-EXTRACT] Error extracting text:', error);
    console.error('❌ [MEDIA-EXTRACT] Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to extract text from media: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch customer purchase history (last 6 months)
 */
async function fetchCustomerHistory(
  cookies: string | null,
  customerId: number,
  months: number = 6
): Promise<{ customer: any; productHistory: CustomerHistoryProduct[] }> {
  console.log(`📍 STEP 1: Fetching customer data for ID ${customerId}...`);

  // Get customer data
  const customers = await callOdoo(cookies, 
    'res.partner',
    'search_read',
    [],
    {
      domain: [['id', '=', customerId]],
      fields: ['id', 'name', 'ref', 'email', 'phone', 'city'],
      limit: 1,
    }
  );

  if (!customers || customers.length === 0) {
    throw new Error(`Cliente con ID ${customerId} non trovato in Odoo`);
  }

  const customer = customers[0];
  console.log('✅ Customer found:', customer.name);

  // Get order history (last X months)
  console.log(`📍 STEP 2: Loading order history (last ${months} months)...`);
  const monthsAgo = new Date();
  monthsAgo.setMonth(monthsAgo.getMonth() - months);
  const dateFrom = monthsAgo.toISOString().split('T')[0];

  const orders = await callOdoo(cookies, 
    'sale.order',
    'search_read',
    [],
    {
      domain: [
        ['partner_id', '=', customerId],
        ['date_order', '>=', dateFrom],
        ['state', 'in', ['sale', 'done']],
      ],
      fields: ['id', 'name', 'date_order'],
      limit: 100,
    }
  );

  console.log(`✅ Found ${orders?.length || 0} orders in last ${months} months`);

  if (!orders || orders.length === 0) {
    throw new Error(`Nessun ordine trovato per ${customer.name} negli ultimi ${months} mesi`);
  }

  // Get all order lines (products purchased)
  console.log('📍 STEP 3: Loading products from order history...');
  const orderIds = orders.map((o: any) => o.id);

  const orderLines = await callOdoo(cookies, 
    'sale.order.line',
    'search_read',
    [],
    {
      domain: [['order_id', 'in', orderIds]],
      fields: ['product_id', 'name', 'product_uom_qty', 'price_unit', 'order_id'],
      limit: 1000,
    }
  );

  console.log(`✅ Found ${orderLines?.length || 0} order lines (products)`);

  // Group products by frequency
  const productFrequency = new Map<number, CustomerHistoryProduct>();

  orderLines?.forEach((line: any) => {
    if (!line.product_id || !Array.isArray(line.product_id) || line.product_id.length < 2) {
      return; // Skip invalid product data
    }

    const productId = line.product_id[0];
    const existing = productFrequency.get(productId);

    if (existing) {
      existing.count++;
      existing.total_qty += line.product_uom_qty || 0;
    } else {
      productFrequency.set(productId, {
        product_id: productId,
        product_name: line.product_id[1],
        count: 1,
        total_qty: line.product_uom_qty || 0,
        last_price: line.price_unit || 0,
      });
    }
  });

  // Convert to array and sort by frequency
  const productHistory = Array.from(productFrequency.values()).sort(
    (a, b) => b.count - a.count
  );

  console.log(`✅ Found ${productHistory.length} unique products in history`);
  console.log('📊 Top 10 most ordered products:');
  productHistory.slice(0, 10).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.product_name} (ordered ${p.count}x, total: ${p.total_qty})`);
  });

  return { customer, productHistory };
}

/**
 * Build AI prompt for product matching
 */
function buildAIPrompt(
  customer: any,
  productHistory: CustomerHistoryProduct[],
  message: string,
  messageType: string
): string {
  const messageTypeDescription: Record<string, string> = {
    text: 'TESTO',
    audio: 'TRASCRIZIONE AUDIO',
    image: 'TESTO DA IMMAGINE',
    recording: 'REGISTRAZIONE VOCALE',
    document: 'DOCUMENTO',
  };

  return `Sei un assistente AI che aiuta a processare ordini di prodotti alimentari italiani.

CLIENTE: "${customer.name}"
${customer.city ? `CITTÀ: ${customer.city}` : ''}

STORICO ACQUISTI CLIENTE (Ultimi 6 mesi):
${productHistory
  .map(
    (p, i) =>
      `${i + 1}. ${p.product_name} (ID: ${p.product_id}) - Ordinato ${p.count} volte, totale ${p.total_qty} unità`
  )
  .join('\n')}

TIPO MESSAGGIO: ${messageTypeDescription[messageType] || 'TESTO'}

MESSAGGIO ORDINE RICEVUTO:
"""
${message}
"""

COMPITO:
Estrai dal messaggio i prodotti richiesti e le quantità, poi fai il MATCH con lo storico acquisti del cliente.

REGOLE MATCHING:
1. Cerca nel nome del prodotto parole chiave dal messaggio
2. Considera sinonimi e varianti (es. "parmigiano" = "parmigiano reggiano", "mozza" = "mozzarella")
3. Ignora dettagli non critici per il matching (es. "DOP", "24 mesi", grammature specifiche)
4. Considera plurali e singolari come equivalenti
5. Se trovi più match possibili, scegli il prodotto ordinato PIÙ FREQUENTEMENTE
6. Se NON trovi match nello storico, segnalalo come "NON_TROVATO" con product_id = null
7. Estrai le quantità in modo intelligente (es. "2 forme" = 2, "una decina" = 10)
8. Se la quantità non è specificata, usa 1 come default

LIVELLI DI CONFIDENCE:
- ALTA: Match esatto o quasi esatto del nome prodotto (>90% sicurezza)
- MEDIA: Match parziale ma ragionevole (60-90% sicurezza)
- BASSA: Match incerto, potrebbero esserci alternative (<60% sicurezza)
- NON_TROVATO: Nessun prodotto nello storico corrisponde alla richiesta

FORMATO OUTPUT (JSON VALIDO):
{
  "matches": [
    {
      "richiesta_originale": "testo estratto dal messaggio che descrive il prodotto",
      "quantita": numero (intero positivo),
      "product_id": numero o null,
      "product_name": "nome prodotto completo" o null,
      "confidence": "ALTA" | "MEDIA" | "BASSA" | "NON_TROVATO",
      "reasoning": "spiegazione breve e chiara del match (max 100 caratteri)"
    }
  ],
  "note_generali": "eventuali note, ambiguità o suggerimenti per il venditore"
}

IMPORTANTE:
- Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo
- Assicurati che il JSON sia valido e ben formattato
- Se il messaggio non contiene richieste di prodotti chiare, restituisci un array matches vuoto
- Sii preciso nelle quantità estratte
- Nel reasoning, spiega brevemente perché hai scelto quel prodotto`;
}

/**
 * Fetch product images and stock from Odoo
 */
async function enrichMatchesWithImages(cookies: string | null, matches: ProductMatch[]): Promise<ProductMatch[]> {
  console.log('📍 STEP 5: Fetching product data (images & stock) from Odoo...');

  // Get all product IDs that were found
  const productIds = matches
    .filter((m) => m.product_id !== null)
    .map((m) => m.product_id as number);

  if (productIds.length === 0) {
    console.log('⚠️ No products to fetch data for');
    return matches;
  }

  try {
    // Fetch product data with images, stock, uom, and incoming qty
    const products = await callOdoo(cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', 'in', productIds]],
        fields: ['id', 'image_128', 'qty_available', 'uom_id', 'incoming_qty'],
        limit: productIds.length,
      }
    );

    console.log(`✅ Fetched data for ${products?.length || 0} products`);

    // Fetch incoming stock moves to get expected arrival dates
    let incomingDates: Map<number, string> = new Map();
    if (productIds.length > 0) {
      const stockMoves = await callOdoo(
        cookies,
        'stock.move',
        'search_read',
        [],
        {
          domain: [
            ['product_id', 'in', productIds],
            ['state', 'in', ['waiting', 'confirmed', 'assigned']],
            ['picking_code', '=', 'incoming'],
          ],
          fields: ['product_id', 'date', 'date_deadline'],
          order: 'date ASC',
          limit: 500,
        }
      );

      console.log(`📅 Found ${stockMoves?.length || 0} incoming stock moves`);

      stockMoves?.forEach((move: any) => {
        const productId = Array.isArray(move.product_id) ? move.product_id[0] : move.product_id;
        const arrivalDate = move.date || move.date_deadline;
        if (arrivalDate && !incomingDates.has(productId)) {
          incomingDates.set(productId, arrivalDate);
        }
      });

      console.log(`✅ Mapped arrival dates for ${incomingDates.size} products`);
    }

    // Create a map of product_id to product data
    const productDataMap = new Map<number, {
      image_url: string | null;
      qty_available: number;
      uom_name: string;
      incoming_qty: number;
      incoming_date: string | null;
    }>();
    products?.forEach((product: any) => {
      productDataMap.set(product.id, {
        image_url: product.image_128 ? `data:image/png;base64,${product.image_128}` : null,
        qty_available: product.qty_available || 0,
        uom_name: product.uom_id && Array.isArray(product.uom_id) ? product.uom_id[1] : '',
        incoming_qty: product.incoming_qty || 0,
        incoming_date: incomingDates.get(product.id) || null,
      });
    });

    // Enrich matches with product data
    return matches.map((match) => {
      if (match.product_id && productDataMap.has(match.product_id)) {
        const data = productDataMap.get(match.product_id)!;
        return {
          ...match,
          image_url: data.image_url,
          qty_available: data.qty_available,
          uom_name: data.uom_name,
          incoming_qty: data.incoming_qty,
          incoming_date: data.incoming_date,
        };
      }
      return {
        ...match,
        image_url: null,
        qty_available: 0,
        uom_name: '',
        incoming_qty: 0,
        incoming_date: null,
      };
    });
  } catch (error) {
    console.error('⚠️ Error fetching product data:', error);
    // Return matches without data if fetch fails
    return matches.map((m) => ({
      ...m,
      image_url: null,
      qty_available: 0,
      uom_name: '',
      incoming_qty: 0,
      incoming_date: null,
    }));
  }
}

/**
 * Call Claude AI for product matching
 */
async function matchProductsWithAI(
  customer: any,
  productHistory: CustomerHistoryProduct[],
  message: string,
  messageType: string
): Promise<AIMatchingResult> {
  console.log('📍 STEP 4: AI Product Matching...');

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = buildAIPrompt(customer, productHistory, message, messageType);

  const aiResponse = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.3, // Lower temperature for more consistent matching
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const aiContent = aiResponse.content[0];

  if (aiContent.type !== 'text') {
    throw new Error('AI response is not text');
  }

  // Extract JSON from response
  const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('AI response without JSON:', aiContent.text);
    throw new Error('AI did not return valid JSON. Raw response: ' + aiContent.text.substring(0, 200));
  }

  let aiResult: AIMatchingResult;
  try {
    aiResult = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('JSON string:', jsonMatch[0]);
    throw new Error('Failed to parse AI JSON response: ' + parseError);
  }

  // Validate response structure
  if (!aiResult.matches || !Array.isArray(aiResult.matches)) {
    throw new Error('AI response missing matches array');
  }

  console.log('✅ AI Matching completed!');
  console.log(`Found ${aiResult.matches.length} product matches`);

  return aiResult;
}

/**
 * POST /api/catalogo-venditori/ai-process-order
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [AI-PROCESS-ORDER] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    console.log('✅ [AI-PROCESS-ORDER] User authenticated, UID:', uid);

    // Check if request has file (FormData) or JSON
    const contentType = request.headers.get('content-type') || '';
    let customerId: number;
    let messageText: string;
    let messageType: string;

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      console.log('📎 [AI-PROCESS-ORDER] Processing file upload with FormData');
      const formData = await request.formData();

      customerId = parseInt(formData.get('customerId') as string);
      messageType = formData.get('messageType') as string || 'text';
      const file = formData.get('file') as File | null;
      const textMessage = formData.get('message') as string || '';

      if (!customerId || isNaN(customerId)) {
        return NextResponse.json(
          { success: false, error: 'customerId is required and must be a number' },
          { status: 400 }
        );
      }

      if (file) {
        // Extract text from media using Gemini
        console.log(`📁 File received: ${file.name} (${file.type}, ${file.size} bytes)`);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileBase64 = buffer.toString('base64');

        messageText = await extractTextFromMedia(fileBase64, file.type);
        console.log(`✅ [GEMINI→CLAUDE] Text extracted, passing to Claude for product matching`);
      } else if (textMessage) {
        messageText = textMessage;
      } else {
        return NextResponse.json(
          { success: false, error: 'Either file or message text is required' },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON request (existing flow)
      const body: ProcessOrderRequest = await request.json();
      customerId = body.customerId;
      messageText = body.message;
      messageType = body.messageType || 'text';

      if (!customerId || typeof customerId !== 'number') {
        return NextResponse.json(
          { success: false, error: 'customerId is required and must be a number' },
          { status: 400 }
        );
      }

      if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
        return NextResponse.json(
          { success: false,
          error: 'message is required and must be a non-empty string',
        },
        { status: 400 }
        );
      }
    }

    console.log('🤖 [AI-PROCESS-ORDER] Starting AI order processing');
    console.log('👤 Customer ID:', customerId);
    console.log('💬 Message type:', messageType);
    console.log('📝 Message preview:', messageText.substring(0, 100));

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'AI service not configured. Please contact support.',
        },
        { status: 500 }
      );
    }

    // Fetch customer history
    let customer: any;
    let productHistory: CustomerHistoryProduct[];

    try {
      const historyData = await fetchCustomerHistory(cookies, customerId);
      customer = historyData.customer;
      productHistory = historyData.productHistory;
    } catch (odooError: any) {
      console.error('❌ Odoo error:', odooError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch customer data: ' + odooError.message,
          errorType: 'odoo_error',
        },
        { status: 500 }
      );
    }

    // Match products with AI
    let aiResult: AIMatchingResult;

    try {
      aiResult = await matchProductsWithAI(
        customer,
        productHistory,
        messageText,
        messageType
      );
    } catch (aiError: any) {
      console.error('❌ AI error:', aiError);
      return NextResponse.json(
        {
          success: false,
          error: 'AI processing failed: ' + aiError.message,
          errorType: 'ai_error',
        },
        { status: 500 }
      );
    }

    // Enrich matches with product images
    try {
      aiResult.matches = await enrichMatchesWithImages(cookies, aiResult.matches);
    } catch (imageError: any) {
      console.error('⚠️ Warning: Failed to fetch product images:', imageError);
      // Continue without images - not critical
    }

    // Calculate statistics
    const totalMatches = aiResult.matches.length;
    const foundMatches = aiResult.matches.filter((m) => m.product_id !== null).length;
    const highConfidence = aiResult.matches.filter((m) => m.confidence === 'ALTA').length;
    const mediumConfidence = aiResult.matches.filter((m) => m.confidence === 'MEDIA').length;
    const lowConfidence = aiResult.matches.filter((m) => m.confidence === 'BASSA').length;
    const notFound = aiResult.matches.filter((m) => m.confidence === 'NON_TROVATO').length;

    const duration = Date.now() - startTime;

    console.log('✅ [AI-PROCESS-ORDER] Processing completed successfully!');
    console.log(`📊 Stats: ${foundMatches}/${totalMatches} matches found in ${duration}ms`);
    console.log(`📊 Confidence: ALTA=${highConfidence}, MEDIA=${mediumConfidence}, BASSA=${lowConfidence}, NON_TROVATO=${notFound}`);

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        matches: aiResult.matches,
        customer: {
          id: customer.id,
          name: customer.name,
          ref: customer.ref,
          email: customer.email,
          phone: customer.phone,
          city: customer.city,
        },
        note: aiResult.note_generali || '',
        stats: {
          total_matches: totalMatches,
          found_matches: foundMatches,
          not_found: notFound,
          confidence_breakdown: {
            alta: highConfidence,
            media: mediumConfidence,
            bassa: lowConfidence,
            non_trovato: notFound,
          },
          processing_time_ms: duration,
        },
        message_analyzed: messageText,
        message_type: messageType,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ [AI-PROCESS-ORDER] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred',
        errorType: 'unknown_error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        processing_time_ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/catalogo-venditori/ai-process-order
 * Health check and endpoint info
 */
export async function GET(request: NextRequest) {
  try {
    const isConfigured = !!process.env.ANTHROPIC_API_KEY;

    return NextResponse.json(
      {
        success: true,
        endpoint: '/api/catalogo-venditori/ai-process-order',
        description: 'AI-powered order processing endpoint using Claude Sonnet 4',
        version: '1.0.0',
        status: isConfigured ? 'operational' : 'not_configured',
        model: 'claude-sonnet-4-20250514',
        max_duration: 90,
        supported_message_types: ['text', 'audio', 'image', 'pdf', 'document'],
        features: [
          'Customer purchase history analysis (6 months)',
          'Smart fuzzy product matching',
          'Confidence scoring (ALTA/MEDIA/BASSA/NON_TROVATO)',
          'Synonym and variant recognition',
          'Intelligent quantity extraction',
          'Comprehensive error handling',
        ],
        usage: {
          method: 'POST',
          body: {
            customerId: 'number (Odoo partner ID)',
            message: 'string (customer order message)',
            messageType: '"text" | "audio" | "image"',
          },
          response: {
            success: 'boolean',
            matches: 'ProductMatch[]',
            customer: 'CustomerInfo',
            note: 'string',
            stats: 'ProcessingStats',
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Service unavailable',
      },
      { status: 503 }
    );
  }
}
