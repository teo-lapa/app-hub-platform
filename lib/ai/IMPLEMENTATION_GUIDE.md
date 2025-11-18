# Contact Enricher Implementation Guide

Guida completa per implementare il Contact Enricher nel vostro progetto.

## File Creati

```
lib/ai/
├── contact-enricher.ts              # Core service (23KB, production-ready)
├── contact-enricher.example.ts      # 10 Usage examples
├── contact-enricher.test.ts         # Jest unit tests
├── contact-enricher-config.ts       # Configuration management
├── CONTACT_ENRICHER_README.md       # Full documentation
└── IMPLEMENTATION_GUIDE.md          # This file

app/api/contacts/enrich/
└── route.ts                         # API endpoint

Root:
└── .env.contact-enricher.example    # Environment variables template
```

## Quick Start (5 minuti)

### 1. Setup Environment

```bash
# Copy template
cp .env.contact-enricher.example .env.local

# Add your API key
export ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Import e Usa

```typescript
import { getContactEnricher } from '@/lib/ai/contact-enricher';

const enricher = getContactEnricher();

const enriched = await enricher.enrichContact({
  companyName: 'Apple Inc',
  country: 'United States'
});

console.log(enriched.company);
```

### 3. Deploy API Endpoint

L'endpoint `/api/contacts/enrich` è già implementato in `app/api/contacts/enrich/route.ts`.

Testa con:

```bash
curl -X POST http://localhost:3000/api/contacts/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Apple Inc",
    "country": "United States",
    "website": "https://apple.com"
  }'
```

## Architecture Overview

```
┌─────────────────────────────────────┐
│   Frontend / External Client         │
└──────────────────┬──────────────────┘
                   │ REST API
                   ↓
┌──────────────────────────────────────┐
│  /api/contacts/enrich (route.ts)    │
│                                      │
│  - Input validation                  │
│  - Response formatting               │
│  - Error handling                    │
└──────────────────┬──────────────────┘
                   │ Service call
                   ↓
┌──────────────────────────────────────┐
│  ContactEnricher (contact-enricher)  │
│                                      │
│  - Caching layer                     │
│  - Retry logic                       │
│  - Data normalization                │
│  - Verification scoring              │
└──────────────────┬──────────────────┘
                   │ API request
                   ↓
┌──────────────────────────────────────┐
│     Claude API (Anthropic)           │
│     (claude-sonnet-4-5-20250929)    │
│                                      │
│  - Company research                  │
│  - Data extraction                   │
│  - Verification                      │
└──────────────────────────────────────┘
```

## Configuration

### Via Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
CONTACT_ENRICHER_CACHE_TTL=86400000  # 24 hours
CONTACT_ENRICHER_MAX_RETRIES=3
CONTACT_ENRICHER_DEBUG=false
```

### Via Code

```typescript
import { createContactEnricherConfig } from '@/lib/ai/contact-enricher-config';

const config = createContactEnricherConfig({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  maxRetries: 5,
  rateLimit: 50,
  debug: true
});

// Validate before use
const validation = validateContactEnricherConfig(config);
if (!validation.valid) {
  console.error(validation.errors);
}
```

## Integration Patterns

### Pattern 1: Server Action for Form

```typescript
// app/actions/enrich-contact.ts

'use server'

import { getContactEnricher } from '@/lib/ai/contact-enricher';

export async function enrichContactAction(
  companyName: string,
  country?: string
) {
  try {
    const enricher = getContactEnricher();
    const enriched = await enricher.enrichContact({
      companyName,
      country
    });

    return {
      success: true,
      data: enriched
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enrich'
    };
  }
}
```

Uso nel form:

```typescript
// app/components/enrich-form.tsx

'use client'

import { enrichContactAction } from '@/app/actions/enrich-contact';
import { useState } from 'react';

export function EnrichForm() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target as HTMLFormElement);
    const companyName = formData.get('company') as string;

    const result = await enrichContactAction(companyName);
    setResult(result);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="company" type="text" required />
      <button disabled={loading}>
        {loading ? 'Enriching...' : 'Enrich'}
      </button>

      {result && (
        <div>
          {result.success ? (
            <div>
              <p>Company: {result.data.company.legalName}</p>
              <p>Score: {result.data.verificationScore}</p>
            </div>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
```

### Pattern 2: Batch Processing

```typescript
// lib/services/batch-enricher.ts

import { getContactEnricher } from '@/lib/ai/contact-enricher';

export interface BatchResult {
  companyName: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class BatchEnricher {
  private enricher = getContactEnricher();
  private delayMs = 2000; // 2 second delay between requests

  async enrichBatch(
    companies: Array<{ name: string; country?: string }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];

      try {
        const enriched = await this.enricher.enrichContact({
          companyName: company.name,
          country: company.country
        });

        results.push({
          companyName: company.name,
          success: true,
          data: enriched
        });
      } catch (error) {
        results.push({
          companyName: company.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Callback progress
      if (onProgress) {
        onProgress(i + 1, companies.length);
      }

      // Delay before next request (except last)
      if (i < companies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    return results;
  }

  async enrichBatchWithExport(
    companies: Array<{ name: string; country?: string }>,
    outputFile: string
  ): Promise<void> {
    const results = await this.enrichBatch(companies);

    // Convert to CSV
    const csvLines = ['Company,Legal Name,P.IVA,Score,Success'];

    for (const result of results) {
      if (result.success) {
        csvLines.push(
          `"${result.companyName}","${result.data.company.legalName}","${result.data.company.piva}",${result.data.verificationScore},"Yes"`
        );
      } else {
        csvLines.push(
          `"${result.companyName}","","",0,"No"`
        );
      }
    }

    // Write to file
    await import('fs/promises').then(fs =>
      fs.writeFile(outputFile, csvLines.join('\n'))
    );
  }
}

// Usage
const batchEnricher = new BatchEnricher();

const companies = [
  { name: 'Apple Inc', country: 'US' },
  { name: 'Microsoft', country: 'US' },
  { name: 'Google', country: 'US' }
];

const results = await batchEnricher.enrichBatch(companies, (current, total) => {
  console.log(`Progress: ${current}/${total}`);
});

// Or export to CSV
await batchEnricher.enrichBatchWithExport(
  companies,
  'companies_enriched.csv'
);
```

### Pattern 3: Caching with Redis

```typescript
// lib/services/cached-enricher.ts

import { getContactEnricher } from '@/lib/ai/contact-enricher';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export class CachedEnricher {
  private enricher = getContactEnricher();
  private cacheKeyPrefix = 'enriched:';
  private cacheTtl = 24 * 60 * 60; // 24 hours

  private getCacheKey(companyName: string, country?: string): string {
    return `${this.cacheKeyPrefix}${companyName}:${country || 'global'}`;
  }

  async enrichContact(companyName: string, country?: string) {
    const cacheKey = this.getCacheKey(companyName, country);

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Cache hit: ${cacheKey}`);
      return JSON.parse(cached as string);
    }

    // Fetch from enricher
    const enriched = await this.enricher.enrichContact({
      companyName,
      country
    });

    // Store in Redis
    await redis.setex(
      cacheKey,
      this.cacheTtl,
      JSON.stringify(enriched)
    );

    return enriched;
  }

  async clearCache(companyName: string, country?: string): Promise<void> {
    const cacheKey = this.getCacheKey(companyName, country);
    await redis.del(cacheKey);
  }

  async clearAllCache(): Promise<void> {
    const keys = await redis.keys(`${this.cacheKeyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
```

### Pattern 4: Webhook Integration

```typescript
// app/api/webhooks/enrich/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getContactEnricher } from '@/lib/ai/contact-enricher';

export async function POST(request: NextRequest) {
  try {
    const { companyName, country, webhookUrl } = await request.json();

    // Enrich asynchronously
    (async () => {
      try {
        const enricher = getContactEnricher();
        const enriched = await enricher.enrichContact({
          companyName,
          country
        });

        // Send results to webhook
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            data: enriched
          })
        });
      } catch (error) {
        // Notify webhook of error
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        });
      }
    })();

    // Return immediately
    return NextResponse.json({
      success: true,
      message: 'Enrichment started. Results will be sent to webhook.'
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
```

## Testing

### Unit Tests

```bash
npm test -- lib/ai/contact-enricher.test.ts
```

Copertura:
- Input validation
- Email verification
- Phone verification
- CSV export
- Cache management

### Integration Tests

```typescript
// Richiede API key valida
npm test -- lib/ai/contact-enricher.test.ts --testNamePattern="Integration"
```

### Manual Testing

```typescript
// scripts/test-enricher.ts

import { getContactEnricher } from '@/lib/ai/contact-enricher';

async function test() {
  const enricher = getContactEnricher();

  console.log('Testing Contact Enricher...\n');

  // Test 1: Basic enrichment
  console.log('1. Basic Enrichment');
  const enriched = await enricher.enrichContact({
    companyName: 'OpenAI',
    country: 'United States'
  });
  console.log(`   Company: ${enriched.company.legalName}`);
  console.log(`   Score: ${enriched.verificationScore}\n`);

  // Test 2: Email verification
  console.log('2. Email Verification');
  const emailVerif = await enricher.verifyEmail('contact@openai.com');
  console.log(`   Valid: ${emailVerif.valid}, Score: ${emailVerif.score}\n`);

  // Test 3: Phone verification
  console.log('3. Phone Verification');
  const phoneVerif = await enricher.verifyPhone('+1-415-555-0123', 'US');
  console.log(`   Valid: ${phoneVerif.valid}`);
  console.log(`   Normalized: ${phoneVerif.normalized}\n`);

  // Test 4: Cache stats
  console.log('4. Cache Stats');
  const stats = enricher.getCacheStats();
  console.log(`   Cached entries: ${stats.size}\n`);

  console.log('All tests completed!');
}

test().catch(console.error);
```

Esegui con:

```bash
npx ts-node scripts/test-enricher.ts
```

## Deployment Checklist

### Pre-Deployment

- [ ] Set `ANTHROPIC_API_KEY` in production environment
- [ ] Test API endpoint with real data
- [ ] Verify rate limiting works
- [ ] Check error handling and logging
- [ ] Load test with expected volume
- [ ] Review security (no key logging, input sanitization)
- [ ] Configure monitoring and alerts
- [ ] Setup backup cache strategy (Redis)
- [ ] Document SLA and limits
- [ ] Create runbook for incidents

### Deployment

```bash
# Build
npm run build

# Deploy to production
npm run deploy

# Verify endpoint
curl -X POST https://your-domain.com/api/contacts/enrich \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Test Inc"}'
```

### Post-Deployment

- [ ] Monitor API usage and costs
- [ ] Check error rates (should be < 1%)
- [ ] Verify response times (typically 2-5 seconds)
- [ ] Monitor cache hit rate (should be > 70% after warmup)
- [ ] Setup alerts for rate limits
- [ ] Document any issues and resolutions

## Monitoring & Logging

```typescript
// lib/services/enrichment-monitor.ts

import { ContactEnrichmentError } from '@/lib/ai/contact-enricher';

export class EnrichmentMonitor {
  private stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
    errors: new Map<string, number>()
  };

  trackRequest(duration: number, success: boolean, errorCode?: string) {
    this.stats.totalRequests++;

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
      if (errorCode) {
        this.stats.errors.set(
          errorCode,
          (this.stats.errors.get(errorCode) || 0) + 1
        );
      }
    }

    // Update average response time
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + duration) /
      this.stats.totalRequests;
  }

  trackCacheHit() {
    this.stats.cacheHits++;
  }

  getStats() {
    return {
      ...this.stats,
      successRate: (this.stats.successfulRequests / this.stats.totalRequests) * 100,
      cacheHitRate: (this.stats.cacheHits / this.stats.totalRequests) * 100
    };
  }

  logStats() {
    const stats = this.getStats();
    console.log('Enrichment Statistics:');
    console.log(`  Total Requests: ${stats.totalRequests}`);
    console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
    console.log(`  Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%`);
    console.log(`  Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms`);

    if (stats.errors.size > 0) {
      console.log('  Top Errors:');
      for (const [code, count] of Array.from(stats.errors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)) {
        console.log(`    - ${code}: ${count}`);
      }
    }
  }
}
```

## Troubleshooting

### Problem: "ANTHROPIC_API_KEY environment variable not set"

**Solution**: Set environment variable

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Problem: Rate limit errors

**Solution**: Implementa request throttling

```typescript
const delay = Math.pow(2, retryCount) * 1000; // exponential backoff
await new Promise(r => setTimeout(r, delay));
```

### Problem: Slow responses

**Possible causes**:
- API latency
- Network issues
- Large batch processing

**Solutions**:
- Check `avgResponseTime` metrics
- Implement timeout handling
- Use caching more aggressively

### Problem: Incomplete company data

**Possible causes**:
- Company not well-indexed
- Small/private company
- Regional variations

**Solutions**:
- Check verification score (low = incomplete)
- Use additional data sources
- Manual verification for critical data

## Cost Optimization

### Estimate Usage

```typescript
// Pricing example (May 2024)
const inputTokenCost = 0.003; // $3 per million input tokens
const outputTokenCost = 0.015; // $15 per million output tokens

const estimatedTokensPerRequest = {
  input: 2000,  // ~2K tokens for prompt + company data
  output: 500   // ~500 tokens for response
};

const costPerRequest =
  (estimatedTokensPerRequest.input * inputTokenCost / 1000000) +
  (estimatedTokensPerRequest.output * outputTokenCost / 1000000);

// ~$0.0085 per request
const monthlyRequests = 10000;
const estimatedCost = costPerRequest * monthlyRequests; // ~$85/month
```

### Ways to Reduce Cost

1. **Caching**: Riduce duplicate requests by 70-80%
2. **Batch processing**: Mejora efficiency
3. **Selective enrichment**: Non arricchire tutto, solo dati critici
4. **Lazy loading**: Scarica logo solo se necessario
5. **Rate limiting**: Evita duplicate/accidental requests

## Security

### API Key Management

```bash
# Use environment variables, never in code
export ANTHROPIC_API_KEY=sk-ant-...

# Use secure vaults in production (e.g., AWS Secrets Manager)
# Never commit .env files
```

### Input Validation

```typescript
// Always validate input
const request = validateInput(userInput);

// Sanitize company names
const cleanName = companyName
  .trim()
  .slice(0, 200) // Max length
  .replace(/[<>]/g, ''); // Remove dangerous chars
```

### Rate Limiting

```typescript
// Implement per-user/IP rate limiting
const rateLimit = new RateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10 // Max 10 requests per minute
});
```

## Support

- Documentation: `lib/ai/CONTACT_ENRICHER_README.md`
- Examples: `lib/ai/contact-enricher.example.ts`
- Tests: `lib/ai/contact-enricher.test.ts`

---

**Ready to enrich contacts!** Start with Quick Start section above.
