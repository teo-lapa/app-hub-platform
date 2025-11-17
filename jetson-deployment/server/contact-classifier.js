/**
 * Contact Data Classifier Service - Ollama Llama 3.2 3B (Local)
 * Extracts contact information (nome, azienda, P.IVA, email, telefono, indirizzo)
 * from business cards, invoices, and other documents using local AI
 */

const CONTACT_FIELD_NAMES = {
  firstName: 'NOME',
  lastName: 'COGNOME',
  displayName: 'NOME COMPLETO',
  companyName: 'AZIENDA',
  jobTitle: 'POSIZIONE',
  email: 'EMAIL',
  phone: 'TELEFONO',
  mobile: 'CELLULARE',
  fax: 'FAX',
  website: 'SITO WEB',
  vatId: 'PARTITA IVA',
  fiscalCode: 'CODICE FISCALE',
  street: 'VIA/INDIRIZZO',
  city: 'CITTÀ',
  postalCode: 'CAP',
  country: 'PAESE'
};

class ContactClassifierService {
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
      console.log(`✅ Contact Classifier Service initialized with ${this.model}`);
      console.log(`   Ollama URL: ${this.ollamaURL}`);

    } catch (error) {
      console.error('❌ Failed to initialize Ollama:', error.message);
      console.error('   Make sure Ollama is running: sudo systemctl start ollama');
      throw error;
    }
  }

  /**
   * Extract contact information from document text
   */
  async extractContact(text, options = {}) {
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
      const result = this.parseContactResult(response);
      result.duration = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('Contact extraction error:', error);

      // Fallback to keyword-based extraction
      console.log('⚠️  Falling back to keyword-based contact extraction');
      const fallback = this.quickExtractContact(text);
      fallback.duration = Date.now() - startTime;
      fallback.error = error.message;
      return fallback;
    }
  }

  /**
   * Build system prompt for Llama 3.2
   */
  buildSystemPrompt() {
    return `You are an expert at extracting contact information from documents like business cards, invoices, and letters.

Extract the following information from the provided text:
1. NOME/COGNOME/NOME COMPLETO (First name, last name, full display name)
2. AZIENDA (Company/organization name)
3. POSIZIONE (Job title/position)
4. EMAIL (Email address, can be multiple)
5. TELEFONO/CELLULARE (Phone numbers - landline and mobile, can be multiple)
6. FAX (Fax number if present)
7. SITO WEB (Website URL)
8. INDIRIZZO (Full postal address: via/street, città/city, CAP/postal code, paese/country)
9. PARTITA IVA (VAT ID - Partita IVA, usually 11 digits for Italian companies)
10. CODICE FISCALE (Fiscal code - Codice Fiscale, usually 16 characters for Italian individuals)

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "displayName": "Full Name Here",
  "firstName": "First",
  "lastName": "Last",
  "companyName": "Company Name S.r.l.",
  "jobTitle": "Position/Title",
  "emails": [
    {
      "value": "email@example.com",
      "type": "work",
      "confidence": "high"
    }
  ],
  "phones": [
    {
      "value": "+39 02 1234 5678",
      "formatted": "+39021234567",
      "type": "landline",
      "confidence": "high"
    },
    {
      "value": "+39 334 123 4567",
      "formatted": "+393341234567",
      "type": "mobile",
      "confidence": "high"
    }
  ],
  "address": {
    "fullAddress": "Via Milano 123, 20100 Milano, Italia",
    "street": "Via Milano 123",
    "city": "Milano",
    "postalCode": "20100",
    "country": "Italia",
    "confidence": "high"
  },
  "website": "https://www.example.com",
  "taxIdentifiers": {
    "vatId": "01234567890",
    "fiscalCode": "ABCXYZ00A00A000A",
    "confidence": "high"
  },
  "confidence": 95,
  "extractedFields": ["displayName", "companyName", "emails", "phones", "address", "vatId"]
}

RULES:
- Extract ONLY information that is clearly present in the text
- For phone numbers: clean up spaces and special characters, try to format with country code (+39 for Italy)
- For emails: validate basic email format
- For VAT ID (Partita IVA): remove spaces and hyphens, should be 11 digits for Italy
- For Fiscal Code (Codice Fiscale): remove spaces, should be 16 characters
- Keep addresses intact with full details
- Confidence levels: high (>80%), medium (50-80%), low (<50%)
- If a field is not found, omit it from the JSON
- Always include "displayName", "confidence", and "extractedFields"
- Respond with ONLY the JSON, no additional text
- Phone numbers type: "mobile", "landline", "fax", "whatsapp", or "other"
- Email type: "work", "personal", or "other"`;
  }

  /**
   * Build user prompt with OCR text
   */
  buildUserPrompt(text) {
    // Limit text to first 6000 chars (Llama 3.2 3B context limit)
    const limitedText = text.substring(0, 6000);

    return `Extract contact information from this document and provide result in JSON format:

EXTRACTED TEXT:
${limitedText}

Respond ONLY with the JSON contact data, nothing else.`;
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
   * Parse contact extraction result from Ollama
   */
  parseContactResult(responseText) {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!parsed.displayName) {
        throw new Error('Missing displayName field in response');
      }

      // Sanitize and normalize data
      const sanitized = this.sanitizeContactData(parsed);

      // Build result
      return {
        displayName: sanitized.displayName,
        firstName: sanitized.firstName,
        lastName: sanitized.lastName,
        companyName: sanitized.companyName,
        jobTitle: sanitized.jobTitle,
        emails: sanitized.emails || [],
        phones: sanitized.phones || [],
        address: sanitized.address,
        website: sanitized.website,
        taxIdentifiers: sanitized.taxIdentifiers,
        confidence: parsed.confidence || 50,
        extractedFields: parsed.extractedFields || [],
        rawResponse: responseText,
        model: this.model
      };

    } catch (error) {
      console.error('Failed to parse contact result:', error);
      console.error('Response text:', responseText);

      // Return fallback
      return {
        displayName: '',
        confidence: 0,
        extractedFields: [],
        emails: [],
        phones: [],
        error: error.message,
        rawResponse: responseText,
        model: this.model
      };
    }
  }

  /**
   * Sanitize and validate extracted contact data
   */
  sanitizeContactData(data) {
    const sanitized = {};

    // String fields
    if (data.displayName) sanitized.displayName = String(data.displayName).trim();
    if (data.firstName) sanitized.firstName = String(data.firstName).trim();
    if (data.lastName) sanitized.lastName = String(data.lastName).trim();
    if (data.companyName) sanitized.companyName = String(data.companyName).trim();
    if (data.jobTitle) sanitized.jobTitle = String(data.jobTitle).trim();
    if (data.website) sanitized.website = String(data.website).trim();

    // Email addresses
    if (Array.isArray(data.emails)) {
      sanitized.emails = data.emails
        .filter(e => e && typeof e === 'object' && e.value)
        .map(e => ({
          value: String(e.value).trim().toLowerCase(),
          type: e.type || 'work',
          confidence: e.confidence || 'medium'
        }))
        .filter(e => this.isValidEmail(e.value));
    }

    // Phone numbers
    if (Array.isArray(data.phones)) {
      sanitized.phones = data.phones
        .filter(p => p && typeof p === 'object' && p.value)
        .map(p => ({
          value: String(p.value).trim(),
          formatted: this.formatPhoneNumber(String(p.value)),
          type: p.type || 'landline',
          countryCode: p.countryCode || this.extractCountryCode(String(p.value)),
          confidence: p.confidence || 'medium'
        }));
    }

    // Address
    if (data.address && typeof data.address === 'object') {
      const addr = data.address;
      sanitized.address = {
        fullAddress: addr.fullAddress ? String(addr.fullAddress).trim() : '',
        street: addr.street ? String(addr.street).trim() : undefined,
        city: addr.city ? String(addr.city).trim() : undefined,
        postalCode: addr.postalCode ? String(addr.postalCode).trim() : undefined,
        country: addr.country ? String(addr.country).trim() : undefined,
        confidence: addr.confidence || 'medium'
      };

      // Remove empty address if no data
      if (!sanitized.address.fullAddress && !sanitized.address.street) {
        delete sanitized.address;
      }
    }

    // Tax identifiers
    if (data.taxIdentifiers && typeof data.taxIdentifiers === 'object') {
      const tax = data.taxIdentifiers;
      sanitized.taxIdentifiers = {};

      if (tax.vatId) {
        sanitized.taxIdentifiers.vatId = this.sanitizeVatId(String(tax.vatId));
      }
      if (tax.fiscalCode) {
        sanitized.taxIdentifiers.fiscalCode = String(tax.fiscalCode).trim().toUpperCase();
      }
      if (tax.confidence) {
        sanitized.taxIdentifiers.confidence = tax.confidence;
      }

      // Remove if empty
      if (!sanitized.taxIdentifiers.vatId && !sanitized.taxIdentifiers.fiscalCode) {
        delete sanitized.taxIdentifiers;
      }
    }

    return sanitized;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Format phone number by removing spaces and special chars (except +)
   */
  formatPhoneNumber(phone) {
    // Remove spaces, hyphens, parentheses, dots
    let formatted = phone.replace(/[\s\-\(\)\.]/g, '');

    // Ensure starts with + for international format
    if (!formatted.startsWith('+') && !formatted.startsWith('00')) {
      // If Italian number without country code, add +39
      if (formatted.startsWith('3') && formatted.length === 10) {
        formatted = '+39' + formatted;
      } else if (formatted.startsWith('02') && formatted.length === 9) {
        formatted = '+3902' + formatted.substring(2);
      }
    }

    return formatted;
  }

  /**
   * Extract country code from phone number
   */
  extractCountryCode(phone) {
    if (phone.includes('+39') || phone.includes('0039') || phone.startsWith('39')) {
      return 'IT';
    }
    if (phone.includes('+41') || phone.includes('0041') || phone.startsWith('41')) {
      return 'CH';
    }
    if (phone.includes('+1')) {
      return 'US';
    }
    return undefined;
  }

  /**
   * Sanitize VAT ID (Partita IVA)
   * - Remove spaces, hyphens, dots
   * - Should be 11 digits for Italy
   */
  sanitizeVatId(vatId) {
    // Remove spaces, hyphens, dots
    let cleaned = vatId.replace(/[\s\-\.]/g, '');

    // Remove country prefix if present
    if (cleaned.startsWith('IT')) {
      cleaned = cleaned.substring(2);
    }

    return cleaned;
  }

  /**
   * Quick keyword-based contact extraction (fallback, no API call)
   */
  quickExtractContact(text) {
    const lowerText = text.toLowerCase();
    const result = {
      displayName: '',
      emails: [],
      phones: [],
      confidence: 0,
      extractedFields: [],
      method: 'quick-keywords'
    };

    // Extract emails using regex
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emails = text.match(emailRegex) || [];
    result.emails = emails.map(e => ({
      value: e.toLowerCase(),
      type: 'work',
      confidence: 'medium'
    }));

    if (result.emails.length > 0) {
      result.extractedFields.push('emails');
    }

    // Extract phones - Italian format
    const phoneRegex = /(?:\+?39|0)[\s]?(?:\d[\s]?){8,10}/g;
    const phones = text.match(phoneRegex) || [];
    result.phones = phones.map(p => ({
      value: p.trim(),
      formatted: this.formatPhoneNumber(p),
      type: p.includes('fax') ? 'fax' : 'landline',
      countryCode: 'IT',
      confidence: 'medium'
    }));

    if (result.phones.length > 0) {
      result.extractedFields.push('phones');
    }

    // Extract VAT ID (11 digits, often with spaces)
    const vatRegex = /\b(?:\d[\s]?){10}\d\b/g;
    const vats = text.match(vatRegex) || [];
    if (vats.length > 0) {
      const vatId = vats[0].replace(/[\s]/g, '');
      result.taxIdentifiers = {
        vatId: vatId,
        confidence: 'low'
      };
      result.extractedFields.push('vatId');
    }

    // Look for company name (often appears after company-related keywords)
    const companyKeywords = ['azienda:', 'società:', 'ditta:', 'razione sociale:'];
    for (const keyword of companyKeywords) {
      const idx = lowerText.indexOf(keyword);
      if (idx !== -1) {
        // Extract text after keyword until newline or email
        const startIdx = idx + keyword.length;
        const endIdx = text.indexOf('\n', startIdx);
        const companyName = text.substring(startIdx, endIdx > 0 ? endIdx : startIdx + 100).trim();

        // Clean up
        result.companyName = companyName.split(/[,\n]/)[0].trim();
        result.extractedFields.push('companyName');
        break;
      }
    }

    // Try to extract name (often first or second line)
    const lines = text.split('\n').slice(0, 5);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length > 2 && cleanLine.length < 100 && !cleanLine.includes('@') && !cleanLine.match(/\d/)) {
        result.displayName = cleanLine;
        result.extractedFields.push('displayName');
        break;
      }
    }

    // Calculate confidence based on extracted fields
    result.confidence = Math.min(result.extractedFields.length * 15, 70);

    return result;
  }

  /**
   * Chat with Ollama about contact/document
   */
  async chat(message, conversation = []) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      // Build conversation context
      let prompt = 'You are a helpful AI assistant specializing in contact information and document analysis. ';

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
   * Ask question about extracted contact or document
   */
  async askContact(text, question) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      const limitedText = text.substring(0, 8000);

      const prompt = `Answer the question about this contact/document.

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
      throw new Error(`Contact Q&A error: ${error.message}`);
    }
  }

  /**
   * Extract structured contact data for Odoo partner sync
   */
  async extractForOdoo(text) {
    try {
      if (!this.initialized) {
        throw new Error('Classifier not initialized');
      }

      const limitedText = text.substring(0, 6000);

      const prompt = `Extract contact information optimized for Odoo partner creation.

DOCUMENT TEXT:
${limitedText}

Extract and provide in JSON format:
{
  "name": "Display name or company name (REQUIRED)",
  "email": "Primary email address",
  "phone": "Primary phone number",
  "mobile": "Mobile/cell phone number",
  "fax": "Fax number",
  "website": "Website URL",
  "vat": "VAT ID (Partita IVA) - 11 digits without spaces",
  "street": "Street address",
  "city": "City",
  "zip": "Postal code",
  "country": "Country name",
  "isCompany": true/false,
  "comment": "Any additional notes"
}

RULES:
- VAT ID should have no spaces or special characters, just digits
- Phone numbers should be cleaned (remove spaces and special chars)
- Always include "name" field
- Respond with ONLY the JSON, no additional text`;

      const response = await this.callOllama(prompt);

      // Parse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      // Sanitize for Odoo
      return {
        name: data.name || '',
        email: data.email,
        phone: data.phone,
        mobile: data.mobile,
        fax: data.fax,
        website: data.website,
        vat: data.vat ? this.sanitizeVatId(data.vat) : undefined,
        street: data.street,
        city: data.city,
        zip: data.zip,
        country: data.country,
        isCompany: Boolean(data.isCompany),
        comment: data.comment
      };

    } catch (error) {
      throw new Error(`Odoo extraction error: ${error.message}`);
    }
  }
}

// Singleton instance
const contactClassifierService = new ContactClassifierService();

module.exports = contactClassifierService;
