# 🤖 Ordini Fornitori Intelligenti - Sistema AI

## 📋 Panoramica

Sistema autonomo di gestione ordini fornitori basato su **Claude 3.5 Sonnet AI**.

### ✨ Caratteristiche Principali

- **🤖 Agente Autonomo**: Analisi automatica giornaliera prodotti da Odoo
- **🧠 Machine Learning**: Previsioni vendite con AI su 60 giorni storico
- **📊 Analisi Avanzata**:
  - Trend detection (crescente/decrescente/stabile/volatile)
  - Rilevamento stagionalità
  - Anomaly detection
  - Risk assessment
- **💡 Safety Stock Dinamico**: Calcolato in base a variabilità vendite (15-30%)
- **🎯 Urgenza Intelligente**: Classificazione automatica (critica/alta/media/bassa)
- **📈 Executive Summary**: Report AI sintetico per decisioni rapide
- **💰 Ottimizzazione Ordini**: Raggruppamento automatico per fornitore

---

## 🚀 Setup Rapido

### 1. Prerequisiti

- Node.js 18+ installato
- Account Anthropic con API key
- Accesso Odoo con API configurata

### 2. Configurazione API Key Anthropic

**IMPORTANTE**: Devi aggiungere la tua API key Anthropic!

1. Vai su https://console.anthropic.com/settings/keys
2. Crea una nuova API key
3. Apri `.env.local`
4. Inserisci la chiave:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-TUA_CHIAVE_QUI
```

### 3. Avvio Applicazione

```bash
cd app-hub-platform
npm run dev
```

Apri browser: http://localhost:3000/ordini-fornitori

---

## 📖 Come Funziona

### Flusso Automatico

```mermaid
graph TD
    A[Utente apre app] --> B[Carica analisi cache]
    B --> C{Cache valida?}
    C -->|Sì < 1h| D[Mostra risultati]
    C -->|No| E[Esegui Agente AI]
    E --> F[Carica prodotti da Odoo]
    F --> G[Per ogni prodotto]
    G --> H[Carica storico 60 giorni]
    H --> I[Analisi AI con Claude]
    I --> J[Calcola quantità ottimale]
    J --> K[Genera executive summary]
    K --> L[Salva in cache]
    L --> D
```

### Architettura

```
app-hub-platform/
├── lib/ai/
│   ├── claude-service.ts       # 🧠 Servizio AI Claude
│   └── autonomous-agent.ts     # 🤖 Agente autonomo
├── app/
│   ├── ordini-fornitori/
│   │   └── page.tsx            # 📱 UI Dashboard
│   └── api/ordini-fornitori/
│       ├── analyze/route.ts    # 🔄 API analisi
│       └── cache/route.ts      # 💾 API cache
└── .env.local                  # 🔑 Configurazione
```

---

## 🎯 Funzionalità Dettagliate

### 1. Analisi AI Prodotto Singolo

Per ogni prodotto, Claude AI analizza:

**Input:**
- Storico vendite 60 giorni
- Giacenza attuale
- Lead time fornitore
- Top clienti
- Prezzo unitario

**Output AI:**
- Previsione vendite (giornaliera/settimanale/mensile)
- Quantità raccomandata
- Livello urgenza
- Confidenza (0-100%)
- Trend e stagionalità
- Anomalie rilevate
- Rischi identificati
- Opportunità business
- Suggerimenti strategici

### 2. Algoritmo Quantità Ottimale

```typescript
Fabbisogno Base = Vendite Previste × Lead Time
Safety Stock = Fabbisogno × Safety Margin (15-30%)
Quantità Ordine = (Fabbisogno + Safety) - Giacenza Attuale

Safety Margin dinamico:
- 15% se vendite stabili (variabilità < 30%)
- 20% se vendite moderate (variabilità 30-50%)
- 25% se vendite volatili (variabilità > 50%)
- +5% se lead time > 7 giorni
- +5% se lead time > 14 giorni
```

### 3. Classificazione Urgenza

```typescript
Giorni Esaurimento = Giacenza / Vendite Giornaliere

Urgenza:
- CRITICA: < 50% lead time → ordina SUBITO
- ALTA: < 100% lead time → ordina entro oggi
- MEDIA: < 150% lead time → ordina entro 2-3 giorni
- BASSA: > 150% lead time → monitora
```

### 4. Executive Summary AI

Claude genera automaticamente un report esecutivo che include:

- Situazione generale stock
- Azioni immediate richieste
- Rischi principali da mitigare
- Opportunità da cogliere
- Metriche chiave (valore ordini, prodotti critici)

---

## 📊 Dashboard

### Tab 1: Dashboard Operativa

**Vista Principale:**
- Prodotti raggruppati per fornitore
- Selezione multipla con checkbox
- Modifica quantità suggerite
- Visualizzazione:
  - Stock attuale
  - Previsione vendite/giorno
  - Giorni fino esaurimento
  - Quantità AI raccomandata
  - Urgenza
  - Confidenza %

**Click su Prodotto:**
- Popup dettagliato con:
  - Reasoning AI completo
  - Metriche predittive
  - Trend e anomalie
  - Rischi e opportunità
  - Suggerimenti strategici

### Tab 2: Executive Summary

- **Stats Overview**: Totale prodotti, critici, attenzione, valore ordini
- **AI Summary**: Report sintetico generato da Claude
- **Rischi**: Lista rischi identificati
- **Opportunità**: Lista opportunità business

### Tab 3: Analisi Dettagliata

- Prodotti critici (rosso)
- Prodotti in attenzione (arancione)
- Reasoning AI per ogni prodotto

---

## 🔄 API Endpoints

### POST `/api/ordini-fornitori/analyze`

Esegue analisi completa AI.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-1234567890",
    "productsAnalyzed": 45,
    "criticalCount": 5,
    "warningCount": 12,
    "totalOrderValue": 12450.50,
    "duration": 85000,
    "aiAnalysis": {
      "executiveSummary": "...",
      "criticalProducts": [...],
      "warningProducts": [...],
      "overallRisks": [...],
      "overallOpportunities": [...]
    }
  }
}
```

### GET `/api/ordini-fornitori/cache`

Recupera ultima analisi (valida 1 ora).

### POST `/api/ordini-fornitori/cache`

Salva analisi in cache.

### DELETE `/api/ordini-fornitori/cache`

Cancella cache.

---

## ⚙️ Configurazione Avanzata

### Modifica Parametri AI

In `lib/ai/claude-service.ts`:

```typescript
// Modello AI
private model = 'claude-3-5-sonnet-20241022';

// Token massimi risposta
private maxTokens = 4096;

// Temperatura (0-1, più basso = più deterministico)
temperature: 0.3
```

### Modifica Caricamento Dati

In `lib/ai/autonomous-agent.ts`:

```typescript
// Giorni storico vendite
async loadProductSalesHistory(productId: number, days: number = 60)

// Soglia minima vendite per includere prodotto
await loadProductsForAnalysis(minSalesThreshold: number = 1)
```

### Modifica Cache Duration

In `app/api/ordini-fornitori/cache/route.ts`:

```typescript
const CACHE_DURATION = 1000 * 60 * 60; // 1 ora (modificabile)
```

---

## 🔧 Troubleshooting

### Errore: "ANTHROPIC_API_KEY non trovata"

**Soluzione:**
1. Verifica `.env.local` contenga `ANTHROPIC_API_KEY=sk-ant-...`
2. Riavvia server dev: `npm run dev`

### Errore: "Nessun prodotto trovato"

**Cause possibili:**
- Nessuna vendita negli ultimi 60 giorni
- Prodotti non configurati in Odoo
- Errore connessione Odoo

**Soluzione:**
1. Verifica configurazione Odoo in `.env.local`
2. Controlla console per errori dettagliati
3. Abbassa soglia: `minSalesThreshold = 0`

### Analisi lenta (> 2 min)

**Cause:**
- Troppi prodotti da analizzare (> 50)
- API Anthropic rate limiting

**Soluzioni:**
1. Aumenta soglia minima vendite
2. Riduci batch size in `autonomous-agent.ts`:
```typescript
const batchSize = 3; // invece di 5
```

### Prezzi prodotti = 0

**Causa:** Fornitore non configurato in Odoo

**Soluzione:**
1. In Odoo: Prodotto → Acquisti → Fornitori
2. Aggiungi fornitore con prezzo

---

## 📈 Performance

### Metriche Tipiche

- **Analisi 50 prodotti**: ~60-90 secondi
- **Singolo prodotto**: ~1-2 secondi
- **Cache hit**: istantaneo
- **API calls Anthropic**: 1 per prodotto + 1 per summary

### Ottimizzazioni

1. **Cache**: Risultati validi 1 ora
2. **Batch Processing**: Max 5 prodotti in parallelo
3. **Threshold**: Solo prodotti con vendite > soglia

---

## 🎓 Best Practices

### Quando Rieseguire Analisi

- **Ogni mattina**: Per ordini giornata
- **Dopo grandi ordini**: Per aggiornare stock
- **Fine settimana**: Per pianificazione settimanale
- **Mai**: Durante orario punta ordini

### Come Interpretare Risultati

**Confidenza Alta (> 80%):**
- Vendite stabili e prevedibili
- Storico sufficiente
- Pochi picchi anomali
→ Fidati della quantità AI

**Confidenza Media (60-80%):**
- Alcune variazioni vendite
- Storico parziale
→ Aggiungi 10-15% safety margin

**Confidenza Bassa (< 60%):**
- Vendite molto volatili
- Prodotto nuovo/poco venduto
- Anomalie rilevate
→ Valuta manualmente

### Gestione Anomalie

Se AI rileva anomalie:
1. Leggi dettaglio nel popup prodotto
2. Verifica cause (cliente grande, promo, stagionalità)
3. Aggiusta quantità manualmente se necessario

---

## 🚦 Roadmap Future

- [ ] Scheduling automatico analisi giornaliera (cron job)
- [ ] Creazione automatica ordini in Odoo
- [ ] Integrazione prezzi fornitori reali
- [ ] Notifiche email/Slack per ordini critici
- [ ] Dashboard mobile responsive
- [ ] Export Excel/PDF report
- [ ] Multi-language support
- [ ] Machine Learning model custom trainato su dati azienda

---

## 📞 Supporto

Per problemi o domande:
1. Controlla questa documentazione
2. Verifica console browser (F12)
3. Controlla logs server terminal

---

## 📄 Licenza

Proprietario LAPA - Uso Interno

---

**Sviluppato con Claude AI 🤖**

*Ultima modifica: Gennaio 2025*
