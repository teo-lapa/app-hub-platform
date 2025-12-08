/**
 * Multi-Agent Inventory Video Analysis Service
 *
 * Architecture:
 * - AGENT 1 (Gemini 2.0 Flash): Extracts raw product data from video
 * - AGENT 2 (Claude Haiku): Normalizes and cleans extracted data
 * - AGENT 3 (Claude Sonnet): Performs fuzzy matching with expected products
 */

import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// API Keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let anthropic: Anthropic | null = null;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY must be set');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

function getAnthropic() {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY must be set');
  }
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropic;
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Product extracted from video by Gemini (Agent 1)
 */
export interface InventoryProduct {
  productName: string;
  quantity: number;
  weight?: number;
  uom: string;           // Unit of Measure (KG, PZ, LT, etc.)
  lotNumber?: string;
  expiryDate?: string;   // ISO format or text
  barcode?: string;
  confidence: number;    // 0-1
  timestampSeconds?: number;
  observations?: string;
}

/**
 * Expected product from Odoo
 */
export interface OdooProduct {
  productId: number;
  productName: string;
  expectedQuantity: number;
  uom: string;
  barcode?: string;
  lotNumber?: string;
  expiryDate?: string;
}

/**
 * Normalized product after Agent 2 processing
 */
export interface NormalizedProduct {
  originalName: string;
  cleanedName: string;
  quantity: number;
  weight?: number;
  uom: string;           // Standardized (kg, pz, lt, etc.)
  lotNumber?: string;
  expiryDate?: string;   // ISO format
  barcode?: string;
  confidence: number;
  corrections: string[]; // List of corrections made
  timestampSeconds?: number;
}

/**
 * Match result between extracted and expected product (Agent 3)
 */
export interface InventoryMatchResult {
  odooProductId: number;
  odooProductName: string;
  extractedProductName?: string;
  matched: boolean;
  matchConfidence: number;  // 0-1
  matchReason: string;
  expectedQuantity: number;
  actualQuantity?: number;
  quantityDifference?: number;
  expectedUom: string;
  actualUom?: string;
  uomCompatible: boolean;
  lotMatch?: boolean;
  expiryMatch?: boolean;
  barcodeMatch?: boolean;
  warnings: string[];
}

/**
 * Final analysis result
 */
export interface InventoryAnalysisResult {
  success: boolean;
  analysisDate: string;
  videoDurationSeconds: number;
  locationName: string;

  // Agent 1 - Extraction
  extractedProducts: InventoryProduct[];
  extractionConfidence: number;

  // Agent 2 - Normalization
  normalizedProducts: NormalizedProduct[];
  normalizationStats: {
    totalCorrections: number;
    ocrErrors: number;
    uomStandardizations: number;
    nameCleanups: number;
  };

  // Agent 3 - Matching
  matches: InventoryMatchResult[];
  totalExpectedProducts: number;
  totalMatchedProducts: number;
  totalUnmatchedProducts: number;
  totalExtraProducts: number;
  matchingConfidence: number;

  // Summary
  summary: string;
  warnings: string[];
  errors: string[];

  // Raw data for debugging
  rawExtractionResponse?: string;
  rawNormalizationResponse?: string;
  rawMatchingResponse?: string;
}

// ============================================================================
// AGENT 1 - GEMINI EXTRACTION
// ============================================================================

function buildExtractionPrompt(locationName: string): string {
  return `Sei un esperto AI specializzato nell'estrazione di dati da video di inventario per magazzini alimentari.

CONTESTO: Stai analizzando un video di inventario dalla location "${locationName}".

OBIETTIVO: Estrai TUTTI i prodotti visibili nel video con i seguenti dettagli:
- Nome del prodotto (come appare sull'etichetta/confezione)
- Quantità (numero di unità/pezzi)
- Peso (se visibile, in kg o g)
- Unità di misura (KG, G, PZ, LT, ML, CONF, SCATOLA, etc.)
- Numero di lotto (se visibile)
- Data di scadenza (se visibile)
- Codice a barre (se leggibile)

ISTRUZIONI:
1. Guarda TUTTO il video dall'inizio alla fine
2. Per ogni prodotto visibile:
   - Leggi etichette, packaging, codici a barre
   - Conta il numero di unità/confezioni
   - Identifica peso se indicato
   - Cerca lotto e scadenza
3. Se un dato non è visibile/leggibile, ometti quel campo
4. Presta PARTICOLARE attenzione a:
   - Errori OCR comuni (0/O, 1/I, 5/S, 8/B, etc.)
   - Unità di misura scritte in modi diversi (kg/KG/Kg, pz/PZ/pezzi)
   - Date in formati diversi (DD/MM/YYYY, YYYY-MM-DD, etc.)

FORMATO RISPOSTA (JSON):
{
  "videoDurationEstimate": <durata in secondi>,
  "products": [
    {
      "productName": "nome esatto come appare",
      "quantity": <numero>,
      "weight": <numero opzionale>,
      "uom": "unità di misura",
      "lotNumber": "lotto opzionale",
      "expiryDate": "scadenza opzionale",
      "barcode": "barcode opzionale",
      "confidence": 0.0-1.0,
      "timestampSeconds": <quando appare>,
      "observations": "note su cosa hai visto"
    }
  ],
  "overallConfidence": 0.0-1.0,
  "warnings": ["eventuali problemi di lettura"]
}

CRITERI DI CONFIDENZA:
- 0.9-1.0: Tutti i dati chiaramente leggibili
- 0.7-0.89: Maggior parte dati leggibili, qualche incertezza
- 0.5-0.69: Dati parzialmente leggibili
- 0.3-0.49: Molti dati incerti
- 0.0-0.29: Prodotto visibile ma dati non leggibili

IMPORTANTE:
- Sii PRECISO nell'OCR. Se un carattere non è chiaro, riportalo nelle observations
- NON inventare dati. Se non vedi qualcosa, non includerlo
- Rispondi SOLO con JSON valido, senza testo aggiuntivo`;
}

async function agent1ExtractFromVideo(
  videoUrl: string,
  locationName: string
): Promise<{ products: InventoryProduct[], videoDuration: number, confidence: number, warnings: string[], rawResponse: string }> {
  console.log(`[Agent 1 - Gemini Extraction] Starting extraction for location: ${locationName}`);

  const model = getGenAI().getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  // Fetch video
  console.log(`[Agent 1] Fetching video from: ${videoUrl}`);
  const videoResponse = await fetch(videoUrl);

  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  const videoBase64 = Buffer.from(videoBuffer).toString('base64');
  const contentType = videoResponse.headers.get('content-type') || 'video/webm';

  console.log(`[Agent 1] Video fetched: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`);

  const videoPart: Part = {
    inlineData: {
      data: videoBase64,
      mimeType: contentType,
    },
  };

  const prompt = buildExtractionPrompt(locationName);

  console.log(`[Agent 1] Sending to Gemini 2.0 Flash...`);
  const result = await model.generateContent([prompt, videoPart]);
  const response = await result.response;
  const text = response.text();

  console.log(`[Agent 1] Raw response length: ${text.length}`);

  // Parse JSON
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  const products: InventoryProduct[] = (parsed.products || []).map((p: any) => ({
    productName: p.productName,
    quantity: p.quantity || 0,
    weight: p.weight,
    uom: p.uom || 'PZ',
    lotNumber: p.lotNumber,
    expiryDate: p.expiryDate,
    barcode: p.barcode,
    confidence: p.confidence || 0,
    timestampSeconds: p.timestampSeconds,
    observations: p.observations,
  }));

  console.log(`[Agent 1] Extraction complete: ${products.length} products found`);

  return {
    products,
    videoDuration: parsed.videoDurationEstimate || 0,
    confidence: parsed.overallConfidence || 0,
    warnings: parsed.warnings || [],
    rawResponse: text,
  };
}

// ============================================================================
// AGENT 2 - CLAUDE HAIKU NORMALIZATION
// ============================================================================

function buildNormalizationPrompt(products: InventoryProduct[]): string {
  const productList = products.map((p, i) =>
    `${i + 1}. ${p.productName} - ${p.quantity} ${p.uom}${p.weight ? ` (${p.weight}kg)` : ''}${p.lotNumber ? ` [Lotto: ${p.lotNumber}]` : ''}${p.expiryDate ? ` [Scad: ${p.expiryDate}]` : ''}${p.barcode ? ` [BC: ${p.barcode}]` : ''}`
  ).join('\n');

  return `Sei un esperto in normalizzazione dati per sistemi di inventario alimentare.

OBIETTIVO: Correggi errori OCR, standardizza unità di misura e pulisci i nomi dei prodotti estratti da un video.

PRODOTTI ESTRATTI (${products.length}):
${productList}

REGOLE DI NORMALIZZAZIONE:

1. CORREZIONE OCR:
   - 0 vs O: usa contesto (n0me → nome, 100g → 100g)
   - 1 vs I vs l: usa contesto (1kg → 1kg, Italla → Italia)
   - 5 vs S: usa contesto (5kg → 5kg, ca5a → casa)
   - 8 vs B: usa contesto (8pz → 8pz, 8anana → Banana)
   - 6 vs G: usa contesto
   - 2 vs Z: usa contesto

2. STANDARDIZZAZIONE UNITÀ DI MISURA:
   - Peso: KG/Kg/kg/KILO → "kg", G/GR/GRAMMI → "g"
   - Pezzi: PZ/PCE/PC/PEZZI/PEZZO → "pz"
   - Litri: LT/L/LITRI → "lt"
   - Millilitri: ML/MILLILITRI → "ml"
   - Confezioni: CONF/CONFEZIONE → "conf"
   - Scatole: SCATOLA/SCATOLE/BOX → "scatola"

3. PULIZIA NOMI PRODOTTI:
   - Rimuovi spazi multipli
   - Capitalizza prima lettera di ogni parola importante
   - Mantieni maiuscole per sigle (DOP, IGP, BIO, etc.)
   - Rimuovi caratteri speciali non necessari

4. DATE:
   - Converti tutte le date in formato ISO (YYYY-MM-DD)
   - Formati comuni: DD/MM/YYYY, DD-MM-YY, DDMMYY

5. PESO vs QUANTITÀ:
   - Se weight è presente e uom è "kg", weight dovrebbe essere il valore numerico
   - Esempio: "1 KG" → quantity=1, weight=1, uom="kg"
   - Esempio: "500g" → quantity=1, weight=0.5, uom="kg"

FORMATO RISPOSTA (JSON):
{
  "normalizedProducts": [
    {
      "originalName": "nome originale",
      "cleanedName": "Nome Pulito",
      "quantity": <numero>,
      "weight": <numero opzionale>,
      "uom": "unità standardizzata",
      "lotNumber": "lotto pulito",
      "expiryDate": "YYYY-MM-DD",
      "barcode": "barcode",
      "confidence": 0.0-1.0,
      "corrections": ["descrizione correzione 1", "correzione 2"],
      "timestampSeconds": <timestamp>
    }
  ],
  "stats": {
    "totalCorrections": <numero>,
    "ocrErrors": <numero errori OCR corretti>,
    "uomStandardizations": <numero UoM standardizzate>,
    "nameCleanups": <numero nomi puliti>
  }
}

IMPORTANTE:
- Mantieni la confidence originale se non ci sono problemi
- Riduci confidence se hai dovuto fare molte correzioni
- Spiega ogni correzione nella lista "corrections"
- Rispondi SOLO con JSON valido`;
}

async function agent2NormalizeProducts(
  products: InventoryProduct[]
): Promise<{ normalized: NormalizedProduct[], stats: any, rawResponse: string }> {
  console.log(`[Agent 2 - Claude Haiku Normalization] Starting normalization for ${products.length} products`);

  const client = getAnthropic();
  const prompt = buildNormalizationPrompt(products);

  console.log(`[Agent 2] Sending to Claude Haiku...`);
  const message = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const text = content.text;
  console.log(`[Agent 2] Raw response length: ${text.length}`);

  // Parse JSON
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  const normalized: NormalizedProduct[] = (parsed.normalizedProducts || []).map((p: any) => ({
    originalName: p.originalName,
    cleanedName: p.cleanedName,
    quantity: p.quantity || 0,
    weight: p.weight,
    uom: p.uom || 'pz',
    lotNumber: p.lotNumber,
    expiryDate: p.expiryDate,
    barcode: p.barcode,
    confidence: p.confidence || 0,
    corrections: p.corrections || [],
    timestampSeconds: p.timestampSeconds,
  }));

  console.log(`[Agent 2] Normalization complete: ${parsed.stats.totalCorrections} corrections made`);

  return {
    normalized,
    stats: parsed.stats || { totalCorrections: 0, ocrErrors: 0, uomStandardizations: 0, nameCleanups: 0 },
    rawResponse: text,
  };
}

// ============================================================================
// AGENT 3 - CLAUDE SONNET MATCHING
// ============================================================================

function buildMatchingPrompt(
  normalizedProducts: NormalizedProduct[],
  expectedProducts: OdooProduct[]
): string {
  const extractedList = normalizedProducts.map((p, i) =>
    `${i + 1}. ${p.cleanedName} - ${p.quantity} ${p.uom}${p.weight ? ` (${p.weight}kg)` : ''}${p.lotNumber ? ` [Lotto: ${p.lotNumber}]` : ''}${p.expiryDate ? ` [Scad: ${p.expiryDate}]` : ''}${p.barcode ? ` [BC: ${p.barcode}]` : ''} (confidence: ${p.confidence})`
  ).join('\n');

  const expectedList = expectedProducts.map((p, i) =>
    `${i + 1}. [ID: ${p.productId}] ${p.productName} - ${p.expectedQuantity} ${p.uom}${p.lotNumber ? ` [Lotto: ${p.lotNumber}]` : ''}${p.expiryDate ? ` [Scad: ${p.expiryDate}]` : ''}${p.barcode ? ` [BC: ${p.barcode}]` : ''}`
  ).join('\n');

  return `Sei un esperto in matching di prodotti per sistemi di inventario alimentare.

OBIETTIVO: Fai il match tra i prodotti estratti dal video e i prodotti attesi da Odoo.

PRODOTTI ESTRATTI DAL VIDEO (${normalizedProducts.length}):
${extractedList}

PRODOTTI ATTESI DA ODOO (${expectedProducts.length}):
${expectedList}

ISTRUZIONI:

1. FUZZY MATCHING SUI NOMI:
   - Match esatto: 100% confidence
   - Match parziale: considera sinonimi, abbreviazioni, varianti
   - Esempi:
     * "Pomodoro Pelato" ↔ "Pomodori Pelati DOP" → MATCH
     * "Olio EVO 1L" ↔ "Olio Extravergine Oliva" → MATCH
     * "Pasta Penne" ↔ "Penne Rigate" → MATCH
   - Non matchare prodotti completamente diversi

2. COMPATIBILITÀ UNITÀ DI MISURA:
   - kg ↔ g: compatibili (controlla conversione)
   - lt ↔ ml: compatibili (controlla conversione)
   - pz ↔ conf: potrebbero essere compatibili (verifica contesto)
   - Segnala se UoM sono incompatibili

3. CALCOLO DIFFERENZE:
   - Confronta quantità attese vs trovate
   - Se UoM diverse, converti prima (1kg = 1000g, 1lt = 1000ml)
   - Differenza = quantità_trovata - quantità_attesa

4. VERIFICA LOTTO E SCADENZA:
   - Se entrambi presenti, devono matchare
   - Se mancante in uno dei due, non penalizzare

5. VERIFICA BARCODE:
   - Se entrambi presenti, devono matchare esattamente
   - Match barcode = alta confidence

FORMATO RISPOSTA (JSON):
{
  "matches": [
    {
      "odooProductId": <ID>,
      "odooProductName": "nome Odoo",
      "extractedProductName": "nome estratto o null",
      "matched": true/false,
      "matchConfidence": 0.0-1.0,
      "matchReason": "spiegazione del match/non-match",
      "expectedQuantity": <numero>,
      "actualQuantity": <numero o null>,
      "quantityDifference": <differenza o null>,
      "expectedUom": "uom",
      "actualUom": "uom o null",
      "uomCompatible": true/false,
      "lotMatch": true/false/null,
      "expiryMatch": true/false/null,
      "barcodeMatch": true/false/null,
      "warnings": ["warning 1", "warning 2"]
    }
  ],
  "summary": {
    "totalExpected": <numero>,
    "totalMatched": <numero>,
    "totalUnmatched": <numero>,
    "totalExtra": <numero estratti ma non attesi>,
    "overallConfidence": 0.0-1.0
  },
  "extraProducts": [
    "prodotti estratti che non matchano con nessun prodotto atteso"
  ]
}

CRITERI DI CONFIDENZA MATCHING:
- 1.0: Match esatto nome + barcode
- 0.9: Match esatto nome
- 0.8: Match forte nome + UoM compatibile
- 0.7: Match parziale nome + UoM compatibile
- 0.6: Match debole nome
- <0.5: Non considerare matched

IMPORTANTE:
- Un prodotto estratto può matchare al massimo UN prodotto Odoo
- Preferisci match con barcode se disponibile
- Spiega sempre il motivo del match/non-match
- Rispondi SOLO con JSON valido`;
}

async function agent3MatchProducts(
  normalizedProducts: NormalizedProduct[],
  expectedProducts: OdooProduct[]
): Promise<{ matches: InventoryMatchResult[], summary: any, extraProducts: string[], rawResponse: string }> {
  console.log(`[Agent 3 - Claude Sonnet Matching] Matching ${normalizedProducts.length} extracted with ${expectedProducts.length} expected products`);

  const client = getAnthropic();
  const prompt = buildMatchingPrompt(normalizedProducts, expectedProducts);

  console.log(`[Agent 3] Sending to Claude Sonnet 3.5...`);
  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const text = content.text;
  console.log(`[Agent 3] Raw response length: ${text.length}`);

  // Parse JSON
  let jsonText = text.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  const matches: InventoryMatchResult[] = (parsed.matches || []).map((m: any) => ({
    odooProductId: m.odooProductId,
    odooProductName: m.odooProductName,
    extractedProductName: m.extractedProductName,
    matched: m.matched,
    matchConfidence: m.matchConfidence || 0,
    matchReason: m.matchReason || '',
    expectedQuantity: m.expectedQuantity || 0,
    actualQuantity: m.actualQuantity,
    quantityDifference: m.quantityDifference,
    expectedUom: m.expectedUom || '',
    actualUom: m.actualUom,
    uomCompatible: m.uomCompatible || false,
    lotMatch: m.lotMatch,
    expiryMatch: m.expiryMatch,
    barcodeMatch: m.barcodeMatch,
    warnings: m.warnings || [],
  }));

  console.log(`[Agent 3] Matching complete: ${parsed.summary.totalMatched}/${parsed.summary.totalExpected} matched`);

  return {
    matches,
    summary: parsed.summary || { totalExpected: 0, totalMatched: 0, totalUnmatched: 0, totalExtra: 0, overallConfidence: 0 },
    extraProducts: parsed.extraProducts || [],
    rawResponse: text,
  };
}

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Analyzes inventory video using multi-agent architecture
 *
 * @param videoUrl - URL of the video to analyze
 * @param expectedProducts - List of expected products from Odoo
 * @param locationName - Name of the warehouse location
 * @returns Complete analysis result with extraction, normalization, and matching
 */
export async function analyzeInventoryVideo(
  videoUrl: string,
  expectedProducts: OdooProduct[],
  locationName: string
): Promise<InventoryAnalysisResult> {
  console.log(`\n========================================`);
  console.log(`MULTI-AGENT INVENTORY ANALYSIS STARTED`);
  console.log(`Location: ${locationName}`);
  console.log(`Expected products: ${expectedProducts.length}`);
  console.log(`Video: ${videoUrl}`);
  console.log(`========================================\n`);

  try {
    // AGENT 1: Extract products from video using Gemini
    console.log(`\n--- AGENT 1: GEMINI EXTRACTION ---`);
    const extractionResult = await agent1ExtractFromVideo(videoUrl, locationName);
    console.log(`Extracted ${extractionResult.products.length} products with confidence ${extractionResult.confidence}`);

    if (extractionResult.products.length === 0) {
      return {
        success: false,
        analysisDate: new Date().toISOString(),
        videoDurationSeconds: extractionResult.videoDuration,
        locationName,
        extractedProducts: [],
        extractionConfidence: extractionResult.confidence,
        normalizedProducts: [],
        normalizationStats: { totalCorrections: 0, ocrErrors: 0, uomStandardizations: 0, nameCleanups: 0 },
        matches: [],
        totalExpectedProducts: expectedProducts.length,
        totalMatchedProducts: 0,
        totalUnmatchedProducts: expectedProducts.length,
        totalExtraProducts: 0,
        matchingConfidence: 0,
        summary: 'Nessun prodotto estratto dal video',
        warnings: extractionResult.warnings,
        errors: ['Nessun prodotto rilevato nel video'],
        rawExtractionResponse: extractionResult.rawResponse,
      };
    }

    // AGENT 2: Normalize extracted products using Claude Haiku
    console.log(`\n--- AGENT 2: CLAUDE HAIKU NORMALIZATION ---`);
    const normalizationResult = await agent2NormalizeProducts(extractionResult.products);
    console.log(`Normalized ${normalizationResult.normalized.length} products, ${normalizationResult.stats.totalCorrections} corrections made`);

    // AGENT 3: Match with expected products using Claude Sonnet
    console.log(`\n--- AGENT 3: CLAUDE SONNET MATCHING ---`);
    const matchingResult = await agent3MatchProducts(
      normalizationResult.normalized,
      expectedProducts
    );
    console.log(`Matching complete: ${matchingResult.summary.totalMatched}/${matchingResult.summary.totalExpected} products matched`);

    // Build final result
    const warnings: string[] = [
      ...extractionResult.warnings,
      ...matchingResult.matches.flatMap(m => m.warnings),
    ];

    const errors: string[] = [];
    if (matchingResult.summary.totalUnmatched > 0) {
      errors.push(`${matchingResult.summary.totalUnmatched} prodotti attesi non trovati nel video`);
    }
    if (matchingResult.summary.totalExtra > 0) {
      warnings.push(`${matchingResult.summary.totalExtra} prodotti extra trovati nel video`);
    }

    const result: InventoryAnalysisResult = {
      success: true,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: extractionResult.videoDuration,
      locationName,

      extractedProducts: extractionResult.products,
      extractionConfidence: extractionResult.confidence,

      normalizedProducts: normalizationResult.normalized,
      normalizationStats: normalizationResult.stats,

      matches: matchingResult.matches,
      totalExpectedProducts: matchingResult.summary.totalExpected,
      totalMatchedProducts: matchingResult.summary.totalMatched,
      totalUnmatchedProducts: matchingResult.summary.totalUnmatched,
      totalExtraProducts: matchingResult.summary.totalExtra,
      matchingConfidence: matchingResult.summary.overallConfidence,

      summary: generateSummary(matchingResult, normalizationResult.stats),
      warnings,
      errors,

      rawExtractionResponse: extractionResult.rawResponse,
      rawNormalizationResponse: normalizationResult.rawResponse,
      rawMatchingResponse: matchingResult.rawResponse,
    };

    console.log(`\n========================================`);
    console.log(`ANALYSIS COMPLETE`);
    console.log(`Success: ${result.success}`);
    console.log(`Matched: ${result.totalMatchedProducts}/${result.totalExpectedProducts}`);
    console.log(`Confidence: ${result.matchingConfidence.toFixed(2)}`);
    console.log(`========================================\n`);

    return result;

  } catch (error: any) {
    console.error('[Multi-Agent Analysis] Error:', error);

    return {
      success: false,
      analysisDate: new Date().toISOString(),
      videoDurationSeconds: 0,
      locationName,
      extractedProducts: [],
      extractionConfidence: 0,
      normalizedProducts: [],
      normalizationStats: { totalCorrections: 0, ocrErrors: 0, uomStandardizations: 0, nameCleanups: 0 },
      matches: [],
      totalExpectedProducts: expectedProducts.length,
      totalMatchedProducts: 0,
      totalUnmatchedProducts: expectedProducts.length,
      totalExtraProducts: 0,
      matchingConfidence: 0,
      summary: `Errore durante l'analisi: ${error.message}`,
      warnings: [],
      errors: [error.message],
    };
  }
}

function generateSummary(matchingResult: any, normStats: any): string {
  const { totalExpected, totalMatched, totalUnmatched, totalExtra, overallConfidence } = matchingResult.summary;

  let summary = `Analisi completata: ${totalMatched}/${totalExpected} prodotti matchati (${(totalMatched / totalExpected * 100).toFixed(0)}%). `;

  if (totalUnmatched > 0) {
    summary += `${totalUnmatched} prodotti attesi non trovati. `;
  }

  if (totalExtra > 0) {
    summary += `${totalExtra} prodotti extra rilevati. `;
  }

  summary += `Normalizzazione: ${normStats.totalCorrections} correzioni effettuate. `;
  summary += `Confidenza complessiva: ${(overallConfidence * 100).toFixed(0)}%.`;

  return summary;
}
