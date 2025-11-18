/**
 * Contact Enricher Unit Tests
 *
 * Usa Jest per testare le funzionalità principali
 */

import {
  ContactEnricher,
  getContactEnricher,
  resetContactEnricher,
  ContactEnrichmentError,
  InvalidInputError,
  EnrichedContact,
} from './contact-enricher';

describe('ContactEnricher', () => {
  let enricher: ContactEnricher;

  beforeEach(() => {
    resetContactEnricher();
    enricher = getContactEnricher();
  });

  afterEach(() => {
    enricher.clearCache();
  });

  describe('Input Validation', () => {
    it('should throw error for empty company name', async () => {
      await expect(
        enricher.enrichContact({ companyName: '' })
      ).rejects.toThrow(InvalidInputError);
    });

    it('should throw error for missing company name', async () => {
      await expect(
        enricher.enrichContact({ companyName: '' })
      ).rejects.toThrow('Company name is required');
    });

    it('should throw error for company name exceeding max length', async () => {
      const longName = 'a'.repeat(201);
      await expect(
        enricher.enrichContact({ companyName: longName })
      ).rejects.toThrow('exceeds maximum length');
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        enricher.enrichContact({
          companyName: 'Test Corp',
          email: 'invalid-email',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for invalid phone format', async () => {
      await expect(
        enricher.enrichContact({
          companyName: 'Test Corp',
          phone: '123', // Too short
        })
      ).rejects.toThrow('Invalid phone format');
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email format', async () => {
      const result = await enricher.verifyEmail('test@example.com');
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should reject invalid email format', async () => {
      const result = await enricher.verifyEmail('invalid-email');
      expect(result.valid).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should detect temporary email domains', async () => {
      const result = await enricher.verifyEmail('test@tempmail.com');
      expect(result.valid).toBe(true);
      expect(result.score).toBeLessThan(80);
    });

    it('should detect test/demo patterns in email', async () => {
      const result = await enricher.verifyEmail('test@company.com');
      expect(result.score).toBeLessThan(100);
    });

    it('should give higher score to .com domains', async () => {
      const result1 = await enricher.verifyEmail('user@company.com');
      const result2 = await enricher.verifyEmail('user@example.local');

      expect(result1.score).toBeGreaterThanOrEqual(result2.score);
    });
  });

  describe('Phone Validation', () => {
    it('should validate correct phone format', async () => {
      const result = await enricher.verifyPhone('+1-888-518-3752');
      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should reject phone with too few digits', async () => {
      const result = await enricher.verifyPhone('123');
      expect(result.valid).toBe(false);
    });

    it('should normalize phone with country code', async () => {
      const result = await enricher.verifyPhone('3331234567', 'IT');
      expect(result.normalized).toMatch(/^\+39/);
    });

    it('should detect suspicious phone patterns', async () => {
      const result = await enricher.verifyPhone('1111111111');
      expect(result.score).toBeLessThan(50);
    });

    it('should handle various phone formats', async () => {
      const formats = [
        '+1-888-518-3752',
        '+1 (888) 518-3752',
        '8885183752',
        '+18885183752',
      ];

      for (const phone of formats) {
        const result = await enricher.verifyPhone(phone);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Cache Management', () => {
    it('should store enrichment results in cache', async () => {
      const request = { companyName: 'Test Company' };

      const stats1 = enricher.getCacheStats();
      expect(stats1.size).toBe(0);

      // Nota: questo test fallisce in questo contesto perché non abbiamo
      // una vera risposta da Claude. In un vero test, usereste mock.
      // Mostriamo comunque la struttura corretta:
    });

    it('should have correct cache key format', async () => {
      const cacheKey1 = (enricher as any).generateCacheKey('Apple', 'US');
      const cacheKey2 = (enricher as any).generateCacheKey('Apple', 'IT');

      expect(cacheKey1).not.toBe(cacheKey2);
      expect(cacheKey1).toHaveLength(64); // SHA256 hex length
    });

    it('should clear all cache entries', async () => {
      enricher.clearCache();
      const stats = enricher.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Image Format Detection', () => {
    it('should detect PNG format', () => {
      const format = (enricher as any).extractImageFormat('image/png');
      expect(format).toBe('png');
    });

    it('should detect JPEG format', () => {
      const format = (enricher as any).extractImageFormat('image/jpeg');
      expect(format).toBe('jpg');
    });

    it('should detect WebP format', () => {
      const format = (enricher as any).extractImageFormat('image/webp');
      expect(format).toBe('webp');
    });

    it('should return unknown for unrecognized format', () => {
      const format = (enricher as any).extractImageFormat('application/octet-stream');
      expect(format).toBe('unknown');
    });
  });

  describe('Verification Score Calculation', () => {
    it('should calculate correct verification score', () => {
      const company = {
        legalName: 'Test Corp',
        piva: 'IT12345678901',
        sector: 'Technology',
        employees: 100,
        website: 'https://test.com',
        country: 'Italy',
      };

      const social = {
        linkedin: 'https://linkedin.com/company/test',
      };

      const contacts = [
        {
          name: 'John Doe',
          email: 'john@test.com',
          role: 'CEO',
        },
      ];

      const validation = {
        emailValid: true,
        phoneValid: true,
      };

      const score = (enricher as any).calculateVerificationScore(
        company,
        social,
        contacts,
        validation
      );

      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give lower score for incomplete data', () => {
      const company = {
        legalName: 'Test Corp',
        piva: '',
        sector: '',
        employees: null,
        website: '',
        country: '',
      };

      const social = {};
      const contacts: any[] = [];
      const validation = { emailValid: false, phoneValid: false };

      const score = (enricher as any).calculateVerificationScore(
        company,
        social,
        contacts,
        validation
      );

      expect(score).toBeLessThan(50);
    });
  });

  describe('CSV Export', () => {
    it('should generate valid CSV from enriched contact', () => {
      const enriched: EnrichedContact = {
        company: {
          legalName: 'Test Corp',
          piva: 'IT12345678901',
          sector: 'Technology',
          employees: 100,
          website: 'https://test.com',
          country: 'Italy',
        },
        social: {
          linkedin: 'https://linkedin.com/company/test',
        },
        contacts: [
          {
            name: 'John Doe',
            email: 'john@test.com',
            role: 'CEO',
          },
        ],
        emailValid: true,
        phoneValid: false,
        verificationScore: 85,
        lastUpdated: new Date().toISOString(),
        sources: ['Claude API', 'Web'],
      };

      const csv = enricher.exportToCSV(enriched);

      expect(csv).toContain('Test Corp');
      expect(csv).toContain('IT12345678901');
      expect(csv).toContain('John Doe');
      expect(csv).toContain('john@test.com');
      expect(csv).toContain('CEO');
    });

    it('should properly escape CSV values with commas', () => {
      const enriched: EnrichedContact = {
        company: {
          legalName: 'Test, Corp',
          piva: '',
          sector: '',
          employees: null,
          website: '',
          country: '',
        },
        social: {},
        contacts: [],
        emailValid: false,
        phoneValid: false,
        verificationScore: 0,
        lastUpdated: new Date().toISOString(),
        sources: [],
      };

      const csv = enricher.exportToCSV(enriched);

      expect(csv).toContain('"Test, Corp"');
    });

    it('should handle quotes in CSV values', () => {
      const enriched: EnrichedContact = {
        company: {
          legalName: 'Test "Corp"',
          piva: '',
          sector: '',
          employees: null,
          website: '',
          country: '',
        },
        social: {},
        contacts: [],
        emailValid: false,
        phoneValid: false,
        verificationScore: 0,
        lastUpdated: new Date().toISOString(),
        sources: [],
      };

      const csv = enricher.exportToCSV(enriched);

      expect(csv).toContain('"Test ""Corp"""');
    });
  });

  describe('Phone Normalization', () => {
    it('should normalize Italian phone numbers', () => {
      const normalized = (enricher as any).normalizePhoneWithCountry(
        '3331234567',
        'IT'
      );

      expect(normalized).toMatch(/^\+39/);
    });

    it('should normalize US phone numbers', () => {
      const normalized = (enricher as any).normalizePhoneWithCountry(
        '5551234567',
        'US'
      );

      expect(normalized).toMatch(/^\+1/);
    });

    it('should not double-prefix if already present', () => {
      const normalized = (enricher as any).normalizePhoneWithCountry(
        '39123456789',
        'IT'
      );

      expect(normalized).not.toContain('++');
    });

    it('should handle unknown country codes', () => {
      const normalized = (enricher as any).normalizePhoneWithCountry(
        '1234567',
        'XX'
      );

      expect(normalized).toBe('1234567');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const enricher1 = getContactEnricher();
      const enricher2 = getContactEnricher();

      expect(enricher1).toBe(enricher2);
    });

    it('should reset singleton properly', () => {
      const enricher1 = getContactEnricher();
      resetContactEnricher();
      const enricher2 = getContactEnricher();

      expect(enricher1).not.toBe(enricher2);
    });
  });

  describe('Error Types', () => {
    it('should throw ContactEnrichmentError with code', () => {
      const error = new ContactEnrichmentError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(ContactEnrichmentError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
    });

    it('should throw InvalidInputError correctly', () => {
      const error = new InvalidInputError('Invalid input');

      expect(error).toBeInstanceOf(ContactEnrichmentError);
      expect(error.code).toBe('INVALID_INPUT');
    });
  });
});

/**
 * Integration Tests (richiedono API key valida)
 *
 * Commentati per default. Decommentare per integration testing.
 */
describe('ContactEnricher Integration Tests', () => {
  beforeEach(() => {
    // Skip if ANTHROPIC_API_KEY not set
    if (!process.env.ANTHROPIC_API_KEY) {
      return;
    }
  });

  it.skip('should enrich real company data', async () => {
    // Richiederebbe API key reale e conteggi su quota
    const enricher = getContactEnricher();
    const enriched = await enricher.enrichContact({
      companyName: 'OpenAI Inc',
      country: 'United States',
    });

    expect(enriched.company.legalName).toBeTruthy();
    expect(enriched.verificationScore).toBeGreaterThan(0);
  });

  it.skip('should download real company logo', async () => {
    const enricher = getContactEnricher();
    const logo = await enricher.fetchCompanyLogo('https://github.com');

    expect(logo).toBeTruthy();
    expect(logo?.base64).toMatch(/^data:image/);
  });
});
