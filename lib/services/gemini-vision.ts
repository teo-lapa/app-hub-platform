/**
 * Gemini Vision Service
 * Estrae dati strutturati da documenti aziendali usando Google Gemini Vision API
 * Supporta: biglietti da visita, fatture, scontrini, documenti aziendali
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY must be set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export interface ExtractedContactData {
  // Dati persona
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string; // Dr., Ing., etc.
  position?: string; // CEO, Manager, etc.

  // Contatti
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;

  // Azienda
  companyName?: string;
  companyLegalName?: string;
  companyUID?: string; // CHE-123.456.789
  companyVAT?: string; // IVA number

  // Indirizzo
  street?: string;
  street2?: string;
  zip?: string;
  city?: string;
  state?: string;
  country?: string;

  // Dati fattura/documento
  documentType?: 'business_card' | 'invoice' | 'receipt' | 'letter' | 'other';
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  currency?: string;

  // Metadati
  confidence?: number; // 0-1
  rawText?: string;
  detectedLanguage?: string;
}

const EXTRACTION_PROMPT = `
Sei un esperto nell'estrazione di dati da documenti aziendali svizzeri.

Analizza questa immagine e estrai TUTTI i dati disponibili in formato JSON strutturato.

IMPORTANTE:
- Identifica il tipo di documento (biglietto da visita, fattura, scontrino, lettera, altro)
- Estrai TUTTI i dati visibili: nomi, aziende, contatti, indirizzi, numeri
- Per le aziende svizzere, cerca il numero UID/CHE (formato: CHE-123.456.789)
- Distingui tra nome legale dell'azienda e nome commerciale
- Estrai ruolo/posizione della persona se presente
- Per fatture: numero fattura, data, importo totale, valuta
- Specifica il livello di confidenza (0-1) per ogni dato estratto

Rispondi SOLO con un oggetto JSON valido in questo formato:
{
  "documentType": "business_card" | "invoice" | "receipt" | "letter" | "other",
  "name": "nome completo persona",
  "firstName": "nome",
  "lastName": "cognome",
  "title": "Dr./Ing./etc",
  "position": "CEO/Manager/etc",
  "email": "email",
  "phone": "telefono fisso",
  "mobile": "cellulare",
  "fax": "fax",
  "website": "sito web",
  "companyName": "nome commerciale azienda",
  "companyLegalName": "ragione sociale completa",
  "companyUID": "CHE-XXX.XXX.XXX",
  "companyVAT": "numero IVA",
  "street": "via e numero",
  "street2": "complemento indirizzo",
  "zip": "CAP",
  "city": "città",
  "state": "cantone/provincia",
  "country": "paese",
  "invoiceNumber": "numero fattura",
  "invoiceDate": "data fattura YYYY-MM-DD",
  "invoiceAmount": 1234.56,
  "currency": "CHF/EUR/etc",
  "confidence": 0.95,
  "rawText": "tutto il testo estratto",
  "detectedLanguage": "it/de/fr/en"
}

Ometti i campi che non riesci a trovare. Rispondi SOLO con JSON valido, senza testo aggiuntivo.
`;

export async function extractContactDataFromImage(
  imageData: Buffer | string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedContactData> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Prepara l'immagine per Gemini
    const imagePart = {
      inlineData: {
        data: typeof imageData === 'string' ? imageData : imageData.toString('base64'),
        mimeType: mimeType,
      },
    };

    // Chiama Gemini Vision
    const result = await model.generateContent([EXTRACTION_PROMPT, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('[Gemini Vision] Raw response:', text);

    // Parse JSON dalla risposta
    // Rimuovi eventuali markdown code blocks
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const extractedData: ExtractedContactData = JSON.parse(jsonText);

    console.log('[Gemini Vision] Extracted data:', extractedData);

    return extractedData;

  } catch (error: any) {
    console.error('[Gemini Vision] Error:', error);
    throw new Error(`Gemini Vision extraction failed: ${error.message}`);
  }
}

export async function extractContactDataFromFile(
  file: File
): Promise<ExtractedContactData> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return extractContactDataFromImage(buffer, file.type);
}

export async function extractContactDataFromURL(
  imageUrl: string
): Promise<ExtractedContactData> {
  try {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return extractContactDataFromImage(buffer, mimeType);
  } catch (error: any) {
    console.error('[Gemini Vision] Error fetching image:', error);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}
