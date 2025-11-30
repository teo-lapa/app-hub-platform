# Kimi K2 Integration - Lettore Intelligente PDF

## 🚀 Overview

Integrazione di **Kimi K2**, il potente modello AI cinese con 1 trilione di parametri, per la classificazione automatica di documenti (fatture, ordini, ricevute, etc.) tramite analisi intelligente.

## 📊 Kimi K2 - Caratteristiche

- **1 trilione di parametri** (architettura MoE - Mixture of Experts)
- **256K token** di contesto
- **Performance superiori** su coding tasks (65.8% su SWE-Bench vs 54.6% GPT-4.1)
- **Costo ridotto**: ~€0.14/M input tokens, ~€2.30/M output tokens
- Accesso via **OpenRouter** (versione gratuita disponibile)

## 🔧 Setup

### 1. Variabili d'Ambiente

Aggiungi al tuo `.env.local`:

```env
KIMI_K2_API_KEY=sk-or-v1-your-api-key-here
```

### 2. Installazione

Tutte le dipendenze necessarie sono già incluse nel progetto:
- `pdf-lib` - Gestione PDF
- SDK TypeScript custom per Kimi K2

## 📁 Struttura dei File

```
lib/ai/
├── kimi-k2-config.ts         # Configurazione e tipi
├── kimi-k2-client.ts         # Client API per Kimi K2
└── document-classifier.ts    # Classificatore documenti

lib/utils/
└── pdf-extractor.ts          # Estrattore testo da PDF

app/api/ai/
├── classify-document/        # Endpoint classificazione
└── analyze-pdf/              # Endpoint analisi PDF completa

app/pdf-analyzer/
└── page.tsx                  # UI Lettore PDF

scripts/
└── test-kimi-k2.ts          # Script di test
```

## 🎯 Funzionalità

### Classificazione Documenti

Il sistema riconosce automaticamente:

- ✅ **Fatture** (invoice)
- ✅ **Ordini di Acquisto** (purchase_order)
- ✅ **Ordini di Vendita** (sales_order)
- ✅ **Ricevute/Scontrini** (receipt)
- ✅ **Documenti di Trasporto** (delivery_note / DDT)
- ✅ **Preventivi** (quote)
- ✅ **Contratti** (contract)
- ✅ **Bollettini di Pagamento** (payment_slip)
- ✅ **Documenti Fiscali** (tax_document)
- ✅ **Foto generiche** (photo)

### Estrazione Dati

Per ogni documento, estrae:

- 🏢 Fornitore/Cliente
- 🔢 Numero documento
- 📅 Data
- 💰 Importo totale e valuta
- 📦 Righe prodotti (descrizione, quantità, prezzo, totale)

## 🔌 API Endpoints

### POST /api/ai/analyze-pdf

Analizza un file PDF caricato.

**Request:**
```typescript
FormData {
  file: File (PDF, max 10MB)
}
```

**Response:**
```typescript
{
  success: true,
  file: {
    name: string,
    size: number,
    type: string
  },
  extractedText: string,
  classification: {
    type: DocumentType,
    confidence: number,
    typeName: string,
    details: {
      supplier?: string,
      customer?: string,
      number?: string,
      date?: string,
      amount?: number,
      currency?: string,
      items?: Array<{...}>
    },
    rawAnalysis: string
  },
  timestamp: string
}
```

### POST /api/ai/classify-document

Classifica testo estratto o immagine base64.

**Request:**
```typescript
{
  content: string,
  contentType: 'text' | 'pdf' | 'image',
  mimeType?: string
}
```

## 💻 Utilizzo UI

### Lettore PDF Intelligente

Accedi a: `/pdf-analyzer`

1. **Carica** un file PDF o immagine
2. **Clicca** su "Analizza"
3. **Visualizza** il tipo di documento e i dati estratti

L'interfaccia mostra:
- Badge colorato con tipo documento
- Livello di confidenza
- Dettagli estratti in card separate
- Tabella prodotti (se presenti)
- Analisi completa (espandibile)

## 🧪 Testing

### Script di Test

Esegui lo script di test per verificare l'integrazione:

```bash
npx ts-node scripts/test-kimi-k2.ts
```

Lo script testa:
1. ✅ Completamento semplice
2. ✅ Classificazione fattura
3. ✅ Classificazione ordine
4. ✅ Quick detection
5. ✅ Code review

### Test Manuale

Puoi testare manualmente gli endpoint:

```bash
# Test service status
curl http://localhost:3000/api/ai/analyze-pdf

# Upload e analizza PDF
curl -X POST http://localhost:3000/api/ai/analyze-pdf \
  -F "file=@path/to/invoice.pdf"
```

## 📚 Esempi di Codice

### Client JavaScript

```typescript
import { createKimiK2Client } from '@/lib/ai/kimi-k2-client';

const client = createKimiK2Client(apiKey);

// Simple completion
const response = await client.complete(
  'Analizza questo testo...',
  'Sei un esperto analista',
  { maxTokens: 1024 }
);

// Code review
const review = await client.reviewCode(
  codeString,
  'typescript',
  'Context info'
);

// Data analysis
const analysis = await client.analyzeData(
  jsonData,
  'Quali sono i trend?',
  'json'
);
```

### Document Classifier

```typescript
import { createDocumentClassifier } from '@/lib/ai/document-classifier';

const classifier = createDocumentClassifier(apiKey);

// Classificazione completa
const result = await classifier.classifyFromText(documentText);

// Quick detection (keyword-based)
const quick = await classifier.quickDetect(documentText);
```

## 🎨 Personalizzazione

### Aggiungere Nuovi Tipi di Documento

1. Aggiorna il tipo `DocumentType` in `document-classifier.ts`
2. Aggiungi il nome italiano in `DOCUMENT_TYPE_NAMES`
3. Aggiungi il colore in `DOCUMENT_TYPE_COLORS` (UI)
4. Aggiorna il prompt system del classificatore

### Modificare i Prompt

I prompt per la classificazione si trovano in:
- `document-classifier.ts` → metodo `classifyFromText()`

Puoi personalizzare il sistema per:
- Estrarre campi specifici
- Migliorare l'accuratezza per certi tipi
- Supportare altre lingue

## 🚀 Deploy su Vercel

Le variabili d'ambiente sono già configurate localmente. Per il deploy:

1. Aggiungi `KIMI_K2_API_KEY` nelle Environment Variables Vercel
2. Deploy normalmente: `vercel --prod`

## 💡 Casi d'Uso

1. **Validazione Fatture**: Carica fatture e verifica automaticamente i dati
2. **Gestione Ordini**: Identifica ordini e estrai le righe prodotto
3. **Archiviazione Intelligente**: Classifica automaticamente documenti in arrivo
4. **Controllo DDT**: Verifica documenti di trasporto
5. **Analisi Ricevute**: Estrai dati da scontrini e ricevute

## 🔒 Sicurezza

- Max file size: **10MB**
- File types: **PDF** e **immagini**
- API key protetta via environment variables
- Validazione server-side di tutti gli input

## 📈 Performance

- Tempo medio classificazione: **2-5 secondi**
- Context window: **256K token** (documenti molto lunghi)
- Cost per classificazione: **~€0.001-0.01** (molto economico)

## 🤝 Contributi

Per migliorare l'integrazione:
1. Testa con documenti reali
2. Raccogli feedback sugli errori di classificazione
3. Migliora i prompt per casi specifici
4. Aggiungi nuovi tipi di documento

## 📞 Supporto

Per problemi con:
- **Kimi K2 API**: Controlla [OpenRouter Docs](https://openrouter.ai)
- **Integrazione**: Vedi log in console/network tab
- **Classificazione errata**: Migliora i prompt o aggiungi esempi

---

**Powered by Kimi K2** 🇨🇳 - Il futuro dell'AI per documenti è qui!
