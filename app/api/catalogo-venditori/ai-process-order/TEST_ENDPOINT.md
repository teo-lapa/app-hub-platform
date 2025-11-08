# AI Order Processing Endpoint - Test Guide

## Endpoint Information

**URL:** `POST /api/catalogo-venditori/ai-process-order`
**Model:** Claude Sonnet 4 (claude-sonnet-4-20250514)
**Max Duration:** 90 seconds
**Version:** 1.0.0

---

## Features

- Customer purchase history analysis (last 6 months)
- Smart fuzzy product matching with AI
- Confidence scoring (ALTA/MEDIA/BASSA/NON_TROVATO)
- Synonym and variant recognition
- Intelligent quantity extraction
- Support for text, audio transcription, and image text
- Comprehensive error handling (Odoo, AI, JSON parsing)

---

## Request Format

### Required Fields

```json
{
  "customerId": 12345,
  "message": "Vorrei 2 forme di parmigiano e una decina di mozzarelle",
  "messageType": "text"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | number | Yes | Odoo partner ID (res.partner) |
| `message` | string | Yes | Customer order message (non-empty) |
| `messageType` | enum | Yes | One of: `"text"`, `"audio"`, `"image"` |

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "matches": [
    {
      "richiesta_originale": "2 forme di parmigiano",
      "quantita": 2,
      "product_id": 1234,
      "product_name": "Parmigiano Reggiano DOP 24 mesi - Forma",
      "confidence": "ALTA",
      "reasoning": "Match esatto con il prodotto più ordinato dal cliente"
    },
    {
      "richiesta_originale": "una decina di mozzarelle",
      "quantita": 10,
      "product_id": 5678,
      "product_name": "Mozzarella di Bufala DOP 250g",
      "confidence": "MEDIA",
      "reasoning": "Match parziale, assumendo mozzarella standard 250g"
    }
  ],
  "customer": {
    "id": 12345,
    "name": "Ristorante Da Mario",
    "ref": "C00123",
    "email": "mario@example.com",
    "phone": "+39 123456789",
    "city": "Milano"
  },
  "note": "Tutte le quantità sono state estratte correttamente. Confermare grammatura mozzarelle con il cliente.",
  "stats": {
    "total_matches": 2,
    "found_matches": 2,
    "not_found": 0,
    "confidence_breakdown": {
      "alta": 1,
      "media": 1,
      "bassa": 0,
      "non_trovato": 0
    },
    "processing_time_ms": 3245
  },
  "message_analyzed": "Vorrei 2 forme di parmigiano e una decina di mozzarelle",
  "message_type": "text"
}
```

### Error Responses

#### 400 Bad Request - Invalid Input

```json
{
  "success": false,
  "error": "customerId is required and must be a number"
}
```

#### 500 Internal Server Error - Odoo Error

```json
{
  "success": false,
  "error": "Failed to fetch customer data: Cliente con ID 99999 non trovato in Odoo",
  "errorType": "odoo_error"
}
```

#### 500 Internal Server Error - AI Error

```json
{
  "success": false,
  "error": "AI processing failed: AI did not return valid JSON",
  "errorType": "ai_error"
}
```

#### 500 Internal Server Error - Configuration Error

```json
{
  "success": false,
  "error": "AI service not configured. Please contact support."
}
```

---

## Test Cases

### Test 1: Simple Text Order

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "Vorrei 3 kg di prosciutto crudo e 2 forme di parmigiano",
    "messageType": "text"
  }'
```

**Expected Result:** 2 product matches with ALTA/MEDIA confidence

---

### Test 2: Audio Transcription

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "sì allora volevo dire che oggi avrei bisogno di di uh tre forme di parmigiano eh e poi anche magari una decina di di mozzarelle ecco sì grazie",
    "messageType": "audio"
  }'
```

**Expected Result:** AI handles disfluencies and extracts clean product requests

---

### Test 3: Image Text Extraction

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "Ordine per domani:\n- Parmigiano x2\n- Mozzarella x10\n- Prosciutto crudo 3kg",
    "messageType": "image"
  }'
```

**Expected Result:** 3 product matches with proper quantity extraction

---

### Test 4: Missing Customer

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 99999999,
    "message": "Test message",
    "messageType": "text"
  }'
```

**Expected Result:** Error 500 with "Cliente con ID 99999999 non trovato in Odoo"

---

### Test 5: Invalid Message Type

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "Test message",
    "messageType": "video"
  }'
```

**Expected Result:** Error 400 with "messageType must be one of: text, audio, image"

---

### Test 6: Empty Message

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "",
    "messageType": "text"
  }'
```

**Expected Result:** Error 400 with "message is required and must be a non-empty string"

---

### Test 7: Product Not in History

```bash
curl -X POST http://localhost:3000/api/catalogo-venditori/ai-process-order \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 12345,
    "message": "Vorrei del caviale iraniano di altissima qualità",
    "messageType": "text"
  }'
```

**Expected Result:** 1 match with confidence "NON_TROVATO" and product_id = null

---

### Test 8: Health Check (GET)

```bash
curl -X GET http://localhost:3000/api/catalogo-venditori/ai-process-order
```

**Expected Result:** Endpoint information and capabilities

---

## Confidence Levels

| Level | Description | Typical Use Case |
|-------|-------------|------------------|
| **ALTA** | >90% confidence, exact or near-exact match | Proceed with order automatically |
| **MEDIA** | 60-90% confidence, reasonable match | Review with salesperson |
| **BASSA** | <60% confidence, uncertain match | Requires manual verification |
| **NON_TROVATO** | No match in customer history | Add new product or clarify with customer |

---

## AI Matching Rules

1. **Keyword Search:** Searches product names for keywords from message
2. **Synonyms:** Recognizes variants (e.g., "parmigiano" = "parmigiano reggiano", "mozza" = "mozzarella")
3. **Ignore Details:** Skips non-critical details (DOP, age, specific weights)
4. **Plural/Singular:** Treats as equivalent
5. **Frequency:** Prefers most frequently ordered product when multiple matches
6. **Smart Quantities:** Extracts numbers intelligently (e.g., "una decina" = 10)
7. **Default Quantity:** Uses 1 if not specified

---

## Performance

- **Average Response Time:** 2-4 seconds
- **Max Duration:** 90 seconds (timeout)
- **Customer History Window:** 6 months
- **Max Order Lines Analyzed:** 1000
- **Max Orders Analyzed:** 100

---

## Error Handling

The endpoint implements comprehensive error handling for:

1. **Validation Errors:** Invalid input parameters (400 Bad Request)
2. **Odoo Errors:** Customer not found, no order history (500 Internal Server Error)
3. **AI Errors:** API key missing, AI timeout, invalid response (500 Internal Server Error)
4. **JSON Parsing Errors:** Malformed AI JSON response (500 Internal Server Error)
5. **Unknown Errors:** Unexpected exceptions with stack trace in development (500 Internal Server Error)

All errors include:
- `success: false`
- `error: string` (human-readable message)
- `errorType: string` (for programmatic handling)
- `processing_time_ms: number` (for monitoring)

---

## Integration Example (TypeScript)

```typescript
interface ProcessOrderRequest {
  customerId: number;
  message: string;
  messageType: 'text' | 'audio' | 'image';
}

async function processOrder(request: ProcessOrderRequest) {
  const response = await fetch('/api/catalogo-venditori/ai-process-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error);
  }

  // Process matches
  const highConfidenceMatches = data.matches.filter(
    m => m.confidence === 'ALTA' && m.product_id !== null
  );

  const needsReview = data.matches.filter(
    m => ['MEDIA', 'BASSA'].includes(m.confidence)
  );

  const notFound = data.matches.filter(
    m => m.confidence === 'NON_TROVATO'
  );

  return {
    customer: data.customer,
    autoProcessable: highConfidenceMatches,
    needsReview,
    notFound,
    note: data.note,
    stats: data.stats,
  };
}
```

---

## Monitoring & Logging

The endpoint logs detailed information at each step:

```
🤖 [AI-PROCESS-ORDER] Starting AI order processing
👤 Customer ID: 12345
💬 Message type: text
📝 Message preview: Vorrei 2 forme di parmigiano...
📍 STEP 1: Fetching customer data for ID 12345...
✅ Customer found: Ristorante Da Mario
📍 STEP 2: Loading order history (last 6 months)...
✅ Found 45 orders in last 6 months
📍 STEP 3: Loading products from order history...
✅ Found 234 order lines (products)
✅ Found 87 unique products in history
📊 Top 10 most ordered products:
  1. Parmigiano Reggiano DOP 24 mesi - Forma (ordered 23x, total: 46)
  2. Mozzarella di Bufala DOP 250g (ordered 18x, total: 180)
  ...
📍 STEP 4: AI Product Matching...
✅ AI Matching completed!
Found 2 product matches
✅ [AI-PROCESS-ORDER] Processing completed successfully!
📊 Stats: 2/2 matches found in 3245ms
📊 Confidence: ALTA=1, MEDIA=1, BASSA=0, NON_TROVATO=0
```

---

## Security Notes

- Endpoint uses admin session (`callOdooAsAdmin`) for Odoo access
- Customer data is filtered by `customerId` parameter
- API key for Anthropic must be set in `ANTHROPIC_API_KEY` environment variable
- No sensitive data is logged (only customer ID and message preview)

---

## Future Enhancements

- [ ] Support for multi-language orders
- [ ] Product category suggestions for NON_TROVATO items
- [ ] Learning from salesperson corrections
- [ ] Batch processing for multiple messages
- [ ] Price estimation in response
- [ ] Stock availability checking
- [ ] Automatic order draft creation

---

## Troubleshooting

### Issue: "AI service not configured"
**Solution:** Set `ANTHROPIC_API_KEY` in environment variables

### Issue: "Cliente non trovato in Odoo"
**Solution:** Verify customerId exists in res.partner table

### Issue: "Nessun ordine trovato negli ultimi 6 mesi"
**Solution:** Customer has no confirmed orders, cannot match products

### Issue: "AI did not return valid JSON"
**Solution:** Check AI prompt or model response, may need prompt adjustment

### Issue: Timeout after 90 seconds
**Solution:** Customer has too many orders/products, consider optimizing query limits

---

## Support

For issues or questions, contact the development team or check the endpoint logs for detailed error information.
