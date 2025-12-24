# Helpdesk Agent - Integrazione Odoo Completata

## Panoramica

L'agente Helpdesk è stato aggiornato per collegarsi direttamente ai dati reali di Odoo tramite `createOdooRPCClient`. Supporta sia il modulo `helpdesk.ticket` che un fallback automatico a `mail.message` quando il modulo Helpdesk non è disponibile.

## File Modificato

**Path:** `lib/lapa-agents/agents/helpdesk-agent.ts`

## Modifiche Principali

### 1. Sostituzione Client Odoo

**Prima:**
```typescript
import { OdooClient, OdooSession } from '@/lib/odoo/client';

export class HelpdeskAgent {
  private odooClient: OdooClient;
  private session: OdooSession | null = null;

  constructor(odooClient: OdooClient, session?: OdooSession) {
    this.odooClient = odooClient;
    this.session = session || null;
  }
}
```

**Dopo:**
```typescript
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export class HelpdeskAgent {
  private odooRPC: ReturnType<typeof createOdooRPCClient>;
  private helpdeskAvailable: boolean | null = null;

  constructor(sessionId?: string, language: Language = 'it') {
    this.odooRPC = createOdooRPCClient(sessionId);
    this.lang = language;
  }
}
```

### 2. Verifica Modulo Helpdesk

Aggiunto metodo per verificare se il modulo `helpdesk.ticket` è disponibile:

```typescript
private async checkHelpdeskAvailable(): Promise<boolean> {
  if (this.helpdeskAvailable !== null) {
    return this.helpdeskAvailable;
  }

  try {
    await this.odooRPC.searchRead('helpdesk.ticket', [], ['id'], 1);
    this.helpdeskAvailable = true;
    return true;
  } catch (error) {
    this.helpdeskAvailable = false;
    return false;
  }
}
```

### 3. Fallback Automatico

Se `helpdesk.ticket` non è disponibile, l'agente usa automaticamente `mail.message`:

```typescript
async createTicket(params: CreateTicketParams) {
  const isHelpdeskAvailable = await this.checkHelpdeskAvailable();

  if (isHelpdeskAvailable) {
    return await this.createHelpdeskTicket(params);
  } else {
    return await this.createMailMessage(params);
  }
}
```

## Metodi Implementati

### 1. **createTicket(customerId, subject, description, priority?, attachments?)**

Crea un nuovo ticket di supporto.

**Parametri:**
- `customerId` (number): ID del cliente in Odoo
- `subject` (string): Oggetto del ticket
- `description` (string): Descrizione del problema
- `priority` (string, opzionale): '0'=Bassa, '1'=Media, '2'=Alta, '3'=Urgente
- `attachments` (array, opzionale): File allegati in base64

**Campi Odoo utilizzati:**
- `name`: subject del ticket
- `description`: descrizione dettagliata
- `partner_id`: ID cliente
- `team_id`: Team helpdesk (default: 1 - Customer Care)
- `priority`: priorità
- `stage_id`: stage ticket (automatico)
- `user_id`: utente assegnato (opzionale)

**Esempio:**
```typescript
const result = await agent.createTicket({
  customerId: 123,
  subject: 'Problema con ordine',
  description: 'Il mio ordine non è arrivato',
  priority: '2'
});

if (result.success) {
  console.log('Ticket creato:', result.ticketId);
}
```

### 2. **getCustomerTickets(customerId)**

Ottiene tutti i ticket di un cliente.

**Parametri:**
- `customerId` (number): ID del cliente

**Restituisce:**
- `tickets`: Array di oggetti HelpdeskTicket
- `count`: Numero totale di ticket

**Esempio:**
```typescript
const result = await agent.getCustomerTickets(123);

if (result.success) {
  result.tickets?.forEach(ticket => {
    console.log(`#${ticket.id}: ${ticket.name} [${ticket.stage_name}]`);
  });
}
```

### 3. **getTicketDetails(ticketId)**

Ottiene dettagli completi di un ticket con tutti i commenti.

**Parametri:**
- `ticketId` (number): ID del ticket

**Restituisce:**
- `ticket`: Oggetto HelpdeskTicket completo
- `comments`: Array di commenti/messaggi

**Esempio:**
```typescript
const result = await agent.getTicketDetails(456);

if (result.success) {
  console.log('Ticket:', result.ticket);
  console.log('Commenti:', result.comments);
}
```

### 4. **addComment(ticketId, message, internal?)**

Aggiunge un commento a un ticket esistente.

**Parametri:**
- `ticketId` (number): ID del ticket
- `message` (string): Testo del commento
- `internal` (boolean, opzionale): Se true, commento interno (non visibile al cliente)

**Esempio:**
```typescript
await agent.addComment(
  456,
  'Abbiamo risolto il problema',
  false // pubblico
);
```

## Campi del Modello helpdesk.ticket

### Campi Principali

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `id` | integer | ID univoco del ticket |
| `name` | string | Oggetto/titolo del ticket |
| `description` | text | Descrizione dettagliata |
| `partner_id` | many2one | Riferimento al cliente (res.partner) |
| `partner_name` | string | Nome del cliente |
| `team_id` | many2one | Team helpdesk assegnato |
| `user_id` | many2one | Utente assegnato |
| `stage_id` | many2one | Stage corrente (helpdesk.stage) |
| `stage_name` | string | Nome dello stage |
| `priority` | selection | 0=Bassa, 1=Media, 2=Alta, 3=Urgente |
| `create_date` | datetime | Data creazione |
| `write_date` | datetime | Data ultima modifica |
| `kanban_state` | selection | normal/done/blocked |
| `message_ids` | one2many | Messaggi/commenti associati |

## Fallback a mail.message

Quando `helpdesk.ticket` non è disponibile, l'agente crea record in `mail.message`:

```typescript
{
  subject: params.subject,
  body: messageBody,
  message_type: 'notification',
  subtype_id: 1,
  model: 'res.partner',
  res_id: params.customerId
}
```

## Notifiche Email

L'agente invia automaticamente notifiche email a `lapa@lapa.ch` quando:
- Viene creato un nuovo ticket
- Un ticket viene escalato a supporto umano
- Viene richiesta attenzione immediata

Le email includono:
- Dettagli del ticket
- Link diretto al ticket in Odoo
- Informazioni del cliente
- Priorità e stato

## Esempio Completo di Utilizzo

```typescript
import { createHelpdeskAgent } from '@/lib/lapa-agents/agents/helpdesk-agent';

async function handleCustomerSupport(customerId: number) {
  // Crea agente
  const agent = createHelpdeskAgent(undefined, 'it');

  // 1. Crea ticket
  const ticketResult = await agent.createTicket({
    customerId,
    subject: 'Richiesta informazioni prodotto',
    description: 'Vorrei sapere quando sarà disponibile il prodotto XYZ',
    priority: '1',
  });

  if (!ticketResult.success) {
    console.error('Errore:', ticketResult.error);
    return;
  }

  const ticketId = ticketResult.ticketId!;

  // 2. Aggiungi commento
  await agent.addComment(
    ticketId,
    'Grazie per la segnalazione, stiamo verificando',
    false
  );

  // 3. Se necessario, escalation
  await agent.escalateToHuman(
    ticketId,
    'Richiesta informazioni tecniche specifiche',
    8 // Laura Teodorescu
  );

  // 4. Ottieni tutti i ticket del cliente
  const customerTickets = await agent.getCustomerTickets(customerId);
  console.log(`Cliente ha ${customerTickets.count} ticket aperti`);
}
```

## Test

Per testare l'integrazione, eseguire:

```bash
npx ts-node lib/lapa-agents/agents/test-helpdesk-agent.ts
```

Lo script di test verifica:
1. Creazione ticket
2. Recupero dettagli
3. Aggiunta commenti
4. Lista ticket cliente
5. Escalation

## Vantaggi dell'Integrazione

1. **Connessione Diretta**: Dati reali da Odoo invece di mock
2. **Auto-Reconnect**: Gestione automatica scadenza sessione
3. **Fallback Intelligente**: Funziona anche senza modulo Helpdesk
4. **Type-Safe**: TypeScript con tipi completi
5. **Notifiche Email**: Team sempre informato
6. **Multilingua**: Supporto IT/EN/DE

## Prossimi Sviluppi

- [ ] Integrazione con AI per risposte automatiche
- [ ] Dashboard analytics ticket
- [ ] SLA tracking
- [ ] Priorità automatica basata su ML
- [ ] Integrazione WhatsApp per notifiche
