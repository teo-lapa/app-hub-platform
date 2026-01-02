# LAPA AI Chat Widget - Documentazione Architetturale Completa

## IMPORTANTE - LEGGERE PRIMA DI TUTTO

**Il sistema LAPA Chat è diviso in DUE parti completamente separate:**

1. **ODOO (lapa.ch)** = Gestisce il **PULSANTE** e l'**ASPETTO VISIVO** della chat
2. **VERCEL (hub.lapa.ch)** = Gestisce gli **AGENTI AI** e la **LOGICA** della chat

**NON CONFONDERE MAI QUESTE DUE COSE!**

---

## PARTE 1: ODOO - Il Pulsante e l'Interfaccia Visiva

### Dove si trova il codice

**Posizione:** Backend Odoo → Sito Web → Sito → Editor HTML/CSS → "Modifica codice intestazione e corpo"

**Oppure via API:**
- URL: `https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com`
- Modello: `website`
- Campo: `custom_code_footer`
- ID Website: `1` (LAPA ZERO PENSIERI - www.lapa.ch)

### Credenziali Odoo
```
URL: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com
Database: lapadevadmin-lapa-v2-main-7268478
Email: paul@lapa.ch
Password: lapa201180
```

### Cosa controlla Odoo

| Elemento | Controllato da Odoo | File/Campo |
|----------|---------------------|------------|
| Posizione pulsante chat (bottom, right) | ✅ SÌ | `custom_code_footer` |
| Colore pulsante | ✅ SÌ | `custom_code_footer` |
| Dimensione pulsante | ✅ SÌ | `custom_code_footer` |
| Animazione pulsante | ✅ SÌ | `custom_code_footer` |
| Pulsante Shop (rosso a sinistra) | ✅ SÌ | `custom_code_footer` |
| Script di tracciamento (LinkedIn, TikTok, etc.) | ✅ SÌ | `custom_code_head` / `custom_code_footer` |
| Cookie consent (Iubenda) | ✅ SÌ | `custom_code_head` |

### Codice attuale nel footer di Odoo

```html
<!-- LAPA Shop Button -->
<style>
.lapa-shop-btn {
  position: fixed;
  bottom: 25px;
  left: 25px;
  z-index: 9999;
  /* ... altri stili ... */
}
@media(max-width:768px) {
  .lapa-shop-btn {
    bottom: 90px;  /* Posizione mobile del pulsante Shop */
    left: 20px;
  }
}
</style>
<a href="/shop" class="lapa-shop-btn">...</a>

<!-- LAPA AI Chat Widget - CARICA LO SCRIPT DA VERCEL -->
<script src="https://hub.lapa.ch/lapa-chat-embed.js"></script>

<!-- LAPA AI Chat Position Fix - SOVRASCRIVE LA POSIZIONE -->
<script>
(function() {
  function fixChatPosition() {
    var container = document.getElementById('lapa-chat-widget-container');
    if (container) {
      container.style.setProperty('bottom', '100px', 'important');
    }
  }
  setTimeout(fixChatPosition, 500);
  setTimeout(fixChatPosition, 1000);
  // ... MutationObserver per catturare il widget ...
})();
</script>
```

### Come modificare la posizione del pulsante chat

**METODO 1: Via interfaccia Odoo**
1. Vai su https://www.lapa.ch (loggato come admin)
2. Clicca "Sito web" nel menu in alto
3. Clicca "Sito" → "Editor HTML/CSS"
4. Trova la sezione `<!-- LAPA AI Chat Position Fix -->`
5. Modifica il valore `bottom: 100px` con quello desiderato
6. Salva

**METODO 2: Via API (come fa Claude Code)**
```javascript
const https = require('https');

// 1. Autenticazione
const authData = JSON.stringify({
  jsonrpc: '2.0',
  method: 'call',
  params: {
    db: 'lapadevadmin-lapa-v2-main-7268478',
    login: 'paul@lapa.ch',
    password: 'lapa201180'
  },
  id: 1
});

// Chiamata a /web/session/authenticate per ottenere session_id

// 2. Modifica del footer
const updateData = JSON.stringify({
  jsonrpc: '2.0',
  method: 'call',
  params: {
    model: 'website',
    method: 'write',
    args: [[1], { custom_code_footer: 'NUOVO_CONTENUTO_HTML' }],
    kwargs: {}
  },
  id: 2
});

// Chiamata a /web/dataset/call_kw con Cookie: session_id=...
```

---

## PARTE 2: VERCEL - Gli Agenti AI e la Logica

### Dove si trova il codice

**Repository:** `c:\Users\lapa\OneDrive\Desktop\Claude Code`
**Hosting:** Vercel
**URL Produzione:** https://hub.lapa.ch
**URL Staging:** https://staging.hub.lapa.ch
**Branch Produzione:** `main`
**Branch Staging:** `staging`

### Cosa controlla Vercel

| Elemento | Controllato da Vercel | File |
|----------|----------------------|------|
| Logica degli Agenti AI | ✅ SÌ | `lib/lapa-agents/*.ts` |
| Risposte della chat | ✅ SÌ | `lib/lapa-agents/orchestrator.ts` |
| API endpoint chat | ✅ SÌ | `app/api/lapa-agents/chat/route.ts` |
| Interfaccia dentro l'iframe | ✅ SÌ | `app/lapa-ai-agents/widget/page.tsx` |
| Gestione conversazioni | ✅ SÌ | `lib/lapa-agents/conversation-store.ts` |
| Analisi allegati | ✅ SÌ | `lib/lapa-agents/attachment-analyzer.ts` |
| Statistiche | ✅ SÌ | `lib/lapa-agents/stats.ts` |

### File principali su Vercel

```
lib/lapa-agents/
├── orchestrator.ts          # Router principale - decide quale agente risponde
├── orders-agent.ts          # Agente Ordini
├── invoices-agent.ts        # Agente Fatture
├── shipping-agent.ts        # Agente Spedizioni
├── products-agent.ts        # Agente Prodotti
├── helpdesk-agent.ts        # Agente Supporto
├── conversation-store.ts    # Salvataggio conversazioni (Vercel KV)
├── attachment-analyzer.ts   # Analisi immagini/PDF (Gemini)
└── stats.ts                 # Statistiche e analytics

app/
├── api/lapa-agents/chat/route.ts    # Endpoint API principale
└── lapa-ai-agents/widget/page.tsx   # Interfaccia React della chat

public/
├── lapa-chat-embed.js       # Script embed (NON USATO DA ODOO DIRETTAMENTE)
└── lapa-ai-widget.js        # Widget standalone
```

### Come funziona il flusso

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              ODOO (lapa.ch)                              │
│                                                                          │
│  1. Utente visita lapa.ch                                               │
│  2. Odoo carica il custom_code_footer                                   │
│  3. Lo script crea il PULSANTE ROSSO in basso a destra                  │
│  4. Quando l'utente clicca, si apre un IFRAME                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ iframe src="https://hub.lapa.ch/lapa-ai-agents/widget"
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL (hub.lapa.ch)                           │
│                                                                          │
│  5. Vercel serve la pagina widget (React)                               │
│  6. Utente scrive messaggio                                             │
│  7. Messaggio inviato a /api/lapa-agents/chat                           │
│  8. Orchestrator decide quale agente risponde                           │
│  9. Agente genera risposta (usando Claude AI)                           │
│  10. Risposta tornata all'iframe                                        │
│  11. Widget mostra la risposta all'utente                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Come fare deploy su Vercel

**Per Staging:**
```bash
git add .
git commit -m "descrizione modifica"
git push origin staging
# Vercel fa deploy automatico su staging.hub.lapa.ch
```

**Per Produzione:**
```bash
git checkout main
git merge staging
git push origin main
# Vercel fa deploy automatico su hub.lapa.ch
```

---

## PARTE 3: Cosa Modificare e Dove

### VOGLIO CAMBIARE LA POSIZIONE DEL PULSANTE
**→ VAI SU ODOO** (custom_code_footer)

### VOGLIO CAMBIARE IL COLORE DEL PULSANTE
**→ VAI SU ODOO** (custom_code_footer)

### VOGLIO CAMBIARE COME RISPONDE L'AI
**→ VAI SU VERCEL** (lib/lapa-agents/orchestrator.ts)

### VOGLIO AGGIUNGERE UN NUOVO AGENTE
**→ VAI SU VERCEL** (crea nuovo file in lib/lapa-agents/)

### VOGLIO CAMBIARE L'INTERFACCIA DELLA CHAT (dentro la finestra)
**→ VAI SU VERCEL** (app/lapa-ai-agents/widget/page.tsx)

### VOGLIO AGGIUNGERE TRACKING/ANALYTICS
**→ VAI SU ODOO** (custom_code_head o custom_code_footer)

### VOGLIO CAMBIARE IL MESSAGGIO DI BENVENUTO
**→ VAI SU VERCEL** (app/lapa-ai-agents/widget/page.tsx)

---

## PARTE 4: Credenziali e Accessi

### Odoo
```
URL Backend: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web
URL Sito: https://www.lapa.ch
Database: lapadevadmin-lapa-v2-main-7268478
Email: paul@lapa.ch
Password: lapa201180
```

### Vercel
```
Repository: https://github.com/teo-lapa/app-hub-platform
Progetto: app-hub-platform
Dominio Prod: hub.lapa.ch
Dominio Staging: staging.hub.lapa.ch
```

### API Keys (in .env.local)
```
ANTHROPIC_API_KEY=sk-ant-api03-...     # Per Claude AI
GEMINI_API_KEY=AIzaSy...               # Per analisi immagini
KV_REST_API_TOKEN=...                  # Per salvare conversazioni
ODOO_API_KEY=9ac3da527ecc3b4e08...     # Per chiamare API Odoo
```

---

## PARTE 5: Risoluzione Problemi Comuni

### Il pulsante della chat è nella posizione sbagliata
1. **NON modificare file su Vercel!**
2. Vai su Odoo → Sito → Editor HTML/CSS
3. Trova `<!-- LAPA AI Chat Position Fix -->`
4. Modifica il valore `bottom: XXXpx`
5. Salva

### La chat non risponde / errori AI
1. Controlla Vercel Dashboard per errori
2. Controlla le API keys in .env.local
3. Verifica che il deploy sia andato a buon fine

### Il pulsante non appare
1. Controlla la console del browser per errori JavaScript
2. Verifica che lo script `hub.lapa.ch/lapa-chat-embed.js` sia caricato
3. Controlla che non ci siano errori nel custom_code_footer di Odoo

### La chat mostra l'interfaccia sbagliata
1. Il problema è su Vercel
2. Modifica `app/lapa-ai-agents/widget/page.tsx`
3. Fai deploy

---

## PARTE 6: Comandi Utili per Claude Code

### Leggere il footer attuale di Odoo
```bash
curl -s -X POST "https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web/dataset/call_kw" \
  -H "Content-Type: application/json" \
  -H "Cookie: session_id=SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"call","params":{"model":"website","method":"read","args":[[1]],"kwargs":{"fields":["custom_code_footer"]}},"id":1}'
```

### Modificare il footer di Odoo
```bash
# Usa Node.js per gestire JSON complessi - vedi esempi sopra
```

### Controllare la versione su Vercel
```bash
curl -s "https://hub.lapa.ch/lapa-chat-embed.js" | grep "bottom:"
```

---

## RIEPILOGO FINALE

| Cosa | Dove | Come Accedere |
|------|------|---------------|
| **Pulsante chat (posizione, colore, dimensione)** | ODOO | Backend → Sito → Editor HTML/CSS |
| **Pulsante Shop** | ODOO | Backend → Sito → Editor HTML/CSS |
| **Tracking (Google, Facebook, TikTok, LinkedIn)** | ODOO | Backend → Sito → Editor HTML/CSS |
| **Cookie consent** | ODOO | Backend → Sito → Editor HTML/CSS |
| **Agenti AI (logica risposte)** | VERCEL | `lib/lapa-agents/*.ts` |
| **API chat** | VERCEL | `app/api/lapa-agents/chat/route.ts` |
| **Interfaccia dentro la chat** | VERCEL | `app/lapa-ai-agents/widget/page.tsx` |
| **Salvataggio conversazioni** | VERCEL | Vercel KV (Redis) |

---

**RICORDA:**
- **PULSANTE = ODOO**
- **CERVELLO (AI) = VERCEL**

Non confondere mai le due cose!
