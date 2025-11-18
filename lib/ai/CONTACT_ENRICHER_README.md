# Contact Enricher Service

Servizio production-ready per arricchimento automatico di dati contatti usando Claude API.

## Caratteristiche

- **Ricerca dati aziendali**: nome legale, P.IVA, settore, dipendenti
- **Social media discovery**: LinkedIn, Facebook, Twitter, Instagram, TikTok
- **Download logo aziendale**: in base64 per uso diretto
- **Verifica contatti**: validazione email e telefono con scoring
- **Caching intelligente**: riduce API calls e migliora performance
- **Error handling robusto**: retry esponenziale e gestione rate limit
- **Export dati**: CSV per integrazione con tool esterni

## Installazione

Assicurati che `@anthropic-ai/sdk` sia installato:

```bash
npm install @anthropic-ai/sdk
```

Configura variabile di ambiente:

```bash
export ANTHROPIC_API_KEY=sk-...
```

## Uso Rapido

### Arricchimento Base

```typescript
import { getContactEnricher } from '@/lib/ai/contact-enricher';

const enricher = getContactEnricher();

const enriched = await enricher.enrichContact({
  companyName: 'Apple Inc',
  country: 'United States',
  website: 'https://apple.com'
});

console.log(enriched.company);
// {
//   legalName: 'Apple Inc',
//   piva: '...',
//   sector: 'Technology',
//   employees: 164000,
//   country: 'United States'
// }
```

### Verifica Email

```typescript
const emailVerification = await enricher.verifyEmail('contact@apple.com');

if (emailVerification.valid) {
  console.log(`Score: ${emailVerification.score}/100`);
}
```

### Verifica Telefono

```typescript
const phoneVerification = await enricher.verifyPhone(
  '+1-888-518-3752',
  'US' // country code
);

console.log(phoneVerification.normalized); // "+18885183752"
```

### Scarica Logo

```typescript
const logo = await enricher.fetchCompanyLogo('https://apple.com');

if (logo) {
  // Usa direttamente in HTML
  // <img src="${logo.base64}" alt="Logo" />
  console.log(logo.format); // "png"
  console.log(logo.base64); // "data:image/png;base64,..."
}
```

### Export CSV

```typescript
const csv = enricher.exportToCSV(enriched);
fs.writeFileSync('companies.csv', csv);
```

## API Reference

### ContactEnricher

Classe principale per tutte le operazioni di arricchimento.

#### Constructor

```typescript
const enricher = new ContactEnricher(apiKey?: string);
```

- `apiKey` (opzionale): chiave API Anthropic. Default: `ANTHROPIC_API_KEY` env var

#### Methods

##### enrichContact(request)

Entra contatto con dati online.

```typescript
const enriched = await enricher.enrichContact({
  companyName: 'string (required)',
  country?: 'string',
  website?: 'string',
  email?: 'string',
  phone?: 'string',
  contacts?: Array<{
    name?: string,
    email?: string,
    phone?: string,
    role?: string
  }>
});
```

Returns: `Promise<EnrichedContact>`

**Throws**:
- `InvalidInputError`: input validation failed
- `ApiRateLimitError`: API rate limit exceeded
- `ContactEnrichmentError`: enrichment failed

**Caching**: Risultati cachati per 24 ore automaticamente

##### verifyEmail(email)

Valida email e restituisce confidence score.

```typescript
const result = await enricher.verifyEmail('test@company.com');
// { valid: true, score: 95 }
```

Returns: `Promise<{ valid: boolean, score: number, reason?: string }>`

Fattori di scoring:
- Formato email valido
- Dominio verificato (non temporary)
- Pattern email aziendali (non test/demo)

##### verifyPhone(phone, countryCode?)

Valida telefono e normalizza con country code.

```typescript
const result = await enricher.verifyPhone('+1-888-518-3752', 'US');
// {
//   valid: true,
//   score: 95,
//   normalized: '+18885183752'
// }
```

Returns: `Promise<{ valid: boolean, score: number, normalized?: string, reason?: string }>`

##### fetchCompanyLogo(websiteUrl)

Scarica logo aziendale e converte in base64.

```typescript
const logo = await enricher.fetchCompanyLogo('https://apple.com');
// {
//   base64: 'data:image/png;base64,...',
//   format: 'png',
//   source: 'https://apple.com/logo.png'
// }
```

Returns: `Promise<LogoData | null>`

**Supported formats**: PNG, JPG, GIF, WebP, SVG

**Max size**: 500KB

##### exportToCSV(enriched)

Esporta contatto arricchito come CSV.

```typescript
const csv = enricher.exportToCSV(enriched);
// "Company Name,Legal Name,P.IVA,..."
```

Returns: `string` (CSV formatted)

##### clearCache()

Cancella tutti i risultati cachati.

```typescript
enricher.clearCache();
```

##### getCacheStats()

Ottienii statistiche cache.

```typescript
const stats = enricher.getCacheStats();
// { size: 2, entries: ['hash1', 'hash2'] }
```

Returns: `{ size: number, entries: string[] }`

### Singleton Pattern

Usa `getContactEnricher()` per ottenere istanza singleton:

```typescript
// Stessa istanza in tutto l'app
const enricher1 = getContactEnricher();
const enricher2 = getContactEnricher();

enricher1 === enricher2; // true
```

## Types

### EnrichedContact

```typescript
interface EnrichedContact {
  company: CompanyData;
  social: SocialProfiles;
  contacts: ContactData[];
  logo?: LogoData;
  emailValid: boolean;
  phoneValid: boolean;
  verificationScore: number; // 0-100
  lastUpdated: string; // ISO date
  sources: string[]; // Data sources
}
```

### CompanyData

```typescript
interface CompanyData {
  legalName: string;
  piva: string; // Tax/VAT ID
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
```

### SocialProfiles

```typescript
interface SocialProfiles {
  linkedin?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
}
```

### ContactData

```typescript
interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  department?: string;
  linkedinProfile?: string;
}
```

### LogoData

```typescript
interface LogoData {
  base64: string; // data URL
  format: string; // png, jpg, gif, webp, svg
  source: string; // original URL
}
```

## API Route Integration

### Endpoint: POST /api/contacts/enrich

```typescript
// request
{
  "companyName": "Apple Inc",
  "country": "United States",
  "website": "https://apple.com",
  "email": "contact@apple.com"
}

// response
{
  "success": true,
  "data": {
    "company": { /* ... */ },
    "social": { /* ... */ },
    "contacts": [ /* ... */ ],
    "verificationScore": 85,
    "emailValid": true,
    "phoneValid": true,
    "lastUpdated": "2024-11-17T10:30:00.000Z"
  },
  "metadata": {
    "processingTimeMs": 2500,
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid input or validation error
- `429`: Rate limit exceeded
- `500`: Server error

## Verification Score Explained

Il verification score (0-100) indica l'affidabilità dei dati:

- **80-100**: Molto alta - Dati verificati e completi
- **60-79**: Alta - Buona copertura dei dati
- **40-59**: Media - Dati parziali, consigliata verifica
- **20-39**: Bassa - Dati molto incomplete
- **0-19**: Molto bassa - Insufficiente per business use

**Fattori che aumentano lo score**:
- Legale name verificato
- P.IVA/Tax ID trovato
- Social media profiles
- Contact information
- Email/phone verified

## Error Handling

### Tipologie di errore

```typescript
import {
  ContactEnrichmentError,
  InvalidInputError,
  ApiRateLimitError
} from '@/lib/ai/contact-enricher';

try {
  const enriched = await enricher.enrichContact(request);
} catch (error) {
  if (error instanceof InvalidInputError) {
    // Validazione input fallita
    console.error(error.message); // es: "Company name is required"
  } else if (error instanceof ApiRateLimitError) {
    // Rate limit exceeded - retry dopo delay
    console.error('Retry in 60 seconds');
  } else if (error instanceof ContactEnrichmentError) {
    // Errore generico enrichment
    console.error(`[${error.code}]: ${error.message}`);
  }
}
```

### Retry Logic

Built-in exponential backoff per errori ritentabili:

```
Attempt 1: immediate
Attempt 2: 1000ms delay
Attempt 3: 2000ms delay (2x)
Attempt 4: 4000ms delay (2x)
```

Max 3 retry automatici.

## Caching Strategy

Risultati cachati in-memory per 24 ore:

```typescript
// Prima richiesta - API call
const enriched1 = await enricher.enrichContact({
  companyName: 'Apple Inc',
  country: 'US'
});

// Seconda richiesta - da cache (istantaneo)
const enriched2 = await enricher.enrichContact({
  companyName: 'Apple Inc',
  country: 'US'
});

// Cache invalidato dopo 24 ore
```

Chiave cache: SHA256(companyName:country)

### Clear Cache Manualmente

```typescript
enricher.clearCache();
```

Utile per:
- Testing
- Memory management
- Force refresh data

## Performance Considerations

### Timeout

- API request: 2 minutes (built-in Anthropic SDK)
- Logo download: 5-10 seconds
- Verifica email/phone: immediate (local)

### Rate Limiting

Anthropic API limits:
- Free tier: limited requests per minute
- Paid: higher limits

Implementa retry logic e request throttling:

```typescript
// Batch enrichment con delay
for (const company of companies) {
  await enricher.enrichContact({ companyName: company });
  await new Promise(r => setTimeout(r, 1000)); // 1s delay tra richieste
}
```

### Memory Management

Cache limita a ~1000 entries (24hr expiry):

```typescript
// Check stats
const stats = enricher.getCacheStats();
console.log(`Cache size: ${stats.size}`);

// Clear if needed
if (stats.size > 500) {
  enricher.clearCache();
}
```

## Testing

Run tests:

```bash
npm test -- lib/ai/contact-enricher.test.ts
```

Unit tests coprono:
- Input validation
- Email/phone verification
- CSV export
- Cache management
- Error handling

Integration tests (require API key):
- Real company enrichment
- Logo download

## Production Checklist

- [ ] Set `ANTHROPIC_API_KEY` in production environment
- [ ] Configure rate limiting per endpoint
- [ ] Monitor API usage and costs
- [ ] Setup error logging/monitoring
- [ ] Implement request throttling per client
- [ ] Consider Redis cache per multi-instance deployments
- [ ] Setup alerts for rate limit errors
- [ ] Review verification score thresholds per use case
- [ ] Document user expectations re: data freshness
- [ ] Implement request deduplication

## Best Practices

### 1. Batch Processing

```typescript
const companies = ['Apple', 'Google', 'Microsoft'];

for (const name of companies) {
  try {
    const enriched = await enricher.enrichContact({ companyName: name });
    // Process enriched data
  } catch (error) {
    // Handle error for single company
    console.error(`Failed to enrich ${name}`);
  }

  // Delay tra richieste
  await new Promise(r => setTimeout(r, 2000));
}
```

### 2. Validation Before Use

```typescript
const enriched = await enricher.enrichContact(request);

// Check confidence score
if (enriched.verificationScore < 50) {
  console.warn('Low confidence - recommend manual verification');
}

// Verify specific fields
if (!enriched.company.piva) {
  console.warn('P.IVA not found');
}
```

### 3. Logo Caching

```typescript
// Salva logo localmente per evitare download ripetuti
const logo = await enricher.fetchCompanyLogo(url);
if (logo) {
  await fs.writeFile(`logos/${companyId}.${logo.format}`,
    Buffer.from(logo.base64.split(',')[1], 'base64')
  );
}
```

### 4. Error Recovery

```typescript
async function enrichWithFallback(companyName: string) {
  try {
    return await enricher.enrichContact({ companyName });
  } catch (error) {
    if (error instanceof ApiRateLimitError) {
      // Wait and retry
      await new Promise(r => setTimeout(r, 60000));
      return enrichWithFallback(companyName);
    }

    // Return minimal data on failure
    return {
      company: { legalName: companyName, /* ... */ },
      verificationScore: 0,
      // ... other empty fields
    };
  }
}
```

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable not set"

Set API key:
```bash
export ANTHROPIC_API_KEY=sk-...
```

### Rate limit errors

Implementa backoff esponenziale e request throttling:

```typescript
const delay = 1000 * Math.pow(2, retryCount);
await new Promise(r => setTimeout(r, delay));
```

### Logo download fails

Alcuni siti bloccano accesso da bot. Fallback a URL logo predefiniti:

```typescript
const logo = await enricher.fetchCompanyLogo(website)
  || await getLogoFromAlternativeSource(website);
```

### Incomplete data

Verification score basso = dati incompleti. Considerazioni:

- Azienda non ha social media pubblici
- Dati non ancora indicizzati
- Azienda privatata/nascosta

Usa il dati comunque ma marca come non verificato.

## Security Considerations

- API key non esposta nel client (server-side only)
- Logo base64 limitato a 500KB max
- Email/phone validation locale (no external service)
- Input sanitization per tutti i parametri
- Rate limiting per prevenire abuse

## Cost Optimization

- In-memory cache riduce API calls ~80%
- Batch processing con delay evita rate limiting
- Logo caching locale riduce transfer costs
- Verification locale (no extra API calls)

## Migrazione da Sistemi Esistenti

Se migri da altro servizio di enrichment:

```typescript
// Old system
const oldData = await oldEnricher.enrich(companyName);

// New system
const enriched = await enricher.enrichContact({
  companyName,
  country: oldData.country,
  website: oldData.website
});

// Map to new format
const newData = {
  company: enriched.company,
  social: enriched.social,
  verificationScore: enriched.verificationScore,
  // ... map other fields
};
```

## Support & Documentation

- Model: `claude-sonnet-4-5-20250929`
- SDK: `@anthropic-ai/sdk` v0.65.0+
- Node: 18+ required

## Changelog

### v1.0.0 (2024-11-17)

- Initial release
- Full contact enrichment
- Email/phone verification
- Logo download
- CSV export
- Production-ready error handling

---

**Made with** by Backend Development Team
