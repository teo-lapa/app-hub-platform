# Progetto: Miglioramento Continuo degli Agenti AI LAPA

**Data**: 3 Gennaio 2026
**Versione**: 1.0
**Stato**: Proposta

---

## 1. Contesto e Situazione Attuale

### 1.1 Cosa Abbiamo Oggi

Il sistema LAPA AI Agents è composto da:

| Componente | Descrizione | Stato |
|------------|-------------|-------|
| **Orchestrator** | Router centrale che analizza intent e smista ai vari agenti | ✅ Attivo |
| **5 Agenti Specializzati** | Ordini, Fatture, Prodotti, Spedizioni, Helpdesk | ✅ Attivi |
| **Sistema RAG** | Ricerca semantica prodotti con pgvector | ✅ Attivo |
| **Storico Conversazioni** | Salvate in Vercel KV (Redis) | ✅ Attivo |
| **Canali** | Web chat, WhatsApp, API | ✅ Attivi |
| **Statistiche Base** | Durata, successo, escalation | ✅ Parziale |

### 1.2 Il Problema

Attualmente **non esiste un processo strutturato** per:
- Analizzare le conversazioni e identificare errori
- Raccogliere feedback dagli utenti
- Migliorare sistematicamente le risposte degli agenti
- Arricchire la knowledge base con nuove informazioni

Gli agenti funzionano con i prompt iniziali, ma **non imparano** dalle interazioni.

### 1.3 Dati Disponibili

Ogni conversazione salvata contiene:
```
- sessionId / customerId / parentId (B2B)
- customerName, customerType (b2b/b2c)
- channels: ['web', 'whatsapp']
- messages[]:
  - role: 'user' | 'assistant'
  - content: testo del messaggio
  - timestamp
  - agentId: quale agente ha risposto
  - channel: da dove è arrivato
- createdAt, updatedAt
```

---

## 2. Obiettivi del Progetto

### 2.1 Obiettivo Principale
Creare un **sistema di miglioramento continuo** che permetta di:
1. Analizzare le conversazioni per identificare problemi
2. Raccogliere feedback dagli utenti
3. Migliorare le risposte degli agenti nel tempo
4. Arricchire la knowledge base con nuove informazioni

### 2.2 Obiettivi Misurabili

| KPI | Attuale | Target |
|-----|---------|--------|
| Tasso di escalation umana | ~15% (stimato) | < 5% |
| Soddisfazione utente | Non misurata | > 4.5/5 |
| Risposte "non so" | Non misurato | < 3% |
| Tempo medio risposta | ~3s | < 2s |

---

## 3. Strategia di Miglioramento

### 3.1 Le 4 Leve del Miglioramento

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIGLIORAMENTO AGENTI AI                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   PROMPT     │  │     RAG      │  │   FEEDBACK   │           │
│  │ ENGINEERING  │  │ ENHANCEMENT  │  │    LOOP      │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  Modificare le     Arricchire la     Raccogliere               │
│  istruzioni        knowledge base    valutazioni               │
│  degli agenti      con documenti     dagli utenti              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    ANALYTICS                              │   │
│  │         Dashboard per analisi conversazioni               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Dettaglio delle Leve

#### A) Prompt Engineering
**Cosa**: Modificare i system prompt degli agenti per migliorare le risposte

**Come funziona**:
1. Analizzo conversazioni con risposte sbagliate
2. Identifico pattern di errori (es: "non capisce richieste di reso")
3. Aggiungo istruzioni/esempi nel prompt dell'agente
4. Testo e verifico miglioramento

**Esempio pratico**:
```
PRIMA: L'agente non sa gestire "voglio restituire il prodotto"
DOPO:  Aggiungo nel prompt: "Per richieste di reso, chiedi numero ordine
       e motivo, poi crea ticket helpdesk con categoria 'reso'"
```

**Vantaggi**: Gratuito, veloce, efficace
**Svantaggi**: Richiede analisi manuale, non scala

---

#### B) RAG Enhancement
**Cosa**: Arricchire la knowledge base con documenti e FAQ

**Come funziona**:
1. Creo documenti con informazioni utili (FAQ, policy, guide)
2. Il sistema genera embeddings (vettori semantici)
3. Quando l'utente chiede qualcosa, il sistema cerca nei documenti
4. L'agente usa le informazioni trovate per rispondere

**Esempio pratico**:
```
DOCUMENTO: "Politica Resi LAPA"
- I resi sono accettati entro 14 giorni
- Il prodotto deve essere integro
- Contattare helpdesk per autorizzazione
- Il rimborso avviene in 5-7 giorni lavorativi

DOMANDA UTENTE: "Posso restituire il pesce che ho comprato ieri?"
RISPOSTA: "Sì, i resi sono accettati entro 14 giorni. Il prodotto deve
          essere integro. Vuoi che apra una richiesta di reso?"
```

**Vantaggi**: Molto potente, risposte precise e aggiornabili
**Svantaggi**: Richiede creazione contenuti, costo embeddings (~$0.02/1000 docs)

---

#### C) Feedback Loop
**Cosa**: Raccogliere valutazioni dagli utenti per identificare problemi

**Come funziona**:
1. Dopo ogni risposta, mostro 👍 👎
2. Salvo i feedback nel database
3. Periodicamente analizzo i feedback negativi
4. Uso i pattern per migliorare prompt/RAG

**Esempio pratico**:
```
CONVERSAZIONE:
User: "Quanto costa la spedizione?"
Agent: "Le spedizioni sono gestite dal nostro team logistica."
User: 👎 (feedback negativo)

ANALISI: L'agente non ha risposto alla domanda sui costi
AZIONE: Aggiungo nel RAG documento con tabella costi spedizione
```

**Vantaggi**: Feedback diretto dagli utenti, prioritizzazione automatica
**Svantaggi**: Richiede implementazione UI, utenti potrebbero non votare

---

#### D) Analytics Dashboard
**Cosa**: Interfaccia per analizzare conversazioni e metriche

**Componenti**:
1. **Lista conversazioni** con filtri (data, agente, canale, keyword)
2. **Dettaglio conversazione** con messaggi e metadata
3. **Metriche aggregate** (conversazioni/giorno, tasso escalation, etc.)
4. **Segnalazione problemi** (marcare conversazioni da rivedere)

---

## 4. Fasi del Progetto

### Fase 1: Analytics Dashboard
**Obiettivo**: Vedere e analizzare le conversazioni esistenti

**Deliverables**:
- [ ] Lista conversazioni con filtri
- [ ] Vista dettaglio conversazione
- [ ] Filtro per agente, canale, data
- [ ] Ricerca per keyword
- [ ] Funzione "segnala problema"
- [ ] Export CSV per analisi

**Stima**: 3-4 giorni

---

### Fase 2: Sistema Feedback
**Obiettivo**: Raccogliere valutazioni dagli utenti

**Deliverables**:
- [ ] Bottoni 👍 👎 nella chat web
- [ ] Bottoni feedback anche su WhatsApp (opzionale)
- [ ] Storage feedback in database
- [ ] Vista feedback nella dashboard
- [ ] Report settimanale automatico

**Stima**: 4-5 giorni

---

### Fase 3: Knowledge Base Manager
**Obiettivo**: Gestire documenti e prompt da interfaccia

**Deliverables**:
- [ ] Upload documenti (PDF, TXT, MD)
- [ ] Editor per FAQ
- [ ] Gestione prompt agenti da UI
- [ ] Versionamento modifiche
- [ ] Test prompt prima di deploy

**Stima**: 5-7 giorni

---

### Fase 4: Analisi Automatica (Avanzato)
**Obiettivo**: AI che analizza e suggerisce miglioramenti

**Deliverables**:
- [ ] Job che analizza conversazioni negative
- [ ] Clustering problemi simili
- [ ] Suggerimenti automatici miglioramenti
- [ ] Alert per nuovi pattern di errore

**Stima**: 5-7 giorni

---

## 5. Architettura Tecnica Proposta

### 5.1 Nuove Tabelle Database

```sql
-- Feedback utenti
CREATE TABLE ai_feedback (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  message_index INT NOT NULL,
  rating VARCHAR(20) NOT NULL,  -- 'positive', 'negative'
  comment TEXT,
  agent_id VARCHAR(100),
  channel VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Documenti Knowledge Base
CREATE TABLE ai_knowledge_docs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  embedding VECTOR(1536),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Versioni Prompt Agenti
CREATE TABLE ai_agent_prompts (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(100) NOT NULL,
  version INT NOT NULL,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Conversazioni segnalate per review
CREATE TABLE ai_conversation_flags (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  flag_type VARCHAR(50) NOT NULL,  -- 'review', 'resolved', 'training'
  notes TEXT,
  flagged_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 Nuove API

```
POST /api/ai-admin/feedback          - Salva feedback utente
GET  /api/ai-admin/conversations     - Lista conversazioni con filtri
GET  /api/ai-admin/conversations/:id - Dettaglio conversazione
POST /api/ai-admin/conversations/:id/flag - Segnala conversazione

GET  /api/ai-admin/knowledge         - Lista documenti KB
POST /api/ai-admin/knowledge         - Crea documento
PUT  /api/ai-admin/knowledge/:id     - Modifica documento
DEL  /api/ai-admin/knowledge/:id     - Elimina documento

GET  /api/ai-admin/prompts/:agentId  - Lista versioni prompt
POST /api/ai-admin/prompts/:agentId  - Crea nuova versione
PUT  /api/ai-admin/prompts/:agentId/activate/:version - Attiva versione

GET  /api/ai-admin/analytics         - Metriche aggregate
GET  /api/ai-admin/analytics/report  - Report settimanale
```

### 5.3 Nuove Pagine UI

```
/admin/ai-agents/conversations     - Lista e analisi conversazioni
/admin/ai-agents/feedback          - Vista feedback ricevuti
/admin/ai-agents/knowledge         - Gestione knowledge base
/admin/ai-agents/prompts           - Gestione prompt agenti
/admin/ai-agents/analytics         - Dashboard metriche
```

---

## 6. Costi Stimati

### 6.1 Costi di Sviluppo
| Fase | Giorni | Note |
|------|--------|------|
| Fase 1 - Analytics | 3-4 | Dashboard base |
| Fase 2 - Feedback | 4-5 | Sistema raccolta |
| Fase 3 - Knowledge | 5-7 | Gestione documenti |
| Fase 4 - Auto-analisi | 5-7 | Opzionale |
| **Totale** | **17-23** | |

### 6.2 Costi Operativi Mensili
| Voce | Costo | Note |
|------|-------|------|
| OpenAI Embeddings | ~$5-20 | Per nuovi documenti KB |
| Analisi automatica | ~$20-50 | Se attivata Fase 4 |
| Storage aggiuntivo | ~$5 | Feedback + documenti |
| **Totale** | **~$30-75/mese** | |

---

## 7. Raccomandazione

### Approccio Consigliato

**Partire con Fase 1 + Fase 2** perché:

1. **Fase 1 (Analytics)** ti permette di:
   - Vedere subito cosa funziona e cosa no
   - Identificare i problemi più frequenti
   - Prendere decisioni basate su dati reali

2. **Fase 2 (Feedback)** ti permette di:
   - Sapere cosa pensano gli utenti
   - Prioritizzare i miglioramenti
   - Misurare l'impatto delle modifiche

Con queste due fasi puoi già:
- Fare Prompt Engineering manuale basato su dati
- Decidere se serve la Fase 3 (Knowledge Base)
- Capire se vale la pena automatizzare (Fase 4)

### Prossimi Passi

1. **Approvare** questo documento di progetto
2. **Decidere** da quale fase partire
3. **Pianificare** le risorse e i tempi
4. **Iniziare** l'implementazione

---

## 8. Domande Aperte

1. Vuoi partire dalla Fase 1 (Analytics) per vedere prima i dati?
2. Serve anche l'analisi WhatsApp o solo web chat?
3. Chi dovrà usare la dashboard di admin? (solo te o anche altri?)
4. Ci sono già FAQ o documenti da caricare nella knowledge base?

---

*Documento creato da Claude AI - 3 Gennaio 2026*
