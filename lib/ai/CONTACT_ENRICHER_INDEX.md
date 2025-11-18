# Contact Enricher - File Index & Overview

Indice completo e descrizione di tutti i file creati per il servizio di arricchimento contatti.

## File Creati

### Core Service

#### `contact-enricher.ts` (808 lines)
**Production-ready main service class**

Contiene:
- `ContactEnricher` class - Main service
- Metodi pubblici:
  - `enrichContact(request)` - Entra contatto completo
  - `verifyEmail(email)` - Valida email con scoring
  - `verifyPhone(phone, countryCode)` - Valida telefono
  - `fetchCompanyLogo(websiteUrl)` - Scarica logo in base64
  - `exportToCSV(enriched)` - Esporta a CSV
  - `clearCache()` - Pulisci cache
  - `getCacheStats()` - Statistiche cache

Caratteristiche:
- Full error handling con error classes custom
- Retry logic con exponential backoff (max 3 retries)
- In-memory caching (24 ore default)
- Input validation completa
- CSV export con escaping
- International phone normalization
- Logo download con size limits (500KB max)
- Verification score calculation (0-100)

Dependencies:
- `@anthropic-ai/sdk` - Claude API client
- Built-in Node modules: `crypto`, `fetch`, `Buffer`

#### `contact-enricher-config.ts` (255 lines)
**Environment configuration management**

Contiene:
- `ContactEnricherConfig` interface
- `loadContactEnricherConfig()` - Load from env vars
- `createContactEnricherConfig()` - Create with overrides
- `validateContactEnricherConfig()` - Validate config
- `getContactEnricherConfig()` - Get with validation
- `logContactEnricherConfig()` - Log sanitized config
- Utility functions: `formatBytes()`, `formatDuration()`

Environment variables supportati:
- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_API_BASE` (optional)
- `CONTACT_ENRICHER_TIMEOUT` (default: 120000ms)
- `CONTACT_ENRICHER_CACHE_TTL` (default: 24h)
- `CONTACT_ENRICHER_CACHE_MAX_SIZE` (default: 1000)
- `CONTACT_ENRICHER_DEBUG` (default: false)
- `CONTACT_ENRICHER_RATE_LIMIT` (default: 30 req/min)
- `CONTACT_ENRICHER_MAX_RETRIES` (default: 3)
- `CONTACT_ENRICHER_RETRY_DELAY` (default: 1000ms)
- `CONTACT_ENRICHER_LOGO_TIMEOUT` (default: 10000ms)
- `CONTACT_ENRICHER_LOGO_MAX_SIZE` (default: 500KB)
- `CONTACT_ENRICHER_MIN_SCORE_THRESHOLD` (default: 50)
- `CONTACT_ENRICHER_ENABLE_LOGO_FETCH` (default: true)
- `CONTACT_ENRICHER_ENABLE_SOCIAL` (default: true)

### API & Integration

#### `app/api/contacts/enrich/route.ts` (238 lines)
**REST API endpoint**

Endpoints:
- `POST /api/contacts/enrich` - Enrich contact
- `GET /api/contacts/enrich` - API documentation

Request body:
```json
{
  "companyName": "string (required)",
  "country": "string (optional)",
  "website": "string (optional)",
  "email": "string (optional)",
  "phone": "string (optional)",
  "contacts": "array (optional)"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "company": { /* CompanyData */ },
    "social": { /* SocialProfiles */ },
    "contacts": [ /* ContactData[] */ ],
    "logo": { /* LogoData optional */ },
    "verificationScore": 85,
    "emailValid": true,
    "phoneValid": true
  },
  "metadata": {
    "processingTimeMs": 2500,
    "timestamp": "2024-11-17T10:30:00Z",
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

Status codes:
- `200` - Success
- `400` - Invalid input or enrichment error
- `429` - Rate limit exceeded
- `500` - Server error

### Examples & Tests

#### `contact-enricher.example.ts` (418 lines)
**10 practical usage examples**

Esempi inclusi:
1. Basic enrichment
2. Email/phone verification
3. Download logo
4. Multiple contacts
5. Export to CSV
6. Error handling
7. Batch enrichment
8. API route integration
9. Cache management
10. Data validation

Ogni esempio è completo e runnable.

#### `contact-enricher.test.ts` (440 lines)
**Jest unit test suite**

Test coverage:
- Input validation (empty, invalid, too long)
- Email validation (format, domain, patterns)
- Phone validation (format, normalization, patterns)
- Cache management
- Image format detection
- Verification score calculation
- CSV export with special characters
- Phone normalization for different countries
- Singleton pattern
- Error types and codes

Run tests:
```bash
npm test -- lib/ai/contact-enricher.test.ts
```

### Documentation

#### `CONTACT_ENRICHER_README.md` (530 lines)
**Complete user documentation**

Sezioni:
- Features overview
- Installation instructions
- Quick start guide
- Full API reference
- All types documentation
- API route integration
- Verification score explanation
- Error handling guide
- Caching strategy
- Performance considerations
- Testing instructions
- Production checklist
- Best practices (8 patterns)
- Troubleshooting
- Security considerations
- Cost optimization
- Migration guide
- Changelog

#### `IMPLEMENTATION_GUIDE.md` (650 lines)
**Implementation and deployment guide**

Sezioni:
- Quick start (5 minutes)
- Architecture overview
- Configuration options
- 4 integration patterns:
  1. Server Action for forms
  2. Batch processing service
  3. Caching with Redis
  4. Webhook integration
- Testing strategies
- Deployment checklist
- Monitoring and logging
- Troubleshooting guide
- Cost optimization
- Security best practices
- Support resources

#### `CONTACT_ENRICHER_INDEX.md` (This file)
**File index and overview**

### Configuration

#### `.env.contact-enricher.example` (30 lines)
**Environment variables template**

Contains all available configuration options with comments.

Copy to `.env.local` and customize:
```bash
cp .env.contact-enricher.example .env.local
```

## Usage Quick Start

### 1. Setup

```bash
# Copy env template
cp .env.contact-enricher.example .env.local

# Add your API key
export ANTHROPIC_API_KEY=sk-ant-v7-...
```

### 2. Import

```typescript
import { getContactEnricher } from '@/lib/ai/contact-enricher';

const enricher = getContactEnricher();
```

### 3. Enrich Contact

```typescript
const enriched = await enricher.enrichContact({
  companyName: 'Apple Inc',
  country: 'United States',
  website: 'https://apple.com'
});

console.log(enriched.company);
console.log(enriched.verificationScore);
```

### 4. Verify Email/Phone

```typescript
const emailVerif = await enricher.verifyEmail('contact@company.com');
const phoneVerif = await enricher.verifyPhone('+1-888-555-1234', 'US');
```

### 5. Use API Endpoint

```bash
curl -X POST http://localhost:3000/api/contacts/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Apple Inc",
    "country": "United States"
  }'
```

## Type Definitions

All types are exported from `contact-enricher.ts`:

```typescript
export interface EnrichedContact { /* Full contact data */ }
export interface CompanyData { /* Company information */ }
export interface SocialProfiles { /* Social media URLs */ }
export interface ContactData { /* Individual contact */ }
export interface LogoData { /* Logo with base64 */ }
export interface EnrichmentRequest { /* API request */ }
export class ContactEnrichmentError { /* Error base class */ }
export class ApiRateLimitError { /* Rate limit error */ }
export class InvalidInputError { /* Validation error */ }
```

## Architecture

```
Input (Company Name, Website, Email, Phone)
         ↓
    ContactEnricher
         ├→ Input Validation
         ├→ Cache Lookup
         ├→ API Request to Claude
         ├→ Response Parsing
         ├→ Data Normalization
         ├→ Verification Scoring
         ├→ Cache Storage
         └→ Return EnrichedContact

Output (Company Data, Social Profiles, Contacts, Score)
```

## Key Features

| Feature | Implementation |
|---------|---|
| Company Research | Claude API with structured prompts |
| Email Verification | Regex validation + domain checking |
| Phone Verification | International normalization + pattern detection |
| Logo Download | HTTP fetch + base64 encoding |
| CSV Export | Custom formatting with escaping |
| Caching | In-memory 24-hour TTL |
| Retry Logic | Exponential backoff (3 attempts) |
| Error Handling | Custom error classes with codes |
| Rate Limiting | Configurable requests per minute |
| Social Media | LinkedIn, Facebook, Twitter, Instagram, TikTok |
| Verification Score | 0-100 based on data completeness |
| Input Validation | Length, format, character checks |

## Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | 2,159 |
| Main Service | 808 lines |
| Examples | 418 lines |
| Unit Tests | 440 lines |
| Configuration | 255 lines |
| API Route | 238 lines |
| Documentation | 1,200+ lines |
| Files Created | 11 |

## Model & API Details

- **Model**: `claude-sonnet-4-5-20250929`
- **SDK Version**: `@anthropic-ai/sdk` v0.65.0+
- **Node Version**: 18+ required
- **Runtime**: Server-side only (no client-side)

## Dependencies

- `@anthropic-ai/sdk` - Claude API client (already in package.json)
- Node.js built-ins: `crypto`, `fs`, `fetch`, `Buffer`

## Integration Points

The service integrates with:
- **Next.js**: API routes, server actions, server components
- **Odoo**: Can enrich Odoo contacts via API route
- **Database**: Can store enriched data
- **Redis**: Optional external cache (Pattern 3 in guide)
- **Webhooks**: Can POST results to external systems (Pattern 4)
- **Frontend**: Via REST API endpoint

## Production Readiness Checklist

- [x] Full error handling with custom error classes
- [x] Input validation with detailed error messages
- [x] Retry logic with exponential backoff
- [x] In-memory caching with TTL
- [x] Email/phone verification
- [x] Logo download with size limits
- [x] CSV export capability
- [x] Comprehensive logging capability
- [x] Configuration management
- [x] Unit test coverage
- [x] API route implementation
- [x] Documentation (3 files, 1200+ lines)
- [x] Error recovery strategies
- [x] Performance optimization (caching, batching)
- [x] Security considerations (no key logging, input sanitization)

## What's NOT Included (By Design)

Things intentionally left out for flexibility:

1. **Database persistence** - Your project may use different DB
2. **Authentication** - Use your existing auth middleware
3. **Authorization** - Implement per your security model
4. **Redis integration** - Optional, shown in example pattern
5. **Webhook management** - Shown in example pattern
6. **Logging/monitoring** - Use your existing solution
7. **Metrics/analytics** - Shown in example pattern

These are all shown as patterns in the `IMPLEMENTATION_GUIDE.md`.

## Next Steps

1. Read `CONTACT_ENRICHER_README.md` for API reference
2. Copy `.env.contact-enricher.example` to `.env.local`
3. Set your `ANTHROPIC_API_KEY`
4. Try examples from `contact-enricher.example.ts`
5. Deploy API route
6. Follow patterns in `IMPLEMENTATION_GUIDE.md`
7. Run tests: `npm test -- lib/ai/contact-enricher.test.ts`

## Support

- Main docs: `CONTACT_ENRICHER_README.md`
- Implementation: `IMPLEMENTATION_GUIDE.md`
- Examples: `contact-enricher.example.ts`
- Tests: `contact-enricher.test.ts`

---

**Contact Enricher** - Production-ready contact intelligence service powered by Claude API.

Created with care for the Backend Development Team.
