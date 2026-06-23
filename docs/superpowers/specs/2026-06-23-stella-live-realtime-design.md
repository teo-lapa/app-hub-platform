# Stella Live — Assistente vocale realtime con orchestrazione su Claude

**Data:** 2026-06-23
**Stato:** Design approvato dall'utente (Paul), in implementazione
**Autore:** Claude Code

---

## 1. Obiettivo

Creare una **nuova** esperienza vocale `hub.lapa.ch/stella-live` dove l'utente parla in **tempo reale** con una voce naturale (OpenAI Realtime via WebRTC), che:

- chiacchiera in modo fluido e **si lascia interrompere** (barge-in);
- fa da **orchestratore**: non ha strumenti propri, ma quando l'utente chiede qualcosa di LAPA gira la domanda al **vero cervello Claude-Stella** (il bridge `claude -p` già esistente su PC STELLA);
- mentre Claude elabora (~10-15 s), **tiene compagnia** all'utente (può continuare a parlare, aggiungere dettagli);
- quando arriva la risposta di Claude, la **legge a voce** e la si discute;
- mostra in chat la **trascrizione** di tutto + immagini/PDF/link che Claude restituisce.

È un'**app installabile** (PWA + APK Capacitor) e ha una **Modalità Auto** per l'uso a mani libere in macchina via Bluetooth.

### Cosa NON è (limiti onesti)
- **Non è Android Auto.** Non si proietta sul display dell'auto. Google non permette assistenti conversazionali custom sul cruscotto Android Auto (solo Google Assistant/Gemini). In auto Stella Live vive sul telefono (audio via Bluetooth + schermo acceso).
- **La latenza di Claude resta.** Il realtime rende la conversazione fluida e mascherata, ma la lettura reale dei dati Odoo richiede comunque i secondi di `claude -p`.

---

## 2. Architettura

```
[Telefono / browser / APK]
   |  WebRTC (audio bidirezionale, full-duplex, interrompibile)
   v
[OpenAI Realtime API]  <-- voce + STT + VAD + decide quando chiamare il tool
   |  function call: chiedi_a_stella(domanda)
   v  (gestita nel client)
[Browser] --HTTP--> [/api/stella-live/ask su Vercel]
                          |  POST /ask  (X-Token)
                          v
                    [Bridge su PC STELLA: /home/lapa/stella-voice-bridge]
                          |  claude -p (cervello vero: Odoo, skill, memoria)
                          v
                    reply + images  --> torna al browser
                          |
                          v
   [Browser] invia function_call_output al Realtime --> la voce LEGGE la risposta
```

### Principio di isolamento
- **Non si tocca** `/stella-voce`, `/romeo-voce`, il bridge su STELLA, il bot WhatsApp.
- Il bridge `/ask` viene **riusato così com'è** (stesso endpoint usato oggi da /stella-voce). Nessuna modifica server su STELLA.
- Tutto il nuovo codice è confinato in `app/stella-live/**` e `app/api/stella-live/**`.

---

## 3. Componenti (nuovi file)

### 3.1 `app/api/stella-live/session/route.ts` — token effimero (auth-gated)
- `POST`: verifica cookie JWT `token` → email in `STELLA_ALLOWED_EMAILS` (default paul@lapa.ch, laura@lapa.ch). Se non autorizzato → 403.
- Crea l'ephemeral client secret OpenAI (`POST https://api.openai.com/v1/realtime/sessions` con `{ model, voice }`, header `Authorization: Bearer OPENAI_API_KEY`) e ritorna `client_secret` + `model` al browser. La chiave vera **non** lascia mai il server.
- `GET`: ritorna `{ authed, email }` per l'overlay di login (come fa /stella-voce).
- Riuso del pattern esistente in `app/api/openai/realtime/route.ts` (già funzionante), ma **con auth ai proprietari**.

### 3.2 `app/api/stella-live/ask/route.ts` — dispatch a Claude
- `POST`: auth-gated come sopra. Legge `stella:bridge_url` da KV, fa `POST {bridge}/ask` con header `X-Token: STELLA_VOICE_TOKEN` e body `{ text, reset?, image? }`.
- Ritorna `{ reply, images, error }`. **Senza STT/TTS** (li fa il Realtime). È una versione ridotta dell'attuale `app/api/stella-voce/route.ts`.

### 3.3 `app/stella-live/page.tsx` — UI realtime
Client component. Riusa il pattern WebRTC da `StellaRealTime.tsx`:
- `RTCPeerConnection`, `getUserMedia({audio})`, `addTrack`, `ontrack → <audio autoplay>` (l'audio arriva dal **media track** WebRTC, niente decoding PCM manuale).
- `createDataChannel('oai-events')`; allo `onopen` invia `session.update` con: `instructions` (persona orchestratore), `voice` femminile, `input_audio_transcription` (italiano), `turn_detection` (server VAD), e **`tools: [chiedi_a_stella]`**.
- Scambio SDP: `createOffer` → `POST https://api.openai.com/v1/realtime?model=...` con `Authorization: Bearer <client_secret>` → `setRemoteDescription(answer)`.
- Gestione eventi: trascrizioni utente/Stella in chat, **function call** (vedi §4), errori.
- Stati visivi: sfera animata (off/listening/speaking/thinking), badge fase, modalità auto, notifiche (riuso `/api/stella-voce/notifs`).
- Rendering link cliccabili + immagini/PDF (riuso `renderText` + marcatore `[IMG:]` dalla pagina /stella-voce).
- Auth overlay + wake lock (riuso da /stella-voce).

### 3.4 `app/stella-live/layout.tsx` + `public/stella-live.webmanifest`
- Manifest dedicato (`start_url`/`scope` = `/stella-live`, icone, theme). Pattern identico a `stella.webmanifest`.

### 3.5 Card launcher
- Voce in `lib/data/apps-with-indicators.ts` (`id: 'stella-live'`, `requiredRole: 'admin'`, categoria AI & Tech).
- Visibilità interna via KV `app_visibility:stella-live` = `{visibilityGroup:'internal'}` (come stella-voce).

### 3.6 APK Capacitor
- Nuovo progetto `C:\Users\lapa\Dev\stella-live-app` (Capacitor 8), `server.url = https://hub.lapa.ch/stella-live` (carica il web live → aggiornamenti automatici).
- `appId: ch.lapa.stellalive`, permesso `RECORD_AUDIO` (+ gestione permesso mic nella WebView), audio playback senza gesture.
- APK in `public/downloads/stella-live.apk`. Toolchain già presente sul PC (JDK 21 + Android SDK).

---

## 4. Function calling: il pattern asincrono (cuore del progetto)

### Definizione tool (nel `session.update`)
```json
{
  "type": "function",
  "name": "chiedi_a_stella",
  "description": "Inoltra al cervello Claude-Stella QUALSIASI richiesta che riguardi LAPA: ordini, clienti, email, fatture, magazzino, telecamere, azioni Odoo, dati o numeri reali. Tu NON hai questi dati: per ogni cosa LAPA usa SEMPRE questo strumento.",
  "parameters": {
    "type": "object",
    "properties": { "domanda": { "type": "string", "description": "La richiesta dell'utente, riformulata chiara e completa in italiano." } },
    "required": ["domanda"]
  }
}
```

### Istruzioni alla voce (estratto)
- Sei la voce di Stella. Per le chiacchiere rispondi tu. Per **qualsiasi** cosa LAPA chiama `chiedi_a_stella`.
- **Prima** di chiamare il tool, di' a voce una frase breve tipo "un attimo, controllo…" così l'utente non resta nel vuoto.
- Quando ricevi il risultato, **leggilo in modo naturale** e discutilo; non inventare dati, riferisci solo quello che torna dal tool.

### Lifecycle nel client
1. Evento di function call dal data channel (`response.function_call_arguments.done` → `call_id` + `arguments`; in fallback `response.output_item.done` con `item.type === 'function_call'`). ⚠️ Da confermare il nome esatto evento nella versione modello usata (vedi ricerca tecnica).
2. Il client fa `fetch('/api/stella-live/ask', { body: { text: domanda } })` (non bloccante). Nel frattempo la sessione resta viva: l'utente può parlare, la voce risponde.
3. Al ritorno: `dataChannel.send(conversation.item.create con { type:'function_call_output', call_id, output: replyText })`, poi `dataChannel.send({ type:'response.create' })` → la voce legge la risposta.
4. Le `images` di Claude vengono mostrate **direttamente in chat** (non passano dal modello). Il testo `output` è la versione "pulita" senza marcatori `[IMG:]` (già fatto dal bridge).

### Gestione concorrenza
- Guard `isCreatingResponse` per non sovrapporre `response.create`.
- Se l'utente fa una seconda domanda mentre il tool è in volo: in questa v1 si accoda (una richiesta a Claude alla volta). Parallelo = fuori scope v1.

---

## 5. Modalità Auto + avvio in macchina

- **Livello 1 (in scope):** Modalità Auto = wake lock (schermo acceso) + UI dedicata a pulsanti grandi/scuri + ascolto continuo del Realtime (un tocco a inizio viaggio, poi mani libere via Bluetooth dell'auto).
- **Livello 2 (in scope, best effort):** scorciatoia per avvio a voce "Ehi Google, apri Stella" (App Shortcut Android) + opzione di avvio automatico alla connessione Bluetooth dell'auto. ⚠️ Da verificare fattibilità reale su APK Capacitor.
- **Livello 3 (fuori scope):** proiezione su display Android Auto — bloccato da policy Google.

---

## 6. Sicurezza, env, KV (tutto già esistente)
- Auth: cookie JWT `token` → `verifyToken` → `STELLA_ALLOWED_EMAILS`.
- `OPENAI_API_KEY` (server), `STELLA_VOICE_TOKEN` (bridge), KV `stella:bridge_url`. Già su Vercel.
- L'ephemeral token OpenAI scade in fretta ed è l'unica cosa che arriva al client.

## 7. Error handling
- Bridge offline / KV vuoto → la voce dice "Stella non risponde, riprova".
- Connessione Realtime persa → stato errore + retry.
- 403 / non loggato → overlay "Accedi" (redirect a `/?redirect=/stella-live`).

## 8. Testing
- Build verde su Vercel (staging) — build locale ARM64 è rotto, **validare su Vercel** non in locale.
- Manuale su telefono di Paul: chiacchiera (no dispatch), domanda LAPA (dispatch + lettura), interruzione, modalità auto (wake lock + Bluetooth), foto, link.

## 9. Rollout
- Tutto su branch **staging** → verifica build Vercel Preview → Paul promuove a **main** (mai main diretto).
- APK generato e copiato in `public/downloads/stella-live.apk`.

## 10. Punti da verificare in fase di test (⚠️)
- Nome esatto del modello Realtime corrente (GA `gpt-realtime` vs `gpt-4o-realtime-preview-2024-12-17` già funzionante nel repo).
- Endpoint mint token: `/v1/realtime/sessions` (funzionante oggi) vs nuovo `/v1/realtime/client_secrets`.
- Eventi precisi del function calling nella versione modello scelta.
- Microfono WebRTC dentro WebView Capacitor con `server.url` remoto (permessi).
- Costo reale al minuto del Realtime audio (da monitorare).
