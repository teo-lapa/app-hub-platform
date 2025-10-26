# 🎬 Stella Avatar Animato con Lip-Sync

## Come Funziona

Stella ora ha **2 modalità video**:

### 1. **Modalità Statica** (quando ascolta o è idle)
- Usa il video `/public/videos/stella.mp4` esistente
- Si muove lentamente in loop
- Playback rate: 0.8x (rilassata)

### 2. **Modalità Animata con Lip-Sync** (quando parla) ⭐
- Attiva **D-ID Streaming** in tempo reale
- Le labbra si muovono **SINCRONIZZATE** con l'audio
- Animazione REALISTICA della faccia
- Si ferma automaticamente quando Stella smette di parlare

## Setup D-ID API (5 minuti)

### Step 1: Crea Account D-ID

1. Vai su https://studio.d-id.com/
2. Clicca su **"Sign Up"**
3. Registrati (è GRATIS per iniziare - 20 crediti gratuiti)
4. Verifica email

### Step 2: Ottieni API Key

1. Vai su **API** nel menu laterale
2. Oppure vai direttamente a: https://studio.d-id.com/account-settings
3. Trova la sezione **"API Key"**
4. Clicca **"Create new key"**
5. Copia la chiave (formato: `Basic abc123def456...`)

### Step 3: Aggiungi API Key

#### Locale (.env.local)

```bash
# D-ID API per Stella lip-sync
DID_API_KEY="Basic INSERISCI_QUI_LA_TUA_CHIAVE"
NEXT_PUBLIC_DID_API_KEY="Basic INSERISCI_QUI_LA_TUA_CHIAVE"
```

#### Production (Vercel)

```bash
cd app-hub-platform
vercel env add DID_API_KEY
# Inserisci: Basic INSERISCI_QUI_LA_TUA_CHIAVE
# Seleziona: Production, Preview, Development

vercel env add NEXT_PUBLIC_DID_API_KEY
# Inserisci: Basic INSERISCI_QUI_LA_TUA_CHIAVE
# Seleziona: Production, Preview, Development
```

### Step 4: Restart e Deploy

```bash
# Locale: riavvia dev server
npm run dev

# Production: redeploy automatico
git push origin staging
```

## Come Usare

1. Vai su Stella Assistant
2. Clicca **"Parla con Stella"**
3. **Quando Stella parla** → Video animato con lip-sync
4. **Quando Stella ascolta** → Video statico normale

## Prezzi D-ID

- **FREE**: 20 crediti (~2 minuti video)
- **Lite**: $5/mese - 100 crediti (~10 minuti)
- **Basic**: $49/mese - 1000 crediti (~100 minuti)
- **Pro**: $300/mese - 15000 crediti (~1500 minuti)

Un **credito** = 1 secondo di video animato

## Test Senza API Key

Se NON hai la API key, Stella funziona lo stesso con il video statico normale! L'animazione lip-sync è un **upgrade opzionale**.

## Troubleshooting

### "DID API not configured"
→ Aggiungi `DID_API_KEY` in `.env.local`

### Video non si anima
→ Controlla console browser per errori
→ Verifica che la API key sia corretta
→ Controlla crediti D-ID rimanenti

### Stella rimane muta
→ Il problema è OpenAI Realtime, non D-ID
→ Controlla API OpenAI funzioni

## Vantaggi Lip-Sync

✅ **Realismo estremo** - Sembra che Stella parli davvero
✅ **Professionalità** - User experience PREMIUM
✅ **Attenzione utente** - Più engaging e memorabile
✅ **Branding forte** - Assistente AI riconoscibile

## File Modificati

```
app/
├── api/
│   └── stella/
│       └── did-stream/
│           └── route.ts          # NEW: API per D-ID streaming
└── stella-assistant/
    └── components/
        ├── StellaVideoAvatar.tsx  # NEW: Avatar component con lip-sync
        └── StellaRealTime.tsx     # MODIFIED: Usa nuovo avatar

STELLA_LIP_SYNC_SETUP.md           # NEW: Questa guida
```

## Next Steps

1. **Ottieni DID API Key** (5 minuti)
2. **Aggiungi a .env** (1 minuto)
3. **Test locale** (2 minuti)
4. **Deploy production** (1 minuto)

**Totale: 10 minuti per Stella ANIMATA! 🎬**
