# Integration Example - Connect Maestro UI to Real Backend

## Overview

Questo documento mostra come sostituire mock data con chiamate API reali.

## Step 1: API Routes Necessarie

### 1.1 Daily Plan Endpoint

**File**: `app/api/maestro/daily-plan/route.ts` (GIÀ ESISTE)

**Request**:
```
GET /api/maestro/daily-plan?salesperson_id=14
```

**Response attesa**:
```json
{
  "salesperson": {
    "id": 14,
    "name": "Mario Rossi",
    "todayStats": {
      "plannedVisits": 8,
      "completedVisits": 3,
      "targetRevenue": 5000
    }
  },
  "urgent": [
    {
      "id": 101,
      "name": "Ristorante Da Gianni",
      "city": "Milano",
      "health_score": 35,
      "churn_risk": 85,
      "avg_order_value": 1200,
      "last_order_days": 45,
      "recommendation": "URGENTE: Cliente ad alto rischio churn...",
      "suggested_products": ["Mozzarella Bufala DOP", "Prosciutto San Daniele"],
      "priority": "urgent"
    }
  ],
  "opportunities": [...],
  "followUps": [...],
  "routeOptimization": [...]
}
```

### 1.2 Dashboard Endpoint

**File**: `app/api/maestro/dashboard/route.ts` (DA CREARE)

```typescript
// app/api/maestro/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: NextRequest) {
  try {
    // KPIs from maestro_avatars table
    const kpisResult = await sql`
      SELECT
        SUM(total_revenue) as total_revenue,
        COUNT(DISTINCT customer_id) as active_customers,
        AVG(avg_order_value) as avg_order_value,
        COUNT(DISTINCT order_id) as total_orders
      FROM maestro_avatars
      WHERE last_order_date >= CURRENT_DATE - INTERVAL '30 days'
    `;

    // Top performers (salespeople)
    const topPerformers = await sql`
      SELECT
        salesperson_id,
        salesperson_name,
        SUM(total_revenue) as revenue,
        COUNT(DISTINCT order_id) as orders,
        (SUM(current_month_revenue) - SUM(last_month_revenue)) / NULLIF(SUM(last_month_revenue), 0) * 100 as growth
      FROM maestro_avatars
      GROUP BY salesperson_id, salesperson_name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Churn alerts
    const churnAlerts = await sql`
      SELECT
        customer_id as id,
        customer_name as name,
        city,
        health_score,
        churn_risk,
        last_order_days,
        avg_order_value
      FROM maestro_avatars
      WHERE churn_risk >= 70
      ORDER BY churn_risk DESC
      LIMIT 10
    `;

    // Revenue trend (last 6 months)
    const revenueTrend = await sql`
      SELECT
        TO_CHAR(order_date, 'Mon') as month,
        SUM(order_total) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(order_date, 'Mon'), DATE_TRUNC('month', order_date)
      ORDER BY DATE_TRUNC('month', order_date)
    `;

    return NextResponse.json({
      kpis: {
        totalRevenue: kpisResult.rows[0].total_revenue,
        totalOrders: kpisResult.rows[0].total_orders,
        activeCustomers: kpisResult.rows[0].active_customers,
        avgOrderValue: kpisResult.rows[0].avg_order_value,
        // Trends: calcolare vs mese precedente
        revenueTrend: 12.5,  // TODO: calcolare
        ordersTrend: 8.3,
        customersTrend: -2.1,
        avgOrderTrend: 15.2
      },
      topPerformers: topPerformers.rows,
      churnAlerts: churnAlerts.rows,
      revenueChart: revenueTrend.rows,
      upcomingVisits: []  // TODO: da interactions table
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 1.3 Customer Detail Endpoint

**File**: `app/api/maestro/customers/[id]/route.ts` (DA CREARE)

```typescript
// app/api/maestro/customers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const customerId = parseInt(params.id);

  try {
    // Customer basic info
    const customer = await sql`
      SELECT * FROM maestro_avatars
      WHERE customer_id = ${customerId}
    `;

    if (customer.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Orders history
    const orders = await sql`
      SELECT
        order_date as date,
        order_total as amount,
        line_count as items,
        state as status
      FROM orders
      WHERE customer_id = ${customerId}
      ORDER BY order_date DESC
      LIMIT 20
    `;

    // Interactions
    const interactions = await sql`
      SELECT *
      FROM maestro_interactions
      WHERE customer_id = ${customerId}
      ORDER BY interaction_date DESC
      LIMIT 50
    `;

    // Top products
    const topProducts = await sql`
      SELECT
        product_name as name,
        SUM(quantity) as quantity,
        SUM(subtotal) as revenue,
        -- Calculate trend vs previous period
        0 as trend
      FROM order_lines
      WHERE customer_id = ${customerId}
      GROUP BY product_name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Suggested products (from recommendations)
    const suggestions = await sql`
      SELECT *
      FROM maestro_recommendations
      WHERE customer_id = ${customerId}
        AND type = 'product_suggestion'
      ORDER BY confidence DESC
      LIMIT 5
    `;

    return NextResponse.json({
      ...customer.rows[0],
      orders: orders.rows,
      interactions: interactions.rows,
      topProducts: topProducts.rows,
      suggestedProducts: suggestions.rows,
      // Additional computed fields
      revenueTrend: [],  // TODO: calcolare
      categorySpend: []  // TODO: da order_lines
    });
  } catch (error) {
    console.error('Customer detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 1.4 Interactions Endpoint

**File**: `app/api/maestro/interactions/route.ts` (GIÀ ESISTE)

Già implementato, verifica che salvi tutti i campi necessari.

## Step 2: Update Frontend Pages

### 2.1 Daily Plan - Replace Mock Data

**File**: `app/maestro-ai/daily-plan/page.tsx`

**BEFORE** (Mock data):
```tsx
const dailyPlanData = {
  salesperson: { ... },
  urgent: [ ... ],
  // ...
};
```

**AFTER** (Real data):
```tsx
'use client';

import { useDailyPlan } from '@/hooks/useMaestroAI';
import { LoadingSpinner, CustomerCardSkeleton } from '@/components/maestro';

export default function DailyPlanPage() {
  // Get current user (from auth context/session)
  const currentUserId = 14; // TODO: get from useSession() or auth

  const { data, isLoading, error } = useDailyPlan(currentUserId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-10 bg-slate-700 rounded w-64 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-800 rounded animate-pulse" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <CustomerCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Rest of JSX usando data.urgent, data.opportunities, etc */}
    </div>
  );
}
```

### 2.2 Dashboard - Replace Mock Data

**File**: `app/maestro-ai/page.tsx`

**AFTER**:
```tsx
'use client';

import { useDashboard } from '@/hooks/useMaestroAI';
import { DashboardSkeleton } from '@/components/maestro';

export default function MaestroAIDashboard() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Use data.kpis, data.topPerformers, etc */}
    </div>
  );
}
```

### 2.3 Customer Detail - Replace Mock Data

**File**: `app/maestro-ai/customers/[id]/page.tsx`

**AFTER**:
```tsx
'use client';

import { useCustomerDetail } from '@/hooks/useMaestroAI';

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const customerId = parseInt(params.id);
  const { data: customer, isLoading, error } = useCustomerDetail(customerId);

  if (isLoading) return <LoadingSpinner size="lg" />;
  if (error) return <div>Error: {error.message}</div>;
  if (!customer) return <div>Customer not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Use customer.name, customer.health_score, etc */}
    </div>
  );
}
```

## Step 3: Authentication Integration

### 3.1 Get Current User

**Option A: Next-Auth**
```tsx
import { useSession } from 'next-auth/react';

function DailyPlanPage() {
  const { data: session } = useSession();
  const salespersonId = session?.user?.id;

  const { data } = useDailyPlan(salespersonId);
}
```

**Option B: Custom Auth Context**
```tsx
import { useAuth } from '@/contexts/AuthContext';

function DailyPlanPage() {
  const { user } = useAuth();
  const { data } = useDailyPlan(user.id);
}
```

### 3.2 Protect Routes

```tsx
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');

  if (!token && request.nextUrl.pathname.startsWith('/maestro-ai')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

## Step 4: Real-time Updates (Optional)

### 4.1 Setup React Query Refetch

```tsx
// hooks/useMaestroAI.ts
export function useDailyPlan(salespersonId: number) {
  return useQuery({
    queryKey: ['daily-plan', salespersonId],
    queryFn: () => api.getDailyPlan(salespersonId),
    refetchInterval: 60000, // Refetch every 60s
    refetchOnWindowFocus: true
  });
}
```

### 4.2 WebSocket Updates

```tsx
// hooks/useRealtimeUpdates.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket('wss://your-backend/ws');

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      if (update.type === 'customer_updated') {
        queryClient.invalidateQueries({
          queryKey: ['customer', update.customerId]
        });
      }

      if (update.type === 'daily_plan_updated') {
        queryClient.invalidateQueries({
          queryKey: ['daily-plan']
        });
      }
    };

    return () => ws.close();
  }, [queryClient]);
}
```

## Step 5: Error Handling

### 5.1 Global Error Boundary

```tsx
// app/maestro-ai/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Qualcosa è andato storto
        </h2>
        <p className="text-slate-400 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Riprova
        </button>
      </div>
    </div>
  );
}
```

### 5.2 Loading States

```tsx
// app/maestro-ai/loading.tsx
import { LoadingSpinner } from '@/components/maestro';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <LoadingSpinner size="lg" />
    </div>
  );
}
```

## Step 6: Testing

### 6.1 Test API Endpoints

```bash
# Test dashboard
curl http://localhost:3000/api/maestro/dashboard

# Test daily plan
curl http://localhost:3000/api/maestro/daily-plan?salesperson_id=14

# Test customer detail
curl http://localhost:3000/api/maestro/customers/101

# Test create interaction
curl -X POST http://localhost:3000/api/maestro/interactions \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 101,
    "interaction_type": "visit",
    "outcome": "positive",
    "notes": "Test"
  }'
```

### 6.2 Browser Testing

1. Open DevTools Network tab
2. Navigate to `/maestro-ai/daily-plan`
3. Verify API call to `/api/maestro/daily-plan`
4. Check response data structure
5. Click "Completa visita"
6. Verify POST to `/api/maestro/interactions`
7. Check toast notification appears

## Common Issues & Solutions

### Issue 1: CORS Errors
**Solution**: Next.js API routes don't have CORS issues (same origin)

### Issue 2: Slow API Responses
**Solution**: Add loading skeletons and optimize queries
```tsx
const { data, isLoading } = useDailyPlan(id);
if (isLoading) return <CustomerCardSkeleton />;
```

### Issue 3: Stale Data
**Solution**: Configure React Query cache
```tsx
queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
```

### Issue 4: Type Mismatches
**Solution**: Define shared types
```tsx
// types/maestro.ts
export interface Customer {
  id: number;
  name: string;
  // ... match backend response
}
```

## Checklist

- [ ] Create `/api/maestro/dashboard` endpoint
- [ ] Create `/api/maestro/customers/[id]` endpoint
- [ ] Verify `/api/maestro/daily-plan` returns correct format
- [ ] Verify `/api/maestro/interactions` saves all fields
- [ ] Remove mock data from all pages
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Test all API calls
- [ ] Add authentication
- [ ] Setup React Query cache
- [ ] Test on mobile
- [ ] Deploy to production

---

**Ready to integrate!** Start with Step 1, implement API routes, then update frontend pages.
