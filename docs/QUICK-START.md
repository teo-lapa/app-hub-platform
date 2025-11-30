# Contact Enrichment Pipeline - Quick Start Guide

## Cos'è?

Sistema completo per **trasformare qualsiasi documento aziendale in contatti Odoo arricchiti**:

- Scansioni **biglietti da visita, fatture, scontrini** → Dati estratti con AI
- Cerca azienda su **Moneyhouse.ch** → Dati legali completi + proprietari
- Verifica **rating creditizio** → Buoni/cattivi pagatori automatico
- Crea **contatti multipli in Odoo** → Azienda + proprietari + persona originale

**Tutto automatico in 4-7 secondi!**

---

## Test Rapido (5 minuti)

### Step 1: Verifica Odoo Connection

```bash
python3 -c "
import xmlrpc.client, ssl
ssl._create_default_https_context = ssl._create_unverified_context

common = xmlrpc.client.ServerProxy('https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/xmlrpc/2/common')
uid = common.authenticate('lapadevadmin-lapa-v2-main-7268478', 'apphubplatform@lapa.ch', 'apphubplatform2025', {})

print(f'OK! UID: {uid}')
"
```

Se vedi `OK! UID: 430` → Odoo funziona!

### Step 2: Test Odoo Client Script

```bash
cd jetson-deployment/server

export ODOO_URL="https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com"
export ODOO_DB="lapadevadmin-lapa-v2-main-7268478"
export ODOO_USERNAME="apphubplatform@lapa.ch"
export ODOO_PASSWORD="apphubplatform2025"

python3 odoo-client.py create_partner '{"name": "Test Quick Start", "email": "test@example.com"}'
```

Output atteso:
```json
{
  "success": true,
  "partner_id": 10222,
  "partner": {
    "id": 10222,
    "name": "Test Quick Start",
    "display_name": "Test Quick Start",
    "email": "test@example.com"
  }
}
```

### Step 3: Avvia Jetson Server

```bash
cd jetson-deployment/server

# Installa dipendenze (prima volta)
npm install

# Avvia server
node index.js
```

Output atteso:
```
🚀 Jetson OCR Server running on port 3100
📍 Health check: http://localhost:3100/api/v1/health
📊 Metrics: http://localhost:3100/api/v1/metrics
```

### Step 4: Test Jetson Endpoint

```bash
curl -X POST http://10.0.0.108:3100/api/v1/odoo/create-contact \
  -H "Content-Type: application/json" \
  -d '{
    "partner": {
      "name": "Test Jetson",
      "email": "jetson@example.com",
      "phone": "+41 79 123 45 67"
    }
  }'
```

Output atteso:
```json
{
  "success": true,
  "partner_id": 10223,
  "partner": {
    "id": 10223,
    "name": "Test Jetson",
    "display_name": "Test Jetson",
    "email": "jetson@example.com",
    "phone": "+41 79 123 45 67"
  }
}
```

### Step 5: Test Pipeline Completa (con immagine)

```bash
node test-pipeline-complete.js
```

Output atteso:
```
================================================================================
TEST 1: Odoo Python Client (Direct)
================================================================================
[OK] Authentication successful - UID: 430
[OK] Partner created - ID: 10224
[OK] Partner read back:
  Name: Test Pipeline Complete
  ...

✓✓✓ ALL TESTS PASSED! ✓✓✓
```

---

## Deploy su Vercel

### Configurazione Env Variables

Nel Vercel dashboard, aggiungi:

```bash
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key-here
JETSON_URL=http://10.0.0.108:3100

# (Optional - per override)
ODOO_URL=https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
ODOO_DB=lapadevadmin-lapa-v2-main-7268478
ODOO_USERNAME=apphubplatform@lapa.ch
ODOO_PASSWORD=apphubplatform2025
```

### Deploy

```bash
# Commit codice
git add .
git commit -m "feat: Contact Enrichment Pipeline complete"
git push origin staging

# Vercel auto-deploy su staging branch
# Aspetta deploy...
```

### Test API su Vercel

```bash
curl -X POST https://your-app.vercel.app/api/scan-contatto-complete \
  -F "file=@test-business-card-real.jpg"
```

---

## Uso Frontend

### React Component Esempio

```typescript
async function scanBusinessCard(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/scan-contatto-complete', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (result.success) {
    console.log('Company created:', result.odooResult.company_id);
    console.log('Owners created:', result.odooResult.owners.length);
    console.log('Contact created:', result.odooResult.contact);

    // Show rating
    if (result.moneyhouseData?.financial) {
      const { creditRating, paymentBehavior } = result.moneyhouseData.financial;
      console.log(`Rating: ${creditRating}, Pagatori: ${paymentBehavior}`);
    }
  }
}
```

### File Input

```tsx
<input
  type="file"
  accept="image/*"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await scanBusinessCard(file);
    }
  }}
/>
```

---

## Troubleshooting

### "Jetson unreachable"

```bash
# Verifica IP Jetson
ping 10.0.0.108

# Verifica server running
curl http://10.0.0.108:3100/api/v1/health
```

### "Odoo authentication failed"

```bash
# Test credenziali
python3 -c "import xmlrpc.client, ssl; ..."
```

### "Gemini API error"

```bash
# Verifica API key
echo $GEMINI_API_KEY

# Test API
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY"
```

---

## Files Chiave

```
app/
├── api/
│   └── scan-contatto-complete/
│       └── route.ts          # Endpoint principale pipeline

lib/
├── services/
│   ├── gemini-vision.ts       # OCR Gemini
│   └── moneyhouse-scraper.ts  # Web scraping

jetson-deployment/
└── server/
    ├── index.js               # Server Express
    └── odoo-client.py         # Python Odoo client

test-pipeline-complete.js       # Test suite completa
CONTACT-ENRICHMENT-PIPELINE.md  # Documentazione completa
```

---

## Next Steps

1. ✅ Test locale completo
2. ⏳ Deploy su Vercel
3. ⏳ Test con documenti reali
4. ⏳ Integrazione frontend UI
5. ⏳ Monitoring e analytics

---

## Supporto

Documentazione completa: [CONTACT-ENRICHMENT-PIPELINE.md](./CONTACT-ENRICHMENT-PIPELINE.md)

Test ID creato: **10221** ([Vedi in Odoo](https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=10221&model=res.partner))
