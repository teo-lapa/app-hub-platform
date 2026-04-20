# Design: Recupero Clienti + Stella Voce

**Data:** 2026-04-20
**Autore:** Paul + Claude (brainstorming)
**Stato:** Draft per approvazione

---

## Problema

Oggi LAPA ha:
- Mihai (venditore) da gestire con ~250 clienti B2B regolari (≥2 consegne in 6 mesi)
- 3 pagine sovrapposte nel HUB: `/recupero-clienti` (statica, ex-Alessandro), `/clienti-mancanti` (live, duplicato), `/analisi-clienti` (drill-down)
- Skill Vanessa `recupero-clienti` gia funzionante per Mihai
- Zero cron o notifiche automatizzate
- Zero canale voce per interagire con gli agenti mentre si guida

**Obiettivo:** sistema sostenibile per un venditore solo (Mihai) che gestisca 250 clienti tramite mix visite/chiamate/WhatsApp, con supporto vocale dell'agente AI mentre e in movimento.

**Vincoli chiave:**
- NON assumere un secondo venditore
- NON toccare i bot WhatsApp in produzione (Stella/Vanessa/Romeo/Diana)
- Usare `stock.picking.date_done` per ogni analisi temporale (mai `date_order`)
- OpenAI = solo orecchie+bocca, il cervello e Claude via MCP come i bot esistenti

---

## Visione

Sistema unico chiamato **Recupero Clienti** composto da:

1. **Pagina web** `/recupero-clienti` (live Odoo, allarmi, feedback per cliente)
2. **Skill conversazionale** eseguita domenica per aggiornare priorita settimanali
3. **Notifica WhatsApp** lunedi mattina con link alla pagina + top 5 del giorno
4. **Canale voce** (`stella-voce.lapa.ch`) per parlare con l'agente mentre guidi

Il venditore apre la pagina come "vetrina" per consultare, ma aggiorna lo stato tramite conversazione naturale con l'agente (voce o WhatsApp).

### Use-case tipico (Mihai)

**Domenica 18:00** — Cron su LAPA-SALES lancia skill `clienti-mancanti`. Snapshot salvato.

**Lunedi 8:00** — Vanessa manda WhatsApp a Mihai:
> "Buongiorno Mihai! Oggi lunedi, zona Nord. Priorita della settimana (5 allarmi): Imperial Food ☎, Pizzeria Nonna Jo ☎, NAPULE AG visita, Fermentum ☎, AnaMiRa visita. Lista completa: hub.lapa.ch/recupero-clienti"

**Durante il giorno** — Mihai lavora. Quando vuole parlare con Vanessa mentre guida:

Mihai (WhatsApp): *"Vanessa voglio parlare con te"*
Vanessa (WhatsApp): *"Certo, apri: https://vanessa-voce.lapa.ch/mihai"*

Mihai apre link → pagina con microfono. Parla:
> "Vanessa, ho chiamato Imperial Food, ordina giovedi. Sono passato da Cemini, mi ha detto che il fratello compra in Germania. AnaMiRa non c'era."

Vanessa (voce + scrive in DB):
- Imperial Food → stato "ordinato", next contact +7gg, apre bozza
- Cemini → stato "perso?", feedback "fratello compra Germania", flag a Paul
- AnaMiRa → stato "retry venerdi"

Vanessa (voce): *"Fatto. Altro?"*

**Sera 18:00** — Vanessa chiede riepilogo se Mihai non ha gia detto tutto.

---

## Architettura

### Componente 1 — Pagina HUB `/recupero-clienti` (consolidata)

Riutilizza la pagina esistente `/recupero-clienti` ma cambia:

**Fonte dati:** da file statico `clienti-data.ts` → live Odoo via `/api/recupero-clienti`

**Nuovi campi per cliente:**
- `fatturato3m`, `consegne3m`, `consPerSettimana`, `silenzioGiorni`, `ultimaConsegna`, `allarme` (GRAVE/SI/NO)
- `feedback` per settimana (persistente)
- `status` (da_contattare/contattato/attivo/perso) esistente
- `note` utente esistente

**API nuova** (da creare):
- `POST /api/recupero-clienti/get_weekly_data` — lista live con allarmi
- `POST /api/recupero-clienti/save_feedback` — salva feedback per cliente settimana
- `POST /api/recupero-clienti/save_status` — aggiorna status

**Rimozione:**
- Elimino la pagina `/clienti-mancanti` e la sua API (duplicato mio, mal scoped)
- Elimino `clienti-data.ts` statico (ora da Odoo live)

**UI:**
- Tab "Oggi" (lunedi=Nord, martedi=Basilea, ecc. — basato su zona CAP)
- Tab "Settimana" (tutti gli allarmi)
- Tab "Tutti i clienti" (250 regolari)
- Filtri: per allarme, per zona, per ultimo contatto
- Riga: nome, tel, fatturato 3M, allarme badge, cons/sett, silenzio gg, ultimo contatto, [feedback btn], [chiama], [naviga mappa]

### Componente 2 — Skill `clienti-mancanti` (gia creata, da consolidare)

Rinominata implicitamente come "skill di analisi" della pagina. Cosa fa:
- Usa `date_done` su `stock.picking` (mai `date_order`)
- Calcola allarme reale basato su silenzio vs cons/sett storiche
- Output: JSON con 250 clienti ordinati per priorita

Sincronizzata su ogni agente: Stella, Vanessa, Romeo, Diana (per permettere drill-down puntuale quando richiesto).

### Componente 3 — Cron settimanale + notifica

**Su LAPA-SALES (Windows Task Scheduler):**

| Task | Quando | Cosa fa |
|------|--------|---------|
| `recupero-snapshot-domenica` | Dom 18:00 | Lancia skill, salva snapshot JSON in filesystem Vanessa + scrive flag in `whatsapp.db` |
| `recupero-notifica-mattina` | Lun-Sab 8:00 | Script Node legge snapshot, costruisce messaggio, inserisce riga in tabella `outgoing_messages` di `whatsapp.db` |
| Bot Vanessa (invariato) | sempre attivo | Quando riceve evento esterno o tramite skill, manda messaggio. |

**Canale notifica confermato**: **Telegram** via `send_telegram.py` (gia esistente su LAPA-SALES e Stella PC).
Motivo: zero rischio sui bot WhatsApp in produzione, gia testato, immediato.

Rollover a WhatsApp via Vanessa rimandato a Fase 2-bis (dopo che il sistema funziona e Paul vuole migrare).

### Componente 4 — Stella Voce (feature nuova)

**Architettura:**
```
Mihai/Paul parla al mic (browser)
    ↓
Audio stream → pagina web su stella-voce.lapa.ch (servita da Stella PC locale)
    ↓
OpenAI Whisper API → testo
    ↓
Claude Sonnet 4.6 via Anthropic API con:
  - System prompt IDENTICO a Stella (caricato da /home/lapa/stella-whatsapp-bot/CLAUDE.md)
  - MCP Odoo (config condivisa con Stella)
  - Skill in /home/lapa/stella-agent/skills/
  - Lettura file-system LOCALE Stella (whatsapp.db, memory SQLite, note)
  - Scrittura su stesso DB feedback che usa il bot WhatsApp (tabella condivisa)
    ↓
Risposta testuale → OpenAI TTS API → audio stream al browser
```

**Localizzazione**: il servizio gira SU Stella PC (non su Vercel). Motivo: accesso diretto a file system e SQLite di Stella. Zero sync, zero latenza dati.

**Esposizione pubblica**: Cloudflare Tunnel `stella-voce.lapa.ch` → Stella PC porta 3010.

**Non tocca il bot WhatsApp esistente**: e un processo separato che legge gli stessi file ma non modifica `bot.js`.

**Componenti tecnici:**
- `voice-service/` su Stella: nuovo repo git, Node.js + Next.js
- `voice-service/pages/index.tsx`: pagina con MediaRecorder API, WebSocket streaming
- `voice-service/api/chat`: endpoint che riceve audio chunks, chiama Whisper, chiama Claude, chiama TTS
- `voice-service/lib/stella-brain.ts`: costruisce il prompt come Stella (usa stesso CLAUDE.md + stesso MCP config)
- Cloudflared config: `stella-voce.lapa.ch` → `localhost:3010`

**Trigger WhatsApp**:
- Stella gia ha skill che legge richieste e risponde. Aggiungo skill `voce` in `/home/lapa/stella-agent/skills/voce.md`:
  ```
  Quando l'utente dice "voglio parlare con te" / "parlami" / "voce" / "chiamata":
  rispondi con: "Certo! Apri qui: https://stella-voce.lapa.ch/<user>"
  dove <user> e 'paul' se e Paul, 'mihai' se e Mihai, ecc.
  ```
- Zero modifica a `bot.js`. Solo un file skill nuovo.

### Componente 5 — Rollout multi-agente

Dopo che la voce funziona su Stella (2 settimane di test con Paul), replichiamo:

- Vanessa → `vanessa-voce.lapa.ch` (per Mihai, a LAPA-SALES)
- Romeo → `romeo-voce.lapa.ch` (per Laura)
- Diana → `diana-voce.lapa.ch` (per staff)

Pattern identico: voice-service dentro la macchina dell'agente + Cloudflare Tunnel.

---

## Dati e Persistenza

**DB operativo condiviso**: tabella `clienti_feedback` su **Vercel Postgres** (Neon via Vercel integration) che tutti leggono/scrivono:

```sql
CREATE TABLE clienti_feedback (
  partner_id INTEGER NOT NULL,
  week_start DATE NOT NULL,
  status VARCHAR(20),         -- da_contattare/contattato/attivo/perso
  feedback_text TEXT,
  last_contact_type VARCHAR(20),  -- visita/telefonata/whatsapp
  last_contact_date TIMESTAMP,
  next_contact_hint VARCHAR(100),
  updated_by VARCHAR(50),     -- paul/mihai/laura/stella/vanessa
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (partner_id, week_start)
);
```

Sostituisce l'attuale `data/clienti-mancanti-feedback.json` (persistente solo su Vercel disk, perso ad ogni deploy).

**Ready**: HUB ha gia Vercel Postgres (da verificare) o possiamo aggiungere.

---

## Piano Implementazione

### Fase 1 — Consolidamento HUB (1-2 giorni)

1. Creare Postgres `clienti_feedback` su Vercel (o JSON Blob se Postgres non setup)
2. Rifattorizzare `/api/recupero-clienti/route.ts` per servire dati live come `/api/clienti-mancanti` (con campi allarme/silenzio/cons_sett)
3. Aggiornare `/recupero-clienti/page.tsx` per usare nuova API + aggiungere tabs + filtro
4. Rimuovere `/clienti-mancanti` e `/api/clienti-mancanti` (duplicato)
5. Rimuovere `clienti-data.ts` statico
6. Deploy staging + produzione

### Fase 2 — Cron + Notifica (1 giorno)

1. Script Node su LAPA-SALES: `~/vanessa-agent/scripts/recupero-snapshot.js`
   - Chiama API HUB per snapshot settimanale
   - Scrive risultato in filesystem locale
   - Invia messaggio via Telegram a Mihai con link

2. Task Scheduler Windows:
   - Domenica 18:00: `node ~/vanessa-agent/scripts/recupero-snapshot.js --snapshot`
   - Lunedi-Sabato 8:00: `node ~/vanessa-agent/scripts/recupero-snapshot.js --notify`

3. Stessa cosa su Stella PC per Paul (Task Scheduler Stella).

### Fase 3 — Stella Voce MVP (2-3 giorni)

1. Nuovo progetto `/home/lapa/stella-voce-service/` (Node.js + Next.js)
2. Implementare UI (pagina mic/speaker)
3. Implementare API `/api/chat` (Whisper → Claude → TTS)
4. Brain: **Node.js + Anthropic SDK** (non Claude Code CLI per latenza bassa):
   - Carica system prompt da `/home/lapa/stella-whatsapp-bot/CLAUDE.md`
   - Tool definitions costruite da `/home/lapa/stella-agent/skills/*.md` (convertite a Anthropic tool_use format all'avvio del server)
   - Connessione MCP Odoo live (stessa config del bot)
   - Legge `/home/lapa/stella-whatsapp-bot/whatsapp.db` read-only per contesto chat recenti
   - Scrive su tabella `clienti_feedback` (Vercel Postgres) per aggiornamenti
5. Setup Cloudflare Tunnel `stella-voce.lapa.ch` (richiede login Paul)
6. Deploy come Windows service via Task Scheduler + NSSM (always-on)

### Fase 4 — Skill Stella "voglio parlare" (1 ora)

1. Creare `/home/lapa/stella-agent/skills/voce.md`
2. Test: WhatsApp "voglio parlare" → Stella risponde con link

### Fase 5 — Test con Paul (1-2 settimane)

Paul usa il sistema ogni giorno. Feedback loop.

### Fase 6 — Rollout (1 settimana per agente)

Replica voce-service su Vanessa/LAPA-SALES per Mihai.
Poi Romeo per Laura.
Poi Diana.

---

## Cosa serve da Paul (blockers)

- [ ] Autorizzazione Cloudflare login su Stella PC (per installare cloudflared e creare tunnel)
- [ ] OpenAI API key (Whisper + TTS) — serve aggiungere su Stella PC come env var
- [ ] Anthropic API key (per Claude) — probabilmente gia disponibile da Claude Code
- [ ] Conferma che lavoro sul DB feedback su Vercel Postgres (o alternativa)
- [ ] Numero Mihai confermato per notifica cron (forse Telegram inizialmente per evitare di toccare bot)

---

## Rischi e mitigazioni

| Rischio | Probabilita | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Mihai non usa la pagina | Alta | Alto | Vanessa lo "stimola" con WhatsApp + voce conversazionale. Paul ci sta dietro. |
| Voice service rompe Stella bot | Bassa | Alto | Processo separato, zero modifiche a bot.js. Stella bot continua indipendente. |
| Cloudflare Tunnel cade | Bassa | Medio | Fallback: link SSH tunnel locale se Paul e in ufficio. |
| OpenAI costo esplode | Media | Medio | Monitoring uso, budget alert $50/mese. Se esplode, disabilita auto. |
| Dati feedback persi | Media | Alto | Postgres su Vercel (backup auto) invece di JSON su disk. |
| Vanessa manda troppi WhatsApp | Media | Alto | Rate limit: max 1 messaggio/giorno automatico per cliente. Log di tutti gli invii. |
| Numero Mihai non in memoria | Bassa | Basso | Chiedere a Paul. |

---

## Metriche di successo

Dopo 2 settimane di test con Paul su Stella:
- [ ] Paul apre `stella-voce.lapa.ch` almeno 5 volte/settimana
- [ ] Latency voce < 2 secondi per risposta
- [ ] Tasso di comprensione Whisper > 90% (italiano)
- [ ] Zero incidenti su bot Stella esistente

Dopo 2 settimane di test con Mihai su Vanessa:
- [ ] Mihai tocca almeno 80 clienti/mese tra visite/call/WhatsApp
- [ ] Allarmi GRAVE ridotti del 50% settimana su settimana
- [ ] Feedback loop: Mihai aggiorna almeno 50% dei clienti contattati
- [ ] Tasso di risposta ai WhatsApp di Vanessa > 30%

---

## Appendice — Stack tecnico

- **Frontend HUB**: Next.js 14 App Router (esistente)
- **DB feedback**: Vercel Postgres o Neon (da decidere)
- **MCP Odoo**: gia esistente, stesso per bot + voce
- **Voice backend**: Node.js 20 + Next.js 14 su Stella PC (Windows con WSL Ubuntu)
- **Audio**: MediaRecorder API → WebSocket → Whisper → Claude → TTS → audio stream
- **Tunnel**: Cloudflare Tunnel (cloudflared daemon su ogni macchina agente)
- **Cron**: Windows Task Scheduler
- **Notifica mattina**: Telegram (se cron → bot WhatsApp e rischioso) oppure inserimento riga in `whatsapp.db outgoing_messages` con nuovo poller aggiunto via skill (no bot.js)
