/**
 * API SPESE - Analisi Scontrino con Gemini Vision
 *
 * POST /api/spese/analyze
 * - Riceve immagine scontrino (base64 o file)
 * - Usa Gemini 2.5 Flash per estrarre:
 *   - Negozio/Fornitore
 *   - Data scontrino
 *   - Totale
 *   - IVA
 *   - Elenco prodotti
 *   - Categoria spesa (carburante, cibo, ecc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

// Lazy initialization
let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY must be set');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

export interface ReceiptAnalysis {
  // Info negozio
  storeName: string;
  storeAddress?: string;

  // Data e ora
  date: string; // formato YYYY-MM-DD
  time?: string;

  // Importi
  totalAmount: number;
  currency: string;
  vatAmount?: number;
  vatRate?: string; // es. "8.1%"
  subtotal?: number;

  // Categoria automatica
  category: 'carburante' | 'cibo' | 'trasporto' | 'alloggio' | 'materiale' | 'altro';
  categoryConfidence: number;

  // Dettaglio prodotti
  items: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
  }>;

  // Metadati
  rawText?: string;
  confidence: number;
  paymentMethod?: string; // carta, contanti, ecc.
}

const RECEIPT_ANALYSIS_PROMPT = `
Sei un esperto nell'analisi di scontrini e ricevute svizzere e italiane.

Analizza questa immagine di scontrino/ricevuta ed estrai TUTTI i dati in formato JSON strutturato.

REGOLE IMPORTANTI:
1. CATEGORIA: Identifica automaticamente la categoria della spesa:
   - "carburante" = benzina, diesel, gasolio, GPL, stazioni di servizio (Shell, Eni, Q8, Agip, Coop Pronto, Migrol, etc.)
   - "cibo" = ristoranti, supermercati, bar, alimentari, fast food
   - "trasporto" = taxi, treno, bus, parcheggio, autostrada, pedaggi
   - "alloggio" = hotel, B&B, Airbnb
   - "materiale" = ferramenta, ufficio, elettronica
   - "altro" = tutto il resto

2. IMPORTI:
   - Estrai il TOTALE PAGATO (quello finale, dopo sconti e IVA)
   - Se presente, estrai l'IVA separatamente
   - Valuta: CHF per Svizzera, EUR per Italia

3. DATA:
   - Converti sempre in formato YYYY-MM-DD
   - Se l'anno non è presente, usa l'anno corrente (2025)

4. PRODOTTI:
   - Elenca tutti i prodotti/servizi acquistati
   - Per carburante: indica tipo (Diesel, Benzina, ecc.) e litri

Rispondi SOLO con JSON valido in questo formato:
{
  "storeName": "Nome negozio/stazione",
  "storeAddress": "Indirizzo se presente",
  "date": "YYYY-MM-DD",
  "time": "HH:MM se presente",
  "totalAmount": 123.45,
  "currency": "CHF",
  "vatAmount": 9.50,
  "vatRate": "8.1%",
  "subtotal": 113.95,
  "category": "carburante|cibo|trasporto|alloggio|materiale|altro",
  "categoryConfidence": 0.95,
  "items": [
    {
      "description": "Diesel",
      "quantity": 45.5,
      "unitPrice": 1.85,
      "totalPrice": 84.18
    }
  ],
  "paymentMethod": "carta|contanti|altro",
  "confidence": 0.95,
  "rawText": "tutto il testo estratto dallo scontrino"
}

Ometti i campi che non riesci a trovare con certezza. Rispondi SOLO con JSON valido.
`;

export async function POST(request: NextRequest) {
  try {
    console.log('🧾 [SPESE-ANALYZE] Inizio analisi scontrino...');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const base64Data = formData.get('base64') as string | null;
    const mimeType = formData.get('mimeType') as string || 'image/jpeg';

    let imageData: string;
    let imageMimeType: string;

    if (file) {
      // Ricevuto file
      const buffer = Buffer.from(await file.arrayBuffer());
      imageData = buffer.toString('base64');
      imageMimeType = file.type || mimeType;
      console.log(`📷 [SPESE-ANALYZE] File ricevuto: ${file.name}, ${file.size} bytes`);
    } else if (base64Data) {
      // Ricevuto base64 direttamente
      // Rimuovi eventuale prefisso data:image/...;base64,
      imageData = base64Data.replace(/^data:image\/\w+;base64,/, '');
      imageMimeType = mimeType;
      console.log(`📷 [SPESE-ANALYZE] Base64 ricevuto: ${imageData.length} caratteri`);
    } else {
      return NextResponse.json({
        success: false,
        error: 'Nessuna immagine fornita. Usa "file" o "base64".'
      }, { status: 400 });
    }

    // Chiama Gemini Vision
    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: imageMimeType,
      },
    };

    console.log('🤖 [SPESE-ANALYZE] Chiamata Gemini Vision...');
    const result = await model.generateContent([RECEIPT_ANALYSIS_PROMPT, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('📝 [SPESE-ANALYZE] Risposta Gemini:', text.substring(0, 200) + '...');

    // Parse JSON dalla risposta
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const analysis: ReceiptAnalysis = JSON.parse(jsonText);

    console.log('✅ [SPESE-ANALYZE] Analisi completata:', {
      store: analysis.storeName,
      total: analysis.totalAmount,
      category: analysis.category
    });

    return NextResponse.json({
      success: true,
      analysis,
      // Includi anche l'immagine base64 per poterla allegare dopo
      imageBase64: imageData,
      imageMimeType: imageMimeType
    });

  } catch (error: any) {
    console.error('❌ [SPESE-ANALYZE] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore analisi scontrino: ' + error.message
    }, { status: 500 });
  }
}
