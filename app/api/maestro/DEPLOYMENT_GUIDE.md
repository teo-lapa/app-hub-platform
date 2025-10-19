# MAESTRO AI - Deployment & Setup Guide

Guida completa per setup e deployment del sistema MAESTRO AI backend.

## Prerequisites

- **Node.js** 18+
- **Vercel Postgres** database configured
- **Anthropic API Key** per Claude AI
- **Odoo Instance** accessibile con credenziali

---

## 1. Database Setup

### Step 1: Create Database (Vercel)

1. Vai su Vercel Dashboard → tuo progetto
2. Vai in **Storage** → **Create Database** → **Postgres**
3. Copia le credenziali di connessione

### Step 2: Configure Environment Variables

Crea/aggiorna `.env.local`:

```bash
# Vercel Postgres (auto-configured se deploy su Vercel)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# Anthropic AI (REQUIRED for AI recommendations)
ANTHROPIC_API_KEY="sk-ant-api03-xxxxx"

# Odoo Configuration
ODOO_URL="https://your-instance.odoo.com"
ODOO_DB="your-database"
ODOO_USERNAME="your@email.com"
ODOO_PASSWORD="your-password"
```

### Step 3: Create Database Tables

Opzione A - Tramite script SQL:
```bash
# Connettiti a Postgres
psql $POSTGRES_URL

# Esegui schema
\i lib/maestro/db-schema.sql
```

Opzione B - Tramite Vercel Postgres Dashboard:
1. Vai su Vercel → Storage → tuo database → **Query**
2. Copia/incolla contenuto di `lib/maestro/db-schema.sql`
3. Esegui

### Step 4: Verify Tables

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'customer%' OR table_name LIKE 'maestro%';
```

Expected output:
- customer_avatars
- maestro_recommendations
- maestro_interactions

---

## 2. Dependencies Installation

```bash
cd app-hub-platform

# Install dependencies (zod already included)
npm install

# Verify zod installed
npm list zod
```

Se zod non presente:
```bash
npm install zod
```

---

## 3. Initial Data Sync from Odoo

### Step 1: Run Sync Script

Il sync script è già disponibile in `lib/maestro/sync-odoo.ts`.

Opzione A - Sync completo (tutti clienti attivi ultimi 4 mesi):
```typescript
import { syncCustomersFromOdoo } from '@/lib/maestro/sync-odoo';

await syncCustomersFromOdoo(0); // 0 = no limit
```

Opzione B - Sync limitato (es: primi 50 clienti per testing):
```typescript
await syncCustomersFromOdoo(50);
```

### Step 2: Create Sync API Endpoint (Optional)

Crea `app/api/maestro/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { syncCustomersFromOdoo, getSyncStatus } from '@/lib/maestro/sync-odoo';

export async function POST(request: NextRequest) {
  try {
    const { maxCustomers = 0 } = await request.json();

    console.log('Starting Odoo sync...');
    const result = await syncCustomersFromOdoo(maxCustomers);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await getSyncStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

Poi sync tramite API:
```bash
# Sync primi 50 clienti
curl -X POST "http://localhost:3000/api/maestro/sync" \
  -H "Content-Type: application/json" \
  -d '{"maxCustomers": 50}'

# Check sync status
curl "http://localhost:3000/api/maestro/sync"
```

---

## 4. Test API Endpoints

### Start Development Server

```bash
npm run dev
```

### Quick Test

```bash
# Test 1: Fetch avatars
curl "http://localhost:3000/api/maestro/avatars?limit=5"

# Test 2: Generate recommendations (requires ANTHROPIC_API_KEY)
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{"salesperson_id": 5, "max_recommendations": 3}'

# Test 3: Get daily plan
curl "http://localhost:3000/api/maestro/daily-plan?salesperson_id=5"
```

Vedi `TEST_EXAMPLES.md` per test completi.

---

## 5. Deploy to Production (Vercel)

### Step 1: Commit & Push

```bash
git add .
git commit -m "Add MAESTRO AI backend APIs"
git push origin main
```

### Step 2: Deploy su Vercel

Vercel auto-deploy on push (se configurato).

Oppure manuale:
```bash
vercel --prod
```

### Step 3: Configure Production Environment Variables

1. Vercel Dashboard → tuo progetto → **Settings** → **Environment Variables**
2. Aggiungi tutte le variabili da `.env.local`:
   - `ANTHROPIC_API_KEY`
   - `ODOO_URL`
   - `ODOO_DB`
   - `ODOO_USERNAME`
   - `ODOO_PASSWORD`
3. Redeploy

### Step 4: Run Initial Sync in Production

```bash
# Sync via API endpoint
curl -X POST "https://your-domain.vercel.app/api/maestro/sync" \
  -H "Content-Type: application/json" \
  -d '{"maxCustomers": 100}'
```

---

## 6. Monitoring & Maintenance

### Database Monitoring

```sql
-- Check total avatars
SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active
FROM customer_avatars;

-- Check churn risk distribution
SELECT
  CASE
    WHEN churn_risk_score >= 70 THEN 'High Risk'
    WHEN churn_risk_score >= 50 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END as risk_level,
  COUNT(*) as count
FROM customer_avatars
WHERE is_active = true
GROUP BY risk_level;

-- Check recommendations status
SELECT status, COUNT(*) FROM maestro_recommendations GROUP BY status;

-- Check interactions last 7 days
SELECT DATE(interaction_date) as date, COUNT(*) as interactions
FROM maestro_interactions
WHERE interaction_date >= NOW() - INTERVAL '7 days'
GROUP BY DATE(interaction_date)
ORDER BY date DESC;
```

### Logs Monitoring

```bash
# Vercel logs
vercel logs

# Filter MAESTRO logs
vercel logs | grep MAESTRO
```

### Scheduled Sync (Optional)

Crea cron job per sync automatico giornaliero:

**Opzione A - Vercel Cron:**

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/maestro/sync",
    "schedule": "0 2 * * *"
  }]
}
```

**Opzione B - External Cron (es: GitHub Actions):**

`.github/workflows/maestro-sync.yml`:
```yaml
name: MAESTRO Daily Sync
on:
  schedule:
    - cron: '0 2 * * *' # Every day at 2 AM UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/maestro/sync" \
            -H "Content-Type: application/json" \
            -d '{"maxCustomers": 0}'
```

---

## 7. Security Best Practices

### API Authentication (TODO)

Le API attualmente NON hanno autenticazione. Per production:

1. **NextAuth.js** per session-based auth
2. **API Key** per M2M communication
3. **Rate Limiting** con `@vercel/rate-limit`

Esempio auth middleware:
```typescript
// middleware/auth.ts
export async function requireAuth(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}
```

### Input Validation

✅ Già implementata con Zod schemas in tutte le API.

### SQL Injection Protection

✅ Già protetto usando `@vercel/postgres` con parameterized queries.

### Rate Limiting (Recommended)

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

const ratelimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // ... rest of handler
}
```

---

## 8. Performance Optimization

### Database Indexes

✅ Già creati in `db-schema.sql`:
- `idx_avatars_salesperson`
- `idx_avatars_churn_risk`
- `idx_recommendations_status`
- etc.

### API Response Caching

Aggiungi cache headers per GET endpoints:

```typescript
export async function GET(request: NextRequest) {
  // ... fetch data

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
    }
  });
}
```

### Background Jobs per Sync

Usa Vercel Background Functions (Beta) o Queue service per long-running tasks:

```typescript
// app/api/maestro/sync/route.ts
export const config = {
  maxDuration: 300, // 5 minutes
};
```

---

## 9. Troubleshooting

### Issue: "Failed to connect to database"

**Solution:**
- Verifica `POSTGRES_URL` in `.env.local`
- Check firewall/network restrictions
- Verifica database sia running

### Issue: "ANTHROPIC_API_KEY not found"

**Solution:**
- Aggiungi key in `.env.local`
- Redeploy su Vercel con env var configurata

### Issue: "No customers found in sync"

**Solution:**
- Verifica credenziali Odoo corrette
- Check domain filter in `sync-odoo.ts` (ultimi 4 mesi)
- Verifica venditori hanno clienti assegnati

### Issue: "Recommendation generation timeout"

**Solution:**
- Riduci `max_recommendations` parametro
- Check Claude API quota/limits
- Aumenta `maxDuration` in API route config

---

## 10. Next Steps

### Features da Implementare

- [ ] **Authentication & Authorization** (NextAuth.js)
- [ ] **Rate Limiting** (@upstash/ratelimit)
- [ ] **Webhook Odoo → MAESTRO** per sync real-time
- [ ] **Email/WhatsApp notifications** per recommendations urgent
- [ ] **Geo-routing optimization** in daily plan
- [ ] **Analytics Dashboard** (stats, charts)
- [ ] **Export daily plan to PDF/iCal**
- [ ] **ML model training** from interaction outcomes
- [ ] **Mobile app** (React Native/Flutter)

### Testing

- [ ] Unit tests (Jest/Vitest)
- [ ] Integration tests
- [ ] Load testing (k6)
- [ ] E2E tests (Playwright)

### Documentation

- [ ] OpenAPI/Swagger spec
- [ ] Postman collection
- [ ] Frontend integration guide

---

## Support

Per domande o issue: contatta Backend Team.

**Repository:** [GitHub Link]
**Docs:** `/app/api/maestro/README.md`
**Tests:** `/app/api/maestro/TEST_EXAMPLES.md`

---

🚀 **MAESTRO AI is ready for production!**
