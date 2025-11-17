/**
 * Complete TypeScript types for contact scanning and enrichment pipeline
 * Covers extraction, enrichment, and Odoo partner mapping
 */

// ============================================================================
// EXTRACTED CONTACT DATA
// ============================================================================

/**
 * Confidence level for extracted or matched data
 * - high: >80% confidence
 * - medium: 50-80% confidence
 * - low: <50% confidence
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Phone number type classification
 */
export type PhoneType = 'mobile' | 'landline' | 'fax' | 'whatsapp' | 'other';

/**
 * Email type classification
 */
export type EmailType = 'work' | 'personal' | 'other';

/**
 * Address type classification
 */
export type AddressType = 'billing' | 'shipping' | 'residential' | 'other';

/**
 * Source of extracted information
 */
export type ExtractionSource = 'ocr' | 'document_field' | 'manual' | 'api';

/**
 * Single phone number with metadata
 */
export interface PhoneNumber {
  /** Raw phone number value */
  value: string;

  /** Formatted/cleaned phone number */
  formatted?: string;

  /** Type of phone number */
  type?: PhoneType;

  /** Country code (e.g., 'IT', 'CH', 'US') */
  countryCode?: string;

  /** Extraction confidence level */
  confidence: ConfidenceLevel;

  /** Source of extraction */
  source: ExtractionSource;
}

/**
 * Single email address with metadata
 */
export interface EmailAddress {
  /** Email address value */
  value: string;

  /** Type of email (work, personal, etc) */
  type?: EmailType;

  /** Extraction confidence level */
  confidence: ConfidenceLevel;

  /** Source of extraction */
  source: ExtractionSource;

  /** Is this email verified/validated */
  verified?: boolean;
}

/**
 * Complete postal address
 */
export interface PostalAddress {
  /** Full address string */
  fullAddress: string;

  /** Street name and number */
  street?: string;

  /** City/town name */
  city?: string;

  /** State/region/province name */
  state?: string;

  /** Postal code/ZIP code */
  postalCode?: string;

  /** Country name or code */
  country?: string;

  /** Address type classification */
  type?: AddressType;

  /** Latitude for geocoded address */
  latitude?: number;

  /** Longitude for geocoded address */
  longitude?: number;

  /** Extraction confidence level */
  confidence: ConfidenceLevel;

  /** Source of extraction */
  source: ExtractionSource;
}

/**
 * Company tax identifier information
 */
export interface TaxIdentifier {
  /** VAT ID (Partita IVA in IT) */
  vatId?: string;

  /** Fiscal code (Codice Fiscale in IT) */
  fiscalCode?: string;

  /** Country for VAT (ISO 3166-1 alpha-2) */
  vatCountry?: string;

  /** Business registration number */
  businessRegistrationNumber?: string;

  /** Company registration number */
  companyRegistrationNumber?: string;

  /** Extraction confidence level */
  confidence: ConfidenceLevel;

  /** Source of extraction */
  source: ExtractionSource;
}

/**
 * Core extracted contact information from document/scan
 */
export interface ExtractedContact {
  // ========== PERSONAL INFORMATION ==========

  /** First name of contact */
  firstName?: string;

  /** Last name/family name of contact */
  lastName?: string;

  /** Full display name */
  displayName: string;

  /** Job title/position */
  jobTitle?: string;

  /** Department name */
  department?: string;

  // ========== COMPANY INFORMATION ==========

  /** Company/organization name */
  companyName?: string;

  /** Alternative company names or DBA */
  companyAliases?: string[];

  /** Company tax identifiers */
  taxIdentifier?: TaxIdentifier;

  // ========== CONTACT INFORMATION ==========

  /** Phone numbers (can be multiple) */
  phones: PhoneNumber[];

  /** Email addresses (can be multiple) */
  emails: EmailAddress[];

  /** Postal address */
  address?: PostalAddress;

  /** Website/URL */
  website?: string;

  // ========== METADATA ==========

  /** Document/source this contact was extracted from */
  sourceDocument?: string;

  /** Additional notes from extraction */
  notes?: string;

  /** Language detected in document */
  detectedLanguage?: string;

  /** Raw text extracted before processing */
  rawText?: string;

  /** Timestamp of extraction */
  extractedAt: string; // ISO 8601 format
}

// ============================================================================
// COMPANY INFORMATION & ENRICHMENT
// ============================================================================

/**
 * Company legal information
 */
export interface CompanyLegalInfo {
  /** Official company legal name */
  legalName: string;

  /** Company short/common name */
  tradeName?: string;

  /** Company status (active, inactive, dissolved, etc) */
  status?: 'active' | 'inactive' | 'dissolved' | 'suspended' | 'unknown';

  /** Company founding year */
  foundedYear?: number;

  /** Industry/sector classification */
  industry?: string;

  /** Number of employees (estimate) */
  employeeCount?: number;

  /** Annual revenue (if available) */
  annualRevenue?: {
    amount: number;
    currency: string;
    year?: number;
  };

  /** Company description */
  description?: string;

  /** Primary business activity */
  businessActivity?: string;
}

/**
 * Social media presence
 */
export interface SocialMediaProfile {
  /** Platform name (linkedin, twitter, facebook, instagram, etc) */
  platform: string;

  /** Profile URL */
  url: string;

  /** Profile handle/username */
  handle?: string;

  /** Number of followers (if available) */
  followers?: number;

  /** Last verified date */
  verifiedAt?: string;
}

/**
 * Company logo/image information
 */
export interface CompanyLogo {
  /** Logo URL */
  url: string;

  /** Logo format (png, jpg, svg, etc) */
  format?: string;

  /** Logo dimensions */
  dimensions?: {
    width: number;
    height: number;
  };

  /** Logo source */
  source?: string;
}

/**
 * Information source and verification
 */
export interface DataSource {
  /** Name of the source (API name, database name, etc) */
  name: string;

  /** Confidence level in data from this source */
  confidence: ConfidenceLevel;

  /** Date data was retrieved from source */
  retrievedAt?: string;

  /** URL to source if applicable */
  url?: string;

  /** Is this data verified from official source */
  official?: boolean;
}

/**
 * Enriched contact data with additional information
 */
export interface EnrichedContactData {
  // ========== COMPANY INFORMATION ==========

  /** Company legal and business information */
  companyInfo?: CompanyLegalInfo;

  /** Company website */
  companyWebsite?: string;

  // ========== SOCIAL MEDIA ==========

  /** Social media profiles associated with company or contact */
  socialMedia?: SocialMediaProfile[];

  // ========== COMPANY BRANDING ==========

  /** Company logo information */
  logo?: CompanyLogo;

  // ========== DATA SOURCES & VERIFICATION ==========

  /** Sources where data was enriched from */
  sources: DataSource[];

  /** Overall enrichment confidence score (0-100) */
  enrichmentScore: number;

  /** Timestamp when enrichment was completed */
  enrichedAt: string; // ISO 8601 format

  // ========== ADDITIONAL METADATA ==========

  /** Additional enrichment notes */
  notes?: string;
}

// ============================================================================
// ODOO PARTNER MAPPING
// ============================================================================

/**
 * Odoo res.partner model field mappings
 * These are the fields we'll write to Odoo when creating/updating a partner
 */
export interface OdooPartnerData {
  // ========== BASIC INFORMATION ==========

  /** Partner name (required in Odoo) */
  name: string;

  /** Partner type: 'contact' or 'invoice' */
  type?: 'contact' | 'invoice' | 'delivery' | 'other';

  /** Whether this is a company or individual */
  isCompany?: boolean;

  /** Parent company if this is a contact person */
  parentCompanyId?: number;

  // ========== TAX & LEGAL ==========

  /** VAT number (Partita IVA) */
  vat?: string;

  /** Fiscal code (Codice Fiscale) */
  taxId?: string;

  /** Country for tax registration (res.country record) */
  countryId?: number;

  // ========== CONTACT INFORMATION ==========

  /** Primary email address */
  email?: string;

  /** Primary phone number */
  phone?: string;

  /** Mobile/cell phone number */
  mobile?: string;

  /** Fax number */
  fax?: string;

  /** Website URL */
  website?: string;

  // ========== ADDRESS ==========

  /** Street address */
  street?: string;

  /** City */
  city?: string;

  /** State/Province (res.country.state record) */
  stateId?: number;

  /** Postal code */
  zip?: string;

  /** Contact person name (for company partners) */
  contactName?: string;

  // ========== COMMERCIAL INFORMATION ==========

  /** Assigned salesperson/account manager (res.users record) */
  userId?: number;

  /** Payment term (account.payment.term record) */
  propertyPaymentTermId?: number;

  /** Whether this is a customer */
  isCustomer?: boolean;

  /** Whether this is a supplier */
  isSupplier?: boolean;

  /** Preferred communication language */
  language?: string;

  /** Currency for transactions (res.currency record) */
  currencyId?: number;

  // ========== METADATA & NOTES ==========

  /** Internal notes */
  comment?: string;

  /** Tags/labels (many2many) */
  categoryIds?: number[];

  /** Active/inactive status */
  active?: boolean;

  // ========== EXTERNAL REFERENCES ==========

  /** External ID for integration purposes */
  externalId?: string;

  /** Original document source reference */
  sourceReference?: string;
}

// ============================================================================
// MAPPING RESULT
// ============================================================================

/**
 * Mapping between extracted/enriched data and Odoo fields
 */
export interface FieldMapping {
  /** Name of the Odoo field */
  odooField: string;

  /** Path to value in extracted contact or enrichment data */
  sourcePath: string;

  /** How much of the field is filled (0-100%) */
  fillPercentage: number;

  /** Confidence in the mapping */
  confidence: ConfidenceLevel;

  /** Actual mapped value */
  value: unknown;

  /** Any notes about the mapping */
  notes?: string;
}

/**
 * Result of mapping contact data to Odoo partner format
 */
export interface MappingResult {
  /** Odoo partner data ready to be written */
  odooData: OdooPartnerData;

  /** Field-by-field mapping details */
  fieldMappings: FieldMapping[];

  /** Overall fill percentage of Odoo fields (0-100) */
  overallFillPercentage: number;

  /** Whether mandatory fields are filled */
  hasRequiredFields: boolean;

  /** Missing mandatory fields that couldn't be filled */
  missingRequiredFields: string[];

  /** Warnings about data quality or mapping issues */
  warnings: string[];

  /** Timestamp when mapping was created */
  mappedAt: string; // ISO 8601 format
}

// ============================================================================
// VALIDATION RESULT
// ============================================================================

/**
 * Validation result for individual field
 */
export interface FieldValidation {
  /** Field name */
  field: string;

  /** Is field valid */
  isValid: boolean;

  /** Validation error message if invalid */
  error?: string;

  /** Warning messages (non-blocking) */
  warnings?: string[];

  /** Actual value that was validated */
  value?: unknown;
}

/**
 * Overall validation result
 */
export interface ValidationResult {
  /** Is overall validation successful */
  isValid: boolean;

  /** Individual field validation results */
  fieldValidations: FieldValidation[];

  /** Critical errors that prevent processing */
  errors: string[];

  /** Non-critical warnings */
  warnings: string[];

  /** Timestamp when validation was performed */
  validatedAt: string; // ISO 8601 format
}

// ============================================================================
// CONTACT SCAN PIPELINE RESULT
// ============================================================================

/**
 * Processing step information
 */
export interface ProcessingStep {
  /** Step name */
  name: string;

  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

  /** Error message if failed */
  error?: string;

  /** Step start timestamp */
  startedAt?: string;

  /** Step completion timestamp */
  completedAt?: string;

  /** Duration in milliseconds */
  duration?: number;

  /** Step-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete result of contact scanning and enrichment pipeline
 */
export interface ContactScanResult {
  // ========== PIPELINE METADATA ==========

  /** Unique scan/result ID */
  scanId: string;

  /** Overall processing status */
  status: 'success' | 'partial' | 'failed';

  /** Timestamp when scan was initiated */
  startedAt: string; // ISO 8601 format

  /** Timestamp when scan completed */
  completedAt: string; // ISO 8601 format

  /** Total processing duration in milliseconds */
  duration: number;

  // ========== PROCESSING STAGES ==========

  /** Extraction stage result */
  extraction: {
    status: 'success' | 'failed';
    contact: ExtractedContact | null;
    error?: string;
    step: ProcessingStep;
  };

  /** Enrichment stage result */
  enrichment: {
    status: 'success' | 'skipped' | 'failed';
    data: EnrichedContactData | null;
    error?: string;
    step: ProcessingStep;
  };

  /** Validation stage result */
  validation: {
    status: 'success' | 'warning' | 'failed';
    result: ValidationResult | null;
    error?: string;
    step: ProcessingStep;
  };

  /** Odoo mapping stage result */
  mapping: {
    status: 'success' | 'failed';
    result: MappingResult | null;
    error?: string;
    step: ProcessingStep;
  };

  // ========== PROCESSING PIPELINE ==========

  /** All processing steps in order */
  processingSteps: ProcessingStep[];

  /** Whether to proceed with Odoo sync */
  readyForSync: boolean;

  // ========== SYNC RESULT (OPTIONAL) ==========

  /** Odoo sync status if performed */
  odooSync?: {
    status: 'pending' | 'success' | 'failed';
    partnerId?: number;
    error?: string;
    syncedAt?: string;
  };

  // ========== SUMMARY & QUALITY METRICS ==========

  /** Overall data quality score (0-100) */
  qualityScore: number;

  /** Completeness score (0-100) */
  completenessScore: number;

  /** Confidence score (0-100) */
  confidenceScore: number;

  /** Summary message */
  summary: string;

  /** All warnings encountered during processing */
  warnings: string[];

  /** All errors encountered during processing */
  errors: string[];

  // ========== ENRICHMENT SUMMARY ==========

  /** What fields were successfully extracted */
  extractedFields: string[];

  /** What fields were enriched */
  enrichedFields: string[];

  /** What fields failed extraction/enrichment */
  failedFields: string[];

  // ========== METADATA & TRACKING ==========

  /** Source document information */
  source?: {
    type: 'pdf' | 'image' | 'text' | 'document';
    filename?: string;
    documentId?: string;
  };

  /** Processing options applied */
  options?: Record<string, unknown>;

  /** Custom metadata/tags */
  tags?: string[];

  /** User/system that initiated the scan */
  initiatedBy?: string;
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Batch contact scanning request
 */
export interface BatchContactScanRequest {
  /** Unique batch ID */
  batchId: string;

  /** List of documents/content to scan */
  items: Array<{
    /** Item ID */
    id: string;

    /** Document content (base64 for binary, text for text) */
    content: string;

    /** Document type */
    type: 'pdf' | 'image' | 'text';

    /** Document filename */
    filename?: string;

    /** Custom metadata for this item */
    metadata?: Record<string, unknown>;
  }>;

  /** Processing options */
  options?: {
    skipEnrichment?: boolean;
    skipValidation?: boolean;
    skipMapping?: boolean;
    skipOdooSync?: boolean;
    language?: string;
  };
}

/**
 * Batch processing result
 */
export interface BatchContactScanResults {
  /** Batch ID */
  batchId: string;

  /** Total items in batch */
  totalItems: number;

  /** Successful scans */
  successCount: number;

  /** Partial scans (with warnings) */
  partialCount: number;

  /** Failed scans */
  failureCount: number;

  /** Individual scan results */
  results: Array<{
    itemId: string;
    result: ContactScanResult;
  }>;

  /** Batch-level summary */
  summary: {
    averageQualityScore: number;
    averageCompletenessScore: number;
    averageConfidenceScore: number;
    totalProcessingTime: number;
    commonErrors: string[];
    commonWarnings: string[];
  };

  /** Batch completion timestamp */
  completedAt: string; // ISO 8601 format
}

// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================

/**
 * Type guard to check if a result is successful
 */
export function isSuccessfulScan(
  result: ContactScanResult
): result is ContactScanResult & {
  extraction: { status: 'success'; contact: ExtractedContact };
  mapping: { status: 'success'; result: MappingResult };
} {
  return (
    result.status === 'success' &&
    result.extraction.status === 'success' &&
    result.extraction.contact !== null &&
    result.mapping.status === 'success' &&
    result.mapping.result !== null
  );
}

/**
 * Type guard to check if contact has required fields for Odoo
 */
export function hasRequiredContactFields(
  contact: ExtractedContact
): boolean {
  return (
    !!(contact.firstName && contact.lastName) || contact.displayName.length > 0
  );
}

/**
 * Type guard to check if mapping is ready for Odoo sync
 */
export function isMappingReadyForSync(mapping: MappingResult): boolean {
  return mapping.hasRequiredFields && mapping.warnings.length === 0;
}
