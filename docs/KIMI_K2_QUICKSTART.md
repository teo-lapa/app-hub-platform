# 🚀 Kimi K2 - Quick Start Guide

## In 3 Step: Dal Setup al Test

### Step 1: Verifica Setup ✅

La configurazione è già completa! Verifica che tutto sia a posto:

```bash
# Controlla che la chiave API sia nel file .env.local
cat .env.local | grep KIMI_K2
```

Dovresti vedere:
```
KIMI_K2_API_KEY=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
```

### Step 2: Avvia il Server 🖥️

```bash
npm run dev
```

Il server parte su: `http://localhost:3000`

### Step 3: Prova il Lettore PDF 📄

Apri il browser e vai su:

```
http://localhost:3000/pdf-analyzer
```

## 🎯 Cosa Puoi Fare

### 1. Test con l'Interfaccia Web

1. Vai su `/pdf-analyzer`
2. Carica un PDF (fattura, ordine, etc.)
3. Clicca "Analizza"
4. Vedi i risultati!

### 2. Test via API

```bash
# Test service status
curl http://localhost:3000/api/ai/analyze-pdf

# Upload PDF (sostituisci con il tuo file)
curl -X POST http://localhost:3000/api/ai/analyze-pdf \
  -F "file=@/path/to/your/invoice.pdf"
```

### 3. Test Programmatico

Crea un file `test.ts`:

```typescript
import { createKimiK2Client } from './lib/ai/kimi-k2-client';

const client = createKimiK2Client('sk-or-v1-...');

const response = await client.complete(
  'Ciao Kimi K2! Dimmi qualcosa di interessante sull\'AI',
  undefined,
  { maxTokens: 200 }
);

console.log(response);
```

## 📦 File Creati

Tutti i file sono pronti e funzionanti:

```
✅ lib/ai/kimi-k2-config.ts           - Configurazione
✅ lib/ai/kimi-k2-client.ts           - Client API
✅ lib/ai/document-classifier.ts      - Classificatore
✅ lib/utils/pdf-extractor.ts         - Estrattore PDF
✅ app/api/ai/analyze-pdf/route.ts    - API endpoint
✅ app/api/ai/classify-document/route.ts - API classificazione
✅ app/pdf-analyzer/page.tsx          - UI Web
✅ scripts/test-kimi-k2.ts            - Script di test
✅ .env.local                         - API key configurata
```

## 🎨 Demo Rapida

### Esempio 1: Classificare Testo

```typescript
import { createDocumentClassifier } from '@/lib/ai/document-classifier';

const classifier = createDocumentClassifier();

const invoice = `
FATTURA N. 2025/001
Fornitore: LAPA Food SA
Cliente: Ristorante Mario
Totale: €1,234.56
`;

const result = await classifier.classifyFromText(invoice);

console.log(result.typeName);  // "Fattura"
console.log(result.confidence); // 95
console.log(result.details.amount); // 1234.56
```

### Esempio 2: Analisi Dati

```typescript
import { createKimiK2Client } from '@/lib/ai/kimi-k2-client';

const client = createKimiK2Client();

const analysis = await client.analyzeData(
  JSON.stringify(salesData),
  'Quali sono i prodotti più venduti questo mese?',
  'json'
);

console.log(analysis);
```

### Esempio 3: Code Review

```typescript
const review = await client.reviewCode(
  yourCodeString,
  'typescript',
  'E-commerce checkout flow'
);

console.log(review.summary);
console.log(review.issues);
console.log(review.suggestions);
```

## 🔥 Caratteristiche Potenti

- 🧠 **1 Trilione di parametri**
- 📚 **256K token di contesto** (documenti lunghissimi)
- ⚡ **Veloce ed economico** (€0.14/M tokens input)
- 🎯 **Accurato** (65.8% su SWE-Bench vs 54.6% GPT-4.1)
- 🆓 **Versione FREE** disponibile via OpenRouter

## 🐛 Troubleshooting

### Problema: API key non funziona
```bash
# Verifica che sia impostata correttamente
echo $KIMI_K2_API_KEY
```

### Problema: Errore 500 dall'API
- Controlla i log del server
- Verifica che il testo non sia troppo lungo (max ~10K chars)
- Controlla che l'API key sia valida su OpenRouter

### Problema: Classificazione errata
- Fornisci più contesto nel testo
- Usa il metodo `classifyFromText()` invece di `quickDetect()`
- Migliora il prompt system nel classifier

## 📞 Link Utili

- **OpenRouter Dashboard**: https://openrouter.ai/keys
- **Kimi K2 Model Info**: https://openrouter.ai/moonshotai/kimi-k2
- **API Docs**: Vedi `KIMI_K2_README.md`

## 🚀 Prossimi Passi

1. ✅ Testa con PDF reali
2. 📊 Integra nei tuoi workflow
3. 🎯 Personalizza i prompt per i tuoi casi d'uso
4. 🔄 Aggiungi feedback loop per migliorare accuracy

---

**Fatto!** Kimi K2 è pronto all'uso! 🎉
