import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sales-radar/get-visits
 *
 * Recupera tutte le visite registrate (messaggi con "VISITA REGISTRATA")
 * per mostrare indicatori sui marker della mappa
 *
 * Query params:
 * - user_id: number (opzionale, filtra per venditore specifico)
 *
 * Response:
 * {
 *   success: true,
 *   visits: {
 *     [partner_id]: { lastVisit: Date, visitorName: string, visitorId: number },
 *     [lead_id]: { lastVisit: Date, visitorName: string, visitorId: number }
 *   },
 *   vendors: [{ id: number, name: string }] // Venditori che hanno fatto visite
 * }
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

    const searchParams = request.nextUrl.searchParams;
    const userIdStr = searchParams.get('user_id');
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;

    console.log('[GET-VISITS] Fetching visits, user_id filter:', userId);

    // 1. Get current user info
    let currentUserId: number | null = null;
    try {
      const currentUser = await client.getCurrentUser();
      if (currentUser?.id) {
        currentUserId = currentUser.id;
      }
    } catch (e) {
      console.warn('[GET-VISITS] Could not get current user:', e);
    }

    // 2. Search for all "VISITA REGISTRATA" messages in chatter
    // Search in both res.partner and crm.lead
    const visitPattern = 'VISITA REGISTRATA';

    // Build domain for message search
    const baseDomain: any[] = [
      ['body', 'ilike', visitPattern],
      ['message_type', '=', 'comment']
    ];

    // If filtering by user, add author filter
    // Note: author_id in mail.message is a res.partner, not res.users
    // We need to find the partner_id of the user first
    let authorPartnerId: number | null = null;
    if (userId) {
      try {
        const users = await client.searchRead(
          'res.users',
          [['id', '=', userId]],
          ['partner_id'],
          1
        );
        if (users.length > 0 && users[0].partner_id) {
          authorPartnerId = users[0].partner_id[0];
          baseDomain.push(['author_id', '=', authorPartnerId]);
        }
      } catch (e) {
        console.warn('[GET-VISITS] Could not get user partner_id:', e);
      }
    }

    // Search messages for res.partner
    const partnerMessages = await client.callKw(
      'mail.message',
      'search_read',
      [[
        ...baseDomain,
        ['model', '=', 'res.partner']
      ]],
      {
        fields: ['id', 'res_id', 'date', 'author_id', 'body'],
        order: 'date desc',
        limit: 1000 // Limit to avoid performance issues
      }
    );

    // Search messages for crm.lead
    const leadMessages = await client.callKw(
      'mail.message',
      'search_read',
      [[
        ...baseDomain,
        ['model', '=', 'crm.lead']
      ]],
      {
        fields: ['id', 'res_id', 'date', 'author_id', 'body'],
        order: 'date desc',
        limit: 1000
      }
    );

    console.log(`[GET-VISITS] Found ${partnerMessages.length} partner visits, ${leadMessages.length} lead visits`);

    // 3. Build visits map (keep only the most recent visit per record)
    const visits: Record<string, {
      lastVisit: string;
      visitorName: string;
      visitorId: number;
      recordType: 'partner' | 'lead';
    }> = {};

    // Track unique vendors who made visits
    const vendorsMap = new Map<number, string>();

    // Process partner messages
    for (const msg of partnerMessages) {
      const key = `partner_${msg.res_id}`;
      const visitorId = msg.author_id?.[0];
      const visitorName = msg.author_id?.[1] || 'Sconosciuto';

      // Track vendor
      if (visitorId) {
        vendorsMap.set(visitorId, visitorName);
      }

      // Keep only the most recent visit
      if (!visits[key] || new Date(msg.date) > new Date(visits[key].lastVisit)) {
        visits[key] = {
          lastVisit: msg.date,
          visitorName,
          visitorId: visitorId || 0,
          recordType: 'partner'
        };
      }
    }

    // Process lead messages
    for (const msg of leadMessages) {
      const key = `lead_${msg.res_id}`;
      const visitorId = msg.author_id?.[0];
      const visitorName = msg.author_id?.[1] || 'Sconosciuto';

      // Track vendor
      if (visitorId) {
        vendorsMap.set(visitorId, visitorName);
      }

      // Keep only the most recent visit
      if (!visits[key] || new Date(msg.date) > new Date(visits[key].lastVisit)) {
        visits[key] = {
          lastVisit: msg.date,
          visitorName,
          visitorId: visitorId || 0,
          recordType: 'lead'
        };
      }
    }

    // 4. Convert vendors map to array
    const vendors = Array.from(vendorsMap.entries()).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[GET-VISITS] Total unique records with visits: ${Object.keys(visits).length}, Vendors: ${vendors.length}`);

    return NextResponse.json({
      success: true,
      visits,
      vendors,
      currentUserId,
      totalVisits: Object.keys(visits).length
    });

  } catch (error) {
    console.error('[GET-VISITS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il recupero delle visite',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
