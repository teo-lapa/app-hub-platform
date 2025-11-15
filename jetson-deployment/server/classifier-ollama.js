/**
 * Document Classifier Service - Ollama Llama 3.2 3B (Local)
 * Classifies OCR-extracted text into document types using local AI
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
    // Ollama runs locally on the Jetson
    this.ollamaURL = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
    this.initialized = false;
  }

  /**
   * Initialize classifier service
   */
  async initialize() {
    try {
      // Check if Ollama is running
      const response = await fetch(`${this.ollamaURL}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not responding');
      }

      const data = await response.json();
      const hasModel = data.models?.some(m => m.name === this.model);

      if (!hasModel) {
        console.warn(`⚠️  Model ${this.model} not found. Available models:`,
          data.models?.map(m => m.name).join(', '));
        throw new Error(`Model ${this.model} not found. Run: ollama pull ${this.model}`);
      }

      this.initialized = true;
      console.log(`✅ Classifier Service initialized with ${this.model}`);
      console.log(`   Ollama URL: ${this.ollamaURL}`);

    } catch (error) {
      console.error('❌ Failed to initialize Ollama:', error.message);
      console.error('   Make sure Ollama is running: sudo systemctl start ollama');
      throw error;
    }
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
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

      // Call Ollama API
      const response = await this.callOllama(fullPrompt);

      // Parse response
      const result = this.parseClassificationResult(response);
      result.duration = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('Classification error:', error);

      // Fallback to keyword-based classification
      console.log('⚠️  Falling back to keyword-based classification');
      const fallback = this.quickClassify(text);
      fallback.duration = Date.now() - startTime;
      fallback.error = error.message;
      return fallback;
    }
  }

  /**
   * Build system prompt for Llama 3.2
   */
  buildSystemPrompt() {
    return `You are a document classification expert. Analyze the provided text and classify the document.

Identify:
1. DOCUMENT TYPE: invoice, purchase_order, sales_order, receipt, delivery_note, quote, contract, payment_slip, tax_document, other
2. CONFIDENCE LEVEL: 0-100
3. EXTRACTED DETAILS:
   - Supplier/Customer (supplier/customer)
   - Document number (number)
   - Date (date in YYYY-MM-DD format)
   - Total amount and currency (amount, currency)
   - Product lines (items array with: description, quantity, unitPrice, total)

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "type": "invoice",
  "confidence": 95,
  "details": {
    "supplier": "Supplier Name S.r.l.",
    "customer": "Customer Name S.p.A.",
    "number": "INV-2025-001",
    "date": "2025-01-15",
    "amount": 1234.56,
    "currency": "EUR",
    "items": [
      {
        "description": "Example product",
        "quantity": 2,
        "unitPrice": 100.00,
        "total": 200.00
      }
    ]
  }
}

RULES:
- For INVOICES (FATTURA), use type: "invoice"
- For PURCHASE ORDERS (ORDINE), use type: "purchase_order"
- For DELIVERY NOTES (DDT/BOLLA), use type: "delivery_note"
- For RECEIPTS (SCONTRINO), use type: "receipt"
- If unsure, use type: "other" with low confidence
- Extract ALL details you can find in the text
- Numbers must be valid (e.g., 1234.56, not "1.234,56 EUR")
- Dates must be ISO format (YYYY-MM-DD)
- Respond with ONLY the JSON, no additional text`;
  }

  /**
   * Build user prompt with OCR text
   */
  buildUserPrompt(text) {
    // Limit text to first 6000 chars (Llama 3.2 3B context limit)
    const limitedText = text.substring(0, 6000);

    return `Analyze this document and provide classification in JSON format:

EXTRACTED TEXT:
${limitedText}

Respond ONLY with the JSON classification, nothing else.`;
  }

  /**
   * Call Ollama API
   */
  async callOllama(prompt, options = {}) {
    const {
      temperature = 0.2,
      num_predict = 1024
    } = options;

    const response = await fetch(`${this.ollamaURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        stream: false,
        format: 'json', // Force JSON output
        options: {
          temperature,
          num_predict
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error('Invalid Ollama response: no response field');
    }

    return data.response;
  }

  /**
   * Parse classification result from Ollama
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
        rawResponse: responseText,
        model: this.model
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
        rawResponse: responseText,
        model: this.model
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
   * Chat with Ollama
   */
  async chat(message, conversation = []) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      // Build conversation context
      let prompt = 'You are a helpful AI assistant. ';

      if (conversation.length > 0) {
        prompt += 'Previous conversation:\n';
        conversation.forEach(msg => {
          prompt += `${msg.role}: ${msg.content}\n`;
        });
      }

      prompt += `\nUser: ${message}\nAssistant:`;

      const response = await this.callOllama(prompt, { temperature: 0.7, num_predict: 2048 });

      const updatedConversation = [
        ...conversation,
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      ];

      return {
        message: response,
        conversation: updatedConversation
      };

    } catch (error) {
      throw new Error(`Chat error: ${error.message}`);
    }
  }

  /**
   * Extract structured data from document
   */
  async extractData(text) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      const limitedText = text.substring(0, 6000);

      const prompt = `Extract ALL data from this document into structured JSON format.

DOCUMENT TEXT:
${limitedText}

Extract:
- Document type
- Supplier/Vendor name
- Customer name
- Document number
- Date (YYYY-MM-DD format)
- Total amount and currency
- ALL product lines with: description, quantity, unit price, total price

Respond ONLY with valid JSON in this format:
{
  "type": "invoice",
  "supplier": "Company Name",
  "customer": "Customer Name",
  "number": "DOC-123",
  "date": "2025-01-15",
  "amount": 1234.56,
  "currency": "EUR",
  "items": [
    {
      "description": "Product name",
      "quantity": 10,
      "unitPrice": 5.50,
      "total": 55.00
    }
  ]
}

Extract EVERY product line you find. Respond with ONLY the JSON.`;

      const response = await this.callOllama(prompt);

      // Parse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      return {
        ...data,
        details: this.sanitizeDetails(data)
      };

    } catch (error) {
      throw new Error(`Data extraction error: ${error.message}`);
    }
  }

  /**
   * Ask question about document
   */
  async askDocument(text, question) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      const limitedText = text.substring(0, 8000);

      const prompt = `Answer the question about this document.

DOCUMENT TEXT:
${limitedText}

QUESTION: ${question}

Provide a clear, concise answer based ONLY on the information in the document. If the information is not in the document, say "Non trovato nel documento".

Answer:`;

      const response = await this.callOllama(prompt, { temperature: 0.3, num_predict: 1024 });

      return {
        answer: response.trim(),
        confidence: 85
      };

    } catch (error) {
      throw new Error(`Document Q&A error: ${error.message}`);
    }
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
