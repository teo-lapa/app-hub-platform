# MAESTRO Analytics API

Endpoint per dashboard analytics che aggrega dati REALI dal database Vercel Postgres.

## Endpoint

```
GET /api/maestro/analytics
```

## Risposta

```typescript
{
  kpis: {
    totalRevenue: number;        // Somma totale revenue di tutti i clienti attivi
    totalOrders: number;          // Somma totale ordini
    activeCustomers: number;      // Count di customer_avatars attivi
    avgOrderValue: number;        // totalRevenue / totalOrders
  };

  topPerformers: {
    bySalesperson: [              // Top 10 venditori per revenue
      {
        name: string;             // Nome venditore (o "Unassigned")
        revenue: number;          // Revenue totale clienti assegnati
        orders: number;           // Ordini totali clienti assegnati
        customerCount: number;    // Numero clienti assegnati
      }
    ];

    byCustomer: [                 // Top 10 clienti per revenue
      {
        id: string;               // Customer avatar ID
        name: string;             // Nome cliente
        revenue: number;          // Total revenue
        orders: number;           // Total orders
        healthScore: number;      // Health score 0-100
      }
    ];
  };

  churnAlerts: [                  // Clienti ad alto rischio (churn_risk_score > 70)
    {
      id: string;
      name: string;
      city: string | null;
      churnRisk: number;          // 0-100
      healthScore: number;        // 0-100
      daysSinceLastOrder: number;
      avgOrderValue: number;
    }
  ];

  revenueByMonth: [               // Ultimi 6 mesi
    {
      month: string;              // YYYY-MM format
      revenue: number;
      orders: number;
    }
  ];

  healthDistribution: {
    healthy: number;              // health_score >= 80
    warning: number;              // health_score 50-79
    critical: number;             // health_score < 50
  };
}
```

## Query SQL Utilizzate

### 1. KPIs Globali
```sql
SELECT
  COALESCE(SUM(total_revenue), 0)::numeric as total_revenue,
  COALESCE(SUM(total_orders), 0)::numeric as total_orders,
  COUNT(*)::numeric as active_customers
FROM customer_avatars
WHERE is_active = true
```

### 2. Top Venditori
```sql
SELECT
  COALESCE(assigned_salesperson_name, 'Unassigned') as salesperson_name,
  COALESCE(SUM(total_revenue), 0)::numeric as revenue,
  COALESCE(SUM(total_orders), 0)::numeric as orders,
  COUNT(*)::numeric as customer_count
FROM customer_avatars
WHERE is_active = true
GROUP BY assigned_salesperson_name
ORDER BY revenue DESC
LIMIT 10
```

### 3. Top Clienti
```sql
SELECT
  id,
  name,
  total_revenue,
  total_orders,
  health_score
FROM customer_avatars
WHERE is_active = true
ORDER BY total_revenue DESC
LIMIT 10
```

### 4. Churn Alerts
```sql
SELECT
  id,
  name,
  city,
  churn_risk_score,
  health_score,
  days_since_last_order,
  avg_order_value
FROM customer_avatars
WHERE is_active = true
  AND churn_risk_score > 70
ORDER BY churn_risk_score DESC
LIMIT 20
```

### 5. Revenue per Mese
```sql
SELECT
  TO_CHAR(last_order_date, 'YYYY-MM') as month,
  COUNT(*) as order_count,
  SUM(total_revenue) as revenue
FROM customer_avatars
WHERE is_active = true
  AND last_order_date IS NOT NULL
  AND last_order_date >= '2025-04-01'  -- 6 mesi fa
GROUP BY TO_CHAR(last_order_date, 'YYYY-MM')
ORDER BY month DESC
LIMIT 6
```

### 6. Health Distribution
```sql
SELECT
  COUNT(*) FILTER (WHERE health_score >= 80) as healthy,
  COUNT(*) FILTER (WHERE health_score >= 50 AND health_score < 80) as warning,
  COUNT(*) FILTER (WHERE health_score < 50) as critical
FROM customer_avatars
WHERE is_active = true
```

## Esempio di Utilizzo

```bash
curl http://localhost:3010/api/maestro/analytics
```

## Dati di Esempio (Database Reale)

```json
{
  "kpis": {
    "totalRevenue": 76499.49,
    "totalOrders": 138,
    "activeCustomers": 10,
    "avgOrderValue": 554.34
  },
  "topPerformers": {
    "bySalesperson": [
      {
        "name": "Gregorio Buccolieri",
        "revenue": 27924.33,
        "orders": 36,
        "customerCount": 2
      },
      {
        "name": "Alessandro Motta",
        "revenue": 15969.5,
        "orders": 46,
        "customerCount": 2
      }
    ],
    "byCustomer": [
      {
        "id": 3,
        "name": "ALLIA GIOVANNI PIZZERIA STEAKERIA DA GIO",
        "revenue": 27542.66,
        "orders": 35,
        "healthScore": 90
      }
    ]
  },
  "churnAlerts": [
    {
      "id": 7,
      "name": "AUTOGRILL SCHWEIZ AG CH1000TBS3",
      "city": "FLUGHAFEN ZURICH",
      "churnRisk": 100,
      "healthScore": 50,
      "daysSinceLastOrder": 33,
      "avgOrderValue": 1498.3
    }
  ],
  "revenueByMonth": [
    {
      "month": "2025-07",
      "revenue": 0,
      "orders": 1
    },
    {
      "month": "2025-10",
      "revenue": 50195.13,
      "orders": 5
    }
  ],
  "healthDistribution": {
    "healthy": 5,
    "warning": 4,
    "critical": 1
  }
}
```

## Performance

- Tutte le query utilizzano aggregazioni SQL native
- Index su: `is_active`, `churn_risk_score`, `total_revenue`, `last_order_date`, `health_score`
- Tempo di risposta tipico: < 200ms con 10 customer avatars
- Scalabile fino a 10,000+ avatars con gli index appropriati

## Type Safety

Tutti i types sono definiti in `/lib/maestro/types.ts`:
- `AnalyticsResponse`
- `AnalyticsKPIs`
- `SalespersonPerformance`
- `CustomerPerformance`
- `ChurnAlert`
- `RevenueByMonth`
- `HealthDistribution`
