# 🔍 Setup Web Search per Scan Contatto

## Panoramica

La funzionalità **Web Search** cerca automaticamente le aziende su Internet per arricchire i dati estratti dall'OCR.

**Supporta 2 provider:**
1. **Google Custom Search API** (PRIMARIO) - 100 ricerche gratuite/giorno
2. **Tavily API** (FALLBACK) - A pagamento, $0.0005 per ricerca

---

## 📋 Opzione 1: Google Custom Search API (CONSIGLIATA)

### Step 1: Ottieni API Key Google

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuovo progetto o seleziona quello esistente
3. Abilita l'API **"Custom Search API"**:
   - Vai su **APIs & Services** → **Library**
   - Cerca "Custom Search API"
   - Click **Enable**

4. Crea credenziali:
   - Vai su **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **API Key**
   - Copia la chiave generata

5. (Opzionale) Limita la chiave:
   - Click sulla chiave appena creata
   - **API restrictions** → Seleziona solo "Custom Search API"
   - Salva

### Step 2: Crea Search Engine ID

1. Vai su [Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click **"Add"** o **"Create Search Engine"**
3. Configurazione:
   - **Sites to search:** Lascia vuoto (cerca tutto il web)
   - **Name:** "LAPA Web Search"
   - **Language:** Italian/German/French
   - Click **Create**

4. Ottieni Search Engine ID (cx):
   - Vai su **Control Panel** della search engine creata
   - Nella sezione **Basics**, trovi il **Search engine ID (cx)**
   - Copia questo ID

### Step 3: Aggiungi le Chiavi in .env.local

```bash
GOOGLE_SEARCH_API_KEY="AIzaSy..."
GOOGLE_SEARCH_ENGINE_ID="017576662512468239146:omuauf..."
```

### Limiti Gratuiti Google

- ✅ **100 ricerche/giorno GRATIS**
- ❌ Oltre 100: $5 per 1000 ricerche

---

## 💰 Opzione 2: Tavily API (FALLBACK)

Tavily è ottimizzata per AI e fornisce risultati più strutturati.

### Step 1: Registrati su Tavily

1. Vai su [https://tavily.com/](https://tavily.com/)
2. Sign up (gratis, 1000 ricerche al mese per iniziare)
3. Vai su **Dashboard** → **API Keys**
4. Copia la tua API key

### Step 2: Aggiungi in .env.local

```bash
TAVILY_API_KEY="tvly-..."
```

### Pricing Tavily

- 🆓 **1000 ricerche gratis/mese** (prova)
- 💵 Poi: **$0.0005 per ricerca** (~$0.50 per 1000 ricerche)

---

## 🚀 Come Funziona

1. **OCR** estrae il nome dell'azienda dal documento
2. **Web Search** cerca automaticamente:
   - Prima prova **Google Custom Search**
   - Se fallisce, prova **Tavily** (se configurato)
3. Arricchisce i dati con:
   - Sito web ufficiale
   - Indirizzo completo
   - Descrizione attività
   - Altre informazioni pubbliche

## ✅ Verifica Setup

Dopo aver configurato le API key:

1. Riavvia il server Next.js:
   ```bash
   npm run dev
   ```

2. Vai su **Scan Contatto**
3. Carica un biglietto da visita (es. MIGROS)
4. Verifica che **Claude Web Search** mostri:
   - ✅ "Azienda trovata: [Nome]"
   - ❌ NO "Azienda non trovata su web"

## 🔒 Sicurezza

- ⚠️ **NON committare** le API key su GitHub
- Le chiavi sono già in `.env.local` (ignorato da Git)
- Per deploy su Vercel, aggiungi le variabili in **Project Settings** → **Environment Variables**

---

## 📝 Note

- Se **nessuna** API è configurata, la ricerca web è **disabilitata** (usa solo OCR)
- **Google** è gratuito e sufficiente per la maggior parte dei casi
- **Tavily** è utile solo se superi 100 ricerche/giorno
