# 🌟 Stella - Assistente AI per Clienti e Dipendenti

## 📋 Panoramica del Progetto

**Stella** è un'applicazione di assistenza clienti basata su AI che fornisce supporto in tempo reale tramite chat con avatar virtuale. L'applicazione è progettata per gestire richieste clienti attraverso un'interfaccia intuitiva con pulsanti predefiniti per azioni specifiche.

## 🎯 Obiettivi Principali

- **Assistenza Clienti Automatizzata**: Chat AI in tempo reale per supporto clienti
- **Interfaccia Semplificata**: Pulsanti predefiniti per azioni comuni
- **Avatar Virtuale**: Donna bionda che rappresenta "Stella"
- **Integrazione Odoo**: Connessione diretta con i dati cliente
- **Multi-modal**: Supporto per testo, foto e allegati

## 🚀 Funzionalità Chiave

### 🔐 Autenticazione e Contesto
- **Login Automatico**: L'utente è già autenticato (no ricerca cliente)
- **Dati Utente**: Accesso automatico ai dati del cliente loggato
- **Sessione Persistente**: Mantenimento del contesto durante la conversazione

### 🎪 Interfaccia Chat
- **Avatar Stella**: Donna bionda animata come interfaccia principale
- **Chat Real-Time**: Conversazione fluida con OpenAI Real-Time API
- **Input Multi-modale**:
  - ✅ Scrittura testo
  - ✅ Upload foto
  - ✅ Allegati vari

### 🎛️ Azioni Predefinite (Pulsanti)

#### 1. 📦 **Voglio Fare un Ordine**
- Attiva task specifico per gestione ordini
- Accesso diretto al catalogo prodotti
- Integrazione con offerte attive

#### 2. 😤 **Lamentele**
- Gestione reclami e problemi
- Raccolta feedback clienti
- Escalation automatica se necessario

#### 3. 🔍 **Ricerca Prodotto**
- Ricerca nel catalogo Odoo
- Suggerimenti personalizzati
- Informazioni su disponibilità e prezzi

#### 4. 🔧 **Richiesta di Intervento**
- Gestione richieste tecniche
- Supporto post-vendita
- Programmazione interventi

#### 5. ❓ **Altre Richieste**
- Categoria catch-all per richieste generiche
- Routing intelligente verso operatori umani

## 🏗️ Architettura Tecnica

### 📁 Struttura File
```
app/
├── stella-assistant/
│   ├── page.tsx              # Componente principale
│   ├── components/
│   │   ├── Avatar.tsx         # Avatar di Stella
│   │   ├── ChatInterface.tsx  # Interfaccia chat
│   │   ├── ActionButtons.tsx  # Pulsanti azioni
│   │   └── FileUpload.tsx     # Upload allegati
│   └── types/
│       └── stella.types.ts    # TypeScript definitions
```

### 🔌 Integrazioni API

#### OpenAI Real-Time API
- **Endpoint**: `/api/openai/realtime`
- **Funzionalità**: Chat conversazionale in tempo reale
- **Prompt Personalizzati**: Task specifici per ogni azione

#### Odoo Integration
- **Endpoint**: `/api/odoo/rpc`
- **Funzionalità**:
  - Accesso dati cliente
  - Gestione ordini
  - Catalogo prodotti
  - Gestione interventi

### 🎨 Design UI/UX

#### Colori e Tema
- **Primario**: Blu/Azzurro (#3B82F6)
- **Secondario**: Oro/Giallo (#F59E0B)
- **Sfondo**: Gradiente chiaro
- **Accenti**: Rosa per Stella (#EC4899)

#### Avatar Stella
- **Stile**: Illustrazione moderna, friendly
- **Caratteristiche**: Donna bionda, professionale ma approachable
- **Animazioni**: Micro-interazioni durante la conversazione
- **Stati**: Listening, Thinking, Speaking

#### Layout Responsivo
- **Mobile-First**: Ottimizzato per smartphone
- **Desktop**: Layout espanso con sidebar
- **Tablet**: Interfaccia bilanciata

## 🔄 Flusso Utente

### 1. **Accesso**
```
Login Utente → Accesso Diretto a Stella → Caricamento Dati Cliente
```

### 2. **Interazione Base**
```
Schermata Principale → Pulsanti Azione → Chat con Stella → Risoluzione
```

### 3. **Flusso Ordine**
```
"Voglio Fare Ordine" → Caricamento Catalogo → Selezione Prodotti → Conferma → Invio a Sistema
```

### 4. **Flusso Lamentela**
```
"Lamentele" → Raccolta Dettagli → Classificazione → Assegnazione → Follow-up
```

## 🎯 Task e Prompt Backend

### Task Configurabili
Ogni pulsante attiva un task specifico con:
- **Prompt Personalizzato**: Contesto specifico per l'azione
- **Dati Cliente**: Informazioni precaricate
- **Workflow**: Step predefiniti per la risoluzione

#### Esempio Task "Ordine":
```json
{
  "task_type": "new_order",
  "prompt": "Sei Stella, assistente specializzata negli ordini. Il cliente {cliente_nome} vuole effettuare un ordine. Hai accesso al suo storico acquisti e alle offerte attive. Guidalo nella selezione...",
  "context": {
    "cliente_id": "123",
    "offerte_attive": [...],
    "storico_ordini": [...]
  }
}
```

## 📊 Analytics e Monitoring

### Metriche Chiave
- **Conversazioni Attive**: Numero sessioni simultanee
- **Tempo Medio Risoluzione**: Per ogni tipo di richiesta
- **Satisfaction Score**: Rating clienti post-conversazione
- **Escalation Rate**: % richieste passate a operatori umani

### Dashboard Admin
- **Real-time Monitoring**: Conversazioni in corso
- **Performance Metrics**: Tempi risposta, accuratezza
- **Cliente Insights**: Richieste più frequenti, pattern

## 🛠️ Sviluppo e Deploy

### Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, OpenAI API, Odoo RPC
- **Database**: Odoo PostgreSQL
- **Real-time**: WebSocket, Server-Sent Events

### Environment Variables
```env
OPENAI_API_KEY=sk-...
ODOO_URL=https://...
ODOO_DB=...
STELLA_AVATAR_URL=...
```

### Deployment
- **Sviluppo**: `npm run dev` su localhost:3005
- **Staging**: Deploy automatico su commit
- **Produzione**: Server dedicato con SSL

## 🔮 Roadmap Futura

### Fase 1 (MVP)
- ✅ Setup base progetto
- ⏳ Interfaccia chat basica
- ⏳ Avatar statico Stella
- ⏳ 4 pulsanti azione principali
- ⏳ Integrazione OpenAI basic

### Fase 2 (Enhancement)
- ⏳ Avatar animato
- ⏳ Upload allegati/foto
- ⏳ Voice input/output
- ⏳ Mobile app nativa

### Fase 3 (Advanced)
- ⏳ AI Learning da conversazioni
- ⏳ Sentiment Analysis
- ⏳ Multi-language support
- ⏳ Integration con CRM esterno

## 👥 Team e Ruoli

- **Developer**: Claude (Sviluppo completo)
- **Product Owner**: Lapa (Specifiche e testing)
- **End Users**: Clienti e dipendenti LAPA

## 📞 Support

Per supporto tecnico o richieste di modifica, contattare il team di sviluppo.

---
*Documento creato il 29 Settembre 2025*
*Versione: 1.0*