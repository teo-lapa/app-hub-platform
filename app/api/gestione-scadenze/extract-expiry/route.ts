import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const EXTRACTION_PROMPT = `Sei un assistente specializzato nella lettura di etichette di prodotti alimentari.

Analizza attentamente l'immagine e cerca di estrarre:
1. **Numero di Lotto** (LOT, LOTTO, L., Batch, etc.)
2. **Data di Scadenza** (Scad., Exp., Best Before, Da consumarsi entro, TMC, etc.)

IMPORTANTE:
- La data di scadenza puo essere in vari formati: DD/MM/YYYY, DD-MM-YY, MM/YYYY, etc.
- Converti sempre la data nel formato YYYY-MM-DD
- Se trovi solo mese e anno, usa il primo giorno del mese
- Se l'anno e a 2 cifre, assumi sia 20XX
- Il lotto puo contenere lettere e numeri

Rispondi SOLO in formato JSON con questa struttura esatta:
{
  "lotNumber": "stringa del numero lotto trovato o stringa vuota",
  "expiryDate": "data in formato YYYY-MM-DD o stringa vuota",
  "confidence": numero da 0 a 100 che indica la tua sicurezza nella lettura,
  "rawLotText": "testo originale letto per il lotto",
  "rawExpiryText": "testo originale letto per la scadenza",
  "notes": "eventuali note o problemi riscontrati"
}

Se non riesci a leggere nulla, rispondi comunque con il JSON ma con valori vuoti e confidence bassa.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photos, productName, currentLot, currentExpiry } = body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessuna foto fornita'
      }, { status: 400 });
    }

    console.log(`🤖 [extract-expiry] Analizzando ${photos.length} foto per: ${productName}`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    });

    // Prepara le immagini per Gemini
    const imageParts = photos.map((photo: string) => {
      // Rimuovi il prefisso data:image/...;base64, se presente
      const base64Data = photo.includes('base64,')
        ? photo.split('base64,')[1]
        : photo;

      return {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      };
    });

    // Aggiungi contesto se disponibile
    let contextPrompt = EXTRACTION_PROMPT;
    if (productName) {
      contextPrompt += `\n\nContesto: Stai analizzando l'etichetta del prodotto "${productName}".`;
    }
    if (currentLot || currentExpiry) {
      contextPrompt += `\nValori attuali nel sistema: Lotto="${currentLot || 'non impostato'}", Scadenza="${currentExpiry || 'non impostata'}".`;
    }

    // Chiama Gemini con tutte le immagini
    const result = await model.generateContent([
      ...imageParts,
      contextPrompt
    ]);

    const text = result.response.text();
    console.log('🤖 [extract-expiry] Risposta Gemini:', text);

    // Parse JSON response
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleaned);

    console.log(`✅ [extract-expiry] Estratto - Lotto: "${extracted.lotNumber}", Scadenza: "${extracted.expiryDate}", Confidence: ${extracted.confidence}%`);

    return NextResponse.json({
      success: true,
      lotNumber: extracted.lotNumber || '',
      expiryDate: extracted.expiryDate || '',
      confidence: extracted.confidence || 0,
      rawLotText: extracted.rawLotText || '',
      rawExpiryText: extracted.rawExpiryText || '',
      notes: extracted.notes || ''
    });

  } catch (error: any) {
    console.error('❌ [extract-expiry] Errore:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'estrazione dei dati'
    }, { status: 500 });
  }
}
