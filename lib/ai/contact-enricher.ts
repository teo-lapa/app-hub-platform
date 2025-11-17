/**
 * Contact Enricher Service
 *
 * Arricchisce contatti con dati da ricerca online usando Claude API.
 * Include:
 * - Dati aziendali (nome legale, P.IVA, settore, dipendenti)
 * - Social media (LinkedIn, Facebook, Twitter)
 * - Logo aziendale in base64
 * - Verifica email/telefono
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';

// Types
export interface CompanyData {
  legalName: string;
  piva: string;
  sector: string;
  employees: number | null;
  website: string;
  country: string;
  region?: string;
  city?: string;
  address?: string;
  foundedYear?: number;
  description?: string;
}

export interface SocialProfiles {
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
}

export interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  linkedinProfile?: string;
}

export interface LogoData {
  base64: string;
  format: string;
  source: string;
}

export interface EnrichedContact {
  company: CompanyData;
  social: SocialProfiles;
  contacts: ContactData[];
  logo?: LogoData;
  emailValid: boolean;
  phoneValid: boolean;
  verificationScore: number; // 0-100
  lastUpdated: string;
  sources: string[];
}

export interface EnrichmentRequest {
  companyName: string;
  country?: string;
  website?: string;
  email?: string;
  phone?: string;
  contacts?: Partial<ContactData>[];
}

// Error classes
export class ContactEnrichmentError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ContactEnrichmentError';
  }
}

export class ApiRateLimitError extends ContactEnrichmentError {
  constructor() {
    super('API rate limit exceeded. Please retry after a few seconds.', 'RATE_LIMIT');
  }
}

export class InvalidInputError extends ContactEnrichmentError {
  constructor(message: string) {
    super(message, 'INVALID_INPUT');
  }
}

/**
 * ContactEnricher: servizio principale per arricchimento contatti
 */
export class ContactEnricher {
  private client: Anthropic;
  private apiKey: string;
  private model = 'claude-sonnet-4-5-20250929';
  private maxRetries = 3;
  private retryDelay = 1000; // ms

  // Cache in-memory per evitare duplicate requests
  private cache = new Map<string, EnrichedContact>();
  private cacheTimeout = 24 * 60 * 60 * 1000; // 24 ore

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }

    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  /**
   * Genera chiave cache dal nome azienda e paese
   */
  private generateCacheKey(companyName: string, country?: string): string {
    const key = `${companyName}:${country || 'GLOBAL'}`;
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Valida input richiesta
   */
  private validateInput(request: EnrichmentRequest): void {
    if (!request.companyName || request.companyName.trim().length === 0) {
      throw new InvalidInputError('Company name is required and cannot be empty');
    }

    if (request.companyName.length > 200) {
      throw new InvalidInputError('Company name exceeds maximum length of 200 characters');
    }

    if (request.email && !this.isValidEmail(request.email)) {
      throw new InvalidInputError('Invalid email format provided');
    }

    if (request.phone && !this.isValidPhone(request.phone)) {
      throw new InvalidInputError('Invalid phone format provided');
    }
  }

  /**
   * Valida formato email con regex semplice
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Valida formato telefono (almeno 6 numeri)
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^\d{6,}$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(digitsOnly);
  }

  /**
   * Entra contatto completo con tutte le info
   */
  async enrichContact(request: EnrichmentRequest): Promise<EnrichedContact> {
    // Validazione input
    this.validateInput(request);

    // Controlla cache
    const cacheKey = this.generateCacheKey(request.companyName, request.country);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Esegui enrichment con retry
      const enriched = await this.enrichWithRetry(request);

      // Salva in cache
      this.cache.set(cacheKey, enriched);

      // Pulisci cache scaduto dopo timeout
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.cacheTimeout);

      return enriched;
    } catch (error) {
      if (error instanceof ContactEnrichmentError) {
        throw error;
      }

      if (error instanceof Anthropic.RateLimitError) {
        throw new ApiRateLimitError();
      }

      throw new ContactEnrichmentError(
        `Failed to enrich contact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ENRICHMENT_FAILED'
      );
    }
  }

  /**
   * Esegui enrichment con retry logic esponenziale
   */
  private async enrichWithRetry(
    request: EnrichmentRequest,
    attempt = 0
  ): Promise<EnrichedContact> {
    try {
      return await this.performEnrichment(request);
    } catch (error) {
      if (attempt < this.maxRetries && this.isRetryable(error)) {
        const delay = this.retryDelay * Math.pow(2, attempt); // exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.enrichWithRetry(request, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Determina se errore è riprirprovabile
   */
  private isRetryable(error: any): boolean {
    if (error instanceof ApiRateLimitError) return true;
    if (error instanceof Anthropic.APIConnectionError) return true;
    // Check for timeout by error message instead of class
    if (error?.message?.includes('timeout') || error?.code === 'ERR_HTTP_REQUEST_TIMEOUT') return true;
    return false;
  }

  /**
   * Esegui richiesta enrichment via Claude
   */
  private async performEnrichment(request: EnrichmentRequest): Promise<EnrichedContact> {
    const prompt = this.buildEnrichmentPrompt(request);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Estrai contenuto risposta
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');

    // Parse JSON dalla risposta
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ContactEnrichmentError(
        'Invalid response format from Claude API',
        'PARSE_ERROR'
      );
    }

    try {
      const enrichedData = JSON.parse(jsonMatch[0]);
      return this.normalizeEnrichmentData(enrichedData, request);
    } catch (error) {
      throw new ContactEnrichmentError(
        `Failed to parse enrichment response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_ERROR'
      );
    }
  }

  /**
   * Costruisci prompt per Claude API
   */
  private buildEnrichmentPrompt(request: EnrichmentRequest): string {
    const countryHint = request.country ? `Country: ${request.country}` : '';
    const websiteHint = request.website ? `Website: ${request.website}` : '';
    const emailHint = request.email ? `Email: ${request.email}` : '';
    const phoneHint = request.phone ? `Phone: ${request.phone}` : '';

    return `You are a business intelligence expert. Please enrich the following company information with accurate, real-world data.

Company to enrich:
- Name: ${request.companyName}
${countryHint}
${websiteHint}
${emailHint}
${phoneHint}

Please research and provide ONLY accurate, verified information. Return a JSON object with the following structure (fill with null or empty arrays if information is unavailable):

{
  "company": {
    "legalName": "Official company legal name",
    "piva": "VAT/Tax ID (P.IVA for Italian companies)",
    "sector": "Industry sector or classification",
    "employees": 150,
    "website": "https://company.com",
    "country": "Country",
    "region": "Region/State if applicable",
    "city": "City",
    "address": "Full address if available",
    "foundedYear": 2015,
    "description": "Brief company description"
  },
  "social": {
    "linkedin": "https://linkedin.com/company/...",
    "facebook": "https://facebook.com/...",
    "twitter": "https://twitter.com/...",
    "instagram": "https://instagram.com/...",
    "tiktok": "https://tiktok.com/..."
  },
  "contacts": [
    {
      "name": "John Doe",
      "email": "john@company.com",
      "phone": "+1234567890",
      "role": "CEO",
      "department": "Executive",
      "linkedinProfile": "https://linkedin.com/in/..."
    }
  ],
  "sources": ["LinkedIn", "Company website", "Business database"]
}

Guidelines:
1. Only include verified, publicly available information
2. If uncertain about data accuracy, mark as null
3. For P.IVA: research VAT/Tax IDs for the country specified
4. For phone/email validation: mark as valid only if verified public information
5. Include at least 1-3 key contacts if available
6. Provide source attribution for traceability
7. If company is not found, return empty/null values

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Normalizza e valida dati enrichment
   */
  private normalizeEnrichmentData(
    data: any,
    originalRequest: EnrichmentRequest
  ): EnrichedContact {
    // Estrai dati con fallback a valori vuoti
    const company: CompanyData = {
      legalName: data.company?.legalName || originalRequest.companyName,
      piva: data.company?.piva || '',
      sector: data.company?.sector || '',
      employees: data.company?.employees || null,
      website: data.company?.website || originalRequest.website || '',
      country: data.company?.country || originalRequest.country || '',
      region: data.company?.region || undefined,
      city: data.company?.city || undefined,
      address: data.company?.address || undefined,
      foundedYear: data.company?.foundedYear || undefined,
      description: data.company?.description || undefined,
    };

    const social: SocialProfiles = {
      linkedin: data.social?.linkedin || undefined,
      facebook: data.social?.facebook || undefined,
      twitter: data.social?.twitter || undefined,
      instagram: data.social?.instagram || undefined,
      tiktok: data.social?.tiktok || undefined,
    };

    const contacts: ContactData[] = (data.contacts || [])
      .map((c: any) => ({
        name: c.name || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        role: c.role || undefined,
        department: c.department || undefined,
        linkedinProfile: c.linkedinProfile || undefined,
      }))
      .filter((c: ContactData) => c.name || c.email || c.phone);

    // Validazione email/phone
    const emailValid = originalRequest.email
      ? this.isValidEmail(originalRequest.email)
      : false;
    const phoneValid = originalRequest.phone
      ? this.isValidPhone(originalRequest.phone)
      : false;

    // Calcola verification score (0-100)
    const verificationScore = this.calculateVerificationScore(
      company,
      social,
      contacts,
      { emailValid, phoneValid }
    );

    const sources = data.sources || [
      'Claude API Research',
      'Public Data Sources',
    ];

    return {
      company,
      social,
      contacts,
      emailValid,
      phoneValid,
      verificationScore,
      lastUpdated: new Date().toISOString(),
      sources,
    };
  }

  /**
   * Calcola verification score basato su completezza dati
   */
  private calculateVerificationScore(
    company: CompanyData,
    social: SocialProfiles,
    contacts: ContactData[],
    validation: { emailValid: boolean; phoneValid: boolean }
  ): number {
    let score = 0;
    let maxScore = 100;
    let weight = 0;

    // Company data (max 40 points)
    weight = 0;
    if (company.legalName && company.legalName.length > 0) weight += 10;
    if (company.piva && company.piva.length > 0) weight += 10;
    if (company.sector && company.sector.length > 0) weight += 10;
    if (company.employees && company.employees > 0) weight += 10;
    score += (weight / 40) * 40;

    // Social profiles (max 20 points)
    weight = Object.values(social).filter(v => v && v.length > 0).length;
    score += (weight / 5) * 20;

    // Contacts (max 20 points)
    weight = contacts.length;
    score += Math.min((weight / 5) * 20, 20);

    // Email/Phone validation (max 20 points)
    if (validation.emailValid) score += 10;
    if (validation.phoneValid) score += 10;

    return Math.round(score);
  }

  /**
   * Scarica logo aziendale e converti in base64
   */
  async fetchCompanyLogo(websiteUrl: string): Promise<LogoData | null> {
    if (!websiteUrl) return null;

    try {
      // Normalizza URL
      let url = websiteUrl.trim();
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      // Prova a recuperare logo da endpoint comune
      const logoUrl = await this.findLogoUrl(new URL(url));
      if (!logoUrl) return null;

      const logoData = await this.downloadAndEncode(logoUrl);
      return logoData;
    } catch (error) {
      console.warn(
        `Failed to fetch logo from ${websiteUrl}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );
      return null;
    }
  }

  /**
   * Trova URL logo aziendale
   */
  private async findLogoUrl(baseUrl: URL): Promise<string | null> {
    const domain = baseUrl.hostname;
    const protocol = baseUrl.protocol;

    // Prova percorsi comuni per logo
    const logoPatterns = [
      `${protocol}//${domain}/logo.png`,
      `${protocol}//${domain}/logo.jpg`,
      `${protocol}//${domain}/images/logo.png`,
      `${protocol}//${domain}/assets/logo.png`,
      `${protocol}//${domain}/favicon.ico`,
    ];

    for (const url of logoPatterns) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok) {
            return url;
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        // Continua con prossimo pattern
        continue;
      }
    }

    return null;
  }

  /**
   * Scarica immagine e converti in base64
   */
  private async downloadAndEncode(imageUrl: string): Promise<LogoData> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      let response: Response;
      try {
        response = await fetch(imageUrl, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      const buffer = await response.arrayBuffer();

      // Validazione dimensione (max 500KB)
      if (buffer.byteLength > 500 * 1024) {
        throw new Error('Logo file too large (max 500KB)');
      }

      const base64 = Buffer.from(buffer).toString('base64');
      const format = this.extractImageFormat(contentType || '');

      return {
        base64: `data:${contentType || 'application/octet-stream'};base64,${base64}`,
        format,
        source: imageUrl,
      };
    } catch (error) {
      throw new ContactEnrichmentError(
        `Failed to download logo: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOGO_DOWNLOAD_FAILED'
      );
    }
  }

  /**
   * Estrai formato immagine da content-type
   */
  private extractImageFormat(contentType: string): string {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('svg')) return 'svg';
    return 'unknown';
  }

  /**
   * Verifica email con controlli vari
   */
  async verifyEmail(email: string): Promise<{
    valid: boolean;
    score: number;
    reason?: string;
  }> {
    if (!this.isValidEmail(email)) {
      return {
        valid: false,
        score: 0,
        reason: 'Invalid email format',
      };
    }

    // Valutazione score
    let score = 100;
    const [localPart, domain] = email.split('@');

    // Penalità per pattern sospetti
    if (/test|temp|fake|demo|example/.test(email.toLowerCase())) {
      score -= 50;
    }

    // Penalità per domini noti come temporary
    const tempDomains = [
      'tempmail.com',
      'guerrillamail.com',
      'mailinator.com',
      '10minutemail.com',
    ];
    if (tempDomains.some(d => domain.includes(d))) {
      score -= 40;
    }

    // Bonus per domini aziendali noti
    if (domain.endsWith('.com') || domain.endsWith('.it') || domain.endsWith('.de')) {
      score += 10;
    }

    return {
      valid: score >= 50,
      score: Math.max(0, Math.min(100, score)),
    };
  }

  /**
   * Verifica telefono con pattern internazionali
   */
  async verifyPhone(phone: string, countryCode?: string): Promise<{
    valid: boolean;
    score: number;
    normalized?: string;
    reason?: string;
  }> {
    const digitsOnly = phone.replace(/\D/g, '');

    if (!this.isValidPhone(phone)) {
      return {
        valid: false,
        score: 0,
        reason: 'Phone must contain at least 6 digits',
      };
    }

    // Normalizzazione con country code se fornito
    let normalized = digitsOnly;
    if (countryCode) {
      normalized = this.normalizePhoneWithCountry(digitsOnly, countryCode);
    }

    // Score basato su lunghezza e pattern
    let score = 100;

    // Lunghezze tipiche per paese
    const isTypicalLength =
      (digitsOnly.length >= 9 && digitsOnly.length <= 15) ||
      (digitsOnly.length >= 6 && digitsOnly.length <= 8);

    if (!isTypicalLength) {
      score -= 20;
    }

    // Pattern sospetti
    if (/^(\d)\1{5,}/.test(digitsOnly)) {
      score -= 50; // Tutti numeri uguali
    }

    return {
      valid: score >= 50,
      score: Math.max(0, Math.min(100, score)),
      normalized: normalized,
    };
  }

  /**
   * Normalizza telefono con country code
   */
  private normalizePhoneWithCountry(
    digitsOnly: string,
    countryCode: string
  ): string {
    const countryMap: Record<string, string> = {
      IT: '+39',
      US: '+1',
      DE: '+49',
      FR: '+33',
      ES: '+34',
      GB: '+44',
      CH: '+41',
      AT: '+43',
      NL: '+31',
      BE: '+32',
    };

    const prefix = countryMap[countryCode.toUpperCase()];
    if (!prefix) return digitsOnly;

    // Rimuovi prefix se già presente
    if (digitsOnly.startsWith(prefix.slice(1))) {
      return prefix + digitsOnly.slice(prefix.length - 1);
    }

    return prefix + digitsOnly;
  }

  /**
   * Esporta contatto arricchito in formato CSV
   */
  exportToCSV(enriched: EnrichedContact): string {
    const headers = [
      'Company Name',
      'Legal Name',
      'P.IVA',
      'Sector',
      'Employees',
      'Website',
      'Country',
      'LinkedIn',
      'Facebook',
      'Twitter',
      'Contact Name',
      'Email',
      'Phone',
      'Role',
      'Verification Score',
      'Last Updated',
    ];

    const rows: string[][] = [];

    if (enriched.contacts.length === 0) {
      // Riga con soli dati azienda
      rows.push([
        enriched.company.legalName,
        enriched.company.legalName,
        enriched.company.piva,
        enriched.company.sector,
        enriched.company.employees?.toString() || '',
        enriched.company.website,
        enriched.company.country,
        enriched.social.linkedin || '',
        enriched.social.facebook || '',
        enriched.social.twitter || '',
        '',
        '',
        '',
        '',
        enriched.verificationScore.toString(),
        enriched.lastUpdated,
      ]);
    } else {
      // Riga per ogni contatto
      enriched.contacts.forEach(contact => {
        rows.push([
          enriched.company.legalName,
          enriched.company.legalName,
          enriched.company.piva,
          enriched.company.sector,
          enriched.company.employees?.toString() || '',
          enriched.company.website,
          enriched.company.country,
          enriched.social.linkedin || '',
          enriched.social.facebook || '',
          enriched.social.twitter || '',
          contact.name || '',
          contact.email || '',
          contact.phone || '',
          contact.role || '',
          enriched.verificationScore.toString(),
          enriched.lastUpdated,
        ]);
      });
    }

    // Escapa CSV values
    const escapedRows = rows.map(row =>
      row.map(cell => {
        if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
    );

    return [headers, ...escapedRows].map(row => row.join(',')).join('\n');
  }

  /**
   * Cancella cache per memoria limitata
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Ottieni stats cache
   */
  getCacheStats(): {
    size: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Factory function per creazione singleton
 */
let enricherInstance: ContactEnricher | null = null;

export function getContactEnricher(apiKey?: string): ContactEnricher {
  if (!enricherInstance) {
    enricherInstance = new ContactEnricher(apiKey);
  }
  return enricherInstance;
}

/**
 * Reset enricher (utile per testing)
 */
export function resetContactEnricher(): void {
  enricherInstance = null;
}
