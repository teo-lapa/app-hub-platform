# MAESTRO AI - Sync Engine v2.0

## Parent/Child Hierarchy Support

Il Sync Engine v2.0 risolve la sfida critica della gerarchia parent/child di Odoo.

### Il Problema

In Odoo `res.partner`:
- **AZIENDA MADRE**: `parent_id = NULL`, `is_company = True`
- **FIGLI** (contacts, indirizzi fatturazione, consegne): `parent_id = ID_MADRE`

**Gli ordini possono essere su QUALSIASI figlio**, quindi dobbiamo:
1. Trovare tutte le aziende madri
2. Per ogni madre, trovare TUTTI i figli
3. Aggregare ordini di madre + TUTTI i figli
4. Creare UN SOLO avatar per azienda madre

### La Soluzione

```typescript
// Il sync engine:
// 1. Trova tutti i partner con ordini
// 2. Risolve la gerarchia parent/child
// 3. Raggruppa ordini per azienda madre
// 4. Crea/aggiorna avatar aggregato

await syncCustomersFromOdoo({
  monthsBack: 4,      // Ultimi 4 mesi
  maxCustomers: 0,    // 0 = tutti
  dryRun: false       // false = scrive DB
});
```

## Architettura

```
┌─────────────────────────────────────────────────────────┐
│                  ODOO ERP (Source)                      │
│                                                         │
│  res.partner (PARENT)                                   │
│  ├── child_ids[0] (delivery address A)                 │
│  ├── child_ids[1] (delivery address B)                 │
│  └── child_ids[2] (invoice address)                    │
│                                                         │
│  sale.order can be on ANY of these partners            │
└─────────────────────────────────────────────────────────┘
                        ↓
                  SYNC ENGINE v2
                  (Parent/Child Logic)
                        ↓
┌─────────────────────────────────────────────────────────┐
│            Vercel Postgres (Destination)                │
│                                                         │
│  customer_avatars                                       │
│  ├── odoo_partner_id (parent ID)                       │
│  ├── total_orders (parent + ALL children)              │
│  ├── total_revenue (aggregated)                        │
│  ├── health_score (AI calculated)                      │
│  ├── churn_risk_score (AI calculated)                  │
│  └── upsell_potential_score (AI calculated)            │
└─────────────────────────────────────────────────────────┘
```

## Features

### 1. Parent/Child Resolution
```typescript
// Automatic hierarchy resolution:
// - Detects parent companies
// - Fetches all children
// - Aggregates orders across entire family
```

### 2. AI Scoring
```typescript
// 4 AI scores per customer:
{
  health_score: 85,           // 0-100: Overall relationship health
  churn_risk_score: 15,       // 0-100: Risk of churn (higher = worse)
  upsell_potential_score: 70, // 0-100: Opportunity for growth
  engagement_score: 90        // 0-100: Activity level
}
```

### 3. Top Products Tracking
```typescript
// Automatically extracts top 10 products per customer
top_products: [
  {
    product_id: 123,
    name: "Prodotto A",
    total_quantity: 50,
    total_revenue: 1500.00,
    order_count: 5
  }
]
```

### 4. Behavioral Metrics
```typescript
// Automatic calculation of:
- first_order_date
- last_order_date
- total_orders
- total_revenue
- avg_order_value
- order_frequency_days (avg days between orders)
- days_since_last_order
```

## Usage

### Via API

```bash
# Trigger sync (10 customers, dry run)
curl -X POST "http://localhost:3000/api/maestro/sync?maxCustomers=10&dryRun=true"

# Full sync (all customers)
curl -X POST "http://localhost:3000/api/maestro/sync"

# Check status
curl http://localhost:3000/api/maestro/sync/status

# Response:
{
  "success": true,
  "syncInProgress": false,
  "lastSyncResult": {
    "synced": 231,
    "created": 180,
    "updated": 51,
    "duration_seconds": 45.3
  },
  "database": {
    "totalAvatars": 231,
    "activeAvatars": 218,
    "avgHealthScore": 76.5,
    "highChurnRiskCount": 12
  }
}
```

### Via Script

```bash
# Test with 10 customers (includes dry run)
npx tsx scripts/test-maestro-sync.ts

# Full sync (all customers)
npx tsx scripts/run-full-sync.ts
```

### Programmatic

```typescript
import { syncCustomersFromOdoo } from '@/lib/maestro/sync-odoo-v2';

const result = await syncCustomersFromOdoo({
  monthsBack: 4,      // Last 4 months of data
  maxCustomers: 0,    // 0 = all customers
  dryRun: false       // Write to database
});

console.log(`Synced ${result.synced} customers in ${result.duration_seconds}s`);
```

## AI Scoring Algorithms

### Health Score (0-100)
```
health_score = (100 - churn_risk + engagement) / 2

High health = Low churn + High engagement
```

### Churn Risk Score (0-100)
```
Based on: days_since_last_order / order_frequency_days

ratio < 0.5  → 0   (very active)
ratio < 1    → 20  (normal)
ratio < 1.5  → 40  (slightly concerning)
ratio < 2    → 60  (concerning)
ratio < 3    → 80  (high risk)
ratio >= 3   → 100 (critical risk)
```

### Engagement Score (0-100)
```
Base: 100
- Recency penalty: -1 point per 3 days since last order (max -60)
+ Frequency bonus: +3 points per order (max +30)
+ Revenue bonus: +5 to +20 based on total revenue
```

### Upsell Potential Score (0-100)
```
Points awarded for:
+ High avg order value (500€+): +25 to +40 points
+ Frequent buyer (5+ orders): +20 to +30 points
+ High total revenue (5k€+): +10 to +20 points
+ Low churn risk (<30): +10 points
```

## Database Schema

```sql
CREATE TABLE customer_avatars (
  id SERIAL PRIMARY KEY,
  odoo_partner_id INT UNIQUE NOT NULL,  -- Parent company ID
  name VARCHAR(255) NOT NULL,

  -- Behavioral data
  first_order_date TIMESTAMP,
  last_order_date TIMESTAMP,
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  order_frequency_days INT,
  days_since_last_order INT DEFAULT 0,

  -- Products
  top_products JSONB DEFAULT '[]',

  -- AI Scores
  health_score INT DEFAULT 50,
  churn_risk_score INT DEFAULT 0,
  upsell_potential_score INT DEFAULT 0,
  engagement_score INT DEFAULT 50,

  -- Salesperson
  assigned_salesperson_id INT,
  assigned_salesperson_name VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_sync_odoo TIMESTAMP DEFAULT NOW()
);
```

## Performance

- **231 customers** synced in ~45 seconds
- **~5 customers/second** throughput
- Includes:
  - Parent/child resolution
  - Order aggregation
  - Product extraction
  - AI score calculation
  - Database upsert

## Error Handling

```typescript
// Partial sync failures are captured
{
  success: true,
  synced: 228,
  errors: [
    "Error processing ACME Corp: timeout",
    "Error processing XYZ Ltd: invalid data"
  ]
}

// Sync continues even if individual customers fail
// All errors are logged and returned
```

## Roadmap

- [ ] Incremental sync (only changed data)
- [ ] Webhook support (real-time updates)
- [ ] Multi-threading for faster sync
- [ ] Advanced ML scoring (GPT-4 integration)
- [ ] Customer similarity search (vector embeddings)

## Testing

```bash
# 1. Test with 10 customers first
npx tsx scripts/test-maestro-sync.ts

# 2. Check database
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM customer_avatars;"

# 3. Full sync when ready
npx tsx scripts/run-full-sync.ts
```

## Troubleshooting

### Issue: "Sync in progress"
```bash
# Reset sync state
curl -X DELETE http://localhost:3000/api/maestro/sync
```

### Issue: "Authentication failed"
```bash
# Check env vars
echo $ODOO_USERNAME
echo $ODOO_PASSWORD

# Test Odoo connection
curl https://your-odoo.com/web/login
```

### Issue: "No customers found"
```bash
# Check date filter (maybe no orders in last 4 months?)
# Try longer period:
curl -X POST "http://localhost:3000/api/maestro/sync?monthsBack=12"
```

## Support

For issues or questions:
1. Check logs in console
2. Review `errors` array in sync result
3. Test with dry run first
4. Use smaller `maxCustomers` for debugging

---

**Built with love by Odoo Integration Master**
