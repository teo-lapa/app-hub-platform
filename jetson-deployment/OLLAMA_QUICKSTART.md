# 🚀 Ollama Quickstart (5 minuti)

## TL;DR: Installazione Rapida

### 1️⃣ Connettiti al Jetson

```bash
ssh jetson@jetson-nano.local
```

### 2️⃣ Copia i file (dal tuo PC Windows)

```bash
cd "C:\Users\lapa\Desktop\Claude Code\app-hub-platform"
scp -r jetson-deployment jetson@jetson-nano.local:~/
```

### 3️⃣ Installa Ollama (sul Jetson)

```bash
cd ~/jetson-deployment
chmod +x install-ollama.sh
./install-ollama.sh
```

⏱️ **Tempo:** ~3-5 minuti (scarica 2GB)

### 4️⃣ Configura environment

```bash
nano .env
```

Aggiungi/modifica:
```bash
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

Salva: **Ctrl+X** → **Y** → **Enter**

### 5️⃣ Avvia i container

```bash
docker-compose up -d --build
```

### 6️⃣ Verifica che funzioni

```bash
docker-compose logs -f ocr-server
```

Dovresti vedere:
```
🤖 AI Classifier: Ollama (Local)
✅ Classifier Service initialized with llama3.2:3b
```

---

## ✅ Fatto!

Ora il tuo Jetson usa **Llama 3.2 3B locale** invece di Kimi K2 cloud!

### Vantaggi:
- ✅ **€0 costi API**
- ✅ **Privacy totale**
- ✅ **Nessun limite**
- ✅ **~5s per documento**

---

## 🧪 Test Veloce

```bash
curl http://localhost:3100/api/v1/health
```

Se vedi `"ollama": "ok"` → **Tutto funziona!** 🎉

---

## 📚 Documentazione Completa

Vedi **GUIDA_OLLAMA_LLAMA.md** per:
- Troubleshooting dettagliato
- Ottimizzazioni performance
- Come switchare tra Ollama/Kimi K2
- Comandi utili

---

## 🆘 Problemi?

```bash
# Verifica Ollama
sudo systemctl status ollama

# Verifica modello
ollama list

# Riavvia tutto
sudo systemctl restart ollama
docker-compose restart
```

---

**Hai finito!** Vai su Vercel e testa: https://app-hub-platform-n3w4x0eqq-teo-lapas-projects.vercel.app/jetson-ocr
