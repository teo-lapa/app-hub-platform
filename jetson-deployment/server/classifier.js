/**
 * Document Classifier Service - Kimi K2 Integration
 * Classifies OCR-extracted text into document types
 */

const DOCUMENT_TYPE_NAMES = {
  invoice: 'FATTURA',
  purchase_order: 'ORDINE ACQUISTO',
  sales_order: 'ORDINE VENDITA',
  receipt: 'RICEVUTA',
  delivery_note: 'DDT',
  quote: 'PREVENTIVO',
  contract: 'CONTRATTO',
  payment_slip: 'BOLLETTINO PAGAMENTO',
  tax_document: 'DOC. FISCALE',
  photo: 'FOTO',
  other: 'ALTRO'
};

class ClassifierService {
  constructor() {
    this.apiKey = process.env.KIMI_K2_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.model = 'moonshotai/kimi-k2'; // Paid model (no privacy issues)
    this.initialized = false;
  }

  /**
   * Initialize classifier service
   */
  async initialize() {
    if (!this.apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }
    this.initialized = true;
    console.log('✅ Classifier Service initialized');
  }

  /**
   * Classify document from OCR text
   */
  async classify(text, options = {}) {
    const startTime = Date.now();

    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      // Prepare prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(text);

      // Call Kimi K2 API
      const response = await this.callKimiK2([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      // Parse response
      const result = this.parseClassificationResult(response);
      result.duration = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('Classification error:', error);

      // Return fallback classification
      return {
        type: 'other',
        typeName: 'Non Classificato',
        confidence: 0,
        details: {},
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Build system prompt for Kimi K2
   */
  buildSystemPrompt() {
    return `Sei un esperto di analisi documentale. Analizza il testo fornito e classifica il documento.

Identifica:
1. TIPO DI DOCUMENTO (invoice, purchase_order, sales_order, receipt, delivery_note, quote, contract, payment_slip, tax_document, other)
2. LIVELLO DI CONFIDENZA (0-100)
3. DETTAGLI ESTRATTI:
   - Fornitore/Cliente (supplier/customer)
   - Numero documento (number)
   - Data (date in format YYYY-MM-DD)
   - Importo totale e valuta (amount, currency)
   - Righe prodotti (items array con: description, quantity, unitPrice, total)

IMPORTANTE: Rispondi SOLO con JSON valido nel seguente formato:
{
  "type": "invoice",
  "confidence": 95,
  "details": {
    "supplier": "Nome Fornitore S.r.l.",
    "customer": "Nome Cliente S.p.A.",
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
}

REGOLE:
- Se il documento è una FATTURA, usa type: "invoice"
- Se è un ORDINE DI ACQUISTO, usa type: "purchase_order"
- Se è un DDT/BOLLA, usa type: "delivery_note"
- Se è uno SCONTRINO/RICEVUTA, usa type: "receipt"
- Se non sei sicuro, usa type: "other" con confidence bassa
- Estrai TUTTI i dettagli che riesci a trovare nel testo
- I numeri devono essere validi (es: 1234.56, non "1.234,56 EUR")
- Le date devono essere in formato ISO (YYYY-MM-DD)`;
  }

  /**
   * Build user prompt with OCR text
   */
  buildUserPrompt(text) {
    // Limit text to first 8000 chars to avoid token limits
    const limitedText = text.substring(0, 8000);

    return `Analizza questo documento e fornisci la classificazione in formato JSON:

TESTO ESTRATTO:
${limitedText}

Rispondi SOLO con il JSON di classificazione, senza altro testo.`;
  }

  /**
   * Call Kimi K2 API via OpenRouter
   */
  async callKimiK2(messages, options = {}) {
    const {
      maxTokens = 2048,
      temperature = 0.2
    } = options;

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app-hub-platform.vercel.app',
        'X-Title': 'Jetson OCR Server - Document Classifier'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: 'json_object' } // Force JSON response
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kimi K2 API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid API response: no choices');
    }

    return data.choices[0].message.content;
  }

  /**
   * Parse classification result from Kimi K2
   */
  parseClassificationResult(responseText) {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.type) {
        throw new Error('Missing type field in response');
      }

      // Build result
      return {
        type: parsed.type,
        typeName: DOCUMENT_TYPE_NAMES[parsed.type] || 'Sconosciuto',
        confidence: parsed.confidence || 50,
        details: this.sanitizeDetails(parsed.details || {}),
        rawResponse: responseText
      };

    } catch (error) {
      console.error('Failed to parse classification result:', error);
      console.error('Response text:', responseText);

      // Return fallback
      return {
        type: 'other',
        typeName: 'Errore Parsing',
        confidence: 0,
        details: {},
        error: error.message,
        rawResponse: responseText
      };
    }
  }

  /**
   * Sanitize and validate extracted details
   */
  sanitizeDetails(details) {
    const sanitized = {};

    // String fields
    if (details.supplier) sanitized.supplier = String(details.supplier).trim();
    if (details.customer) sanitized.customer = String(details.customer).trim();
    if (details.number) sanitized.number = String(details.number).trim();
    if (details.currency) sanitized.currency = String(details.currency).trim();

    // Date field (validate ISO format)
    if (details.date) {
      const dateStr = String(details.date);
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        sanitized.date = dateStr;
      }
    }

    // Amount (ensure it's a number)
    if (details.amount) {
      const amount = parseFloat(details.amount);
      if (!isNaN(amount)) {
        sanitized.amount = amount;
      }
    }

    // Items array
    if (Array.isArray(details.items)) {
      sanitized.items = details.items
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          description: item.description ? String(item.description).trim() : '',
          quantity: item.quantity ? parseFloat(item.quantity) : undefined,
          unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : undefined,
          total: item.total ? parseFloat(item.total) : undefined
        }))
        .filter(item => item.description); // Remove items without description
    }

    return sanitized;
  }

  /**
   * Quick keyword-based classification (fallback, no API call)
   */
  quickClassify(text) {
    const lowerText = text.toLowerCase();

    const keywords = {
      invoice: ['fattura', 'invoice', 'partita iva', 'codice fiscale', 'imponibile', 'iva'],
      purchase_order: ['ordine di acquisto', 'purchase order', 'ordine n.', 'conferma ordine'],
      sales_order: ['ordine di vendita', 'sales order'],
      receipt: ['ricevuta', 'scontrino', 'receipt'],
      delivery_note: ['ddt', 'documento di trasporto', 'delivery note', 'bolla'],
      quote: ['preventivo', 'quotation', 'quote', 'offerta', 'proforma'],
      contract: ['contratto', 'contract', 'accordo'],
      payment_slip: ['bollettino', 'pagamento', 'payment slip']
    };

    let bestMatch = 'other';
    let maxScore = 0;

    for (const [type, words] of Object.entries(keywords)) {
      const score = words.filter(word => lowerText.includes(word)).length;
      if (score > maxScore) {
        maxScore = score;
        bestMatch = type;
      }
    }

    const confidence = maxScore > 0 ? Math.min(maxScore * 25, 75) : 0;

    return {
      type: bestMatch,
      typeName: DOCUMENT_TYPE_NAMES[bestMatch],
      confidence,
      details: {},
      method: 'quick-keywords'
    };
  }
}

// Singleton instance
const classifierService = new ClassifierService();

module.exports = classifierService;
