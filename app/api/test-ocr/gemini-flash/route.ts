import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Pricing per Gemini 2.5 Flash (per 1M tokens)
const PRICING = {
  input: 0.019, // $0.019 per 1M input tokens
  output: 0.075, // $0.075 per 1M output tokens
  image_per_page: 258, // tokens per page estimate
};

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nessun file caricato' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo file PDF sono supportati' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File troppo grande (max 10MB)' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Prepare the file part for Gemini
    const filePart = {
      inlineData: {
        data: base64,
        mimeType: 'application/pdf',
      },
    };

    // PROMPT 1: Raw Text Extraction
    const rawPrompt = `Estrai tutto il testo da questo documento PDF.
Mantieni la struttura originale quanto possibile.
Non aggiungere interpretazioni, solo il testo visibile.
Preserva interruzioni di riga e spaziature importanti.`;

    // PROMPT 2: Markdown Structured
    const markdownPrompt = `Analizza questo documento e crea una versione Markdown ben strutturata.

Identifica e formatta:
- Titolo e tipo documento (usa # heading)
- Intestazione/fornitore (usa **bold**)
- Dati principali (numero documento, data, ecc.)
- Tabelle prodotti (usa formato tabella markdown se presente)
- Totali e note finali

Usa heading, liste, tabelle markdown e formattazione appropriata.
Mantieni leggibilità e struttura logica.`;

    // PROMPT 3: JSON Structured
    const jsonPrompt = `Analizza questo documento commerciale (fattura/DDT/ordine) ed estrai i dati in formato JSON strutturato.

Restituisci un JSON valido con questa struttura:

{
  "document_type": "invoice|delivery_note|order|quote|receipt|other",
  "supplier": {
    "name": "Nome fornitore completo",
    "address": "Indirizzo se presente",
    "vat": "Partita IVA se presente",
    "email": "Email se presente",
    "phone": "Telefono se presente"
  },
  "customer": {
    "name": "Nome cliente se presente",
    "address": "Indirizzo cliente se presente"
  },
  "document_number": "Numero documento",
  "document_date": "YYYY-MM-DD",
  "products": [
    {
      "code": "Codice prodotto se presente",
      "name": "Nome prodotto",
      "description": "Descrizione aggiuntiva",
      "quantity": 0,
      "unit": "kg|pz|lt|ct|nr",
      "price_per_unit": 0,
      "total": 0,
      "batch": "Lotto se presente",
      "expiry_date": "YYYY-MM-DD se presente"
    }
  ],
  "subtotal": 0,
  "tax": 0,
  "tax_rate": 0,
  "total": 0,
  "payment_terms": "Condizioni di pagamento se presenti",
  "notes": "Note o annotazioni aggiuntive"
}

IMPORTANTE:
- Usa null per campi non trovati
- Converti date in formato YYYY-MM-DD
- Usa numeri (non stringhe) per quantità e prezzi
- Se ci sono più pagine/documenti, unisci i prodotti
- Rispondi SOLO con JSON valido, niente testo prima o dopo`;

    // Execute all 3 prompts in parallel
    const [rawResult, markdownResult, jsonResult] = await Promise.all([
      model.generateContent([rawPrompt, filePart]),
      model.generateContent([markdownPrompt, filePart]),
      model.generateContent([jsonPrompt, filePart]),
    ]);

    const rawText = rawResult.response.text();
    const markdownText = markdownResult.response.text();
    let jsonText = jsonResult.response.text();

    // Clean JSON response (remove markdown code blocks if present)
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (e) {
      parsedJson = { error: 'Failed to parse JSON', raw: jsonText };
    }

    // Calculate metrics
    const duration_ms = Date.now() - startTime;

    // Estimate tokens (rough calculation)
    const estimatedInputTokens = PRICING.image_per_page * 2; // assume ~2 pages average
    const estimatedOutputTokens =
      rawText.length / 4 + markdownText.length / 4 + jsonText.length / 4;

    const estimated_cost_usd =
      (estimatedInputTokens / 1_000_000) * PRICING.input * 3 + // 3 calls
      (estimatedOutputTokens / 1_000_000) * PRICING.output;

    return NextResponse.json({
      success: true,
      raw_text: rawText,
      markdown: markdownText,
      json: parsedJson,
      metrics: {
        duration_ms,
        estimated_cost_usd,
        model: 'gemini-2.0-flash-exp',
        file_size_bytes: file.size,
        file_name: file.name,
      },
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Errore durante l\'elaborazione',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
