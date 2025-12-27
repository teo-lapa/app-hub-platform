# Helpdesk Agent - Guida Rapida

## Installazione e Setup

L'Helpdesk Agent è già configurato e pronto all'uso. Utilizza automaticamente `createOdooRPCClient` per connettersi ai dati reali di Odoo.

## File Principali

```
lib/lapa-agents/agents/
├── helpdesk-agent.ts              # Agent principale
├── test-helpdesk-agent.ts         # Script di test
├── example-api-route.ts           # Esempio API route Next.js
├── HELPDESK_AGENT_INTEGRATION.md  # Documentazione completa
└── README_HELPDESK.md             # Questa guida
```

## Quick Start

### 1. Uso Base

```typescript
import { createHelpdeskAgent } from '@/lib/lapa-agents/agents/helpdesk-agent';

// Crea agent
const agent = createHelpdeskAgent();

// Crea ticket
const result = await agent.createTicket({
  customerId: 123,
  subject: 'Problema con ordine',
  description: 'Il mio ordine non è arrivato',
  priority: '2'
});

console.log('Ticket ID:', result.ticketId);
```

### 2. Test

Esegui il test per verificare l'integrazione:

```bash
npx ts-node lib/lapa-agents/agents/test-helpdesk-agent.ts
```

### 3. Integrazione in Next.js

Copia `example-api-route.ts` in `app/api/helpdesk/route.ts` e usa le API:

```typescript
// Client-side
const response = await fetch('/api/helpdesk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'create',
    customerId: 123,
    subject: 'Richiesta supporto',
    description: 'Dettagli...',
    priority: '1'
  })
});

const result = await response.json();
```

## Metodi Disponibili

### createTicket()
Crea un nuovo ticket helpdesk.

```typescript
const result = await agent.createTicket({
  customerId: number,
  subject: string,
  description: string,
  priority?: '0' | '1' | '2' | '3',
  attachments?: Array<{
    name: string,
    content: string, // base64
    mimetype: string
  }>
});
```

### getCustomerTickets()
Ottiene tutti i ticket di un cliente.

```typescript
const result = await agent.getCustomerTickets(customerId);
```

### getTicketDetails()
Ottiene dettagli completi di un ticket.

```typescript
const result = await agent.getTicketDetails(ticketId);
```

### addComment()
Aggiunge un commento a un ticket.

```typescript
const result = await agent.addComment(
  ticketId,
  'Messaggio...',
  false // internal
);
```

## Modello Odoo

L'agent usa il modello `helpdesk.ticket` con questi campi principali:

- `id`: ID del ticket
- `name`: Oggetto
- `description`: Descrizione
- `partner_id`: Cliente
- `team_id`: Team helpdesk
- `stage_id`: Stage corrente
- `priority`: Priorità (0-3)
- `user_id`: Utente assegnato
- `create_date`: Data creazione
- `message_ids`: Commenti

## Fallback Automatico

Se il modulo `helpdesk.ticket` non è disponibile in Odoo, l'agent usa automaticamente `mail.message` come fallback. Il comportamento è trasparente per l'utente.

## Notifiche

L'agent invia automaticamente email a `lapa@lapa.ch` quando:
- Viene creato un nuovo ticket
- Un ticket viene escalato
- È richiesta attenzione immediata

## Supporto Multilingua

Disponibile in:
- Italiano (default)
- Inglese
- Tedesco

```typescript
const agent = createHelpdeskAgent(undefined, 'en');
```

## Documentazione Completa

Per dettagli completi, vedere:
- `HELPDESK_AGENT_INTEGRATION.md` - Documentazione tecnica completa
- `example-api-route.ts` - Esempi di integrazione API

## Supporto

Per problemi o domande, contattare il team di sviluppo LAPA.
