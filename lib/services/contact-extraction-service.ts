/**
 * Contact Extraction Service
 * Wraps contact-classifier.js and provides TypeScript integration
 * Maps extracted data to contact-scan.ts types
 */

import { spawn } from 'child_process';
import path from 'path';
import {
  ExtractedContact,
  PhoneNumber,
  EmailAddress,
  PostalAddress,
  TaxIdentifier,
  ExtractionSource,
  ConfidenceLevel
} from '@/lib/types/contact-scan';

/**
 * Contact extraction result from classifier service
 */
interface ClassifierResult {
  displayName: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  jobTitle?: string;
  emails: Array<{
    value: string;
    type?: string;
    confidence?: string;
  }>;
  phones: Array<{
    value: string;
    formatted?: string;
    type?: string;
    countryCode?: string;
    confidence?: string;
  }>;
  address?: {
    fullAddress: string;
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    confidence?: string;
  };
  website?: string;
  taxIdentifiers?: {
    vatId?: string;
    fiscalCode?: string;
    confidence?: string;
  };
  confidence: number;
  extractedFields: string[];
  duration: number;
  method?: string;
  error?: string;
  rawResponse?: string;
  model?: string;
}

/**
 * Contact Extraction Service
 */
export class ContactExtractionService {
  private classifierPath: string;
  private isInitialized: boolean = false;

  constructor() {
    // Percorso al servizio Ollama
    this.classifierPath = path.join(
      process.cwd(),
      'jetson-deployment/server/contact-classifier.js'
    );
  }

  /**
   * Inizializza il servizio (verifica Ollama disponibile)
   */
  async initialize(): Promise<void> {
    try {
      // Verifica che il file esista
      const fs = await import('fs').then(m => m.promises);
      await fs.access(this.classifierPath);

      console.log('✅ Contact Extraction Service initialized');
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Contact Extraction Service:', error);
      throw new Error('Contact Extraction Service not available');
    }
  }

  /**
   * Extract contact information from OCR text
   */
  async extractContact(ocrText: string): Promise<ExtractedContact> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      // Call the classifier service
      const result = await this.callClassifier('extractContact', ocrText);
      const classifierResult = result as ClassifierResult;

      // Map to ExtractedContact type
      return this.mapToExtractedContact(classifierResult);
    } catch (error) {
      console.error('Contact extraction failed:', error);

      // Return minimal contact on error
      return {
        displayName: 'Unknown Contact',
        phones: [],
        emails: [],
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Extract contact information optimized for Odoo
   */
  async extractForOdoo(ocrText: string): Promise<Record<string, any>> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    try {
      const result = await this.callClassifier('extractForOdoo', ocrText);
      return result;
    } catch (error) {
      console.error('Odoo extraction failed:', error);
      return { name: 'Unknown' };
    }
  }

  /**
   * Map classifier result to ExtractedContact type
   */
  private mapToExtractedContact(result: ClassifierResult): ExtractedContact {
    // Map emails
    const emails: EmailAddress[] = (result.emails || []).map(e => ({
      value: e.value,
      type: (e.type as any) || 'work',
      confidence: this.mapConfidence(e.confidence),
      source: 'ocr' as ExtractionSource
    }));

    // Map phones
    const phones: PhoneNumber[] = (result.phones || []).map(p => ({
      value: p.value,
      formatted: p.formatted,
      type: (p.type as any) || 'landline',
      countryCode: p.countryCode || this.inferCountryCode(p.value),
      confidence: this.mapConfidence(p.confidence),
      source: 'ocr' as ExtractionSource
    }));

    // Map address
    let address: PostalAddress | undefined;
    if (result.address) {
      address = {
        fullAddress: result.address.fullAddress,
        street: result.address.street,
        city: result.address.city,
        postalCode: result.address.postalCode,
        country: result.address.country,
        confidence: this.mapConfidence(result.address.confidence),
        source: 'ocr' as ExtractionSource
      };
    }

    // Map tax identifiers
    let taxIdentifier: TaxIdentifier | undefined;
    if (result.taxIdentifiers) {
      taxIdentifier = {
        vatId: result.taxIdentifiers.vatId,
        fiscalCode: result.taxIdentifiers.fiscalCode,
        confidence: this.mapConfidence(result.taxIdentifiers.confidence),
        source: 'ocr' as ExtractionSource
      };
    }

    // Build extracted contact
    const contact: ExtractedContact = {
      displayName: result.displayName || 'Unknown',
      firstName: result.firstName,
      lastName: result.lastName,
      companyName: result.companyName,
      jobTitle: result.jobTitle,
      emails,
      phones,
      address,
      website: result.website,
      taxIdentifier,
      sourceDocument: result.model,
      notes: result.error || undefined,
      rawText: result.rawResponse,
      extractedAt: new Date().toISOString()
    };

    return contact;
  }

  /**
   * Map string confidence to ConfidenceLevel type
   */
  private mapConfidence(confidence?: string): ConfidenceLevel {
    if (!confidence) return 'medium';
    const lower = confidence.toLowerCase();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
    return 'medium';
  }

  /**
   * Infer country code from phone number
   */
  private inferCountryCode(phone: string): string {
    if (phone.includes('+39') || phone.includes('0039') || phone.startsWith('39')) {
      return 'IT';
    }
    if (phone.includes('+41') || phone.includes('0041') || phone.startsWith('41')) {
      return 'CH';
    }
    if (phone.includes('+1')) {
      return 'US';
    }
    return 'IT'; // Default to Italy
  }

  /**
   * Call classifier service via Node.js process
   */
  private callClassifier(method: string, text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [
        '-e',
        `
          const classifier = require('${this.classifierPath}');
          (async () => {
            try {
              await classifier.initialize();
              const result = await classifier.${method}('${this.escapeString(text)}');
              console.log(JSON.stringify(result));
            } catch (error) {
              console.error(JSON.stringify({ error: error.message }));
              process.exit(1);
            }
          })();
        `
      ]);

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Classifier error: ${errorOutput}`));
        } else {
          try {
            const result = JSON.parse(output);
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (error) {
            reject(new Error(`Failed to parse classifier output: ${output}`));
          }
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Escape string for shell injection protection
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n').substring(0, 1000);
  }

  /**
   * Check if classifier service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.callClassifier('chat', 'Ciao');
      return !result.error;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let contactExtractionService: ContactExtractionService | null = null;

/**
 * Get or create singleton instance
 */
export async function getContactExtractionService(): Promise<ContactExtractionService> {
  if (!contactExtractionService) {
    contactExtractionService = new ContactExtractionService();
    try {
      await contactExtractionService.initialize();
    } catch (error) {
      console.warn('Contact extraction service not available:', error);
      // Still return instance but it won't work
    }
  }
  return contactExtractionService;
}

/**
 * Quick extraction helper
 */
export async function extractContact(ocrText: string): Promise<ExtractedContact> {
  const service = await getContactExtractionService();
  return service.extractContact(ocrText);
}

/**
 * Extract for Odoo helper
 */
export async function extractContactForOdoo(ocrText: string): Promise<Record<string, any>> {
  const service = await getContactExtractionService();
  return service.extractForOdoo(ocrText);
}
