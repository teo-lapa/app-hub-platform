/**
 * DEBUG: Test creazione ticket helpdesk direttamente
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId = 9, subject = 'Test Ticket', description = 'Test description' } = body;

    const odoo = await getOdooClient();
    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      customerId,
      subject,
      steps: []
    };

    // 1. Verifica che il cliente esista
    try {
      const partners = await odoo.searchReadKw('res.partner', [['id', '=', customerId]], ['id', 'name', 'email'], { limit: 1 });
      results.steps.push({ step: 'verify_partner', success: true, data: partners[0] || 'Not found' });
    } catch (error: any) {
      results.steps.push({ step: 'verify_partner', success: false, error: error.message });
    }

    // 2. Trova il team helpdesk
    let teamId = 1;
    try {
      const teams = await odoo.searchReadKw('helpdesk.team', [], ['id', 'name', 'alias_id', 'use_website_helpdesk_form', 'use_api'], { limit: 5 });
      results.steps.push({ step: 'find_teams', success: true, teams });
      if (teams.length > 0) {
        teamId = teams[0].id;
      }
    } catch (error: any) {
      results.steps.push({ step: 'find_teams', success: false, error: error.message });
    }

    // 3. Verifica i campi obbligatori per helpdesk.ticket
    try {
      const fieldsInfo = await odoo.call('helpdesk.ticket', 'fields_get', [], { attributes: ['required', 'string', 'type'] });
      const requiredFields = Object.entries(fieldsInfo)
        .filter(([, info]: [string, any]) => info.required)
        .map(([name, info]: [string, any]) => ({ name, string: info.string, type: info.type }));
      results.steps.push({ step: 'check_required_fields', success: true, requiredFields });
    } catch (error: any) {
      results.steps.push({ step: 'check_required_fields', success: false, error: error.message });
    }

    // 4. Prova a creare il ticket con valori minimi
    try {
      const ticketValues = {
        name: subject,
        partner_id: customerId,
        team_id: teamId
      };
      results.steps.push({ step: 'prepare_values', success: true, values: ticketValues });

      const ticketId = await odoo.call('helpdesk.ticket', 'create', [ticketValues]);
      results.steps.push({ step: 'create_ticket', success: true, ticketId });
      results.ticketCreated = true;
      results.ticketId = ticketId;

      // Leggi il ticket creato
      const ticket = await odoo.searchReadKw('helpdesk.ticket', [['id', '=', ticketId]], ['id', 'name', 'partner_id', 'team_id', 'stage_id'], { limit: 1 });
      results.steps.push({ step: 'read_ticket', success: true, ticket: ticket[0] });

    } catch (error: any) {
      results.steps.push({
        step: 'create_ticket',
        success: false,
        error: error.message,
        fullError: {
          name: error.name,
          code: error.code,
          data: error.data,
          stack: error.stack?.split('\n').slice(0, 5)
        }
      });
      results.ticketCreated = false;
    }

    // 5. Test con valori alternativi se il primo fallisce
    if (!results.ticketCreated) {
      try {
        // Prova senza team_id
        const ticketValues2 = {
          name: subject,
          partner_id: customerId,
          description: description
        };
        results.steps.push({ step: 'prepare_values_v2', success: true, values: ticketValues2 });

        const ticketId2 = await odoo.call('helpdesk.ticket', 'create', [ticketValues2]);
        results.steps.push({ step: 'create_ticket_v2', success: true, ticketId: ticketId2 });
        results.ticketCreated = true;
        results.ticketId = ticketId2;
      } catch (error: any) {
        results.steps.push({
          step: 'create_ticket_v2',
          success: false,
          error: error.message
        });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Debug ticket create error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
