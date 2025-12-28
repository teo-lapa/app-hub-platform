/**
 * DEBUG: Verifica stato modulo Helpdesk in Odoo
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function GET() {
  try {
    const odoo = await getOdooClient();
    const results: Record<string, any> = {
      odooConnected: true,
      timestamp: new Date().toISOString()
    };

    // 1. Test helpdesk.ticket model
    try {
      const tickets = await odoo.searchReadKw('helpdesk.ticket', [], ['id', 'name'], { limit: 1 });
      results.helpdeskTicketAvailable = true;
      results.helpdeskTicketSample = tickets.length > 0 ? tickets[0] : 'No tickets found';
    } catch (error: any) {
      results.helpdeskTicketAvailable = false;
      results.helpdeskTicketError = error.message;
    }

    // 2. Test helpdesk.team model
    try {
      const teams = await odoo.searchReadKw('helpdesk.team', [], ['id', 'name'], { limit: 5 });
      results.helpdeskTeamAvailable = true;
      results.helpdeskTeams = teams;
    } catch (error: any) {
      results.helpdeskTeamAvailable = false;
      results.helpdeskTeamError = error.message;
    }

    // 3. Check installed modules for helpdesk
    try {
      const modules = await odoo.searchReadKw(
        'ir.module.module',
        [['name', 'ilike', 'helpdesk'], ['state', '=', 'installed']],
        ['name', 'state', 'shortdesc'],
        { limit: 10 }
      );
      results.installedHelpdeskModules = modules;
    } catch (error: any) {
      results.moduleCheckError = error.message;
    }

    // 4. Check mail.message (fallback)
    try {
      const messages = await odoo.searchReadKw('mail.message', [], ['id'], { limit: 1, order: 'id desc' });
      results.mailMessageAvailable = true;
      results.latestMessageId = messages.length > 0 ? messages[0].id : null;
    } catch (error: any) {
      results.mailMessageAvailable = false;
      results.mailMessageError = error.message;
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Debug helpdesk error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      odooConnected: false
    }, { status: 500 });
  }
}
