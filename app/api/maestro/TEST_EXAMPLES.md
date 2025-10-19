# MAESTRO AI - Test Examples

Esempi pratici per testare tutte le API MAESTRO.

## Prerequisites

1. Database Postgres con tabelle create
2. Customer avatars sincronizzati da Odoo (`npm run maestro:sync`)
3. Server in esecuzione: `npm run dev`
4. API accessibili su `http://localhost:3000`

---

## 1. Test Customer Avatars API

### 1.1 Fetch All Avatars (Default Params)

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars"
```

**Expected:** Lista di max 20 avatars ordinati per churn_risk_score DESC.

---

### 1.2 Fetch Avatars per Venditore Specifico

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?salesperson_id=5&limit=10"
```

**Expected:** Avatars assegnati al venditore ID 5.

---

### 1.3 Fetch HIGH Churn Risk Customers

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?churn_risk_min=70&sort_by=churn_risk_score&sort_order=desc"
```

**Expected:** Solo clienti con churn_risk >= 70%, ordinati dal più alto.

---

### 1.4 Fetch LOW Health Score Customers

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?health_score_min=0&sort_by=health_score&sort_order=asc&limit=5"
```

**Expected:** Top 5 clienti con health score più basso.

---

### 1.5 Fetch Avatar Detail

Prima trova un avatar ID:
```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?limit=1" | jq '.avatars[0].id'
```

Poi fetch dettaglio:
```bash
# Sostituisci <AVATAR_ID> con ID reale
curl -X GET "http://localhost:3000/api/maestro/avatars/<AVATAR_ID>"
```

**Expected:** Avatar completo + raccomandazioni attive + interazioni recenti.

---

## 2. Test Recommendations API

### 2.1 Generate AI Recommendations

```bash
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "salesperson_id": 5,
    "max_recommendations": 10,
    "focus_on": "all"
  }'
```

**Expected:**
- Success: true
- Recommendations array con max 10 items
- Summary con stats (urgent_count, high_priority_count, etc.)

**Note:** Richiede Claude AI API key in `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### 2.2 Generate Churn-Focused Recommendations

```bash
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "salesperson_id": 5,
    "max_recommendations": 5,
    "focus_on": "churn"
  }'
```

**Expected:** Solo raccomandazioni per clienti ad alto rischio churn.

---

### 2.3 Fetch Pending Recommendations

```bash
curl -X GET "http://localhost:3000/api/maestro/recommendations?salesperson_id=5&status=pending&limit=20"
```

**Expected:** Raccomandazioni ancora da eseguire per venditore 5.

---

### 2.4 Fetch Urgent Recommendations

```bash
curl -X GET "http://localhost:3000/api/maestro/recommendations?priority=urgent&status=pending"
```

**Expected:** Solo raccomandazioni URGENT ancora pending.

---

### 2.5 Update Recommendation to Completed

Prima trova una recommendation ID:
```bash
curl -X GET "http://localhost:3000/api/maestro/recommendations?limit=1" | jq '.recommendations[0].id'
```

Poi update:
```bash
# Sostituisci <REC_ID> con ID reale
curl -X PATCH "http://localhost:3000/api/maestro/recommendations/<REC_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "outcome": "success",
    "outcome_notes": "Cliente riattivato! Ordine da €450 effettuato."
  }'
```

**Expected:**
- Recommendation aggiornata
- Avatar churn_risk_score ridotto (trigger automatico)

---

## 3. Test Daily Plan API

### 3.1 Get Daily Plan for Today

```bash
curl -X GET "http://localhost:3000/api/maestro/daily-plan?salesperson_id=5"
```

**Expected:**
- daily_plan con categorie: urgent, high_priority, upsell, routine
- summary con counts e estimated_hours

---

### 3.2 Get Daily Plan for Specific Date

```bash
curl -X GET "http://localhost:3000/api/maestro/daily-plan?salesperson_id=5&date=2025-10-20"
```

**Expected:** Piano per data specifica.

---

## 4. Test Interactions API

### 4.1 Create Successful Visit Interaction

Prima trova un customer_avatar_id:
```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?limit=1" | jq '.avatars[0].id'
```

Poi crea interazione:
```bash
# Sostituisci <AVATAR_ID> con ID reale
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "<AVATAR_ID>",
    "interaction_type": "visit",
    "outcome": "successful",
    "notes": "Visita positiva, cliente soddisfatto dei nuovi prodotti",
    "order_placed": true,
    "order_value": 350.50,
    "samples_given": [
      {
        "product_id": 123,
        "product_name": "Prosciutto Crudo DOP",
        "quantity": 2
      },
      {
        "product_id": 456,
        "product_name": "Parmigiano Reggiano 24 mesi",
        "quantity": 1
      }
    ],
    "next_follow_up_date": "2025-11-15"
  }'
```

**Expected:**
- Interaction creata
- Avatar scores aggiornati (churn -25, engagement +25)

---

### 4.2 Create Call Interaction (No Order)

```bash
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "<AVATAR_ID>",
    "interaction_type": "call",
    "outcome": "neutral",
    "notes": "Cliente non disponibile, richiamato dopo 2 giorni",
    "order_placed": false
  }'
```

**Expected:**
- Interaction creata
- Avatar scores aggiornati (lievi aggiustamenti)

---

### 4.3 Create Interaction Linked to Recommendation

Prima genera raccomandazione e prendi ID, poi crea interazione:
```bash
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "<AVATAR_ID>",
    "interaction_type": "visit",
    "outcome": "successful",
    "order_placed": true,
    "order_value": 450,
    "recommendation_id": "<REC_ID>"
  }'
```

**Expected:**
- Interaction creata
- Recommendation status → `in_progress` (auto-update)

---

### 4.4 Fetch Interactions for Customer

```bash
curl -X GET "http://localhost:3000/api/maestro/interactions?customer_avatar_id=<AVATAR_ID>&limit=10"
```

**Expected:** Ultime 10 interazioni per quel cliente.

---

### 4.5 Fetch All Interactions by Salesperson

```bash
curl -X GET "http://localhost:3000/api/maestro/interactions?salesperson_id=5&limit=50"
```

**Expected:** Ultime 50 interazioni del venditore 5.

---

## 5. Complete Workflow Test

Test completo del flusso MAESTRO:

```bash
#!/bin/bash

# Step 1: Fetch avatars per venditore
echo "=== STEP 1: Fetch Avatars ==="
AVATARS=$(curl -s "http://localhost:3000/api/maestro/avatars?salesperson_id=5&limit=5")
echo $AVATARS | jq '.avatars[] | {name, churn_risk_score, health_score}'

# Step 2: Generate AI recommendations
echo -e "\n=== STEP 2: Generate Recommendations ==="
RECS=$(curl -s -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{"salesperson_id": 5, "max_recommendations": 5, "focus_on": "all"}')
echo $RECS | jq '.summary'

# Step 3: Get today's daily plan
echo -e "\n=== STEP 3: Get Daily Plan ==="
PLAN=$(curl -s "http://localhost:3000/api/maestro/daily-plan?salesperson_id=5")
echo $PLAN | jq '.summary'

# Step 4: Simulate interaction con primo cliente urgent
echo -e "\n=== STEP 4: Create Interaction ==="
FIRST_AVATAR_ID=$(echo $AVATARS | jq -r '.avatars[0].id')
INTERACTION=$(curl -s -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d "{
    \"customer_avatar_id\": \"$FIRST_AVATAR_ID\",
    \"interaction_type\": \"call\",
    \"outcome\": \"successful\",
    \"order_placed\": true,
    \"order_value\": 300
  }")
echo $INTERACTION | jq '.success'

# Step 5: Verify avatar update
echo -e "\n=== STEP 5: Verify Avatar Updated ==="
UPDATED_AVATAR=$(curl -s "http://localhost:3000/api/maestro/avatars/$FIRST_AVATAR_ID")
echo $UPDATED_AVATAR | jq '.avatar | {name, churn_risk_score, engagement_score, health_score}'

echo -e "\n=== WORKFLOW COMPLETED ==="
```

Salva come `test-maestro-workflow.sh` e esegui:
```bash
chmod +x test-maestro-workflow.sh
./test-maestro-workflow.sh
```

---

## 6. Validation Error Tests

### 6.1 Invalid Salesperson ID (String Instead of Number)

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?salesperson_id=abc"
```

**Expected:** 400 Bad Request con messaggio validazione Zod.

---

### 6.2 Invalid Health Score (Out of Range)

```bash
curl -X GET "http://localhost:3000/api/maestro/avatars?health_score_min=150"
```

**Expected:** 400 Bad Request.

---

### 6.3 Invalid Interaction Type

```bash
curl -X POST "http://localhost:3000/api/maestro/interactions" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_avatar_id": "abc-123",
    "interaction_type": "invalid_type",
    "outcome": "successful"
  }'
```

**Expected:** 400 Bad Request.

---

### 6.4 Missing Required Fields

```bash
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** 400 Bad Request ("salesperson_id: Required").

---

## 7. Performance Tests

### 7.1 Large Batch Recommendations

```bash
curl -X POST "http://localhost:3000/api/maestro/recommendations/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "salesperson_id": 5,
    "max_recommendations": 50,
    "focus_on": "all"
  }'
```

**Monitor:** `generation_time_ms` in response. Should be <30s for 50 recs.

---

### 7.2 Pagination Stress Test

```bash
# Fetch 100 avatars in 5 batches
for i in {0..4}; do
  offset=$((i * 20))
  curl -s "http://localhost:3000/api/maestro/avatars?limit=20&offset=$offset" | jq '.pagination'
done
```

---

## 8. Integration Test with Odoo

### 8.1 Verify Odoo Data Sync

```bash
# Controlla se salesperson_id in avatars corrisponde a reale user Odoo
curl -X GET "http://localhost:3000/api/maestro/avatars?limit=1" | jq '.avatars[0] | {assigned_salesperson_id, assigned_salesperson_name}'
```

Verifica che l'ID e nome corrispondano a utente esistente in Odoo.

---

## Troubleshooting

### Error: "Failed to fetch customer avatars"
- Verifica connessione Postgres in `.env.local`
- Check se tabella `customer_avatars` esiste

### Error: "Failed to generate recommendations"
- Verifica `ANTHROPIC_API_KEY` in `.env.local`
- Check quota Claude API

### Error: "Customer avatar not found"
- Verifica UUID valido
- Check se avatar esiste nel database

### Error: "Recommendation not found"
- Verifica UUID valido
- Check se recommendation non è stata già eliminata

---

## Tips

1. **jq per JSON parsing**: Installa `jq` per parsing JSON in bash
   ```bash
   # Ubuntu/Debian
   sudo apt install jq

   # macOS
   brew install jq
   ```

2. **Postman Collection**: Importa esempi in Postman per testing interattivo

3. **Database Inspection**: Usa psql o PgAdmin per verificare dati:
   ```sql
   SELECT COUNT(*) FROM customer_avatars WHERE is_active = true;
   SELECT COUNT(*) FROM maestro_recommendations WHERE status = 'pending';
   SELECT COUNT(*) FROM maestro_interactions;
   ```

4. **Logs Monitoring**: Segui i logs server per debug:
   ```bash
   npm run dev | grep MAESTRO
   ```

---

Buon testing! 🚀
