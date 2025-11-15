/**
 * Document Classifier using Kimi K2
 *
 * Classifies documents (PDFs, images) into categories like:
 * - Invoice/Fattura
 * - Purchase Order/Ordine
 * - Receipt/Ricevuta
 * - Contract/Contratto
 * - Other documents
 */

import { KimiK2Client } from './kimi-k2-client';
import { getKimiK2Config } from './kimi-k2-config';

export type DocumentType =
  | 'invoice'           // Fattura
  | 'purchase_order'    // Ordine di acquisto
  | 'sales_order'       // Ordine di vendita
  | 'receipt'           // Ricevuta/Scontrino
  | 'delivery_note'     // Documento di trasporto (DDT)
  | 'quote'             // Preventivo
  | 'contract'          // Contratto
  | 'payment_slip'      // Bollettino di pagamento
  | 'tax_document'      // Documento fiscale
  | 'photo'             // Foto generica
  | 'other';            // Altro

export interface DocumentClassification {
  type: DocumentType;
  confidence: number;      // 0-100
  typeName: string;        // Nome in italiano
  details: {
    supplier?: string;     // Fornitore
    customer?: string;     // Cliente
    number?: string;       // Numero documento
    date?: string;         // Data documento
    amount?: number;       // Importo totale
    currency?: string;     // Valuta
    items?: Array<{        // Righe prodotti (se presenti)
      description: string;
      quantity?: number;
      unitPrice?: number;
      total?: number;
    }>;
  };
  rawAnalysis: string;
}

const DOCUMENT_TYPE_NAMES: Record<DocumentType, string> = {
  invoice: 'FATTURA',
  purchase_order: 'ORDINE ACQUISTO',
  sales_order: 'ORDINE VENDITA',
  receipt: 'RICEVUTA',
  delivery_note: 'DDT',
  quote: 'FATTURA PROFORMA',
  contract: 'CONTRATTO',
  payment_slip: 'BOLLETTINO PAGAMENTO',
  tax_document: 'DOC. FISCALE',
  photo: 'FOTO',
  other: 'ALTRO'
};

export class DocumentClassifier {
  private client: KimiK2Client;

  constructor(apiKey: string) {
    // Use paid model to avoid privacy policy issues with free tier
    const config = getKimiK2Config(apiKey, 'moonshotai/kimi-k2-0905');
    this.client = new KimiK2Client(config);
  }

  /**
   * Classify a document from text content
   */
  async classifyFromText(text: string): Promise<DocumentClassification> {
    const systemPrompt = `Sei un esperto di analisi documentale. Analizza il testo fornito e classifica il documento.

Identifica:
1. TIPO DI DOCUMENTO (invoice, purchase_order, sales_order, receipt, delivery_note, quote, contract, payment_slip, tax_document, other)
2. LIVELLO DI CONFIDENZA (0-100)
3. DETTAGLI ESTRATTI:
   - Fornitore/Cliente
   - Numero documento
   - Data
   - Importo totale e valuta
   - Righe prodotti (descrizione, quantità, prezzo unitario, totale)

IMPORTANTE: Rispondi SOLO con JSON valido nel seguente formato:
{
  "type": "invoice",
  "confidence": 95,
  "details": {
    "supplier": "Nome Fornitore",
    "number": "FAT-2025-001",
    "date": "2025-01-15",
    "amount": 1234.56,
    "currency": "EUR",
    "items": [
      {
        "description": "Prodotto esempio",
        "quantity": 2,
        "unitPrice": 100.00,
        "total": 200.00
      }
    ]
  }
}`;

    try {
      const textToAnalyze = text.slice(0, 10000);
      console.log('📄 Text to analyze (first 500 chars):', textToAnalyze.slice(0, 500));
      console.log('📏 Total text length:', textToAnalyze.length);

      const response = await this.client.complete(
        `Analizza questo documento:\n\n${textToAnalyze}`, // Limit to first 10k chars
        systemPrompt,
        {
          maxTokens: 2048,
          temperature: 0.2
        }
      );

      console.log('🤖 Kimi K2 raw response:', response);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in response');
        throw new Error('No JSON found in response');
      }

      console.log('✅ JSON extracted:', jsonMatch[0]);
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        type: parsed.type || 'other',
        confidence: parsed.confidence || 50,
        typeName: DOCUMENT_TYPE_NAMES[parsed.type as DocumentType] || 'Altro',
        details: parsed.details || {},
        rawAnalysis: response
      };
    } catch (error) {
      console.error('Classification error:', error);

      // Fallback classification
      return {
        type: 'other',
        confidence: 0,
        typeName: 'Non Classificato',
        details: {},
        rawAnalysis: `Errore nell'analisi: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Classify a document from image (base64)
   */
  async classifyFromImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<DocumentClassification> {
    // Note: OpenRouter/Kimi K2 might support vision models
    // For now, we'll return a basic response suggesting text extraction first

    return {
      type: 'photo',
      confidence: 100,
      typeName: 'Foto',
      details: {},
      rawAnalysis: 'Immagine caricata. Per una classificazione accurata, converti l\'immagine in testo con OCR.'
    };
  }

  /**
   * Classify a document from images using OCR (Kimi-VL)
   */
  async classifyFromImages(imageBase64Array: string[]): Promise<DocumentClassification> {
    const systemPrompt = `Sei un esperto di analisi documentale con capacità OCR. Analizza l'immagine del documento fornito.

Identifica:
1. TIPO DI DOCUMENTO (invoice, purchase_order, sales_order, receipt, delivery_note, quote, contract, payment_slip, tax_document, photo, other)
2. LIVELLO DI CONFIDENZA (0-100)
3. DETTAGLI ESTRATTI:
   - Fornitore/Cliente
   - Numero documento
   - Data
   - Importo totale e valuta
   - Righe prodotti (descrizione, quantità, prezzo unitario, totale)

IMPORTANTE:
- Leggi attentamente TUTTO il testo visibile nell'immagine
- Se è una fattura/documento scansionato, estrai tutti i dettagli con precisione
- Rispondi SOLO con JSON valido nel seguente formato:
{
  "type": "invoice",
  "confidence": 95,
  "extractedText": "Testo completo estratto dall'immagine...",
  "details": {
    "supplier": "Nome Fornitore",
    "number": "FAT-2025-001",
    "date": "2025-01-15",
    "amount": 1234.56,
    "currency": "EUR",
    "items": [
      {
        "description": "Prodotto esempio",
        "quantity": 2,
        "unitPrice": 100.00,
        "total": 200.00
      }
    ]
  }
}`;

    try {
      // Create Llama Vision client for OCR
      const visionConfig = getKimiK2Config(
        process.env.KIMI_K2_API_KEY!,
        'meta-llama/llama-3.2-11b-vision-instruct:free'
      );
      const visionClient = new KimiK2Client(visionConfig);

      console.log('🔍 Using Llama 3.2 Vision (VERIFIED free) for OCR with', imageBase64Array.length, 'images');

      // Prepare multimodal message content
      const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: 'Analizza questo documento scansionato ed estrai tutti i dettagli:' }
      ];

      // Add all images
      for (const imageBase64 of imageBase64Array) {
        content.push({
          type: 'image_url',
          image_url: {
            url: imageBase64
          }
        });
      }

      // Make API call with multimodal content
      const response = await visionClient.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ], {
        maxTokens: 4096,
        temperature: 0.2
      });

      const rawResponse = response.choices[0]?.message.content || '';
      console.log('🤖 Kimi-VL OCR response:', rawResponse);

      // Extract JSON from response
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ No JSON found in OCR response');
        throw new Error('No JSON found in OCR response');
      }

      console.log('✅ JSON extracted from OCR:', jsonMatch[0]);
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        type: parsed.type || 'other',
        confidence: parsed.confidence || 50,
        typeName: DOCUMENT_TYPE_NAMES[parsed.type as DocumentType] || 'Altro',
        details: parsed.details || {},
        rawAnalysis: `[OCR] ${parsed.extractedText || rawResponse}`
      };
    } catch (error) {
      console.error('OCR Classification error:', error);

      // Fallback classification
      return {
        type: 'other',
        confidence: 0,
        typeName: 'Errore OCR',
        details: {},
        rawAnalysis: `Errore nell'analisi OCR: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Quick document type detection (lightweight)
   */
  async quickDetect(text: string): Promise<{ type: DocumentType; confidence: number }> {
    const lowerText = text.toLowerCase();

    // Simple keyword-based detection
    const keywords = {
      invoice: ['fattura', 'invoice', 'partita iva', 'codice fiscale', 'imponibile', 'iva'],
      purchase_order: ['ordine di acquisto', 'purchase order', 'ordine n.', 'conferma ordine'],
      sales_order: ['ordine di vendita', 'sales order'],
      receipt: ['ricevuta', 'scontrino', 'receipt'],
      delivery_note: ['ddt', 'documento di trasporto', 'delivery note', 'bolla'],
      quote: ['preventivo', 'quotation', 'quote', 'offerta'],
      contract: ['contratto', 'contract', 'accordo'],
      payment_slip: ['bollettino', 'pagamento', 'payment slip']
    };

    let bestMatch: DocumentType = 'other';
    let maxScore = 0;

    for (const [type, words] of Object.entries(keywords)) {
      const score = words.filter(word => lowerText.includes(word)).length;
      if (score > maxScore) {
        maxScore = score;
        bestMatch = type as DocumentType;
      }
    }

    const confidence = maxScore > 0 ? Math.min(maxScore * 25, 75) : 0;

    return { type: bestMatch, confidence };
  }
}

/**
 * Factory function
 */
export const createDocumentClassifier = (apiKey?: string): DocumentClassifier => {
  const key = apiKey || process.env.KIMI_K2_API_KEY || '';
  if (!key) {
    throw new Error('KIMI_K2_API_KEY not found in environment variables');
  }
  return new DocumentClassifier(key);
};
