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

    // Build base domain for message search (without user filter - for vendors list)
    const baseVisitDomain: any[] = [
      ['body', 'ilike', visitPattern],
      ['message_type', '=', 'comment']
    ];

    // FIRST: Get ALL visits to build the complete vendors list
    // This ensures the dropdown always shows all vendors who have ever made visits
    const allPartnerMessages = await client.callKw(
      'mail.message',
      'search_read',
      [[
        ...baseVisitDomain,
        ['model', '=', 'res.partner']
      ]],
      {
        fields: ['id', 'res_id', 'date', 'author_id', 'body'],
        order: 'date desc',
        limit: 1000
      }
    );

    const allLeadMessages = await client.callKw(
      'mail.message',
      'search_read',
      [[
        ...baseVisitDomain,
        ['model', '=', 'crm.lead']
      ]],
      {
        fields: ['id', 'res_id', 'date', 'author_id', 'body'],
        order: 'date desc',
        limit: 1000
      }
    );

    // Build complete vendors map from ALL messages
    const allVendorsMap = new Map<number, string>();
    const cleanVendorName = (name: string): string => {
      let cleanedName = name
        .replace(/^[^-]+ - /, '')
        .replace(/^[^,]+,\s*/, '')
        .trim();
      return cleanedName || name;
    };

    for (const msg of [...allPartnerMessages, ...allLeadMessages]) {
      const visitorId = msg.author_id?.[0];
      const rawVisitorName = msg.author_id?.[1] || 'Sconosciuto';
      if (visitorId) {
        allVendorsMap.set(visitorId, cleanVendorName(rawVisitorName));
      }
    }

    // NOW apply user filter for the actual visits data
    let partnerMessages = allPartnerMessages;
    let leadMessages = allLeadMessages;

    if (userId) {
      // Find the partner_id of the user to filter messages
      let authorPartnerId: number | null = null;
      try {
        const users = await client.searchRead(
          'res.users',
          [['id', '=', userId]],
          ['partner_id'],
          1
        );
        if (users.length > 0 && users[0].partner_id) {
          authorPartnerId = users[0].partner_id[0];
        }
      } catch (e) {
        console.warn('[GET-VISITS] Could not get user partner_id:', e);
      }

      if (authorPartnerId) {
        // Filter messages by author
        partnerMessages = allPartnerMessages.filter((msg: any) => msg.author_id?.[0] === authorPartnerId);
        leadMessages = allLeadMessages.filter((msg: any) => msg.author_id?.[0] === authorPartnerId);
      }
    }

    console.log(`[GET-VISITS] Found ${partnerMessages.length} partner visits, ${leadMessages.length} lead visits`);

    // 3. Build visits map (keep only the most recent visit per record)
    // NOTE: This uses the FILTERED messages (by user if specified)
    const visits: Record<string, {
      lastVisit: string;
      visitorName: string;
      visitorId: number;
      recordType: 'partner' | 'lead';
    }> = {};

    // Process partner messages (filtered by user if applicable)
    for (const msg of partnerMessages) {
      const key = `partner_${msg.res_id}`;
      const visitorId = msg.author_id?.[0];
      const rawVisitorName = msg.author_id?.[1] || 'Sconosciuto';
      const visitorName = cleanVendorName(rawVisitorName);

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

    // Process lead messages (filtered by user if applicable)
    for (const msg of leadMessages) {
      const key = `lead_${msg.res_id}`;
      const visitorId = msg.author_id?.[0];
      const rawVisitorName = msg.author_id?.[1] || 'Sconosciuto';
      const visitorName = cleanVendorName(rawVisitorName);

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

    // 4. Convert ALL vendors map to array (not filtered - always show complete list)
    const vendors = Array.from(allVendorsMap.entries()).map(([id, name]) => ({
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
