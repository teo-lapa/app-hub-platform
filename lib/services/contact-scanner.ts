/**
 * CONTACT SCANNER SERVICE
 *
 * Service per scansionare biglietti da visita e documenti di contatto,
 * estrarre informazioni strutturate, enrichment con API esterne,
 * validazione, mapping a Odoo partner e salvataggio.
 *
 * Pipeline completa:
 * 1. Extraction: OCR + AI parsing (Claude Vision API)
 * 2. Enrichment: Arricchimento dati con API esterne (opzionale)
 * 3. Validation: Validazione dati estratti
 * 4. Mapping: Mapping a formato Odoo partner
 * 5. Sync: Salvataggio in Odoo (opzionale)
 */

import Anthropic from '@anthropic-ai/sdk';
import { callOdoo } from '@/lib/odoo-auth';
import type {
  ContactScanResult,
  ExtractedContact,
  EnrichedContactData,
  ValidationResult,
  MappingResult,
  OdooPartnerData,
  ProcessingStep,
  PhoneNumber,
  EmailAddress,
  PostalAddress,
  TaxIdentifier,
  FieldValidation,
  FieldMapping,
  ConfidenceLevel
} from '@/lib/types/contact-scan';

// ============================================================================
// SCANNER OPTIONS
// ============================================================================

export interface ScanOptions {
  /** Filename originale del documento */
  filename?: string;

  /** MIME type del file */
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg';

  /** Salta l'enrichment con API esterne */
  skipEnrichment?: boolean;

  /** Salta la validazione */
  skipValidation?: boolean;

  /** Salta il mapping a Odoo */
  skipMapping?: boolean;

  /** Lingua del documento */
  language?: string;

  /** Cookies Odoo per autenticazione */
  odooCookies?: string;

  /** UID utente Odoo */
  odooUid?: number;

  /** Salva automaticamente in Odoo dopo mapping */
  autoSaveToOdoo?: boolean;
}

// ============================================================================
// CONTACT SCANNER SERVICE
// ============================================================================

export class ContactScanner {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Scan and save contact from document
   * Pipeline completa: extraction -> enrichment -> validation -> mapping -> sync
   */
  async scanAndSave(
    fileBuffer: Buffer,
    options: ScanOptions
  ): Promise<ContactScanResult> {
    const scanId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    console.log(`🔍 [ContactScanner] Scan ${scanId} - Starting pipeline`);

    const processingSteps: ProcessingStep[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // ========== STEP 1: EXTRACTION ==========
    const extractionStep = this.createProcessingStep('extraction');
    processingSteps.push(extractionStep);

    let extractedContact: ExtractedContact | null = null;
    let extractionStatus: 'success' | 'failed' = 'failed';
    let extractionError: string | undefined;

    try {
      extractionStep.status = 'in_progress';
      extractionStep.startedAt = new Date().toISOString();

      extractedContact = await this.extractContact(fileBuffer, options);

      extractionStep.status = 'completed';
      extractionStep.completedAt = new Date().toISOString();
      extractionStep.duration = Date.now() - new Date(extractionStep.startedAt!).getTime();
      extractionStatus = 'success';

      console.log(`✅ [ContactScanner] Extraction completed: ${extractedContact.displayName}`);
    } catch (error) {
      extractionStep.status = 'failed';
      extractionStep.error = error instanceof Error ? error.message : 'Unknown error';
      extractionStep.completedAt = new Date().toISOString();
      extractionError = extractionStep.error;
      errors.push(extractionError);

      console.error(`❌ [ContactScanner] Extraction failed:`, error);
    }

    // ========== STEP 2: ENRICHMENT (OPTIONAL) ==========
    const enrichmentStep = this.createProcessingStep('enrichment');
    processingSteps.push(enrichmentStep);

    let enrichedData: EnrichedContactData | null = null;
    let enrichmentStatus: 'success' | 'skipped' | 'failed' = 'skipped';
    let enrichmentError: string | undefined;

    if (!options.skipEnrichment && extractedContact) {
      try {
        enrichmentStep.status = 'in_progress';
        enrichmentStep.startedAt = new Date().toISOString();

        enrichedData = await this.enrichContact(extractedContact);

        enrichmentStep.status = 'completed';
        enrichmentStep.completedAt = new Date().toISOString();
        enrichmentStep.duration = Date.now() - new Date(enrichmentStep.startedAt!).getTime();
        enrichmentStatus = 'success';

        console.log(`✅ [ContactScanner] Enrichment completed (score: ${enrichedData.enrichmentScore})`);
      } catch (error) {
        enrichmentStep.status = 'failed';
        enrichmentStep.error = error instanceof Error ? error.message : 'Unknown error';
        enrichmentStep.completedAt = new Date().toISOString();
        enrichmentStatus = 'failed';
        enrichmentError = enrichmentStep.error;
        warnings.push(`Enrichment failed: ${enrichmentError}`);

        console.warn(`⚠️ [ContactScanner] Enrichment failed:`, error);
      }
    } else {
      enrichmentStep.status = 'skipped';
      enrichmentStep.completedAt = new Date().toISOString();
    }

    // ========== STEP 3: VALIDATION (OPTIONAL) ==========
    const validationStep = this.createProcessingStep('validation');
    processingSteps.push(validationStep);

    let validationResult: ValidationResult | null = null;
    let validationStatus: 'success' | 'warning' | 'failed' = 'failed';
    let validationError: string | undefined;

    if (!options.skipValidation && extractedContact) {
      try {
        validationStep.status = 'in_progress';
        validationStep.startedAt = new Date().toISOString();

        validationResult = await this.validateContact(extractedContact, enrichedData);

        validationStep.status = 'completed';
        validationStep.completedAt = new Date().toISOString();
        validationStep.duration = Date.now() - new Date(validationStep.startedAt!).getTime();

        if (validationResult.isValid) {
          validationStatus = validationResult.warnings.length > 0 ? 'warning' : 'success';
        } else {
          validationStatus = 'failed';
          errors.push(...validationResult.errors);
        }

        warnings.push(...validationResult.warnings);

        console.log(`✅ [ContactScanner] Validation completed: ${validationStatus}`);
      } catch (error) {
        validationStep.status = 'failed';
        validationStep.error = error instanceof Error ? error.message : 'Unknown error';
        validationStep.completedAt = new Date().toISOString();
        validationError = validationStep.error;
        warnings.push(`Validation failed: ${validationError}`);

        console.warn(`⚠️ [ContactScanner] Validation failed:`, error);
      }
    } else {
      validationStep.status = 'skipped';
      validationStep.completedAt = new Date().toISOString();
      validationStatus = 'success'; // Skip non è un errore
    }

    // ========== STEP 4: MAPPING ==========
    const mappingStep = this.createProcessingStep('mapping');
    processingSteps.push(mappingStep);

    let mappingResult: MappingResult | null = null;
    let mappingStatus: 'success' | 'failed' = 'failed';
    let mappingError: string | undefined;

    if (!options.skipMapping && extractedContact) {
      try {
        mappingStep.status = 'in_progress';
        mappingStep.startedAt = new Date().toISOString();

        mappingResult = await this.mapToOdoo(extractedContact, enrichedData);

        mappingStep.status = 'completed';
        mappingStep.completedAt = new Date().toISOString();
        mappingStep.duration = Date.now() - new Date(mappingStep.startedAt!).getTime();
        mappingStatus = 'success';

        warnings.push(...mappingResult.warnings);

        console.log(`✅ [ContactScanner] Mapping completed (fill: ${mappingResult.overallFillPercentage}%)`);
      } catch (error) {
        mappingStep.status = 'failed';
        mappingStep.error = error instanceof Error ? error.message : 'Unknown error';
        mappingStep.completedAt = new Date().toISOString();
        mappingError = mappingStep.error;
        errors.push(mappingError);

        console.error(`❌ [ContactScanner] Mapping failed:`, error);
      }
    } else {
      mappingStep.status = 'skipped';
      mappingStep.completedAt = new Date().toISOString();
    }

    // ========== STEP 5: ODOO SYNC (OPTIONAL) ==========
    let odooSync: ContactScanResult['odooSync'] = undefined;

    if (options.autoSaveToOdoo && mappingResult && options.odooCookies) {
      const syncStep = this.createProcessingStep('odoo_sync');
      processingSteps.push(syncStep);

      try {
        syncStep.status = 'in_progress';
        syncStep.startedAt = new Date().toISOString();

        const partnerId = await this.saveToOdoo(
          mappingResult.odooData,
          options.odooCookies
        );

        syncStep.status = 'completed';
        syncStep.completedAt = new Date().toISOString();
        syncStep.duration = Date.now() - new Date(syncStep.startedAt!).getTime();

        odooSync = {
          status: 'success',
          partnerId,
          syncedAt: new Date().toISOString()
        };

        console.log(`✅ [ContactScanner] Odoo sync completed: Partner ${partnerId}`);
      } catch (error) {
        syncStep.status = 'failed';
        syncStep.error = error instanceof Error ? error.message : 'Unknown error';
        syncStep.completedAt = new Date().toISOString();

        odooSync = {
          status: 'failed',
          error: syncStep.error
        };

        warnings.push(`Odoo sync failed: ${syncStep.error}`);

        console.warn(`⚠️ [ContactScanner] Odoo sync failed:`, error);
      }
    }

    // ========== CALCULATE QUALITY METRICS ==========
    const qualityScore = this.calculateQualityScore(extractedContact, enrichedData);
    const completenessScore = mappingResult?.overallFillPercentage || 0;
    const confidenceScore = this.calculateConfidenceScore(extractedContact, enrichedData);

    // ========== DETERMINE OVERALL STATUS ==========
    let status: 'success' | 'partial' | 'failed' = 'failed';

    if (extractionStatus === 'success' && mappingStatus === 'success') {
      status = errors.length === 0 ? 'success' : 'partial';
    } else if (extractionStatus === 'success') {
      status = 'partial';
    }

    // ========== SUMMARY ==========
    const extractedFields = extractedContact ? this.getExtractedFields(extractedContact) : [];
    const enrichedFields = enrichedData ? this.getEnrichedFields(enrichedData) : [];
    const failedFields: string[] = [];

    const summary = this.generateSummary(
      status,
      extractedContact,
      mappingResult,
      odooSync
    );

    // ========== BUILD RESULT ==========
    const completedAt = new Date().toISOString();
    const duration = Date.now() - startTime;

    const result: ContactScanResult = {
      scanId,
      status,
      startedAt,
      completedAt,
      duration,

      extraction: {
        status: extractionStatus,
        contact: extractedContact,
        error: extractionError,
        step: extractionStep
      },

      enrichment: {
        status: enrichmentStatus,
        data: enrichedData,
        error: enrichmentError,
        step: enrichmentStep
      },

      validation: {
        status: validationStatus,
        result: validationResult,
        error: validationError,
        step: validationStep
      },

      mapping: {
        status: mappingStatus,
        result: mappingResult,
        error: mappingError,
        step: mappingStep
      },

      processingSteps,
      readyForSync: mappingResult?.hasRequiredFields || false,
      odooSync,

      qualityScore,
      completenessScore,
      confidenceScore,

      summary,
      warnings,
      errors,

      extractedFields,
      enrichedFields,
      failedFields,

      source: {
        type: this.getDocumentType(options.mimeType),
        filename: options.filename
      },

      options: {
        skipEnrichment: options.skipEnrichment,
        skipValidation: options.skipValidation,
        skipMapping: options.skipMapping,
        language: options.language
      }
    };

    console.log(`✅ [ContactScanner] Scan ${scanId} completed in ${duration}ms - Status: ${status}`);

    return result;
  }

  // ==========================================================================
  // PRIVATE METHODS - EXTRACTION
  // ==========================================================================

  private async extractContact(
    fileBuffer: Buffer,
    options: ScanOptions
  ): Promise<ExtractedContact> {
    console.log(`🔍 [ContactScanner] Starting extraction with Claude Vision API`);

    const base64Data = fileBuffer.toString('base64');
    const mediaType = this.getMediaType(options.mimeType);

    const prompt = `Analyze this business card or contact document and extract ALL contact information in structured JSON format.

Extract the following information:
- First name, last name, full display name
- Job title and department
- Company name and aliases
- All phone numbers (classify as mobile/landline/fax/whatsapp)
- All email addresses (classify as work/personal)
- Full postal address (street, city, state, postal code, country)
- Tax identifiers (VAT ID, Fiscal Code, business registration numbers)
- Website URL
- Any additional notes

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "displayName": "string (required)",
  "jobTitle": "string or null",
  "department": "string or null",
  "companyName": "string or null",
  "companyAliases": ["string array or empty"],
  "taxIdentifier": {
    "vatId": "string or null",
    "fiscalCode": "string or null",
    "vatCountry": "string or null"
  },
  "phones": [
    {
      "value": "string",
      "formatted": "string",
      "type": "mobile|landline|fax|whatsapp|other",
      "countryCode": "IT|CH|etc",
      "confidence": "high|medium|low",
      "source": "ocr"
    }
  ],
  "emails": [
    {
      "value": "string",
      "type": "work|personal|other",
      "confidence": "high|medium|low",
      "source": "ocr"
    }
  ],
  "address": {
    "fullAddress": "string",
    "street": "string or null",
    "city": "string or null",
    "state": "string or null",
    "postalCode": "string or null",
    "country": "string or null",
    "type": "billing|shipping|residential|other",
    "confidence": "high|medium|low",
    "source": "ocr"
  },
  "website": "string or null",
  "notes": "string or null",
  "detectedLanguage": "it|en|de|fr|etc",
  "rawText": "full extracted text"
}

Be thorough and extract ALL visible information. If a field is not found, use null or empty array.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      const textContent = response.content.find(c => c.type === 'text');

      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude API');
      }

      const jsonText = this.cleanJsonResponse(textContent.text);
      const extractedData = JSON.parse(jsonText);

      // Add extraction timestamp
      const extractedContact: ExtractedContact = {
        ...extractedData,
        extractedAt: new Date().toISOString()
      };

      console.log(`✅ [ContactScanner] Extraction successful: ${extractedContact.displayName}`);

      return extractedContact;
    } catch (error) {
      console.error(`❌ [ContactScanner] Extraction failed:`, error);
      throw new Error(
        `Failed to extract contact from document: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - ENRICHMENT
  // ==========================================================================

  private async enrichContact(
    contact: ExtractedContact
  ): Promise<EnrichedContactData> {
    console.log(`🔍 [ContactScanner] Starting enrichment for: ${contact.displayName}`);

    // NOTE: This is a placeholder implementation
    // In production, you would integrate with external APIs like:
    // - Clearbit for company data
    // - Hunter.io for email verification
    // - Google Places for address validation
    // - LinkedIn for social profiles
    // - etc.

    const enrichedData: EnrichedContactData = {
      sources: [
        {
          name: 'internal',
          confidence: 'high',
          retrievedAt: new Date().toISOString(),
          official: false
        }
      ],
      enrichmentScore: 0,
      enrichedAt: new Date().toISOString(),
      notes: 'Enrichment placeholder - integrate external APIs for production'
    };

    console.log(`✅ [ContactScanner] Enrichment completed (score: ${enrichedData.enrichmentScore})`);

    return enrichedData;
  }

  // ==========================================================================
  // PRIVATE METHODS - VALIDATION
  // ==========================================================================

  private async validateContact(
    contact: ExtractedContact,
    enrichment: EnrichedContactData | null
  ): Promise<ValidationResult> {
    console.log(`🔍 [ContactScanner] Validating contact: ${contact.displayName}`);

    const fieldValidations: FieldValidation[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate display name (required)
    if (!contact.displayName || contact.displayName.trim().length === 0) {
      errors.push('Display name is required');
      fieldValidations.push({
        field: 'displayName',
        isValid: false,
        error: 'Display name cannot be empty',
        value: contact.displayName
      });
    } else {
      fieldValidations.push({
        field: 'displayName',
        isValid: true,
        value: contact.displayName
      });
    }

    // Validate emails
    contact.emails.forEach((email, index) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(email.value);

      if (!isValid) {
        warnings.push(`Invalid email format: ${email.value}`);
      }

      fieldValidations.push({
        field: `emails[${index}]`,
        isValid,
        value: email.value,
        warnings: isValid ? undefined : [`Email format may be invalid: ${email.value}`]
      });
    });

    // Validate phones
    contact.phones.forEach((phone, index) => {
      const isValid = phone.value.length >= 5; // Basic validation

      if (!isValid) {
        warnings.push(`Phone number too short: ${phone.value}`);
      }

      fieldValidations.push({
        field: `phones[${index}]`,
        isValid,
        value: phone.value,
        warnings: isValid ? undefined : [`Phone number may be invalid: ${phone.value}`]
      });
    });

    // Validate VAT ID (if present)
    if (contact.taxIdentifier?.vatId) {
      const vatRegex = /^[A-Z]{2}[0-9A-Z]+$/;
      const isValid = vatRegex.test(contact.taxIdentifier.vatId);

      if (!isValid) {
        warnings.push(`VAT ID format may be invalid: ${contact.taxIdentifier.vatId}`);
      }

      fieldValidations.push({
        field: 'taxIdentifier.vatId',
        isValid,
        value: contact.taxIdentifier.vatId,
        warnings: isValid ? undefined : ['VAT ID format may be invalid']
      });
    }

    const isValid = errors.length === 0;

    const validationResult: ValidationResult = {
      isValid,
      fieldValidations,
      errors,
      warnings,
      validatedAt: new Date().toISOString()
    };

    console.log(`✅ [ContactScanner] Validation completed: ${isValid ? 'VALID' : 'INVALID'}`);

    return validationResult;
  }

  // ==========================================================================
  // PRIVATE METHODS - MAPPING
  // ==========================================================================

  private async mapToOdoo(
    contact: ExtractedContact,
    enrichment: EnrichedContactData | null
  ): Promise<MappingResult> {
    console.log(`🔍 [ContactScanner] Mapping to Odoo format: ${contact.displayName}`);

    const fieldMappings: FieldMapping[] = [];
    const warnings: string[] = [];
    const missingRequiredFields: string[] = [];

    // Map name (REQUIRED)
    const name = contact.displayName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

    if (!name) {
      missingRequiredFields.push('name');
    }

    fieldMappings.push({
      odooField: 'name',
      sourcePath: 'displayName',
      fillPercentage: name ? 100 : 0,
      confidence: 'high',
      value: name
    });

    // Map company flag
    const isCompany = !!contact.companyName;

    fieldMappings.push({
      odooField: 'is_company',
      sourcePath: 'companyName',
      fillPercentage: 100,
      confidence: 'high',
      value: isCompany
    });

    // Map email (primary)
    const primaryEmail = contact.emails.find(e => e.type === 'work') || contact.emails[0];

    fieldMappings.push({
      odooField: 'email',
      sourcePath: 'emails[0].value',
      fillPercentage: primaryEmail ? 100 : 0,
      confidence: primaryEmail?.confidence || 'low',
      value: primaryEmail?.value || null
    });

    // Map phones
    const mobilePhone = contact.phones.find(p => p.type === 'mobile');
    const landlinePhone = contact.phones.find(p => p.type === 'landline');

    fieldMappings.push({
      odooField: 'mobile',
      sourcePath: 'phones[mobile]',
      fillPercentage: mobilePhone ? 100 : 0,
      confidence: mobilePhone?.confidence || 'low',
      value: mobilePhone?.formatted || mobilePhone?.value || null
    });

    fieldMappings.push({
      odooField: 'phone',
      sourcePath: 'phones[landline]',
      fillPercentage: landlinePhone ? 100 : 0,
      confidence: landlinePhone?.confidence || 'low',
      value: landlinePhone?.formatted || landlinePhone?.value || null
    });

    // Map address
    const address = contact.address;

    if (address) {
      fieldMappings.push(
        {
          odooField: 'street',
          sourcePath: 'address.street',
          fillPercentage: address.street ? 100 : 0,
          confidence: address.confidence,
          value: address.street
        },
        {
          odooField: 'city',
          sourcePath: 'address.city',
          fillPercentage: address.city ? 100 : 0,
          confidence: address.confidence,
          value: address.city
        },
        {
          odooField: 'zip',
          sourcePath: 'address.postalCode',
          fillPercentage: address.postalCode ? 100 : 0,
          confidence: address.confidence,
          value: address.postalCode
        }
      );
    }

    // Map VAT
    const vat = contact.taxIdentifier?.vatId;

    fieldMappings.push({
      odooField: 'vat',
      sourcePath: 'taxIdentifier.vatId',
      fillPercentage: vat ? 100 : 0,
      confidence: contact.taxIdentifier?.confidence || 'low',
      value: vat
    });

    // Map website
    fieldMappings.push({
      odooField: 'website',
      sourcePath: 'website',
      fillPercentage: contact.website ? 100 : 0,
      confidence: 'medium',
      value: contact.website
    });

    // Build Odoo partner data
    const odooData: OdooPartnerData = {
      name,
      isCompany,
      email: primaryEmail?.value,
      mobile: mobilePhone?.formatted || mobilePhone?.value,
      phone: landlinePhone?.formatted || landlinePhone?.value,
      street: address?.street,
      city: address?.city,
      zip: address?.postalCode,
      vat,
      website: contact.website,
      active: true,
      comment: contact.notes
    };

    // Calculate fill percentage
    const totalFields = Object.keys(odooData).length;
    const filledFields = Object.values(odooData).filter(v => v !== null && v !== undefined).length;
    const overallFillPercentage = Math.round((filledFields / totalFields) * 100);

    const hasRequiredFields = missingRequiredFields.length === 0;

    const mappingResult: MappingResult = {
      odooData,
      fieldMappings,
      overallFillPercentage,
      hasRequiredFields,
      missingRequiredFields,
      warnings,
      mappedAt: new Date().toISOString()
    };

    console.log(`✅ [ContactScanner] Mapping completed (fill: ${overallFillPercentage}%)`);

    return mappingResult;
  }

  // ==========================================================================
  // PRIVATE METHODS - ODOO SYNC
  // ==========================================================================

  private async saveToOdoo(
    odooData: OdooPartnerData,
    cookies: string
  ): Promise<number> {
    console.log(`🔍 [ContactScanner] Saving to Odoo: ${odooData.name}`);

    try {
      // Check if partner already exists by email or VAT
      let existingPartnerId: number | null = null;

      if (odooData.email) {
        const existingByEmail = await callOdoo(
          cookies,
          'res.partner',
          'search',
          [[['email', '=', odooData.email]]],
          { limit: 1 }
        );

        if (existingByEmail && existingByEmail.length > 0) {
          existingPartnerId = existingByEmail[0];
          console.log(`📌 [ContactScanner] Found existing partner by email: ${existingPartnerId}`);
        }
      }

      if (!existingPartnerId && odooData.vat) {
        const existingByVat = await callOdoo(
          cookies,
          'res.partner',
          'search',
          [[['vat', '=', odooData.vat]]],
          { limit: 1 }
        );

        if (existingByVat && existingByVat.length > 0) {
          existingPartnerId = existingByVat[0];
          console.log(`📌 [ContactScanner] Found existing partner by VAT: ${existingPartnerId}`);
        }
      }

      let partnerId: number;

      if (existingPartnerId) {
        // Update existing partner
        await callOdoo(
          cookies,
          'res.partner',
          'write',
          [[existingPartnerId], odooData]
        );

        partnerId = existingPartnerId;
        console.log(`✅ [ContactScanner] Updated existing partner: ${partnerId}`);
      } else {
        // Create new partner
        partnerId = await callOdoo(
          cookies,
          'res.partner',
          'create',
          [odooData]
        );

        console.log(`✅ [ContactScanner] Created new partner: ${partnerId}`);
      }

      return partnerId;
    } catch (error) {
      console.error(`❌ [ContactScanner] Failed to save to Odoo:`, error);
      throw new Error(
        `Failed to save partner to Odoo: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private createProcessingStep(name: string): ProcessingStep {
    return {
      name,
      status: 'pending'
    };
  }

  private getMediaType(mimeType: string): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
    if (mimeType === 'application/pdf') {
      throw new Error('PDF files are not supported by Claude Vision API. PDF contact scanning must use Jetson OCR service.');
    }
    if (mimeType === 'image/png') return 'image/png';
    if (mimeType === 'image/gif') return 'image/gif';
    if (mimeType === 'image/webp') return 'image/webp';
    return 'image/jpeg'; // Default for image/jpeg and other image formats
  }

  private getDocumentType(mimeType: string): 'pdf' | 'image' {
    return mimeType === 'application/pdf' ? 'pdf' : 'image';
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code blocks if present
    let cleaned = text.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/^```\n?/, '');
      cleaned = cleaned.replace(/\n?```$/, '');
    }

    return cleaned.trim();
  }

  private calculateQualityScore(
    contact: ExtractedContact | null,
    enrichment: EnrichedContactData | null
  ): number {
    if (!contact) return 0;

    let score = 0;

    // Base score for having a name
    if (contact.displayName) score += 20;

    // Contact methods
    if (contact.emails.length > 0) score += 15;
    if (contact.phones.length > 0) score += 15;

    // Address
    if (contact.address) score += 15;

    // Company info
    if (contact.companyName) score += 10;
    if (contact.jobTitle) score += 5;

    // Tax info
    if (contact.taxIdentifier?.vatId) score += 10;

    // Website
    if (contact.website) score += 5;

    // Enrichment bonus
    if (enrichment && enrichment.enrichmentScore > 0) {
      score += Math.min(enrichment.enrichmentScore / 10, 5);
    }

    return Math.min(Math.round(score), 100);
  }

  private calculateConfidenceScore(
    contact: ExtractedContact | null,
    enrichment: EnrichedContactData | null
  ): number {
    if (!contact) return 0;

    const confidenceMap: Record<ConfidenceLevel, number> = {
      high: 100,
      medium: 60,
      low: 30
    };

    let totalConfidence = 0;
    let count = 0;

    // Average email confidence
    contact.emails.forEach(email => {
      totalConfidence += confidenceMap[email.confidence];
      count++;
    });

    // Average phone confidence
    contact.phones.forEach(phone => {
      totalConfidence += confidenceMap[phone.confidence];
      count++;
    });

    // Address confidence
    if (contact.address) {
      totalConfidence += confidenceMap[contact.address.confidence];
      count++;
    }

    return count > 0 ? Math.round(totalConfidence / count) : 0;
  }

  private getExtractedFields(contact: ExtractedContact): string[] {
    const fields: string[] = [];

    if (contact.firstName) fields.push('firstName');
    if (contact.lastName) fields.push('lastName');
    if (contact.displayName) fields.push('displayName');
    if (contact.jobTitle) fields.push('jobTitle');
    if (contact.department) fields.push('department');
    if (contact.companyName) fields.push('companyName');
    if (contact.emails.length > 0) fields.push('emails');
    if (contact.phones.length > 0) fields.push('phones');
    if (contact.address) fields.push('address');
    if (contact.taxIdentifier) fields.push('taxIdentifier');
    if (contact.website) fields.push('website');

    return fields;
  }

  private getEnrichedFields(enrichment: EnrichedContactData): string[] {
    const fields: string[] = [];

    if (enrichment.companyInfo) fields.push('companyInfo');
    if (enrichment.companyWebsite) fields.push('companyWebsite');
    if (enrichment.socialMedia && enrichment.socialMedia.length > 0) fields.push('socialMedia');
    if (enrichment.logo) fields.push('logo');

    return fields;
  }

  private generateSummary(
    status: 'success' | 'partial' | 'failed',
    contact: ExtractedContact | null,
    mapping: MappingResult | null,
    odooSync: ContactScanResult['odooSync']
  ): string {
    if (status === 'failed') {
      return 'Scan failed - unable to extract contact information';
    }

    if (status === 'partial') {
      return `Partial scan completed for ${contact?.displayName || 'unknown contact'} - some steps failed`;
    }

    const name = contact?.displayName || 'Unknown';
    const fillPercentage = mapping?.overallFillPercentage || 0;

    if (odooSync?.status === 'success') {
      return `Successfully scanned and saved ${name} to Odoo (Partner #${odooSync.partnerId}) - ${fillPercentage}% complete`;
    }

    return `Successfully scanned ${name} - ${fillPercentage}% data completeness`;
  }
}
