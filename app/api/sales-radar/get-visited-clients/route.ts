import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-radar/get-visited-clients
 *
 * Recupera tutti i clienti/lead che hanno almeno una visita registrata nel chatter
 * e calcola da quanto tempo non vengono visitati per assegnare un colore
 *
 * Colori basati sull'ultima visita:
 * - green: ultimi 7 giorni
 * - yellow: 8-14 giorni
 * - orange: 15-30 giorni
 * - red: oltre 30 giorni
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    console.log('[Get-Visited] Searching for visit messages...');

    // 1. Cerca tutti i messaggi "VISITA REGISTRATA" nel chatter
    const visitMessages = await client.callKw(
      'mail.message',
      'search_read',
      [[
        ['body', 'ilike', 'VISITA REGISTRATA'],
        ['model', 'in', ['res.partner', 'crm.lead']]
      ]],
      {
        fields: ['id', 'model', 'res_id', 'date', 'body'],
        order: 'date desc',
        limit: 1000
      }
    );

    console.log(`[Get-Visited] Found ${visitMessages.length} visit messages`);

    // 2. Raggruppa per cliente/lead e trova l'ultima visita per ciascuno
    const visitsByRecord: Map<string, { model: string; res_id: number; lastVisit: Date; visitCount: number }> = new Map();

    for (const msg of visitMessages) {
      const key = `${msg.model}:${msg.res_id}`;
      const visitDate = new Date(msg.date);

      if (!visitsByRecord.has(key)) {
        visitsByRecord.set(key, {
          model: msg.model,
          res_id: msg.res_id,
          lastVisit: visitDate,
          visitCount: 1
        });
      } else {
        const existing = visitsByRecord.get(key)!;
        existing.visitCount++;
        if (visitDate > existing.lastVisit) {
          existing.lastVisit = visitDate;
        }
      }
    }

    console.log(`[Get-Visited] Found ${visitsByRecord.size} unique visited records`);

    // 3. Recupera i dettagli dei partner visitati
    const partnerIds = Array.from(visitsByRecord.values())
      .filter(v => v.model === 'res.partner')
      .map(v => v.res_id);

    const leadIds = Array.from(visitsByRecord.values())
      .filter(v => v.model === 'crm.lead')
      .map(v => v.res_id);

    let partners: any[] = [];
    let leads: any[] = [];

    if (partnerIds.length > 0) {
      partners = await client.callKw(
        'res.partner',
        'search_read',
        [[['id', 'in', partnerIds]]],
        {
          fields: ['id', 'name', 'street', 'city', 'zip', 'phone', 'email', 'partner_latitude', 'partner_longitude', 'customer_rank'],
          context: { active_test: false }
        }
      );
    }

    if (leadIds.length > 0) {
      leads = await client.callKw(
        'crm.lead',
        'search_read',
        [[['id', 'in', leadIds]]],
        {
          fields: ['id', 'name', 'street', 'city', 'zip', 'phone', 'email_from', 'partner_latitude', 'partner_longitude'],
          context: { active_test: false }
        }
      );
    }

    // 4. Calcola il colore basato sull'anzianità della visita
    const now = new Date();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const getVisitColor = (lastVisit: Date): 'visit-green' | 'visit-yellow' | 'visit-orange' | 'visit-red' => {
      const daysSinceVisit = Math.floor((now.getTime() - lastVisit.getTime()) / DAY_MS);

      if (daysSinceVisit <= 7) return 'visit-green';
      if (daysSinceVisit <= 14) return 'visit-yellow';
      if (daysSinceVisit <= 30) return 'visit-orange';
      return 'visit-red';
    };

    const getDaysSinceVisit = (lastVisit: Date): number => {
      return Math.floor((now.getTime() - lastVisit.getTime()) / DAY_MS);
    };

    // 5. Combina i risultati
    const visitedClients: any[] = [];

    for (const partner of partners) {
      const key = `res.partner:${partner.id}`;
      const visitInfo = visitsByRecord.get(key);

      if (visitInfo && partner.partner_latitude && partner.partner_longitude) {
        visitedClients.push({
          id: partner.id,
          odooId: partner.id,
          type: 'partner',
          name: partner.name,
          street: partner.street,
          city: partner.city,
          zip: partner.zip,
          phone: partner.phone,
          email: partner.email,
          latitude: partner.partner_latitude,
          longitude: partner.partner_longitude,
          lat: partner.partner_latitude,
          lng: partner.partner_longitude,
          customerRank: partner.customer_rank,
          lastVisit: visitInfo.lastVisit.toISOString(),
          daysSinceVisit: getDaysSinceVisit(visitInfo.lastVisit),
          visitCount: visitInfo.visitCount,
          visitColor: getVisitColor(visitInfo.lastVisit),
          existsInOdoo: true
        });
      }
    }

    for (const lead of leads) {
      const key = `crm.lead:${lead.id}`;
      const visitInfo = visitsByRecord.get(key);

      if (visitInfo && lead.partner_latitude && lead.partner_longitude) {
        visitedClients.push({
          id: lead.id,
          leadId: lead.id,
          type: 'lead',
          name: lead.name,
          street: lead.street,
          city: lead.city,
          zip: lead.zip,
          phone: lead.phone,
          email: lead.email_from,
          latitude: lead.partner_latitude,
          longitude: lead.partner_longitude,
          lat: lead.partner_latitude,
          lng: lead.partner_longitude,
          lastVisit: visitInfo.lastVisit.toISOString(),
          daysSinceVisit: getDaysSinceVisit(visitInfo.lastVisit),
          visitCount: visitInfo.visitCount,
          visitColor: getVisitColor(visitInfo.lastVisit),
          isLead: true
        });
      }
    }

    console.log(`[Get-Visited] Returning ${visitedClients.length} visited clients with coordinates`);

    // 6. Statistiche
    const stats = {
      total: visitedClients.length,
      green: visitedClients.filter(c => c.visitColor === 'visit-green').length,
      yellow: visitedClients.filter(c => c.visitColor === 'visit-yellow').length,
      orange: visitedClients.filter(c => c.visitColor === 'visit-orange').length,
      red: visitedClients.filter(c => c.visitColor === 'visit-red').length
    };

    return NextResponse.json({
      success: true,
      data: visitedClients,
      stats
    });

  } catch (error) {
    console.error('[Get-Visited] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante il recupero dei clienti visitati'
    }, { status: 500 });
  }
}
