# Architettura Deployment: Sistema OCR + Classificazione Documenti

## Panoramica

Sistema ibrido per classificazione automatica documenti PDF con:
- **OCR su Jetson Nano** (GPU-accelerated, locale)
- **Classificazione AI con Kimi K2** (cloud, via OpenRouter)
- **Integrazione Odoo** (webhook-based)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUSSO DOCUMENTI                         │
└─────────────────────────────────────────────────────────────────┘

1. UPLOAD DOCUMENTO
   ↓
2. ODOO → Webhook → Jetson OCR Server (http://jetson-nano.local:3100)
   ↓
3. Jetson: PDF → Tesseract OCR → Testo estratto
   ↓
4. Jetson → Kimi K2 API (OpenRouter) → Classificazione
   ↓
5. Jetson → Odoo Webhook Response → Risultato
   ↓
6. ODOO: Documento classificato + dati estratti
```

---

## Componenti Sistema

### 1. JETSON NANO (OCR Server)

**Hardware:**
- NVIDIA Jetson Orin Nano Developer Kit
- 2TB storage
- GPU per accelerazione Tesseract OCR

**Software Stack:**
- Ubuntu 20.04 (JetPack)
- Docker + Docker Compose
- Node.js 20 LTS
- Tesseract OCR 5.x (con supporto GPU)
- nginx (reverse proxy)

**Servizi:**
```
jetson-ocr-server/
├── Dockerfile                 # Container per OCR service
├── docker-compose.yml         # Orchestrazione servizi
├── server/
│   ├── index.js              # Express API server
│   ├── ocr.js                # Tesseract OCR wrapper
│   ├── classifier.js         # Kimi K2 integration
│   └── queue.js              # Job queue per batch
├── config/
│   ├── tesseract.conf        # Configurazione OCR
│   └── nginx.conf            # Reverse proxy config
└── storage/
    ├── uploads/              # PDF temporanei
    ├── processed/            # Documenti processati
    └── cache/                # Cache risultati (Redis)
```

**Endpoints API:**
```
POST /api/v1/ocr/analyze           # Singolo documento
POST /api/v1/ocr/batch             # Batch documenti (5-10)
GET  /api/v1/ocr/status/:jobId     # Status job
GET  /api/v1/health                # Health check
GET  /api/v1/metrics               # Metriche performance
```

---

### 2. KIMI K2 CLOUD API

**Provider:** OpenRouter (https://openrouter.ai)
**Modello:** `moonshotai/kimi-k2` (paid, no privacy issues)
**Funzione:** Classificazione documenti + estrazione dati strutturati

**Costo stimato:**
- ~$0.50 per 1000 documenti
- Con 2TB storage, puoi processare milioni di documenti

---

### 3. ODOO INTEGRATION

**Architettura:**
```python
# Odoo Custom Module: document_classifier

class DocumentClassifier(models.Model):
    _name = 'document.classifier'

    def classify_attachment(self, attachment_id):
        """Invia PDF a Jetson OCR Server per classificazione"""

        attachment = self.env['ir.attachment'].browse(attachment_id)
        pdf_data = base64.b64decode(attachment.datas)

        # Call Jetson API
        response = requests.post(
            'http://jetson-nano.local:3100/api/v1/ocr/analyze',
            files={'file': pdf_data},
            json={'extract_details': True}
        )

        result = response.json()

        # Update Odoo record con classificazione
        return {
            'document_type': result['type'],
            'supplier': result['details'].get('supplier'),
            'invoice_number': result['details'].get('number'),
            'date': result['details'].get('date'),
            'amount': result['details'].get('amount'),
            'currency': result['details'].get('currency'),
            'line_items': result['details'].get('items', [])
        }
```

**Workflow Odoo:**

1. **Upload documento** → Trigger classificazione automatica
2. **Arrivi merce** → OCR estrae numero ordine fornitore
3. **Fatture** → Estrae importo, IVA, scadenza per controllo
4. **Ordini clienti** → Estrae prodotti ordinati

---

## Setup Jetson Nano

### Step 1: Preparazione Hardware

```bash
# SSH nel Jetson Nano
ssh jetson@jetson-nano.local

# Update sistema
sudo apt update && sudo apt upgrade -y

# Installa Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Installa Docker Compose
sudo apt install docker-compose -y

# Verifica GPU
sudo nvidia-smi
```

### Step 2: Installazione Tesseract con GPU

```bash
# Installa Tesseract da source con CUDA support
sudo apt install -y automake ca-certificates \
    g++ git libtool libleptonica-dev make pkg-config

git clone https://github.com/tesseract-ocr/tesseract.git
cd tesseract
./autogen.sh
./configure --with-extra-includes=/usr/local/cuda/include \
            --with-extra-libraries=/usr/local/cuda/lib64
make -j4
sudo make install
sudo ldconfig

# Download language data (Italiano + Inglese)
cd /usr/local/share/tessdata
sudo wget https://github.com/tesseract-ocr/tessdata/raw/main/ita.traineddata
sudo wget https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata
```

### Step 3: Deploy OCR Service

```bash
# Clone repository
git clone https://github.com/your-repo/app-hub-platform.git
cd app-hub-platform/jetson-deployment

# Configurazione
cp .env.example .env
nano .env
# KIMI_K2_API_KEY=sk-or-v1-...
# ODOO_WEBHOOK_SECRET=your-secret-key
# MAX_CONCURRENT_JOBS=4

# Build & Run
docker-compose up -d

# Verifica logs
docker-compose logs -f ocr-server
```

---

## Performance & Scalabilità

### Benchmark Attesi (Jetson Orin Nano)

- **Tesseract OCR**: ~2-3 secondi/pagina (con GPU)
- **Kimi K2 API**: ~1-2 secondi/documento
- **Totale**: ~5 secondi per fattura 1-2 pagine

**Throughput:**
- Singolo documento: 5 sec
- Batch 10 documenti: ~30 sec (parallelizzazione)
- **Capacità giornaliera**: ~10.000 documenti/giorno (con queue)

### Storage (2TB disponibili)

```
├── PDF originali:        ~500GB (1M documenti @ 500KB avg)
├── Cache OCR:            ~100GB (testi estratti)
├── Database risultati:   ~50GB (classificazioni + metadati)
├── Logs & monitoring:    ~10GB
└── Spazio libero:        ~1.3TB
```

---

## Sicurezza

1. **Network:** Jetson in LAN privata, esposto solo a Odoo server
2. **Authentication:** Webhook secret key per validare richieste Odoo
3. **Encryption:** HTTPS con certificato self-signed per LAN
4. **Data retention:** Auto-cleanup PDF dopo 30 giorni (configurable)

---

## Monitoring

### Grafana Dashboard

Metriche da monitorare:
- Documenti processati/ora
- Tempo medio OCR
- Accuracy classificazione (%)
- GPU usage
- Storage usage
- Error rate

### Alerts

- GPU temperature > 80°C
- Storage > 80%
- Error rate > 5%
- Queue backlog > 100 documenti

---

## Backup & Disaster Recovery

```bash
# Backup automatico giornaliero (cron job)
0 2 * * * /home/jetson/backup-ocr-data.sh

# Script backup
#!/bin/bash
tar czf /mnt/backup/ocr-$(date +%Y%m%d).tar.gz \
    /opt/ocr-server/storage/processed \
    /opt/ocr-server/database
```

---

## Costi Operativi

### One-time:
- Jetson Orin Nano: €499 (già acquistato ✓)
- 2TB SSD: (già disponibile ✓)
- Setup & development: 0€ (fatto da noi!)

### Mensili:
- Kimi K2 API: ~€5-20/mese (dipende da volume)
- Elettricità Jetson: ~€2-3/mese (~10W)
- **Totale: ~€10-25/mese**

**ROI:** Con 1 ora risparmiata/giorno = ~€400/mese di valore
→ Ritorno investimento in < 2 mesi!

---

## Next Steps

1. ✅ Setup Jetson Nano con Docker
2. ✅ Deploy OCR Server
3. ✅ Test con PDF reali (tamburro1241lapa.pdf)
4. ✅ Creare modulo Odoo custom
5. ✅ Test integration Odoo → Jetson → Odoo
6. ✅ Deploy in produzione
7. ✅ Training team su utilizzo

---

## Support & Maintenance

- **Aggiornamenti:** Mensili (Docker pull + restart)
- **Monitoring:** Dashboard Grafana
- **Logs:** Retention 90 giorni
- **Support:** documentazione + runbook operativo
