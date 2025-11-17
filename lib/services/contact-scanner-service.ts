import { createOdooRPCClient, OdooRPCClient } from '@/lib/odoo/rpcClient';
import type {
  ExtractedContact,
  EnrichedContactData,
  OdooPartnerData,
  ContactScanResult,
  MappingResult,
  ValidationResult,
  ProcessingStep,
  FieldMapping,
  ConfidenceLevel,
  PhoneNumber,
  EmailAddress,
} from '@/lib/types/contact-scan';

/**
 * ContactScannerService - Production-ready service for contact extraction, enrichment, and Odoo sync
 *
 * PIPELINE:
 * 1. extractContact() - Calls Jetson OCR API to extract contact info from document
 * 2. enrichContact() - Enriches extracted data with external APIs (company info, social media, etc)
 * 3. validateAndMap() - Validates data and maps to Odoo res.partner format
 * 4. saveToOdoo() - Creates/updates partner in Odoo using OdooRPCClient
 * 5. scanAndSave() - Complete pipeline orchestration
 *
 * ENVIRONMENT VARIABLES:
 * - JETSON_OCR_URL: Jetson OCR API endpoint (e.g., http://192.168.1.100:8000)
 * - JETSON_WEBHOOK_SECRET: Secret for Jetson API authentication
 * - ODOO_URL: Odoo instance URL
 *
 * USAGE:
 * ```typescript
 * const service = new ContactScannerService();
 * const result = await service.scanAndSave(documentBase64, {
 *   skipEnrichment: false,
 *   autoSyncToOdoo: true,
 *   language: 'it',
 * });
 * console.log('Partner ID:', result.odooSync?.partnerId);
 * ```
 */
export class ContactScannerService {
  private jetsonUrl: string;
  private jetsonSecret: string;
  private odooClient: OdooRPCClient;

  constructor(sessionId?: string) {
    // Initialize Jetson OCR configuration
    this.jetsonUrl = process.env.JETSON_OCR_URL || 'http://192.168.1.100:8000';
    this.jetsonSecret = process.env.JETSON_WEBHOOK_SECRET || '';

    // Initialize Odoo RPC client with auto-reconnect
    this.odooClient = createOdooRPCClient(sessionId);

    console.log('[ContactScannerService] Initialized', {
      jetsonUrl: this.jetsonUrl,
      hasSecret: !!this.jetsonSecret,
    });
  }

  // ============================================================================
  // STEP 1: EXTRACTION FROM DOCUMENT
  // ============================================================================

  /**
   * Extract contact information from document using Jetson OCR API
   *
   * @param documentContent - Base64 encoded document (PDF, image, etc)
   * @param options - Extraction options (language, document type, etc)
   * @returns ExtractedContact with confidence scores
   */
  async extractContact(
    documentContent: string,
    options?: {
      language?: string;
      documentType?: 'business_card' | 'invoice' | 'document' | 'auto';
      extractRawText?: boolean;
    }
  ): Promise<ExtractedContact> {
    const step = this.createProcessingStep('extraction');

    try {
      console.log('[ContactScannerService] Extracting contact from document', options);

      // Call Jetson OCR API
      const response = await fetch(`${this.jetsonUrl}/api/v1/extract-contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.jetsonSecret}`,
        },
        body: JSON.stringify({
          document: documentContent,
          language: options?.language || 'auto',
          document_type: options?.documentType || 'auto',
          extract_raw_text: options?.extractRawText ?? true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jetson OCR API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Map Jetson response to ExtractedContact
      const extractedContact: ExtractedContact = this.mapJetsonResponse(result);

      this.completeProcessingStep(step, 'completed');

      console.log('[ContactScannerService] Contact extracted successfully', {
        displayName: extractedContact.displayName,
        phoneCount: extractedContact.phones.length,
        emailCount: extractedContact.emails.length,
      });

      return extractedContact;

    } catch (error: any) {
      this.completeProcessingStep(step, 'failed', error.message);
      console.error('[ContactScannerService] Extraction failed:', error);
      throw new Error(`Failed to extract contact: ${error.message}`);
    }
  }

  /**
   * Map Jetson API response to ExtractedContact format
   */
  private mapJetsonResponse(jetsonData: any): ExtractedContact {
    const now = new Date().toISOString();

    return {
      // Personal information
      firstName: jetsonData.first_name || undefined,
      lastName: jetsonData.last_name || undefined,
      displayName: jetsonData.display_name || jetsonData.full_name || 'Unknown Contact',
      jobTitle: jetsonData.job_title || undefined,
      department: jetsonData.department || undefined,

      // Company information
      companyName: jetsonData.company_name || jetsonData.organization || undefined,
      companyAliases: jetsonData.company_aliases || undefined,
      taxIdentifier: jetsonData.tax_info ? {
        vatId: jetsonData.tax_info.vat_id,
        fiscalCode: jetsonData.tax_info.fiscal_code,
        vatCountry: jetsonData.tax_info.vat_country,
        businessRegistrationNumber: jetsonData.tax_info.business_reg_number,
        companyRegistrationNumber: jetsonData.tax_info.company_reg_number,
        confidence: jetsonData.tax_info.confidence || 'medium',
        source: 'ocr',
      } : undefined,

      // Contact information
      phones: this.mapPhoneNumbers(jetsonData.phones || []),
      emails: this.mapEmailAddresses(jetsonData.emails || []),
      address: jetsonData.address ? {
        fullAddress: jetsonData.address.full_address || '',
        street: jetsonData.address.street,
        city: jetsonData.address.city,
        state: jetsonData.address.state,
        postalCode: jetsonData.address.postal_code,
        country: jetsonData.address.country,
        type: jetsonData.address.type || 'other',
        latitude: jetsonData.address.latitude,
        longitude: jetsonData.address.longitude,
        confidence: jetsonData.address.confidence || 'medium',
        source: 'ocr',
      } : undefined,
      website: jetsonData.website || undefined,

      // Metadata
      sourceDocument: jetsonData.source_document || undefined,
      notes: jetsonData.notes || undefined,
      detectedLanguage: jetsonData.detected_language || undefined,
      rawText: jetsonData.raw_text || undefined,
      extractedAt: now,
    };
  }

  /**
   * Map phone numbers from Jetson format
   */
  private mapPhoneNumbers(phones: any[]): PhoneNumber[] {
    return phones.map((phone: any) => ({
      value: phone.value || phone.number || '',
      formatted: phone.formatted,
      type: phone.type || 'other',
      countryCode: phone.country_code,
      confidence: phone.confidence || 'medium',
      source: 'ocr',
    }));
  }

  /**
   * Map email addresses from Jetson format
   */
  private mapEmailAddresses(emails: any[]): EmailAddress[] {
    return emails.map((email: any) => ({
      value: email.value || email.email || '',
      type: email.type || 'work',
      confidence: email.confidence || 'medium',
      source: 'ocr',
      verified: email.verified || false,
    }));
  }

  // ============================================================================
  // STEP 2: CONTACT ENRICHMENT
  // ============================================================================

  /**
   * Enrich extracted contact with additional information from external APIs
   *
   * @param contact - Extracted contact to enrich
   * @returns EnrichedContactData with company info, social media, etc
   */
  async enrichContact(contact: ExtractedContact): Promise<EnrichedContactData> {
    const step = this.createProcessingStep('enrichment');

    try {
      console.log('[ContactScannerService] Enriching contact', {
        displayName: contact.displayName,
        companyName: contact.companyName,
      });

      const enrichmentData: EnrichedContactData = {
        sources: [],
        enrichmentScore: 0,
        enrichedAt: new Date().toISOString(),
      };

      let totalScore = 0;
      let sourceCount = 0;

      // 1. Enrich company information if company name exists
      if (contact.companyName) {
        try {
          const companyInfo = await this.enrichCompanyInfo(contact.companyName);
          if (companyInfo) {
            enrichmentData.companyInfo = companyInfo.data;
            enrichmentData.sources.push(companyInfo.source);
            totalScore += companyInfo.source.confidence === 'high' ? 100 : 60;
            sourceCount++;
          }
        } catch (error: any) {
          console.warn('[ContactScannerService] Company enrichment failed:', error.message);
        }
      }

      // 2. Enrich website information
      if (contact.website) {
        try {
          const websiteInfo = await this.enrichWebsite(contact.website);
          if (websiteInfo) {
            enrichmentData.companyWebsite = websiteInfo.data.website;
            enrichmentData.logo = websiteInfo.data.logo;
            enrichmentData.sources.push(websiteInfo.source);
            totalScore += 80;
            sourceCount++;
          }
        } catch (error: any) {
          console.warn('[ContactScannerService] Website enrichment failed:', error.message);
        }
      }

      // 3. Find social media profiles
      if (contact.companyName || contact.website) {
        try {
          const socialMedia = await this.enrichSocialMedia(
            contact.companyName,
            contact.website
          );
          if (socialMedia && socialMedia.length > 0) {
            enrichmentData.socialMedia = socialMedia;
            totalScore += 50;
            sourceCount++;
          }
        } catch (error: any) {
          console.warn('[ContactScannerService] Social media enrichment failed:', error.message);
        }
      }

      // Calculate overall enrichment score
      enrichmentData.enrichmentScore = sourceCount > 0 ? Math.round(totalScore / sourceCount) : 0;

      this.completeProcessingStep(step, 'completed');

      console.log('[ContactScannerService] Contact enriched', {
        enrichmentScore: enrichmentData.enrichmentScore,
        sourceCount: enrichmentData.sources.length,
      });

      return enrichmentData;

    } catch (error: any) {
      this.completeProcessingStep(step, 'failed', error.message);
      console.error('[ContactScannerService] Enrichment failed:', error);

      // Return minimal enrichment data instead of failing
      return {
        sources: [],
        enrichmentScore: 0,
        enrichedAt: new Date().toISOString(),
        notes: `Enrichment partially failed: ${error.message}`,
      };
    }
  }

  /**
   * Enrich company information using external APIs
   */
  private async enrichCompanyInfo(companyName: string): Promise<{
    data: any;
    source: any;
  } | null> {
    // TODO: Implement company enrichment using APIs like:
    // - Clearbit Company API
    // - Google Places API
    // - Company registries (Camera di Commercio, etc)
    // - LinkedIn Company API

    console.log('[ContactScannerService] Company enrichment not yet implemented');
    return null;
  }

  /**
   * Enrich website information (logo, metadata, etc)
   */
  private async enrichWebsite(website: string): Promise<{
    data: { website: string; logo?: any };
    source: any;
  } | null> {
    // TODO: Implement website enrichment using:
    // - Clearbit Logo API
    // - Favicon scraping
    // - OpenGraph metadata extraction

    console.log('[ContactScannerService] Website enrichment not yet implemented');
    return null;
  }

  /**
   * Find social media profiles
   */
  private async enrichSocialMedia(
    companyName?: string,
    website?: string
  ): Promise<any[] | null> {
    // TODO: Implement social media search using:
    // - LinkedIn search
    // - Twitter/X API
    // - Facebook Graph API
    // - Instagram API

    console.log('[ContactScannerService] Social media enrichment not yet implemented');
    return null;
  }

  // ============================================================================
  // STEP 3: VALIDATION AND MAPPING
  // ============================================================================

  /**
   * Validate extracted contact and map to Odoo partner format
   *
   * @param contact - Extracted contact
   * @param enrichment - Enriched data (optional)
   * @returns MappingResult ready for Odoo sync
   */
  async validateAndMap(
    contact: ExtractedContact,
    enrichment?: EnrichedContactData
  ): Promise<MappingResult> {
    const step = this.createProcessingStep('validation_and_mapping');

    try {
      console.log('[ContactScannerService] Validating and mapping contact to Odoo format');

      // Validate contact data
      const validation = this.validateContact(contact);

      if (!validation.isValid) {
        throw new Error(`Contact validation failed: ${validation.errors.join(', ')}`);
      }

      // Map to Odoo partner data
      const odooData = this.mapToOdooPartner(contact, enrichment);

      // Create field mappings
      const fieldMappings = this.createFieldMappings(contact, enrichment, odooData);

      // Calculate fill percentage
      const overallFillPercentage = this.calculateFillPercentage(fieldMappings);

      // Check required fields
      const hasRequiredFields = !!odooData.name;
      const missingRequiredFields = hasRequiredFields ? [] : ['name'];

      const mappingResult: MappingResult = {
        odooData,
        fieldMappings,
        overallFillPercentage,
        hasRequiredFields,
        missingRequiredFields,
        warnings: validation.warnings,
        mappedAt: new Date().toISOString(),
      };

      this.completeProcessingStep(step, 'completed');

      console.log('[ContactScannerService] Validation and mapping completed', {
        fillPercentage: overallFillPercentage,
        hasRequiredFields,
        warningCount: validation.warnings.length,
      });

      return mappingResult;

    } catch (error: any) {
      this.completeProcessingStep(step, 'failed', error.message);
      console.error('[ContactScannerService] Validation and mapping failed:', error);
      throw error;
    }
  }

  /**
   * Validate extracted contact data
   */
  private validateContact(contact: ExtractedContact): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!contact.displayName || contact.displayName.trim().length === 0) {
      errors.push('Display name is required');
    }

    // Validate phone numbers
    if (contact.phones.length === 0) {
      warnings.push('No phone numbers found');
    }

    // Validate email addresses
    if (contact.emails.length === 0) {
      warnings.push('No email addresses found');
    } else {
      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      contact.emails.forEach((email) => {
        if (!emailRegex.test(email.value)) {
          warnings.push(`Invalid email format: ${email.value}`);
        }
      });
    }

    // Validate VAT number format (basic check for IT VAT)
    if (contact.taxIdentifier?.vatId) {
      const vatId = contact.taxIdentifier.vatId;
      if (vatId.startsWith('IT') && vatId.length !== 13) {
        warnings.push('Italian VAT ID should be 13 characters (IT + 11 digits)');
      }
    }

    return {
      isValid: errors.length === 0,
      fieldValidations: [], // TODO: Implement detailed field validations
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Map ExtractedContact to OdooPartnerData
   */
  private mapToOdooPartner(
    contact: ExtractedContact,
    enrichment?: EnrichedContactData
  ): OdooPartnerData {
    // Determine partner name (priority: company name > display name)
    const name = contact.companyName || contact.displayName;

    // Determine if this is a company or individual
    const isCompany = !!contact.companyName;

    // Get primary phone and mobile
    const primaryPhone = contact.phones.find((p) => p.type === 'landline') || contact.phones[0];
    const mobilePhone = contact.phones.find((p) => p.type === 'mobile');
    const faxPhone = contact.phones.find((p) => p.type === 'fax');

    // Get primary email
    const primaryEmail = contact.emails.find((e) => e.type === 'work') || contact.emails[0];

    // Build Odoo partner data
    const odooData: OdooPartnerData = {
      // Basic information
      name,
      type: 'contact',
      isCompany,

      // Tax & Legal
      vat: contact.taxIdentifier?.vatId,
      taxId: contact.taxIdentifier?.fiscalCode,

      // Contact information
      email: primaryEmail?.value,
      phone: primaryPhone?.value,
      mobile: mobilePhone?.value,
      fax: faxPhone?.value,
      website: enrichment?.companyWebsite || contact.website,

      // Address
      street: contact.address?.street,
      city: contact.address?.city,
      zip: contact.address?.postalCode,

      // Commercial information
      isCustomer: true,
      active: true,

      // Metadata
      comment: this.buildPartnerNotes(contact, enrichment),
      sourceReference: contact.sourceDocument,
    };

    // If this is a company and we have a person name, store it as contact name
    if (isCompany && contact.displayName !== contact.companyName) {
      odooData.contactName = contact.displayName;
    }

    return odooData;
  }

  /**
   * Build internal notes for Odoo partner
   */
  private buildPartnerNotes(
    contact: ExtractedContact,
    enrichment?: EnrichedContactData
  ): string {
    const notes: string[] = [];

    // Add extraction metadata
    notes.push(`Contact extracted on: ${contact.extractedAt}`);

    if (contact.detectedLanguage) {
      notes.push(`Detected language: ${contact.detectedLanguage}`);
    }

    // Add enrichment info
    if (enrichment && enrichment.enrichmentScore > 0) {
      notes.push(`Enrichment score: ${enrichment.enrichmentScore}%`);
      notes.push(`Data sources: ${enrichment.sources.map((s) => s.name).join(', ')}`);
    }

    // Add contact notes
    if (contact.notes) {
      notes.push(`Notes: ${contact.notes}`);
    }

    // Add job title and department if individual
    if (!contact.companyName && (contact.jobTitle || contact.department)) {
      if (contact.jobTitle) notes.push(`Job title: ${contact.jobTitle}`);
      if (contact.department) notes.push(`Department: ${contact.department}`);
    }

    return notes.join('\n');
  }

  /**
   * Create field mappings for tracking
   */
  private createFieldMappings(
    contact: ExtractedContact,
    enrichment: EnrichedContactData | undefined,
    odooData: OdooPartnerData
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    // Helper to add mapping
    const addMapping = (
      odooField: string,
      sourcePath: string,
      value: any,
      confidence: ConfidenceLevel
    ) => {
      mappings.push({
        odooField,
        sourcePath,
        fillPercentage: value ? 100 : 0,
        confidence,
        value,
      });
    };

    // Map each field
    addMapping('name', 'contact.displayName / contact.companyName', odooData.name, 'high');
    addMapping('email', 'contact.emails[0].value', odooData.email, 'high');
    addMapping('phone', 'contact.phones[0].value', odooData.phone, 'high');
    addMapping('mobile', 'contact.phones.find(mobile)', odooData.mobile, 'medium');
    addMapping('website', 'contact.website / enrichment.companyWebsite', odooData.website, 'medium');
    addMapping('street', 'contact.address.street', odooData.street, 'medium');
    addMapping('city', 'contact.address.city', odooData.city, 'medium');
    addMapping('zip', 'contact.address.postalCode', odooData.zip, 'medium');
    addMapping('vat', 'contact.taxIdentifier.vatId', odooData.vat, 'high');
    addMapping('taxId', 'contact.taxIdentifier.fiscalCode', odooData.taxId, 'high');

    return mappings;
  }

  /**
   * Calculate overall fill percentage
   */
  private calculateFillPercentage(mappings: FieldMapping[]): number {
    if (mappings.length === 0) return 0;
    const totalFill = mappings.reduce((sum, m) => sum + m.fillPercentage, 0);
    return Math.round(totalFill / mappings.length);
  }

  // ============================================================================
  // STEP 4: ODOO SYNC
  // ============================================================================

  /**
   * Save contact to Odoo res.partner
   *
   * @param mappingResult - Validated and mapped contact data
   * @param options - Sync options
   * @returns Odoo partner ID
   */
  async saveToOdoo(
    mappingResult: MappingResult,
    options?: {
      updateIfExists?: boolean;
      searchFields?: string[];
    }
  ): Promise<number> {
    const step = this.createProcessingStep('odoo_sync');

    try {
      console.log('[ContactScannerService] Saving contact to Odoo', {
        name: mappingResult.odooData.name,
        email: mappingResult.odooData.email,
      });

      const { odooData } = mappingResult;

      // Check if partner already exists
      let partnerId: number | null = null;

      if (options?.updateIfExists) {
        const searchFields = options.searchFields || ['email', 'vat', 'phone'];
        partnerId = await this.findExistingPartner(odooData, searchFields);
      }

      if (partnerId) {
        // Update existing partner
        console.log('[ContactScannerService] Updating existing partner', { partnerId });

        await this.odooClient.callKw('res.partner', 'write', [[partnerId], odooData]);

        console.log('[ContactScannerService] Partner updated successfully', { partnerId });

      } else {
        // Create new partner
        console.log('[ContactScannerService] Creating new partner');

        partnerId = await this.odooClient.callKw('res.partner', 'create', [odooData]);

        console.log('[ContactScannerService] Partner created successfully', { partnerId });
      }

      this.completeProcessingStep(step, 'completed');

      if (!partnerId) {
        throw new Error('Failed to create or update partner: partnerId is null');
      }

      return partnerId;

    } catch (error: any) {
      this.completeProcessingStep(step, 'failed', error.message);
      console.error('[ContactScannerService] Odoo sync failed:', error);
      throw new Error(`Failed to save contact to Odoo: ${error.message}`);
    }
  }

  /**
   * Find existing partner in Odoo by matching fields
   */
  private async findExistingPartner(
    odooData: OdooPartnerData,
    searchFields: string[]
  ): Promise<number | null> {
    const searchDomains: any[][] = [];

    // Build search domains
    if (searchFields.includes('email') && odooData.email) {
      searchDomains.push(['email', '=', odooData.email]);
    }

    if (searchFields.includes('vat') && odooData.vat) {
      searchDomains.push(['vat', '=', odooData.vat]);
    }

    if (searchFields.includes('phone') && odooData.phone) {
      searchDomains.push(['phone', '=', odooData.phone]);
    }

    if (searchFields.includes('name') && odooData.name) {
      searchDomains.push(['name', '=', odooData.name]);
    }

    // Try each search domain
    for (const domain of searchDomains) {
      try {
        const partners = await this.odooClient.searchRead(
          'res.partner',
          [domain],
          ['id'],
          1
        );

        if (partners && partners.length > 0) {
          console.log('[ContactScannerService] Found existing partner', {
            partnerId: partners[0].id,
            searchField: domain[0],
          });
          return partners[0].id;
        }
      } catch (error) {
        console.warn('[ContactScannerService] Partner search failed for domain:', domain, error);
      }
    }

    return null;
  }

  // ============================================================================
  // STEP 5: COMPLETE PIPELINE
  // ============================================================================

  /**
   * Complete contact scanning and saving pipeline
   *
   * @param documentContent - Base64 encoded document
   * @param options - Pipeline options
   * @returns Complete ContactScanResult with all stages
   */
  async scanAndSave(
    documentContent: string,
    options?: {
      skipEnrichment?: boolean;
      skipValidation?: boolean;
      autoSyncToOdoo?: boolean;
      updateIfExists?: boolean;
      language?: string;
      documentType?: 'business_card' | 'invoice' | 'document' | 'auto';
    }
  ): Promise<ContactScanResult> {
    const scanId = this.generateScanId();
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    console.log('[ContactScannerService] Starting complete pipeline', {
      scanId,
      options,
    });

    const result: ContactScanResult = {
      scanId,
      status: 'failed',
      startedAt,
      completedAt: '',
      duration: 0,
      extraction: {
        status: 'failed',
        contact: null,
        step: this.createProcessingStep('extraction'),
      },
      enrichment: {
        status: 'skipped',
        data: null,
        step: this.createProcessingStep('enrichment'),
      },
      validation: {
        status: 'failed',
        result: null,
        step: this.createProcessingStep('validation'),
      },
      mapping: {
        status: 'failed',
        result: null,
        step: this.createProcessingStep('mapping'),
      },
      processingSteps: [],
      readyForSync: false,
      qualityScore: 0,
      completenessScore: 0,
      confidenceScore: 0,
      summary: '',
      warnings: [],
      errors: [],
      extractedFields: [],
      enrichedFields: [],
      failedFields: [],
    };

    try {
      // STEP 1: Extract contact
      try {
        const contact = await this.extractContact(documentContent, {
          language: options?.language,
          documentType: options?.documentType,
        });
        result.extraction = {
          status: 'success',
          contact,
          step: result.extraction.step,
        };
        result.extractedFields = this.getExtractedFields(contact);
      } catch (error: any) {
        result.extraction.error = error.message;
        result.errors.push(`Extraction failed: ${error.message}`);
        throw error;
      }

      // STEP 2: Enrich contact (optional)
      let enrichedData: EnrichedContactData | undefined;
      if (!options?.skipEnrichment && result.extraction.contact) {
        try {
          enrichedData = await this.enrichContact(result.extraction.contact);
          result.enrichment = {
            status: 'success',
            data: enrichedData,
            step: result.enrichment.step,
          };
          result.enrichedFields = this.getEnrichedFields(enrichedData);
        } catch (error: any) {
          result.enrichment.status = 'failed';
          result.enrichment.error = error.message;
          result.warnings.push(`Enrichment failed: ${error.message}`);
        }
      }

      // STEP 3: Validate and map
      if (result.extraction.contact) {
        try {
          const mappingResult = await this.validateAndMap(
            result.extraction.contact,
            enrichedData
          );
          result.mapping = {
            status: 'success',
            result: mappingResult,
            step: result.mapping.step,
          };
          result.validation = {
            status: mappingResult.warnings.length > 0 ? 'warning' : 'success',
            result: {
              isValid: mappingResult.hasRequiredFields,
              fieldValidations: [],
              errors: mappingResult.missingRequiredFields.map(
                (f) => `Missing required field: ${f}`
              ),
              warnings: mappingResult.warnings,
              validatedAt: new Date().toISOString(),
            },
            step: result.validation.step,
          };
          result.warnings.push(...mappingResult.warnings);
          result.readyForSync = mappingResult.hasRequiredFields;
        } catch (error: any) {
          result.mapping.error = error.message;
          result.errors.push(`Mapping failed: ${error.message}`);
          throw error;
        }
      }

      // STEP 4: Sync to Odoo (optional)
      if (options?.autoSyncToOdoo && result.readyForSync && result.mapping.result) {
        try {
          const partnerId = await this.saveToOdoo(result.mapping.result, {
            updateIfExists: options.updateIfExists,
          });
          result.odooSync = {
            status: 'success',
            partnerId,
            syncedAt: new Date().toISOString(),
          };
        } catch (error: any) {
          result.odooSync = {
            status: 'failed',
            error: error.message,
          };
          result.warnings.push(`Odoo sync failed: ${error.message}`);
        }
      }

      // Calculate final scores
      result.qualityScore = this.calculateQualityScore(result);
      result.completenessScore = result.mapping.result?.overallFillPercentage || 0;
      result.confidenceScore = enrichedData?.enrichmentScore || 0;

      // Set final status
      if (result.errors.length === 0) {
        result.status = result.warnings.length > 0 ? 'partial' : 'success';
      }

      result.summary = this.generateSummary(result);

    } catch (error: any) {
      result.status = 'failed';
      result.errors.push(error.message);
      result.summary = `Pipeline failed: ${error.message}`;
    } finally {
      const endTime = Date.now();
      result.completedAt = new Date().toISOString();
      result.duration = endTime - startTime;

      console.log('[ContactScannerService] Pipeline completed', {
        scanId,
        status: result.status,
        duration: result.duration,
        qualityScore: result.qualityScore,
      });
    }

    return result;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Create a new processing step
   */
  private createProcessingStep(name: string): ProcessingStep {
    return {
      name,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Complete a processing step
   */
  private completeProcessingStep(
    step: ProcessingStep,
    status: 'completed' | 'failed' | 'skipped',
    error?: string
  ): void {
    step.status = status;
    step.completedAt = new Date().toISOString();
    if (error) step.error = error;
    if (step.startedAt) {
      step.duration = Date.now() - new Date(step.startedAt).getTime();
    }
  }

  /**
   * Generate unique scan ID
   */
  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get list of successfully extracted fields
   */
  private getExtractedFields(contact: ExtractedContact): string[] {
    const fields: string[] = [];
    if (contact.firstName) fields.push('firstName');
    if (contact.lastName) fields.push('lastName');
    if (contact.displayName) fields.push('displayName');
    if (contact.companyName) fields.push('companyName');
    if (contact.phones.length > 0) fields.push('phones');
    if (contact.emails.length > 0) fields.push('emails');
    if (contact.address) fields.push('address');
    if (contact.website) fields.push('website');
    if (contact.taxIdentifier) fields.push('taxIdentifier');
    return fields;
  }

  /**
   * Get list of successfully enriched fields
   */
  private getEnrichedFields(enrichment: EnrichedContactData): string[] {
    const fields: string[] = [];
    if (enrichment.companyInfo) fields.push('companyInfo');
    if (enrichment.companyWebsite) fields.push('companyWebsite');
    if (enrichment.socialMedia) fields.push('socialMedia');
    if (enrichment.logo) fields.push('logo');
    return fields;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(result: ContactScanResult): number {
    let score = 0;

    // Extraction success: 40 points
    if (result.extraction.status === 'success') score += 40;

    // Enrichment success: 30 points
    if (result.enrichment.status === 'success') score += 30;

    // Validation success: 20 points
    if (result.validation.status === 'success') score += 20;
    else if (result.validation.status === 'warning') score += 10;

    // Odoo sync success: 10 points
    if (result.odooSync?.status === 'success') score += 10;

    return score;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(result: ContactScanResult): string {
    if (result.status === 'success') {
      const contact = result.extraction.contact;
      const partnerId = result.odooSync?.partnerId;
      if (partnerId) {
        return `Successfully scanned and saved contact "${contact?.displayName}" to Odoo (Partner ID: ${partnerId})`;
      }
      return `Successfully scanned contact "${contact?.displayName}"`;
    } else if (result.status === 'partial') {
      return `Partially completed scan with ${result.warnings.length} warnings`;
    } else {
      return `Scan failed: ${result.errors[0] || 'Unknown error'}`;
    }
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new ContactScannerService instance
 *
 * @param sessionId - Odoo session ID (optional, will use session manager if not provided)
 * @returns ContactScannerService instance
 */
export function createContactScannerService(sessionId?: string): ContactScannerService {
  return new ContactScannerService(sessionId);
}

/**
 * Quick helper to scan and save a document in one call
 *
 * @param documentContent - Base64 encoded document
 * @param sessionId - Odoo session ID (optional)
 * @returns ContactScanResult
 */
export async function quickScanAndSave(
  documentContent: string,
  sessionId?: string
): Promise<ContactScanResult> {
  const service = createContactScannerService(sessionId);
  return service.scanAndSave(documentContent, {
    autoSyncToOdoo: true,
    updateIfExists: true,
  });
}
