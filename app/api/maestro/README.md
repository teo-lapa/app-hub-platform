# MAESTRO AI - Backend API Documentation

Sistema di API REST completo per gestione Customer Avatars e AI Recommendations.

## Architecture

```
/app/api/maestro/
├── avatars/
│   ├── route.ts              # GET /api/maestro/avatars (list with filters)
│   └── [id]/
│       └── route.ts          # GET /api/maestro/avatars/[id] (detail)
├── recommendations/
│   ├── route.ts              # GET, POST /api/maestro/recommendations
│   └── [id]/
│       └── route.ts          # GET, PATCH /api/maestro/recommendations/[id]
├── daily-plan/
│   └── route.ts              # GET /api/maestro/daily-plan
├── interactions/
│   └── route.ts              # GET, POST /api/maestro/interactions
└── README.md                 # This file

/lib/maestro/
├── types.ts                  # TypeScript types & interfaces
├── validation.ts             # Zod validation schemas
├── ai-service.ts             # Claude AI integration
└── sync-odoo.ts              # Odoo sync service
```

## API Endpoints

### 1. Customer Avatars API

#### GET /api/maestro/avatars

Fetch lista customer avatars con filtri e pagination.

**Query Parameters:**
- `salesperson_id` (number, optional): Filtra per venditore
- `health_score_min` (number 0-100, optional): Health score minimo
- `churn_risk_min` (number 0-100, optional): Churn risk minimo
- `limit` (number, default: 20, max: 100): Items per page
- `offset` (number, default: 0): Pagination offset
- `sort_by` (enum, default: 'churn_risk_score'): Campo per sorting
  - `health_score`
  - `churn_risk_score`
  - `total_revenue`
  - `last_order_date`
- `sort_order` (enum, default: 'desc'): Ordine sorting
  - `asc`
  - `desc`

**Response:**
```json
{
  "avatars": [
    {
      "id": "uuid",
      "odoo_partner_id": 123,
      "name": "Ristorante Da Mario",
      "email": "mario@example.com",
      "phone": "+41 91 123 4567",
      "city": "Lugano",
      "total_orders": 42,
      "total_revenue": 12500.00,
      "avg_order_value": 297.62,
      "days_since_last_order": 15,
      "health_score": 75,
      "churn_risk_score": 25,
      "upsell_potential_score": 65,
      "engagement_score": 80,
      "assigned_salesperson_id": 5,
      "assigned_salesperson_name": "Luca Rossi",
      "top_products": [...],
      "product_categories": {...}
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

**Example Request:**
```bash
curl "http://localhost:3000/api/maestro/avatars?salesperson_id=5&churn_risk_min=60&limit=10"
```

---

#### GET /api/maestro/avatars/[id]

Fetch dettaglio completo customer avatar + raccomandazioni + interazioni recenti.

**Response:**
```json
{
  "avatar": { ... },
  "recommendations": [
    {
      "id": "uuid",
      "recommendation_type": "churn_prevention",
      "priority": "urgent",
      "title": "URGENTE: Cliente a rischio abbandono",
      "description": "...",
      "suggested_actions": ["..."],
      "reasoning": "...",
      "expected_impact": "Potenziale recupero: €500",
      "ai_confidence": 85,
      "estimated_effort_minutes": 30,
      "status": "pending"
    }
  ],
  "interactions": [...],
  "recent_orders": [],
  "summary": {
    "total_recommendations_active": 2,
    "last_interaction_date": "2025-10-15T10:30:00Z",
    "requires_attention": true
  }
}
```

---

### 2. Recommendations API

#### POST /api/maestro/recommendations/generate

Genera nuove raccomandazioni AI per un venditore.

**Request Body:**
```json
{
  "salesperson_id": 5,
  "max_recommendations": 10,
  "focus_on": "churn" // "churn" | "upsell" | "all"
}
```

**Response:**
```json
{
  "success": true,
  "recommendations": [...],
  "summary": {
    "total_generated": 8,
    "urgent_count": 2,
    "high_priority_count": 3,
    "estimated_total_time_minutes": 240,
    "generation_time_ms": 1523
  }
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{"salesperson_id": 5, "max_recommendations": 10, "focus_on": "all"}'
```

---

#### GET /api/maestro/recommendations

Fetch raccomandazioni con filtri.

**Query Parameters:**
- `salesperson_id` (number, optional)
- `status` (enum, optional): `pending`, `in_progress`, `completed`, `dismissed`
- `priority` (enum, optional): `low`, `medium`, `high`, `urgent`
- `limit` (number, default: 20)
- `offset` (number, default: 0)

**Example:**
```bash
curl "http://localhost:3000/api/maestro/recommendations?salesperson_id=5&status=pending&priority=urgent"
```

---

#### PATCH /api/maestro/recommendations/[id]

Update raccomandazione (status, outcome, notes).

**Request Body:**
```json
{
  "status": "completed",
  "outcome": "success",
  "outcome_notes": "Cliente riattivato! Ordine da €350 piazzato."
}
```

**Response:**
```json
{
  "success": true,
  "recommendation": { ... }
}
```

**Example:**
```bash
curl -X PATCH "http://localhost:3000/api/maestro/recommendations/abc-123" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed", "outcome": "success", "outcome_notes": "..."}'
```

---

### 3. Daily Plan API

#### GET /api/maestro/daily-plan

Genera piano giornaliero ottimizzato per venditore.

**Query Parameters:**
- `salesperson_id` (number, required)
- `date` (string YYYY-MM-DD, optional, default: today)

**Response:**
```json
{
  "daily_plan": {
    "date": "2025-10-19",
    "salesperson_id": 5,
    "salesperson_name": "Luca Rossi",
    "urgent_customers": [
      {
        "avatar": { ... },
        "recommendations": [...],
        "last_interaction": { ... }
      }
    ],
    "high_priority_customers": [...],
    "upsell_opportunities": [...],
    "routine_followups": [...],
    "total_estimated_time_minutes": 240,
    "suggested_route": null
  },
  "summary": {
    "total_customers_to_contact": 12,
    "urgent_count": 3,
    "high_priority_count": 4,
    "upsell_count": 3,
    "routine_count": 2,
    "estimated_hours": 4.0
  }
}
```

**Example:**
```bash
curl "http://localhost:3000/api/maestro/daily-plan?salesperson_id=5&date=2025-10-19"
```

---

### 4. Interactions API

#### POST /api/maestro/interactions

Registra interazione con cliente (visita, chiamata, email).

**Request Body:**
```json
{
  "customer_avatar_id": "uuid",
  "interaction_type": "visit",
  "outcome": "successful",
  "notes": "Cliente soddisfatto, ordinato 3 nuovi prodotti",
  "order_placed": true,
  "order_value": 450.00,
  "samples_given": [
    {
      "product_id": 123,
      "product_name": "Prosciutto Crudo DOP",
      "quantity": 2
    }
  ],
  "next_follow_up_date": "2025-11-01",
  "recommendation_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "interaction": { ... }
}
```

**Side Effects:**
- Update avatar scores (churn_risk, engagement, health)
- Se `recommendation_id` presente, marca raccomandazione come `in_progress`

**Example:**
```bash
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "abc-123",
    "interaction_type": "visit",
    "outcome": "successful",
    "order_placed": true,
    "order_value": 450
  }'
```

---

#### GET /api/maestro/interactions

Fetch interazioni con filtri.

**Query Parameters:**
- `customer_avatar_id` (uuid, optional)
- `salesperson_id` (number, optional)
- `interaction_type` (enum, optional): `visit`, `call`, `email`, `whatsapp`, `other`
- `limit` (number, default: 50)
- `offset` (number, default: 0)

**Example:**
```bash
curl "http://localhost:3000/api/maestro/interactions?customer_avatar_id=abc-123&limit=20"
```

---

## Error Handling

Tutte le API seguono lo stesso pattern per errori:

**400 Bad Request** (validation error):
```json
{
  "error": "salesperson_id: Expected number, received string"
}
```

**404 Not Found**:
```json
{
  "error": "Customer avatar not found"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to fetch customer avatars",
  "details": "Connection timeout"
}
```

---

## Validation

Tutti gli input sono validati con **Zod schemas** (vedi `/lib/maestro/validation.ts`).

Esempi di validazione:
- `salesperson_id`: numero intero positivo
- `health_score_min`: numero 0-100
- `limit`: numero positivo max 100
- `date`: formato YYYY-MM-DD
- `interaction_type`: enum specifico
- `customer_avatar_id`: UUID valido

---

## AI Recommendations Logic

Il sistema usa **Claude 3.5 Sonnet** per generare raccomandazioni intelligenti.

**Input AI:**
- Dati cliente (orders, revenue, frequency)
- AI scores (health, churn, upsell, engagement)
- Top products
- Order history patterns

**Output AI:**
- Tipo raccomandazione (churn_prevention, upsell, etc.)
- Priorità (urgent, high, medium, low)
- Azioni concrete suggerite
- Reasoning (perché questa raccomandazione)
- Impact atteso
- Confidence score (0-100)
- Effort stimato (minuti)

**Fallback:** Se Claude AI fallisce, usa logica rule-based per generare raccomandazione basic.

---

## Database Tables

### customer_avatars
- `id`: UUID primary key
- `odoo_partner_id`: integer (Odoo partner ID)
- Dati anagrafici (name, email, phone, city)
- Metriche transazionali (orders, revenue, frequency)
- AI scores (health, churn, upsell, engagement)
- top_products: JSONB
- product_categories: JSONB
- Timestamps

### maestro_recommendations
- `id`: UUID primary key
- `customer_avatar_id`: FK → customer_avatars
- `recommendation_type`, `priority`, `status`
- `title`, `description`, `reasoning`
- `suggested_actions`: JSONB
- `suggested_products`: JSONB (nullable)
- `ai_confidence`, `estimated_effort_minutes`
- Timestamps

### maestro_interactions
- `id`: UUID primary key
- `customer_avatar_id`: FK → customer_avatars
- `salesperson_id`, `salesperson_name`
- `interaction_type`, `outcome`
- `notes`, `order_placed`, `order_value`
- `samples_given`: JSONB (nullable)
- `next_follow_up_date`
- `recommendation_id`: FK → maestro_recommendations (nullable)
- Timestamps

---

## Testing

Vedi esempi di test in `/app/api/maestro/TEST_EXAMPLES.md`

Per testare localmente:
```bash
npm run dev

# Test GET avatars
curl "http://localhost:3000/api/maestro/avatars?limit=5"

# Test generate recommendations
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{"salesperson_id": 5, "max_recommendations": 5}'

# Test create interaction
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "your-uuid",
    "interaction_type": "call",
    "outcome": "successful"
  }'
```

---

## Future Enhancements

- [ ] Geo-routing optimization per daily plan
- [ ] Real-time Odoo orders fetch in avatar detail
- [ ] Webhook per sync automatico quando ordine creato in Odoo
- [ ] Dashboard analytics endpoint
- [ ] Export daily plan to PDF/Calendar
- [ ] WhatsApp/Email templates integration
- [ ] ML model training from interaction outcomes

---

## Support

Per problemi o domande: contatta il Backend Team.
