# 🗺️ MAPPING COMPLETO: AGENTI → SKILLS → ENDPOINT

Questa è la mappa completa di tutti gli agenti, skills e endpoint della piattaforma.

---

## 📍 INDICE RAPIDO

1. [Endpoint con Skills Diretti](#endpoint-con-skills-diretti) (3 endpoint)
2. [Endpoint Maestro Multi-Agent](#endpoint-maestro-multi-agent) (1 endpoint)
3. [Agenti Maestro e Skills](#agenti-maestro-e-skills) (6 agenti)
4. [Skills per Categoria](#skills-per-categoria) (21 skills)

---

## 🎯 ENDPOINT CON SKILLS DIRETTI

Questi endpoint usano skills DIRETTAMENTE (senza agenti Maestro).

### 1. **Arrivo Merce - Parse Invoice**

**File:** `app/api/arrivo-merce/parse-invoice/route.ts`
**Endpoint:** `POST /api/arrivo-merce/parse-invoice`
**APP:** Arrivo Merce (Gestione Magazzino)

**Skill usato:**
- `document-processing/invoice-parsing`

**Cosa fa:**
- Riceve PDF o immagine fattura fornitore
- Usa Claude Vision + skill per estrarre dati strutturati
- Restituisce JSON con prodotti, quantità, lotti, scadenze

**Input:** File (PDF/JPG/PNG)
**Output:** JSON con lista prodotti estratti

---

### 2. **Arrivo Merce - Parse Attachment**

**File:** `app/api/arrivo-merce/parse-attachment/route.ts`
**Endpoint:** `POST /api/arrivo-merce/parse-attachment`
**APP:** Arrivo Merce (Gestione Magazzino)

**Skill usato:**
- `document-processing/invoice-parsing`

**Cosa fa:**
- Riceve PDF multi-pagina
- Splitta in singole pagine
- Processa ogni pagina con skill invoice-parsing
- Aggrega risultati

**Input:** PDF multi-pagina
**Output:** JSON aggregato con tutti i prodotti

---

### 3. **Arrivo Merce - Process Reception**

**File:** `app/api/arrivo-merce/process-reception/route.ts`
**Endpoint:** `POST /api/arrivo-merce/process-reception`
**APP:** Arrivo Merce (Gestione Magazzino)

**Skill usato:**
- `inventory-management/product-matching`

**Cosa fa:**
- Riceve prodotti dalla fattura + righe ordine Odoo
- Usa skill per matchare prodotti (fuzzy matching)
- Gestisce multi-lotto (stesso prodotto, lotti diversi)
- Crea/aggiorna righe in Odoo

**Input:** JSON { invoice_products, odoo_lines }
**Output:** JSON con matching e azioni (update/create_new_line/no_match)

---

## 🤖 ENDPOINT MAESTRO MULTI-AGENT

Questo endpoint usa il sistema multi-agente orchestrato.

### 4. **Maestro Agent Chat**

**File:** `app/api/maestro/agent-chat/route.ts`
**Endpoint:** `POST /api/maestro/agent-chat`
**APP:** Hub AI Centralizzato (usato da tutti)

**Agente principale:**
- `OrchestratorAgent` (coordina tutti gli altri 6 agenti)

**Cosa fa:**
1. Riceve query utente
2. Orchestrator analizza query e decide quali agenti chiamare
3. Esegue agenti in parallelo o sequenza
4. Sintetizza risposta finale

**Input:**
```json
{
  "user_query": "Analizza il cliente 123",
  "salesperson_id": 1
}
```

**Output:** Risposta sintetizzata con dati da uno o più agenti

**Agenti disponibili:**
- CustomerIntelligenceAgent
- ProductIntelligenceAgent
- SalesAnalystAgent
- MaestroIntelligenceAgent
- ExternalResearchAgent
- ActionExecutorAgent

---

## 🎭 AGENTI MAESTRO E SKILLS

Questi agenti sono orchestrati dal **OrchestratorAgent** e vengono chiamati dinamicamente.

### AGENTE 1: CustomerIntelligenceAgent

**File:** `lib/maestro-agents/agents/customer-intelligence-agent.ts`
**Ruolo:** `customer_intelligence`

**Skills integrati:**
1. `customer-intelligence/customer-profiling`
2. `customer-intelligence/churn-prediction`
3. `customer-intelligence/purchase-pattern-analysis`

**Tools aggiuntivi:**
- ANALYTICS_TOOLS (RFM, anomaly detection, growth rate)
- CHURN_TOOLS (churn prediction, CLV)
- MATH_TOOLS (statistics, regression, correlation)

**Quando viene chiamato:**
- Query su profilo cliente
- Domande su segmentazione
- Analisi rischio churn
- Pattern di acquisto
- Keywords: "profilo", "cliente", "segmento", "churn", "rischio", "abbandono"

**Esempi query:**
- "Fammi un profilo RFM del cliente 123"
- "Il cliente Bar Centrale è a rischio churn?"
- "Analizza i pattern di acquisto del cliente 456"

---

### AGENTE 2: ProductIntelligenceAgent

**File:** `lib/maestro-agents/agents/product-intelligence-agent.ts`
**Ruolo:** `product_intelligence`

**Skills integrati:**
1. `product-intelligence/product-analysis`
2. `product-intelligence/price-optimization`
3. `product-intelligence/category-trends`
4. `product-intelligence/cross-sell-suggestions`

**Tools aggiuntivi:**
- ANALYTICS_TOOLS
- FORECASTING_TOOLS (sales forecast, seasonality)
- MATH_TOOLS

**Quando viene chiamato:**
- Analisi performance prodotto
- Ottimizzazione prezzi
- Trend categorie
- Suggerimenti cross-sell
- Keywords: "prodotto", "prezzo", "ottimizza", "categoria", "trend", "cross-sell"

**Esempi query:**
- "Analizza il prodotto Olio EVO"
- "Come ottimizzare il prezzo della Mozzarella?"
- "Quali prodotti suggerire con il Parmigiano?"

---

### AGENTE 3: SalesAnalystAgent

**File:** `lib/maestro-agents/agents/sales-analyst-agent.ts`
**Ruolo:** `sales_analyst`

**Skills integrati:**
1. `sales-analytics/kpi-calculation`
2. `sales-analytics/sales-forecasting`
3. `sales-analytics/performance-benchmarking`
4. `sales-analytics/opportunity-detection`

**Tools aggiuntivi:**
- ANALYTICS_TOOLS
- FORECASTING_TOOLS
- MATH_TOOLS

**Quando viene chiamato:**
- Calcolo KPI vendite
- Previsioni vendite
- Confronto performance
- Identificazione opportunità
- Keywords: "kpi", "vendite", "performance", "forecast", "previsione", "opportunità"

**Esempi query:**
- "Calcola i KPI di questo mese"
- "Prevedi le vendite per i prossimi 3 mesi"
- "Confronta la mia performance con la media"

---

### AGENTE 4: MaestroIntelligenceAgent

**File:** `lib/maestro-agents/agents/maestro-intelligence-agent.ts`
**Ruolo:** `maestro_intelligence`

**Skills integrati:**
1. `maestro-recommendations/recommendation-engine`
2. `maestro-recommendations/timing-optimization`
3. `maestro-recommendations/learning-patterns`

**Tools aggiuntivi:**
- ANALYTICS_TOOLS
- FORECASTING_TOOLS
- CHURN_TOOLS

**Quando viene chiamato:**
- Raccomandazioni AI personalizzate
- Ottimizzazione timing contatti
- Pattern learning
- Keywords: "raccomanda", "suggerisci", "quando", "timing", "pattern"

**Esempi query:**
- "Cosa dovrei proporre al cliente oggi?"
- "Quando è il momento migliore per contattare il cliente?"
- "Quali pattern vedi nei miei clienti migliori?"

---

### AGENTE 5: ExternalResearchAgent

**File:** `lib/maestro-agents/agents/external-research-agent.ts`
**Ruolo:** `external_research`

**Skills integrati:**
1. `external-research/menu-analysis`
2. `external-research/competitor-research`
3. `external-research/review-aggregation`

**Tools aggiuntivi:**
- Nessun tool analytics (usa research tools specifici)

**Quando viene chiamato:**
- Analisi menu ristorante (da foto/PDF)
- Ricerca competitor
- Aggregazione recensioni
- Keywords: "menu", "competitor", "recensioni", "rivale", "concorrente"

**Esempi query:**
- "Analizza questo menu" (con foto)
- "Chi sono i miei competitor principali?"
- "Cosa dicono le recensioni del mio ristorante?"

---

### AGENTE 6: ActionExecutorAgent

**File:** `lib/maestro-agents/agents/action-executor-agent.ts`
**Ruolo:** `action_executor`

**Skills integrati:**
- Nessuno (usa tools diretti Odoo)

**Tools:**
- Odoo API tools (create order, update customer, etc.)

**Quando viene chiamato:**
- Azioni operative su Odoo
- Creazione ordini
- Aggiornamento dati
- Keywords: "crea", "aggiorna", "registra", "salva"

**Esempi query:**
- "Crea un ordine per il cliente 123"
- "Aggiorna l'indirizzo del cliente"
- "Registra questa interazione"

---

## 📚 SKILLS PER CATEGORIA

### Category: `customer-intelligence/` (3 skills)

1. **customer-profiling.md**
   - RFM score calculation (Recency, Frequency, Monetary)
   - Customer segmentation (Champions, Loyal, At Risk, Lost)
   - Tools: get_customer_orders, calculate_rfm_score

2. **churn-prediction.md**
   - Churn risk scoring (0-100)
   - Risk levels (Critical, High, Medium, Low, Minimal)
   - Tools: predict_churn_risk, calculate_customer_ltv

3. **purchase-pattern-analysis.md**
   - Temporal patterns (day, time, cycle)
   - Buyer type classification
   - Next purchase prediction

---

### Category: `sales-analytics/` (4 skills)

1. **kpi-calculation.md**
   - Revenue, AOV, CLV, Conversion Rate, Churn Rate
   - Period comparisons (MoM, YoY, QoQ)
   - Tools: get_sales_data, calculate_statistics

2. **sales-forecasting.md**
   - Linear regression, moving average, seasonal decomposition
   - Confidence intervals (80%, 95%)
   - Tools: forecast_sales, detect_seasonality

3. **performance-benchmarking.md**
   - Team, product, competitor benchmarking
   - Ranking and percentiles
   - Tools: calculate_statistics

4. **opportunity-detection.md**
   - Cross-sell, upsell, reactivation opportunities
   - Risk detection (churn, stockout, margin erosion)
   - Tools: find_related_products

---

### Category: `product-intelligence/` (4 skills)

1. **product-analysis.md**
   - Performance metrics (sales velocity, margin, turnover)
   - Trend classification
   - Tools: get_product_performance_metrics

2. **price-optimization.md**
   - Price elasticity analysis
   - Optimal price calculation
   - BCG pricing matrix

3. **category-trends.md**
   - BCG Matrix (Stars, Cash Cows, Question Marks, Dogs)
   - Market basket analysis
   - Tools: get_category_analytics

4. **cross-sell-suggestions.md**
   - 6 recommendation types
   - Personalized by customer segment
   - Tools: find_related_products, get_market_basket_analysis

---

### Category: `maestro-recommendations/` (3 skills)

1. **recommendation-engine.md**
   - Collaborative filtering
   - Trend-based recommendations
   - Temperature: 0.3 (creative)

2. **timing-optimization.md**
   - Pre-order proactive, post-purchase follow-up
   - Timezone awareness, quiet hours
   - Temperature: 0.3

3. **learning-patterns.md**
   - Behavioral segmentation (K-Means)
   - Trend forecasting (ARIMA)
   - Temperature: 0.3

---

### Category: `external-research/` (3 skills)

1. **menu-analysis.md**
   - Vision support (PDF, images)
   - Multi-language menus
   - Ingredient and allergen extraction

2. **competitor-research.md**
   - SWOT analysis
   - Pricing model extraction
   - Market positioning

3. **review-aggregation.md**
   - Multi-platform (Google, Trustpilot, Amazon, Yelp)
   - Sentiment analysis
   - Feature requests extraction

---

### Category: `document-processing/` (3 skills)

1. **invoice-parsing.md** ✅ (già esistente)
   - Vision support (PDF, images)
   - Extraction: products, quantities, lots, expiry dates
   - **USATO DA:** parse-invoice, parse-attachment

2. **contract-analysis.md**
   - Payment terms, delivery conditions
   - Price lists, warranties
   - Vision support

3. **receipt-extraction.md**
   - Merchant info, totals, VAT
   - Expense categorization
   - Vision support (optimized OCR)

---

### Category: `inventory-management/` (3 skills)

1. **product-matching.md** ✅ (già esistente)
   - Fuzzy matching (code, name, variant)
   - Multi-lot handling
   - **USATO DA:** process-reception

2. **stock-reconciliation.md**
   - Variance calculation
   - Root cause analysis
   - Corrective actions

3. **expiry-tracking.md**
   - Days-to-expiry calculation
   - FIFO/FEFO rotation
   - HACCP compliance

---

## 🔍 COME TROVARE UN ENDPOINT/AGENTE

### Per Funzionalità (APP)

**Arrivo Merce (Magazzino):**
- 3 endpoint in `app/api/arrivo-merce/`
- Skills: invoice-parsing, product-matching

**Maestro (AI Hub):**
- 1 endpoint in `app/api/maestro/agent-chat/`
- 6 agenti orchestrati
- 21 skills disponibili

### Per Skill

**Cercare dove viene usato uno skill:**
```bash
grep -r "loadSkill('NOME-SKILL')" app/api
```

**Esempio:**
```bash
grep -r "invoice-parsing" app/api
# Output: parse-invoice/route.ts, parse-attachment/route.ts
```

### Per Agente

**Cercare quale endpoint chiama un agente:**
```bash
grep -r "CustomerIntelligenceAgent" app/api
# Output: maestro/agent-chat/route.ts
```

Tutti gli agenti sono chiamati SOLO da: `app/api/maestro/agent-chat/route.ts`

---

## 📊 STATISTICHE

**Endpoint totali con AI:** 4
- 3 endpoint diretti (arrivo-merce)
- 1 endpoint orchestrator (maestro)

**Agenti totali:** 7
- 1 Orchestrator
- 6 Specialized Agents

**Skills totali:** 21
- 7 categorie
- 19 nuovi + 2 esistenti

**Tools totali:** 35+
- Analytics: 3
- Math: 3
- Churn: 2
- Forecasting: 2
- Customer: 8
- Product: 7
- Shared: 13

---

## 🚀 TESTING

**Test endpoint arrivo-merce:**
```bash
curl -X POST https://staging-url/api/arrivo-merce/parse-invoice \
  -F "file=@fattura.pdf"
```

**Test maestro agent chat:**
```bash
curl -X POST https://staging-url/api/maestro/agent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "Fammi un profilo del cliente 123",
    "salesperson_id": 1
  }'
```

---

**Ultimo aggiornamento:** 2025-10-24
**Branch:** staging
**Commit:** fc44ee9
