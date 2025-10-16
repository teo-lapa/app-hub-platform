# 🤖 LAPA Smart Ordering AI - Sistema Intelligente

## 🎯 Obiettivo

**NON rimanere MAI senza prodotto in magazzino!**

Sistema intelligente che:
- ✅ Calcola **lead time REALI** dai purchase orders (data conferma → data consegna)
- ✅ Analizza **vendite REALI** dai sale orders (data consegna effettiva)
- ✅ Usa **AI (Claude)** per predizioni accurate prossimi 7 giorni
- ✅ **Alert intelligenti** quando rischio stock-out < lead time fornitore
- ✅ Identifica **clienti ricorsivi** e pattern di acquisto
- ✅ Suggerisce **quantità ottimale** con safety stock dinamico

---

## 📁 Struttura File Creati

### 1. Database Schema
```
prisma/schema-smart-ordering.prisma
```
Schema PostgreSQL per memorizzare:
- Lead time analysis per fornitore
- Storico vendite prodotti
- Predizioni AI cache
- Alert system
- Customer patterns
- Purchase order analytics
- System analytics summary

### 2. Core Services

#### Lead Time Analyzer
```
lib/smart-ordering/lead-time-analyzer.ts
```
Calcola lead time REALI da Odoo purchase orders:
- Usa `date_approve` (conferma) → `effective_date` (consegna)
- Calcola mediana, media, min, max, std dev
- Rimuove outlier automaticamente
- Calcola reliability score fornitore (0-100)
- On-time delivery rate

#### Sales Analyzer
```
lib/smart-ordering/sales-analyzer.ts
```
Analizza vendite REALI da Odoo sale orders:
- Usa data consegna EFFETTIVA, non data ordine
- Calcola trend (growing, stable, declining, volatile)
- Pattern settimanale (quale giorno si vende di più)
- Identifica clienti ricorsivi
- Weekly breakdown ultimi 3 mesi

#### AI Prediction Engine
```
lib/smart-ordering/ai-prediction-engine.ts
```
Genera predizioni accurate usando Claude AI:
- Predice vendite prossimi 7 giorni
- Simula stock day-by-day
- Calcola giorni fino a stock-out
- Determina urgenza (EMERGENCY, CRITICAL, HIGH, MEDIUM, LOW)
- Safety stock dinamico basato su variabilità
- Reorder point ottimale
- AI reasoning dettagliato
- Confidence score (0-100)

#### Smart Alert System
```
lib/smart-ordering/smart-alert-system.ts
```
Sistema alert intelligente:
- Scansiona prodotti e genera alert
- Prioritizza per urgenza (priority 1-100)
- Confronta stock-out date vs lead time
- Suggerisce azioni immediate
- Notifiche Telegram/Email (placeholder)
- Alert summary con KPI

### 3. API Endpoints

#### POST /api/smart-ordering-ai/predict
Genera predizioni AI per prodotti
```json
{
  "productIds": [123, 456] // o "all"
}
```

#### GET /api/smart-ordering-ai/predict?productId=123
Predizione singolo prodotto

#### GET /api/smart-ordering-ai/alerts
Recupera tutti gli alert intelligenti

#### POST /api/smart-ordering-ai/alerts
Azioni: send-notifications, resolve

#### GET /api/smart-ordering-ai/analyze-supplier?supplierId=X
Analizza lead time fornitore specifico

#### GET /api/smart-ordering-ai/analyze-supplier?mode=all
Analizza TUTTI i fornitori

#### GET /api/smart-ordering-ai/analyze-sales?productId=X
Analizza vendite prodotto specifico

### 4. Dashboard UI

```
app/ordini-smart-ai/page.tsx
```

Dashboard moderna con:
- KPI cards (Prodotti, Emergency, Critical, High, AI Confidence)
- Sezione EMERGENCY con alert rossi
- Sezione CRITICAL con alert arancioni
- Sezione HIGH con alert gialli
- Product cards espandibili con:
  - AI reasoning
  - Risk factors
  - 7-day forecast grafico
  - Bottone crea ordine

---

## 🚀 Come Testare in Locale

### 1. Prerequisiti

Assicurati di avere nel `.env`:
```bash
# Odoo
ODOO_URL=https://your-odoo-url.odoo.com
ODOO_DB=your-database
ODOO_USERNAME=your-username
ODOO_PASSWORD=your-password

# Anthropic API (per AI predictions)
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 2. Installa Dipendenze

```bash
npm install @anthropic-ai/sdk
npm install framer-motion lucide-react
```

### 3. Setup Database (Opzionale)

Se vuoi usare il database per cache:
```bash
# Aggiungi al DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/lapa_ai"

# Migra schema
npx prisma db push --schema=prisma/schema-smart-ordering.prisma
```

**NOTA**: Il sistema funziona anche SENZA database, legge tutto da Odoo in tempo reale!

### 4. Avvia Server di Sviluppo

```bash
npm run dev
```

### 5. Testa Dashboard

Apri browser:
```
http://localhost:3000/ordini-smart-ai
```

### 6. Testa API Direttamente

#### Test Analisi Fornitore
```bash
curl "http://localhost:3000/api/smart-ordering-ai/analyze-supplier?supplierId=123"
```

#### Test Analisi Vendite
```bash
curl "http://localhost:3000/api/smart-ordering-ai/analyze-sales?productId=456"
```

#### Test Predizioni AI
```bash
curl -X POST http://localhost:3000/api/smart-ordering-ai/predict \
  -H "Content-Type: application/json" \
  -d '{"productIds": [123, 456, 789]}'
```

#### Test Alert
```bash
curl "http://localhost:3000/api/smart-ordering-ai/alerts"
```

---

## 📊 Come Funziona il Sistema

### 1. Calcolo Lead Time REALE

```typescript
// Recupera purchase orders ultimi 6 mesi
purchase.order filtrati per:
  - partner_id = supplierId
  - state = 'purchase' o 'done'
  - date_approve != false (deve avere conferma)

// Per ogni ordine calcola:
leadTime = date_received - date_approve

// Statistiche:
- Mediana (più robusta della media)
- Media, Min, Max
- Std Dev (variabilità)
- On-time rate (% consegne puntuali)
- Reliability score (0-100)
```

### 2. Analisi Vendite REALE

```typescript
// Recupera sale order lines ultimi 3 mesi
sale.order.line filtrati per:
  - product_id = X
  - order_id.state = 'sale' o 'done'
  - order_id.effective_date != false (data consegna)

// Calcola:
- Vendite totali, medie giornaliere/settimanali/mensili
- Trend (compara primo mese vs ultimo mese)
- Variabilità (coefficiente variazione)
- Pattern settimanale (% vendite per giorno)
- Clienti ricorsivi (con 2+ ordini)
```

### 3. Predizione AI con Claude

```typescript
// 1. Carica dati prodotto
- Stock attuale
- Fornitore principale
- Lead time REALE fornitore
- Storico vendite 3 mesi

// 2. Chiama Claude AI
Prompt: "Prevedi vendite prossimi 7 giorni considerando:
- Pattern settimanale storico
- Trend recente
- Stagionalità
- Clienti ricorsivi"

// 3. Simula stock day-by-day
runningStock = currentStock
for day in next7Days:
  runningStock -= predictedSales[day]
  if runningStock < 0:
    stockoutDay = day

// 4. Confronta con lead time
if stockoutDay < supplierLeadTime:
  urgency = EMERGENCY // Non ce la fai in tempo!
else if stockoutDay < supplierLeadTime * 1.5:
  urgency = CRITICAL

// 5. Calcola quantità ordine
recommendedQty = (avgDailySales * 14giorni) + safetyStock

safetyStock = zScore × stdDev × √leadTime
```

### 4. Sistema Alert

```typescript
// Per ogni prodotto:
if daysUntilStockout <= 0:
  alert = EMERGENCY "Stock-out OGGI!"

else if daysUntilStockout < supplierLeadTime * 0.5:
  alert = EMERGENCY "Impossibile ordinare in tempo!"

else if daysUntilStockout < supplierLeadTime:
  alert = CRITICAL "Rischio stock-out, ordina OGGI"

else if daysUntilStockout < supplierLeadTime * 1.5:
  alert = HIGH "Ordina questa settimana"
```

---

## 🎨 Dashboard UI

### Sezioni

1. **Header**
   - Titolo con icona Brain
   - Bottone Aggiorna

2. **KPI Cards** (5 card colorate)
   - Prodotti Analizzati
   - EMERGENCY (rosso)
   - CRITICAL (arancione)
   - HIGH (giallo)
   - AI Confidence (verde)

3. **Sezione EMERGENCY** (se presenti)
   - Header rosso con icona Zap
   - Card prodotti urgenti espandibili

4. **Sezione CRITICAL** (se presenti)
   - Header arancione con icona AlertTriangle
   - Card prodotti critici

5. **Sezione HIGH** (se presenti)
   - Header giallo con icona Clock
   - Card prodotti alta priorità

### Product Card Espandibile

Quando clicchi su un prodotto:
- **AI Analysis**: Reasoning dettagliato generato da Claude
- **Fattori di Rischio**: Lista bullet points
- **Previsione 7 Giorni**: Grafico barre con stock previsto ogni giorno
- **Bottone Crea Ordine**: Con quantità raccomandata

---

## 🔧 Configurazione Avanzata

### Personalizza Lead Time History

```typescript
// Default: 6 mesi
leadTimeAnalyzer.analyzeSupplier(supplierId, 12) // 12 mesi
```

### Personalizza Sales History

```typescript
// Default: 3 mesi
salesAnalyzer.analyzeProduct(productId, 6) // 6 mesi
```

### Personalizza Coverage Days

```typescript
// lib/smart-ordering/ai-prediction-engine.ts:489
let coverageDays = 14; // Default 2 settimane
if (salesHistory.trend === 'growing') coverageDays = 21; // 3 settimane
```

### Personalizza Safety Stock Z-Score

```typescript
// lib/smart-ordering/ai-prediction-engine.ts:134
const zScore = reliability > 85 ? 1.65 : // 95% service level
               reliability > 70 ? 1.96 : // 97.5%
               2.33; // 99%
```

---

## 📈 KPI e Metriche

### Lead Time Metrics
- **Median Lead Time**: Giorni mediana (robusto contro outlier)
- **Reliability Score**: 0-100 (variability + on-time rate)
- **On-Time Rate**: % consegne puntuali

### Sales Metrics
- **Avg Daily Sales**: Media vendite giornaliere
- **Trend**: growing, stable, declining, volatile
- **Variability**: Coefficiente di variazione (0-1)
- **Peak Day**: Giorno con più vendite

### Prediction Metrics
- **Days Until Stockout**: Giorni rimanenti prima stock-out
- **Urgency Level**: EMERGENCY, CRITICAL, HIGH, MEDIUM, LOW
- **Confidence Score**: 0-100 (accuratezza predizione)
- **Safety Stock**: Unità di sicurezza
- **Reorder Point**: Soglia per riordinare

---

## 🚀 Deploy in Produzione

### 1. Commit e Push

```bash
git add .
git commit -m "feat: Smart Ordering AI con lead time reali e predizioni Claude"
git push origin master
```

### 2. Deploy su Vercel

```bash
vercel --prod
```

### 3. Configura Environment Variables

Nel dashboard Vercel aggiungi:
- `ODOO_URL`
- `ODOO_DB`
- `ODOO_USERNAME`
- `ODOO_PASSWORD`
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (se usi database)

### 4. Setup Cron Job (Opzionale)

Crea `/api/cron/update-predictions/route.ts`:
```typescript
export async function GET() {
  // Rigenera predizioni ogni giorno alle 6:00 AM
  const predictions = await aiPredictionEngine.predictProducts('all');
  // Salva in database cache
  return NextResponse.json({ success: true });
}
```

Configura Vercel Cron:
```json
{
  "crons": [{
    "path": "/api/cron/update-predictions",
    "schedule": "0 6 * * *"
  }]
}
```

### 5. Setup Notifiche Telegram (Opzionale)

```typescript
// lib/smart-ordering/telegram-notifier.ts
export async function sendTelegramAlert(message: string) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    })
  });
}
```

---

## 🐛 Troubleshooting

### Errore: "ANTHROPIC_API_KEY non trovata"
```bash
# Aggiungi in .env
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Errore: "Sessione Odoo non valida"
```bash
# Verifica credenziali Odoo in .env
ODOO_URL=https://your-url.odoo.com
ODOO_USERNAME=admin
ODOO_PASSWORD=***
```

### Errore: "Nessun ordine trovato per questo fornitore"
Il fornitore non ha purchase orders confermati negli ultimi 6 mesi.
Soluzione: Usa un supplier_id diverso o riduci monthsHistory.

### Errore: "Nessuna vendita trovata per questo prodotto"
Il prodotto non ha sale orders con data consegna effettiva.
Soluzione: Verifica che gli ordini abbiano `effective_date` popolato.

### Predizioni AI lente
Claude API può richiedere 5-10 secondi per prodotto.
Soluzione: Usa cache o genera predizioni in background con cron job.

---

## ✅ Checklist Pre-Deploy

- [ ] File `.env` configurato con tutte le API keys
- [ ] Test dashboard in locale: http://localhost:3000/ordini-smart-ai
- [ ] Test API /predict con almeno 3 prodotti
- [ ] Test API /alerts
- [ ] Test analisi lead time fornitore
- [ ] Test analisi vendite prodotto
- [ ] Verifica che predizioni AI funzionino (Claude risponde)
- [ ] Commit e push su GitHub
- [ ] Deploy su Vercel
- [ ] Configura environment variables su Vercel
- [ ] Test dashboard in production

---

## 📞 Supporto

Per domande o problemi:
1. Controlla i log console (F12 in browser)
2. Verifica che Odoo sia accessibile
3. Testa API endpoints singolarmente
4. Verifica che Claude API key sia valida

---

## 🎉 Features Future

- [ ] Database cache per predizioni (evita ricalcolo ogni volta)
- [ ] Notifiche Telegram/Email automatiche
- [ ] Dashboard analytics con grafici storici
- [ ] Ottimizzatore ordini multi-fornitore
- [ ] Integrazione meteo per prodotti stagionali
- [ ] Mobile app con push notifications
- [ ] Auto-ordering con approvazione automatica
- [ ] ML model training con TensorFlow.js

---

**IMPORTANTE**: Questo sistema usa DATI REALI da Odoo e AI per garantire che NON rimani MAI senza prodotto! 🚀
