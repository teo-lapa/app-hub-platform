# Progetto: Miglioramento Manuale Agenti AI LAPA

## Sistema Avatar - ATTIVO IN PRODUZIONE

Il sistema avatar è ora **attivo**! Gli agenti leggono automaticamente l'avatar quando rispondono.

### File del Sistema Avatar
- `/lib/lapa-agents/memory/conversation-memory.ts` - Interface `CustomerAvatar` + metodi
- `/lib/lapa-agents/avatar-service.ts` - Servizio wrapper per gestire avatar

### Cosa Contiene un Avatar (nel database Vercel KV)
```typescript
{
  preferredTone: 'formal' | 'informal' | 'friendly',
  preferredLanguage: 'it' | 'de' | 'fr' | 'en',
  usesEmoji: boolean,
  communicationNotes?: string,       // "va di fretta", "ama chiacchierare"
  birthday?: string,                 // "03-15" per 15 marzo
  importantDates?: [{date, occasion}],
  personalNotes?: [{date, content}], // Cose da ricordare
  followups?: [{date, action, done}], // Da chiedere al prossimo contatto
  orderPatterns?: {preferredDay, usualProducts, deliveryNotes}
}
```

### Come gli Agenti Usano l'Avatar
Quando un cliente registrato scrive, l'agente riceve:
```
--- PROFILO CLIENTE (parla come un amico!) ---
Tono preferito: amichevole
Usa emoji nelle risposte!
Note: ama chiacchierare, non ha mai fretta
🎂 OGGI È IL COMPLEANNO! Fai gli auguri!
Cose da ricordare:
  - La figlia si sposa ad aprile
Da chiedere al cliente:
  - Come è andato l'evento di sabato?
Ordina di solito: venerdì
Prodotti abituali: salmone, gamberi, ostriche
--- FINE PROFILO ---
```

---

## Come Funziona il Processo Manuale

Ogni giorno (o quando lo chiedi), io (Claude) vado a:
1. Leggere le conversazioni recenti non ancora analizzate
2. Migliorare i prompt degli agenti dove serve
3. **Aggiornare gli avatar nel database (Vercel KV)** - Non più solo file locali!
4. Annotare cosa ho fatto nel log locale

---

## Comando da Dare

Quando vuoi che faccia l'analisi, scrivi:

```
Vai a migliorare gli agenti AI. Leggi le conversazioni recenti e:
1. Migliora i prompt degli agenti dove serve
2. Aggiorna gli avatar degli utenti
3. Scrivi nel log cosa hai fatto
```

---

## Struttura del Progetto

```
ai-improvement/
├── README.md                    # Questo file
├── prompts/                     # I prompt che uso per lavorare
│   ├── analyze-conversations.md # Come analizzo le conversazioni
│   ├── improve-agents.md        # Come miglioro gli agenti
│   └── build-avatar.md          # Come costruisco gli avatar
├── avatars/                     # BACKUP LOCALE degli avatar (opzionale)
│   └── {customer_id}.md         # Es: 1234.md per cliente 1234
├── logs/                        # Log delle mie analisi giornaliere
│   └── YYYY-MM-DD.md            # Es: 2026-01-03.md
├── agent-improvements/          # Miglioramenti per ogni agente
│   ├── orchestrator.md          # Note sull'orchestrator
│   ├── orders-agent.md          # Note sull'agente ordini
│   ├── products-agent.md        # Note sull'agente prodotti
│   ├── invoices-agent.md        # Note sull'agente fatture
│   ├── shipping-agent.md        # Note sull'agente spedizioni
│   └── helpdesk-agent.md        # Note sull'agente helpdesk
└── knowledge/                   # Conoscenze apprese
    ├── common-questions.md      # Domande frequenti
    ├── common-errors.md         # Errori comuni da evitare
    └── best-practices.md        # Best practice scoperte
```

---

## Due Tipi di Utenti

### 1. Utenti Registrati (con account Odoo)
Per questi creo un **avatar nel database**:
- Nome, azienda, ruolo
- Stile di comunicazione preferito
- Prodotti che compra di solito
- Date importanti (compleanno, anniversario azienda, etc.)
- Cose che ha menzionato (impegni, progetti, preferenze)
- Follow-up da fare

**Obiettivo**: Parlare come un amico che lo conosce bene

### 2. Visitatori (non registrati)
Per questi uso un approccio standard:
- Prompt chiaro per convertirli in clienti
- Focus su aiutarli e farli registrare
- Nessun avatar persistente

**Obiettivo**: Convertirli in clienti registrati

---

## Cosa Miglioro

### Per gli Agenti (modifico il codice)
- Risposte che non hanno funzionato
- Casi non gestiti bene
- Tono di comunicazione
- Gestione errori

### Per gli Avatar (aggiorno il database)
- Nuove informazioni personali menzionate
- Preferenze di acquisto
- Stile di comunicazione
- Date da ricordare
- Cose da chiedere al prossimo contatto

---

## Log Giornaliero

Ogni volta che analizzo, creo un file `logs/YYYY-MM-DD.md` con:
- Quante conversazioni analizzate
- Quali avatar aggiornati
- Quali miglioramenti fatti agli agenti
- Problemi trovati
- Prossime cose da fare

---

## Come Aggiorno gli Avatar

Quando trovo info da salvare, uso le API:

```typescript
// Esempio: aggiorno avatar cliente 1234
const memoryService = getMemoryService();

// Imposta stile comunicazione
await memoryService.updateAvatar(1234, {
  preferredTone: 'friendly',
  usesEmoji: true,
  communicationNotes: 'ama chiacchierare'
});

// Aggiungi nota personale
await memoryService.addPersonalNote(1234, 'La figlia si sposa ad aprile');

// Aggiungi follow-up
await memoryService.addFollowup(1234, 'Chiedere come è andato il matrimonio');

// Imposta compleanno
await memoryService.updateAvatar(1234, { birthday: '03-15' });
```

---

## Come Attivare l'Automazione (Futuro)

Quando questo processo manuale funziona bene, possiamo:
1. Creare un cron job che gira ogni notte
2. Usare Claude API per analizzare automaticamente
3. Applicare miglioramenti in modo programmatico
4. Inviare report giornaliero via email

Ma per ora, **iniziamo manuale** per capire bene cosa funziona.
