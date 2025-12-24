/**
 * ESEMPIO API ROUTE - Helpdesk Agent
 *
 * Path suggerito: app/api/helpdesk/route.ts
 *
 * Questo file mostra come integrare l'Helpdesk Agent in una API route di Next.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHelpdeskAgent } from './helpdesk-agent';

// Tipo per le richieste
interface CreateTicketRequest {
  action: 'create';
  customerId: number;
  subject: string;
  description: string;
  priority?: '0' | '1' | '2' | '3';
  attachments?: Array<{
    name: string;
    content: string;
    mimetype: string;
  }>;
}

interface GetTicketsRequest {
  action: 'list';
  customerId: number;
}

interface GetTicketDetailsRequest {
  action: 'details';
  ticketId: number;
}

interface AddCommentRequest {
  action: 'comment';
  ticketId: number;
  message: string;
  internal?: boolean;
}

type HelpdeskRequest =
  | CreateTicketRequest
  | GetTicketsRequest
  | GetTicketDetailsRequest
  | AddCommentRequest;

/**
 * POST /api/helpdesk
 * Gestisce tutte le operazioni helpdesk
 */
export async function POST(request: NextRequest) {
  try {
    const body: HelpdeskRequest = await request.json();

    // Ottieni sessionId dai cookie o header (opzionale)
    const sessionId = request.cookies.get('session_id')?.value;

    // Crea agente helpdesk
    const agent = createHelpdeskAgent(sessionId, 'it');

    // Switch sull'azione richiesta
    switch (body.action) {
      case 'create': {
        // Crea ticket
        const result = await agent.createTicket({
          customerId: body.customerId,
          subject: body.subject,
          description: body.description,
          priority: body.priority,
          attachments: body.attachments,
        });

        return NextResponse.json(result, {
          status: result.success ? 200 : 400
        });
      }

      case 'list': {
        // Lista ticket cliente
        const result = await agent.getCustomerTickets(body.customerId);

        return NextResponse.json(result, {
          status: result.success ? 200 : 400
        });
      }

      case 'details': {
        // Dettagli ticket
        const result = await agent.getTicketDetails(body.ticketId);

        return NextResponse.json(result, {
          status: result.success ? 200 : 404
        });
      }

      case 'comment': {
        // Aggiungi commento
        const result = await agent.addComment(
          body.ticketId,
          body.message,
          body.internal
        );

        return NextResponse.json(result, {
          status: result.success ? 200 : 400
        });
      }

      default:
        return NextResponse.json(
          { error: 'Azione non valida' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('Errore API Helpdesk:', error);

    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/helpdesk?customerId=123
 * Ottiene la lista dei ticket di un cliente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: 'customerId richiesto' },
        { status: 400 }
      );
    }

    const sessionId = request.cookies.get('session_id')?.value;
    const agent = createHelpdeskAgent(sessionId, 'it');

    const result = await agent.getCustomerTickets(parseInt(customerId));

    return NextResponse.json(result, {
      status: result.success ? 200 : 400
    });

  } catch (error: any) {
    console.error('Errore GET Helpdesk:', error);

    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * ESEMPI DI CHIAMATE FETCH DAL CLIENT
 */

// 1. Crea ticket
async function createTicketExample() {
  const response = await fetch('/api/helpdesk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      customerId: 123,
      subject: 'Problema con ordine',
      description: 'Il mio ordine non è arrivato',
      priority: '2'
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('Ticket creato:', result.ticketId);
  }
}

// 2. Lista ticket
async function getTicketsExample() {
  const response = await fetch('/api/helpdesk?customerId=123');
  const result = await response.json();

  if (result.success) {
    console.log('Tickets:', result.tickets);
  }
}

// 3. Dettagli ticket
async function getTicketDetailsExample() {
  const response = await fetch('/api/helpdesk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'details',
      ticketId: 456
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('Ticket:', result.ticket);
    console.log('Comments:', result.comments);
  }
}

// 4. Aggiungi commento
async function addCommentExample() {
  const response = await fetch('/api/helpdesk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'comment',
      ticketId: 456,
      message: 'Grazie per la risposta',
      internal: false
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('Commento aggiunto');
  }
}
