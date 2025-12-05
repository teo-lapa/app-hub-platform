/**
 * Gemini Video Analysis Service
 * Analyzes control videos to verify products match expected list
 */

import { GoogleGenerativeAI, Part } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY must be set');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export interface ExpectedProduct {
  productId: number;
  productName: string;
  quantity: number;
  unit: string;
  customers: string[];
}

export interface ProductMatch {
  productName: string;
  expectedQuantity: number;
  unit: string;
  seenInVideo: boolean;
  confidence: number; // 0-1
  observations: string;
  timestampSeconds?: number;
}

export interface VideoAnalysisResult {
  success: boolean;
  analysisDate: string;
  videoDurationSeconds: number;
  zoneName: string;
  totalExpectedProducts: number;
  matchedProducts: number;
  unmatchedProducts: number;
  matches: ProductMatch[];
  additionalProductsSeen: string[];
  overallConfidence: number;
  summary: string;
  warnings: string[];
  rawAnalysis?: string;
}

function buildVideoAnalysisPrompt(products: ExpectedProduct[], zoneName: string): string {
  const productList = products.map((p, i) =>
    `${i + 1}. ${p.productName} - Quantità: ${p.quantity} ${p.unit}`
  ).join('\n');

  return `Sei un esperto di controllo qualità per un magazzino alimentare. Stai analizzando un video di controllo picking dalla zona "${zoneName}".

OBIETTIVO: Verifica che i prodotti mostrati nel video corrispondano alla lista dei prodotti attesi.

LISTA PRODOTTI ATTESI (${products.length} prodotti):
${productList}

ISTRUZIONI:
1. Guarda attentamente TUTTO il video dall'inizio alla fine
2. Identifica ogni prodotto visibile (confezioni, etichette, scatole)
3. Per ogni prodotto della lista, indica se lo hai visto nel video
4. Nota qualsiasi prodotto aggiuntivo che appare ma non è nella lista
5. Presta attenzione a:
   - Etichette dei prodotti
   - Codici a barre visibili
   - Nomi sui packaging
   - Quantità visibili (numero di confezioni/cartoni)

FORMATO RISPOSTA (JSON):
{
  "videoDurationEstimate": <durata stimata in secondi>,
  "matches": [
    {
      "productName": "nome prodotto dalla lista",
      "seenInVideo": true/false,
      "confidence": 0.0-1.0,
      "observations": "descrizione di cosa hai visto",
      "timestampSeconds": <secondo approssimativo in cui appare, se visto>
    }
  ],
  "additionalProductsSeen": ["prodotto non in lista 1", "prodotto non in lista 2"],
  "overallConfidence": 0.0-1.0,
  "summary": "Riassunto breve dell'analisi (2-3 frasi)",
  "warnings": ["eventuali problemi o anomalie rilevate"]
}

CRITERI DI CONFIDENZA:
- 0.9-1.0: Prodotto chiaramente visibile, etichetta leggibile
- 0.7-0.89: Prodotto visibile ma etichetta parzialmente leggibile
- 0.5-0.69: Prodotto probabilmente presente ma non chiaro
- 0.3-0.49: Prodotto forse presente, bassa certezza
- 0.0-0.29: Prodotto non visto o non identificabile

IMPORTANTE:
- Sii ONESTO sulla confidenza. Se non vedi chiaramente un prodotto, indica bassa confidenza
- Se il video è sfocato o buio, riportalo nei warnings
- Se non riesci a identificare prodotti, spiega il motivo
- Rispondi SOLO con JSON valido, senza testo aggiuntivo`;
}

export async function analyzeControlVideo(
  videoUrl: string,
  expectedProducts: ExpectedProduct[],
  zoneName: string
): Promise<VideoAnalysisResult> {
  console.log(`[Gemini Video] Analyzing video for zone ${zoneName}, ${expectedProducts.length} expected products`);

  try {
    // Use gemini-1.5-flash for video analysis (supports video input)
    const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });

    // Fetch video and convert to base64
    console.log(`[Gemini Video] Fetching video from: ${videoUrl}`);
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString('base64');
    const contentType = videoResponse.headers.get('content-type') || 'video/webm';

    console.log(`[Gemini Video] Video fetched: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`);

    // Prepare video part for Gemini
    const videoPart: Part = {
      inlineData: {
        data: videoBase64,
        mimeType: contentType,
      },
    };

    const prompt = buildVideoAnalysisPrompt(expectedProducts, zoneName);

    console.log(`[Gemini Video] Sending to Gemini...`);
    const result = await model.generateContent([prompt, videoPart]);
    const response = await result.response;
    const text = response.text();

    console.log(`[Gemini Video] Raw response length: ${text.length}`);

    // Parse JSON from response
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    // Build result
    const matches: ProductMatch[] = (parsed.matches || []).map((m: any) => ({
      productName: m.productName,
      expectedQuantity: expectedProducts.find(p =>
        p.productName.toLowerCase().includes(m.productName.toLowerCase()) ||
        m.productName.toLowerCase().includes(p.productName.toLowerCase())
      )?.quantity || 0,
      unit: expectedProducts.find(p =>
        p.productName.toLowerCase().includes(m.productName.toLowerCase()) ||
        m.productName.toLowerCase().includes(p.productName.toLowerCase())
      )?.unit || 'PZ',
      seenInVideo: m.seenInVideo,
      confidence: m.confidence,
      observations: m.observations,
      timestampSeconds: m.timestampSeconds,
    }));

    const matchedProducts = matches.filter(m => m.seenInVideo && m.confidence >= 0.5).length;

    const analysisResult: VideoAnalysisResult = {
      success: true,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: parsed.videoDurationEstimate || 0,
      zoneName,
      totalExpectedProducts: expectedProducts.length,
      matchedProducts,
      unmatchedProducts: expectedProducts.length - matchedProducts,
      matches,
      additionalProductsSeen: parsed.additionalProductsSeen || [],
      overallConfidence: parsed.overallConfidence || 0,
      summary: parsed.summary || '',
      warnings: parsed.warnings || [],
      rawAnalysis: text,
    };

    console.log(`[Gemini Video] Analysis complete: ${matchedProducts}/${expectedProducts.length} matched, confidence: ${analysisResult.overallConfidence}`);

    return analysisResult;

  } catch (error: any) {
    console.error('[Gemini Video] Error:', error);

    return {
      success: false,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: 0,
      zoneName,
      totalExpectedProducts: expectedProducts.length,
      matchedProducts: 0,
      unmatchedProducts: expectedProducts.length,
      matches: [],
      additionalProductsSeen: [],
      overallConfidence: 0,
      summary: `Errore durante l'analisi: ${error.message}`,
      warnings: [`Errore: ${error.message}`],
    };
  }
}

export async function analyzeControlVideoFromBlob(
  videoBlob: Blob,
  expectedProducts: ExpectedProduct[],
  zoneName: string
): Promise<VideoAnalysisResult> {
  console.log(`[Gemini Video] Analyzing video blob for zone ${zoneName}`);

  try {
    const model = getGenAI().getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert blob to base64
    const arrayBuffer = await videoBlob.arrayBuffer();
    const videoBase64 = Buffer.from(arrayBuffer).toString('base64');

    console.log(`[Gemini Video] Video blob: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB, type: ${videoBlob.type}`);

    const videoPart: Part = {
      inlineData: {
        data: videoBase64,
        mimeType: videoBlob.type || 'video/webm',
      },
    };

    const prompt = buildVideoAnalysisPrompt(expectedProducts, zoneName);

    const result = await model.generateContent([prompt, videoPart]);
    const response = await result.response;
    const text = response.text();

    // Same parsing logic as above...
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    const matches: ProductMatch[] = (parsed.matches || []).map((m: any) => ({
      productName: m.productName,
      expectedQuantity: expectedProducts.find(p =>
        p.productName.toLowerCase().includes(m.productName.toLowerCase()) ||
        m.productName.toLowerCase().includes(p.productName.toLowerCase())
      )?.quantity || 0,
      unit: expectedProducts.find(p =>
        p.productName.toLowerCase().includes(m.productName.toLowerCase()) ||
        m.productName.toLowerCase().includes(p.productName.toLowerCase())
      )?.unit || 'PZ',
      seenInVideo: m.seenInVideo,
      confidence: m.confidence,
      observations: m.observations,
      timestampSeconds: m.timestampSeconds,
    }));

    const matchedProducts = matches.filter(m => m.seenInVideo && m.confidence >= 0.5).length;

    return {
      success: true,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: parsed.videoDurationEstimate || 0,
      zoneName,
      totalExpectedProducts: expectedProducts.length,
      matchedProducts,
      unmatchedProducts: expectedProducts.length - matchedProducts,
      matches,
      additionalProductsSeen: parsed.additionalProductsSeen || [],
      overallConfidence: parsed.overallConfidence || 0,
      summary: parsed.summary || '',
      warnings: parsed.warnings || [],
      rawAnalysis: text,
    };

  } catch (error: any) {
    console.error('[Gemini Video] Error:', error);

    return {
      success: false,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: 0,
      zoneName,
      totalExpectedProducts: expectedProducts.length,
      matchedProducts: 0,
      unmatchedProducts: expectedProducts.length,
      matches: [],
      additionalProductsSeen: [],
      overallConfidence: 0,
      summary: `Errore durante l'analisi: ${error.message}`,
      warnings: [`Errore: ${error.message}`],
    };
  }
}
