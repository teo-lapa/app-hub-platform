# Contact Classifier Service

Servizio di estrazione dati contatti da biglietti visita, fatture e documenti commerciali utilizzando Llama 3.2 3B in locale.

## Caratteristiche

- **Estrazione contatti intelligente** via Ollama Llama 3.2 3B
- **Fallback keyword-based** se Llama non disponibile
- **Campi estratti**:
  - Nome, cognome, nome completo
  - Azienda/Società
  - Posizione/Titolo
  - Email (multiple)
  - Telefono/Cellulare (multiple, con formatting)
  - FAX
  - Sito web
  - Indirizzo completo (via, città, CAP, paese)
  - Partita IVA (sanitizzata)
  - Codice Fiscale

- **Output JSON strutturato** compatibile con `contact-scan.ts`
- **Sanitizzazione dati** automatica (spazi da P.IVA, formatting telefoni, etc.)
- **Confidence levels** per ogni campo estratto
- **Tracciamento campi estratti** per quality assurance

## Configurazione

### Prerequisiti

```bash
# Assicurati che Ollama sia installato e in esecuzione
sudo systemctl start ollama

# Scarica il modello Llama 3.2 3B
ollama pull llama3.2:3b

# Verifica modello disponibile
curl http://localhost:11434/api/tags
```

### Variabili d'ambiente

```bash
# .env
OLLAMA_URL=http://localhost:11434          # URL Ollama (default)
OLLAMA_MODEL=llama3.2:3b                   # Modello (default)
```

## Utilizzo

### Inizializzazione

```javascript
const contactClassifier = require('./jetson-deployment/server/contact-classifier.js');

// Inizializza una volta all'avvio dell'app
await contactClassifier.initialize();
console.log('Contact Classifier ready');
```

### Estrazione contatti

```javascript
// Testo OCR estratto da documento
const ocrText = `
ACME Corporation S.r.l.
Via Milano 123, 20100 Milano, Italia

Sig. Marco Rossi
Direttore Vendite

Email: marco.rossi@acme.it
Cellulare: +39 334 123 4567
Telefono: 02 1234 5678
Fax: 02 1234 5679
Sito: www.acme.it

Partita IVA: 01 234 567 890
Codice Fiscale: RSSMRC80A01H501Q
`;

// Estrai contatti
const result = await contactClassifier.extractContact(ocrText);

console.log(result);
// Output:
// {
//   displayName: "Marco Rossi",
//   firstName: "Marco",
//   lastName: "Rossi",
//   companyName: "ACME Corporation S.r.l.",
//   jobTitle: "Direttore Vendite",
//   emails: [
//     {
//       value: "marco.rossi@acme.it",
//       type: "work",
//       confidence: "high"
//     }
//   ],
//   phones: [
//     {
//       value: "+39 334 123 4567",
//       formatted: "+393341234567",
//       type: "mobile",
//       countryCode: "IT",
//       confidence: "high"
//     },
//     {
//       value: "02 1234 5678",
//       formatted: "+390212345678",
//       type: "landline",
//       countryCode: "IT",
//       confidence: "high"
//     }
//   ],
//   address: {
//     fullAddress: "Via Milano 123, 20100 Milano, Italia",
//     street: "Via Milano 123",
//     city: "Milano",
//     postalCode: "20100",
//     country: "Italia",
//     confidence: "high"
//   },
//   website: "www.acme.it",
//   taxIdentifiers: {
//     vatId: "01234567890",
//     fiscalCode: "RSSMRC80A01H501Q",
//     confidence: "high"
//   },
//   confidence: 95,
//   extractedFields: ["displayName", "companyName", "jobTitle", "emails", "phones", "address", "website", "vatId", "fiscalCode"],
//   duration: 2345  // milliseconds
// }
```

### Estrazione per Odoo

```javascript
// Estrai direttamente in formato Odoo res.partner
const odooData = await contactClassifier.extractForOdoo(ocrText);

console.log(odooData);
// Output:
// {
//   name: "ACME Corporation S.r.l.",
//   email: "marco.rossi@acme.it",
//   phone: "02 1234 5678",
//   mobile: "+39 334 123 4567",
//   fax: "02 1234 5679",
//   website: "www.acme.it",
//   vat: "01234567890",     // Sanitizzato (no spaces)
//   street: "Via Milano 123",
//   city: "Milano",
//   zip: "20100",
//   country: "Italia",
//   isCompany: true,
//   comment: undefined
// }

// Usa direttamente in Odoo
const partnerId = await odoo.create('res.partner', odooData);
```

### Chat interattivo

```javascript
// Chiedi domande sul documento
const conversation = [];

let result = await contactClassifier.chat(
  'Qual è il nome della persona di contatto?',
  conversation
);

console.log(result.message);
console.log(result.conversation);  // Traccia conversazione
```

### Domande sul contatto/documento

```javascript
// Fai domande specifiche
const answer = await contactClassifier.askContact(
  ocrText,
  'Qual è l\'indirizzo di fatturazione principale?'
);

console.log(answer);
// Output:
// {
//   answer: "Via Milano 123, 20100 Milano, Italia",
//   confidence: 85
// }
```

## Struttura Output

### ExtractedContact (Formato standard)

```typescript
{
  // Dati personali
  firstName?: string;
  lastName?: string;
  displayName: string;          // REQUIRED
  jobTitle?: string;
  department?: string;

  // Dati azienda
  companyName?: string;
  companyAliases?: string[];

  // Contatti
  emails: PhoneNumber[];
  phones: EmailAddress[];
  address?: PostalAddress;
  website?: string;

  // Identificatori fiscali
  taxIdentifiers?: TaxIdentifier;

  // Metadati
  sourceDocument?: string;
  notes?: string;
  detectedLanguage?: string;
  rawText?: string;
  extractedAt: string;          // ISO 8601
}
```

### PhoneNumber

```javascript
{
  value: "+39 334 123 4567",    // Raw value
  formatted: "+393341234567",   // Cleaned
  type: "mobile",               // mobile|landline|fax|whatsapp|other
  countryCode: "IT",
  confidence: "high"            // high|medium|low
}
```

### EmailAddress

```javascript
{
  value: "email@example.com",
  type: "work",                 // work|personal|other
  confidence: "high",
  verified?: boolean
}
```

### PostalAddress

```javascript
{
  fullAddress: "Via Milano 123, 20100 Milano, Italia",
  street?: "Via Milano 123",
  city?: "Milano",
  state?: undefined,
  postalCode?: "20100",
  country?: "Italia",
  type?: "billing",             // billing|shipping|residential|other
  latitude?: undefined,
  longitude?: undefined,
  confidence: "high"
}
```

### TaxIdentifier

```javascript
{
  vatId?: "01234567890",        // Partita IVA (no spaces)
  fiscalCode?: "RSSMRC80A01H501Q",  // Codice Fiscale
  vatCountry?: "IT",
  businessRegistrationNumber?: undefined,
  companyRegistrationNumber?: undefined,
  confidence: "high"
}
```

## Fallback Keyword Extraction

Se Ollama non è disponibile o fallisce, il servizio usa estrazione keyword-based:

```javascript
// Usa regex per:
// - Email: [a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
// - Telefono: numeri italiani (02, 3xx, +39)
// - P.IVA: 11 cifre raggruppate
// - Nome azienda: dopo keywords come "Azienda:", "Società:"
// - Nome persona: prime righe di testo non numeriche

const result = await contactClassifier.extractContact(ocrText);
console.log(result.method);  // 'quick-keywords' se fallback usato
console.log(result.error);   // Motivo del fallback
```

## Sanitizzazione Dati

Il servizio sanitizza automaticamente:

```javascript
// Partita IVA
"01 234 567 890"  →  "01234567890"
"IT01234567890"   →  "01234567890"
"01-234-567-890"  →  "01234567890"

// Telefoni
"+39 02 1234 5678"        →  "+390212345678"
"02 1234 5678"            →  "+390212345678"  (added +39)
"+39 (0) 2 1234.5678"     →  "+390212345678"
"334 123 4567"            →  "+39334123456"   (Italian mobile)

// Email
"Marco.Rossi@ACME.IT"     →  "marco.rossi@acme.it"
"  email@example.com  "   →  "email@example.com"

// Codice Fiscale
"RSSMRC 80 A 01 H 501 Q"  →  "RSSMRC80A01H501Q"
```

## Quality Metrics

Il servizio fornisce:

```javascript
{
  confidence: 95,                           // 0-100
  extractedFields: [                        // Campi estratti con successo
    "displayName",
    "companyName",
    "emails",
    "phones",
    "address",
    "vatId"
  ],
  duration: 2345,                           // Millisecondi
  method: undefined,                        // 'quick-keywords' se fallback
  error: undefined                          // Errore se occorso
}
```

## Integrazione Next.js API Route

```typescript
// app/api/contacts/extract/route.ts

import { NextRequest, NextResponse } from 'next/server';
import contactClassifier from '@/jetson-deployment/server/contact-classifier';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const result = await contactClassifier.extractContact(text);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Contact extraction failed:', error);

    return NextResponse.json(
      { error: 'Failed to extract contact' },
      { status: 500 }
    );
  }
}
```

## Troubleshooting

### Ollama non risponde

```bash
# Verifica che Ollama sia in esecuzione
curl http://localhost:11434/api/tags

# Se non risponde, riavvia
sudo systemctl restart ollama

# Verifica log
journalctl -u ollama -f
```

### Modello non trovato

```bash
# Lista modelli disponibili
ollama list

# Scarica modello
ollama pull llama3.2:3b

# Verifica download
curl http://localhost:11434/api/tags
```

### Estrazione scadente

- Aumenta temperature (più creativo) o abbassa (più conservativo)
- Controlla che testo OCR sia pulito (rimuovi caratteri speciali)
- Assicurati testo sia in italiano o lingua riconosciuta
- Usa `rawText` per debugging

### Timeout

- Aumenta `num_predict` se risposta incompleta
- Riduci text length (attualmente 6000 chars max)
- Verifica risorse Jetson (memoria, CPU)

## Performance

Tipici tempi di estrazione (Jetson Orin):
- Inizializzazione: 500ms
- Estrazione dati: 2-4 secondi
- Fallback keyword: 50-100ms

## Limiti

- Max 6000 caratteri di testo input (context size Llama 3.2 3B)
- Llama 3.2 3B richiede ~10GB RAM
- Meglio performance su Jetson Orin vs Jetson Nano
- Accuratezza dipende da qualità OCR input

## File Correlati

- `classifier-ollama.js` - Classificazione documenti
- `contact-scan.ts` - Type definitions complete
- `OLLAMA_QUICKSTART.md` - Setup Ollama
- `KIMI_K2_README.md` - Setup Kimi K2 OCR

## Changelog

### v1.0.0 (2025-11-17)
- Estrazione contatti completa (nome, azienda, P.IVA, email, telefono, indirizzo)
- Fallback keyword-based extraction
- Sanitizzazione automatica dati
- Formattazione telefoni italiani
- Estrazione per Odoo res.partner
- Chat e Q&A sul documento
- Full TypeScript compatibility
