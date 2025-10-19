# MAESTRO AI CHAT - Testing Guide

## Overview

Production-ready AI chat endpoint per assistente vendite Maestro.

**Endpoint**: `POST /api/maestro/chat`

**Features**:
- Claude 3.5 Sonnet integration
- Tool calling (get_customer_info, search_customers, etc.)
- Conversation history tracking
- Rate limiting (20 msgs/min per salesperson)
- TypeScript strict mode
- Comprehensive error handling

---

## Prerequisites

### 1. Database Setup

Execute the SQL schema:

```bash
psql $POSTGRES_URL < database/maestro-chat-schema.sql
```

This creates:
- `maestro_conversations` - Chat conversations
- `maestro_chat_messages` - Individual messages
- `maestro_chat_rate_limits` - Rate limiting

### 2. Environment Variables

Ensure `.env.local` contains:

```bash
ANTHROPIC_API_KEY=sk-ant-...
POSTGRES_URL=postgresql://...
```

### 3. Customer Avatars

Ensure you have customer avatars in the database:

```sql
SELECT COUNT(*) FROM customer_avatars;
```

If empty, run the sync first:
```bash
curl -X POST http://localhost:3004/api/maestro/sync
```

---

## API Specification

### Request

```typescript
POST /api/maestro/chat

{
  message: string;              // User message (required, max 2000 chars)
  conversationId?: string;      // If continuing conversation
  salespersonId: number;        // Venditore ID (required)
  context?: {
    customerId?: number;        // Current customer context
    currentPage?: string;       // Current page in app
  }
}
```

### Response (Success)

```typescript
{
  success: true;
  data: {
    reply: string;                  // AI response
    conversationId: string;         // Conversation ID (for next message)
    suggestions?: string[];         // Quick action suggestions
    data?: {
      customer?: CustomerAvatar;    // If tool fetched customer
      performance?: any;            // If tool fetched performance
    };
    tokensUsed?: number;            // Claude tokens consumed
    toolCalls?: any[];              // Tools used by AI
  };
  timestamp: string;
}
```

### Response (Error)

```typescript
{
  success: false;
  error: {
    code: string;        // Error code (VALIDATION_ERROR, RATE_LIMIT_EXCEEDED, etc.)
    message: string;     // Human-readable message
    details?: any;       // Additional error info
  };
  timestamp?: string;
}
```

---

## Test Examples

### Test 1: Simple Question

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Ciao, come posso usarti?",
    "salespersonId": 2
  }'
```

**Expected**: AI introduces itself and explains capabilities.

---

### Test 2: Search Customer

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Cerca clienti a Milano",
    "salespersonId": 2
  }'
```

**Expected**: AI uses `search_customers` tool and returns results.

---

### Test 3: Customer Info

Assuming you have a customer with `odoo_partner_id = 100`:

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Come sta il cliente 100?",
    "salespersonId": 2,
    "context": {
      "customerId": 100
    }
  }'
```

**Expected**: AI uses `get_customer_info` tool and provides analysis with health score, churn risk, recommendations.

---

### Test 4: Salesperson Performance

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Come stanno andando le mie vendite?",
    "salespersonId": 2
  }'
```

**Expected**: AI uses `get_salesperson_performance` tool and returns KPIs.

---

### Test 5: Conversation Continuation

First message:

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Quali sono i miei clienti a rischio?",
    "salespersonId": 2
  }' | jq -r '.data.conversationId'
```

Save the `conversationId` from response, then send follow-up:

```bash
curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Dimmi di più sul primo",
    "salespersonId": 2,
    "conversationId": "CONVERSATION_ID_FROM_PREVIOUS_RESPONSE"
  }'
```

**Expected**: AI remembers context and provides details on the first customer mentioned.

---

### Test 6: Rate Limiting

Send 21 requests rapidly to trigger rate limit:

```bash
for i in {1..21}; do
  curl -X POST http://localhost:3004/api/maestro/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\": \"Test $i\", \"salespersonId\": 2}"
  echo ""
done
```

**Expected**: First 20 succeed, 21st returns `429 RATE_LIMIT_EXCEEDED`.

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request body | 400 |
| `SALESPERSON_NOT_FOUND` | Salesperson ID not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many messages (>20/min) | 429 |
| `API_KEY_MISSING` | ANTHROPIC_API_KEY not set | 500 |
| `AI_QUOTA_EXCEEDED` | Claude API quota exceeded | 503 |
| `INTERNAL_ERROR` | Generic server error | 500 |

---

## Tools Available to AI

### 1. get_customer_info(customer_id)

Retrieves complete customer avatar with:
- Metrics (revenue, orders, frequency)
- AI scores (health, churn risk, upsell potential)
- Top products
- Active recommendations

### 2. get_customer_orders(customer_id, limit=10)

Retrieves recent orders (currently returns summary from avatar, TODO: implement order history table).

### 3. get_salesperson_performance(salesperson_id, period_days=30)

Returns:
- Total/active customers
- Revenue and order stats
- Churn risk count
- Upsell opportunities
- Top 5 customers

### 4. search_customers(query, salesperson_id?, limit=5)

Searches customers by name or city. Returns:
- Customer basic info
- Health score
- Churn risk
- Revenue
- Days since last order

---

## Conversation Flow Example

**User**: "Ciao Maestro"
**AI**: "Ciao! Sono Maestro AI, il tuo assistente vendite. Come posso aiutarti oggi?"

**User**: "Chi devo visitare oggi?"
**AI**: *[Uses get_salesperson_performance and search_customers tools]*
"Ecco i 3 clienti urgenti:
1. 🔴 Bar Centrale - 75 giorni senza ordini
2. ⚠️ Trattoria Nonna - Churn risk 68%
3. ✅ Pizzeria Roma - Upsell opportunity

Vuoi i dettagli del primo?"

**User**: "Sì, dimmi di Bar Centrale"
**AI**: *[Uses get_customer_info(bar_centrale_id)]*
"🔴 SITUAZIONE CRITICA - Bar Centrale
• Health Score: 38/100
• Ultimo ordine: 75 giorni fa (solito: ogni 14 giorni)
• Revenue storico: €12.4K

⚠️ AZIONE: Visita urgente oggi. Cliente rischia churn. Proponi campioni nuovi prodotti."

---

## Database Queries for Debugging

### Check conversations

```sql
SELECT * FROM maestro_conversations
ORDER BY last_message_at DESC
LIMIT 10;
```

### Check messages

```sql
SELECT
  conversation_id,
  role,
  LEFT(content, 50) as content_preview,
  tokens_used,
  created_at
FROM maestro_chat_messages
ORDER BY created_at DESC
LIMIT 20;
```

### Check rate limits

```sql
SELECT * FROM maestro_chat_rate_limits;
```

### Cleanup old conversations

```sql
DELETE FROM maestro_conversations
WHERE last_message_at < NOW() - INTERVAL '7 days';
```

---

## Performance Benchmarks

**Target**:
- Response time: <3s (95th percentile)
- Tool calls: <5s with 2-3 tools
- Token usage: ~500-1000 tokens per response
- Rate limit: 20 messages/minute per salesperson

**Monitor with**:

```bash
# Response time
time curl -X POST http://localhost:3004/api/maestro/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "salespersonId": 2}'

# Token usage (check response)
curl ... | jq '.data.tokensUsed'
```

---

## Production Checklist

- [ ] Database schema deployed
- [ ] ANTHROPIC_API_KEY configured in Vercel
- [ ] Customer avatars synced (at least 10 for testing)
- [ ] Rate limiting tested
- [ ] Error handling tested
- [ ] Conversation history verified
- [ ] Tool calling tested (all 4 tools)
- [ ] Monitoring/logging setup
- [ ] Frontend integration ready

---

## Next Steps

1. **Frontend Integration**: Create chat UI component
2. **WebSocket Support**: For real-time streaming responses
3. **Order History**: Implement maestro_orders table for detailed order data
4. **Analytics**: Track popular questions, tool usage, satisfaction
5. **Multi-language**: Add English support
6. **Voice Input**: Integrate speech-to-text

---

## Support

For issues or questions:
1. Check logs: `docker logs -f app-hub-platform`
2. Verify DB: `psql $POSTGRES_URL -c "SELECT COUNT(*) FROM customer_avatars"`
3. Test Anthropic API: `curl https://api.anthropic.com/v1/messages ...`
4. Check environment: `echo $ANTHROPIC_API_KEY | cut -c1-10`
