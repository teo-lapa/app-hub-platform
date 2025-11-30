# 🦙 Guida Installazione Ollama + Llama 3.2 3B su Jetson Orin Nano

## 📋 Panoramica

Questa guida ti aiuta a configurare **Ollama** con **Llama 3.2 3B** sul tuo Jetson Orin Nano per classificazione documenti **100% locale e gratuita**.

### Vantaggi:
- ✅ **€0 di costi** - Nessuna API da pagare
- ✅ **Privacy totale** - I dati non escono dal Jetson
- ✅ **Nessun limite** - Puoi processare infiniti documenti
- ✅ **Velocità** - ~2-3 secondi per documento
- ✅ **Affidabilità** - Non dipendi da servizi cloud esterni

### Specifiche Tecniche:
- **Hardware:** Jetson Orin Nano (8GB RAM)
- **Modello AI:** Llama 3.2 3B (~2GB)
- **RAM libera richiesta:** ~3GB (dopo sistema + OCR)
- **Storage richiesto:** ~2.5GB

---

## 🚀 Installazione (5 minuti)

### Step 1: Connessione al Jetson

Dalla tua macchina Windows, connettiti al Jetson via SSH:

```bash
ssh jetson@jetson-nano.local
# Password: la tua password del Jetson
```

### Step 2: Copia i file sul Jetson

**Dal tuo PC Windows** (apri Git Bash o PowerShell):

```bash
# Naviga nella cartella del progetto
cd "C:\Users\lapa\Desktop\Claude Code\app-hub-platform"

# Copia i file sul Jetson
scp -r jetson-deployment jetson@jetson-nano.local:~/

# Verifica che i file siano stati copiati
ssh jetson@jetson-nano.local "ls -la ~/jetson-deployment"
```

### Step 3: Esegui lo script di installazione

**Sul Jetson** (via SSH):

```bash
cd ~/jetson-deployment

# Rendi eseguibile lo script
chmod +x install-ollama.sh

# Esegui l'installazione
./install-ollama.sh
```

Lo script installerà automaticamente:
1. ✅ Ollama
2. ✅ Llama 3.2 3B (~2GB download)
3. ✅ Configurazione autostart
4. ✅ Test del modello

**Tempo stimato:** 3-5 minuti (dipende dalla connessione internet)

### Step 4: Verifica l'installazione

```bash
# Verifica che Ollama sia attivo
sudo systemctl status ollama

# Dovresti vedere: "Active: active (running)"

# Testa il modello
ollama run llama3.2:3b "Ciao, come stai?"

# Dovresti ricevere una risposta in italiano
```

### Step 5: Configura l'ambiente

Crea/modifica il file `.env`:

```bash
cd ~/jetson-deployment
nano .env
```

Aggiungi queste righe (o modifica se già esistono):

```bash
# AI Classifier Configuration
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Opzionale: mantieni Kimi K2 come fallback
KIMI_K2_API_KEY=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

# Altre configurazioni
ODOO_WEBHOOK_SECRET=your-secure-secret-key
MAX_CONCURRENT_JOBS=4
OCR_LANGUAGE=ita+eng
LOG_LEVEL=info
```

Salva con **Ctrl+X**, poi **Y**, poi **Enter**.

### Step 6: Avvia i servizi Docker

```bash
# Ricostruisci e avvia i container
docker-compose up -d --build

# Verifica che tutto sia partito
docker-compose ps

# Dovresti vedere:
# - jetson-ocr-server (running)
# - jetson-redis (running)
# - jetson-nginx (running)
```

### Step 7: Verifica i log

```bash
# Guarda i log in tempo reale
docker-compose logs -f ocr-server

# Dovresti vedere:
# 🤖 AI Classifier: Ollama (Local)
# ✅ Classifier Service initialized with llama3.2:3b
```

Se vedi questi messaggi, **tutto funziona!** 🎉

---

## 🧪 Test del Sistema

### Test 1: Health Check

```bash
curl http://localhost:3100/api/v1/health

# Dovresti vedere:
# {
#   "status": "healthy",
#   "services": {
#     "tesseract": "ok",
#     "redis": "ok",
#     "ollama": "ok"
#   }
# }
```

### Test 2: Classifica un PDF

```bash
# Carica un PDF di test (esempio: una fattura)
curl -X POST http://localhost:3100/api/v1/ocr/analyze \
  -F "file=@/path/to/test-invoice.pdf" \
  | jq .

# Output atteso:
# {
#   "success": true,
#   "result": {
#     "type": "invoice",
#     "typeName": "FATTURA",
#     "confidence": 85,
#     "details": {
#       "supplier": "...",
#       "amount": 123.45,
#       ...
#     },
#     "model": "llama3.2:3b"
#   }
# }
```

### Test 3: Verifica velocità

Cronometra l'elaborazione di un documento:

```bash
time curl -X POST http://localhost:3100/api/v1/ocr/analyze \
  -F "file=@test.pdf" \
  -o /dev/null -s

# Tempo atteso: 5-10 secondi (OCR + Classificazione)
```

---

## 📊 Performance Attese

| Fase | Tempo | Note |
|------|-------|------|
| OCR (Tesseract GPU) | 2-3s | Per pagina |
| Classificazione (Llama 3.2 3B) | 2-3s | Totale |
| **TOTALE** | **~5s** | Per documento 1-2 pagine |

### Throughput:
- **1 documento:** ~5 secondi
- **10 documenti (batch):** ~30 secondi (parallelizzazione)
- **Capacità giornaliera:** ~10.000 documenti/giorno

---

## 🔄 Switchare tra Ollama e Kimi K2

Puoi facilmente passare da Ollama (locale) a Kimi K2 (cloud) modificando una variabile:

### Usare Ollama (Locale - GRATIS):

```bash
cd ~/jetson-deployment
nano .env

# Imposta:
USE_OLLAMA=true

# Salva e riavvia
docker-compose restart ocr-server
```

### Usare Kimi K2 (Cloud - A PAGAMENTO):

```bash
cd ~/jetson-deployment
nano .env

# Imposta:
USE_OLLAMA=false

# Salva e riavvia
docker-compose restart ocr-server
```

---

## 🐛 Troubleshooting

### Problema: Ollama non risponde

```bash
# Verifica status
sudo systemctl status ollama

# Se non è attivo, avvialo
sudo systemctl start ollama

# Verifica logs
sudo journalctl -u ollama -f
```

### Problema: Modello non trovato

```bash
# Scarica il modello
ollama pull llama3.2:3b

# Verifica che sia presente
ollama list
```

### Problema: Out of Memory

```bash
# Verifica RAM disponibile
free -h

# Se hai poca RAM, riduci i job concorrenti
nano .env
# Imposta: MAX_CONCURRENT_JOBS=2

docker-compose restart ocr-server
```

### Problema: Classificazione lenta

```bash
# Verifica che stia usando la GPU
nvidia-smi

# Verifica logs Ollama
sudo journalctl -u ollama -n 50
```

### Problema: Docker non riesce a raggiungere Ollama

Ollama deve essere accessibile dal container Docker. Verifica che nel `docker-compose.yml` sia impostato:

```yaml
environment:
  - OLLAMA_URL=http://host.docker.internal:11434
```

Se non funziona, prova con l'IP locale:

```bash
# Trova l'IP del Jetson
hostname -I

# Modifica docker-compose.yml
nano docker-compose.yml

# Cambia OLLAMA_URL con:
# - OLLAMA_URL=http://192.168.x.x:11434

docker-compose restart ocr-server
```

---

## 🔧 Manutenzione

### Aggiornare Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl restart ollama
```

### Aggiornare il modello Llama

```bash
ollama pull llama3.2:3b
docker-compose restart ocr-server
```

### Vedere i modelli installati

```bash
ollama list
```

### Rimuovere un modello (libera spazio)

```bash
ollama rm llama3.2:3b
```

### Backup configurazione

```bash
# Backup file .env
cp .env .env.backup

# Backup modelli Ollama (se necessario)
sudo tar czf ollama-models-backup.tar.gz /usr/share/ollama
```

---

## 📈 Ottimizzazioni Avanzate

### 1. Aumentare concorrenza (se hai RAM)

```bash
nano .env

# Aumenta i job paralleli (default: 4)
MAX_CONCURRENT_JOBS=6

docker-compose restart ocr-server
```

### 2. Usare modello più grande (se hai più RAM)

Se in futuro aggiungi RAM al Jetson:

```bash
# Scarica Llama 3.1 8B (~5GB)
ollama pull llama3.1:8b

# Modifica .env
nano .env
OLLAMA_MODEL=llama3.1:8b

docker-compose restart ocr-server
```

### 3. Pre-caricare il modello in memoria

```bash
# Tieni il modello sempre in RAM (più veloce)
ollama run llama3.2:3b ""
```

---

## 💡 Comandi Utili

```bash
# Status servizio Ollama
sudo systemctl status ollama

# Restart Ollama
sudo systemctl restart ollama

# Logs Ollama in tempo reale
sudo journalctl -u ollama -f

# Test rapido del modello
ollama run llama3.2:3b "Classifica questo testo: Fattura n. 123"

# Elenco modelli
ollama list

# Info su un modello
ollama show llama3.2:3b

# Logs Docker OCR server
docker-compose logs -f ocr-server

# Restart solo OCR server
docker-compose restart ocr-server

# RAM disponibile
free -h

# GPU usage
nvidia-smi
```

---

## 🎯 Prossimi Passi

1. ✅ Testa con PDF reali dal tuo magazzino
2. ✅ Confronta risultati Ollama vs Kimi K2
3. ✅ Monitora performance per 1 settimana
4. ✅ Se soddisfatto, disabilita Kimi K2 e risparmia €€€
5. ✅ Integra con Odoo (vedi README.md principale)

---

## 🆘 Supporto

### Se qualcosa non funziona:

1. **Verifica logs:**
   ```bash
   docker-compose logs -f ocr-server
   sudo journalctl -u ollama -f
   ```

2. **Riavvia tutto:**
   ```bash
   sudo systemctl restart ollama
   docker-compose restart
   ```

3. **Verifica health:**
   ```bash
   curl http://localhost:3100/api/v1/health
   ollama list
   ```

4. **Controlla RAM:**
   ```bash
   free -h
   # Se < 2GB liberi, riduci MAX_CONCURRENT_JOBS
   ```

---

## ✅ Checklist Post-Installazione

- [ ] Ollama installato e running (`sudo systemctl status ollama`)
- [ ] Modello Llama 3.2 3B scaricato (`ollama list`)
- [ ] File `.env` configurato con `USE_OLLAMA=true`
- [ ] Docker containers running (`docker-compose ps`)
- [ ] Health check passa (`curl localhost:3100/api/v1/health`)
- [ ] Test PDF classificato correttamente
- [ ] Logs mostrano "Ollama (Local)" come classifier
- [ ] Performance soddisfacenti (~5s per documento)

---

## 🎉 Fatto!

Ora hai un sistema di classificazione documenti AI **100% locale** e **gratuito**!

**Risparmio stimato:** €10-50/mese (dipende dal volume)
**ROI:** Immediato! 💰

Buon OCR! 🚀
