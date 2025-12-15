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
    // Supporta sia user_id (vecchio) che author_partner_id (nuovo - diretto dal dropdown)
    const authorPartnerIdStr = searchParams.get('author_partner_id');
    const userIdStr = searchParams.get('user_id');
    let authorPartnerId = authorPartnerIdStr ? parseInt(authorPartnerIdStr, 10) : null;
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;

    console.log('[GET-VISITS] Fetching visits, author_partner_id:', authorPartnerId, 'user_id:', userId);

    // 1. Get current user info (sia user_id che partner_id)
    let currentUserId: number | null = null;
    let currentUserPartnerId: number | null = null;
    try {
      const currentUser = await client.getCurrentUser();
      if (currentUser?.id) {
        currentUserId = currentUser.id;
        // Cerca il partner_id dell'utente corrente
        const users = await client.searchRead(
          'res.users',
          [['id', '=', currentUser.id]],
          ['partner_id'],
          1
        );
        if (users.length > 0 && users[0].partner_id) {
          currentUserPartnerId = users[0].partner_id[0];
        }
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

    // Se abbiamo author_partner_id diretto (dal dropdown), usalo
    // Altrimenti se abbiamo user_id, cerca il suo partner_id
    if (!authorPartnerId && userId) {
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
    }

    if (authorPartnerId) {
      // Filter messages by author (partner_id)
      partnerMessages = allPartnerMessages.filter((msg: any) => msg.author_id?.[0] === authorPartnerId);
      leadMessages = allLeadMessages.filter((msg: any) => msg.author_id?.[0] === authorPartnerId);
      console.log(`[GET-VISITS] Filtered by author_partner_id ${authorPartnerId}: ${partnerMessages.length} partner, ${leadMessages.length} lead`);
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

    // 5. Carica i dati completi dei record visitati (per poterli mostrare sulla mappa)
    // Questo permette di aggiungere marker visitati anche quando non sono stati caricati
    const visitedPartnerIds = Object.entries(visits)
      .filter(([_, v]) => v.recordType === 'partner')
      .map(([key]) => parseInt(key.replace('partner_', '')));

    const visitedLeadIds = Object.entries(visits)
      .filter(([_, v]) => v.recordType === 'lead')
      .map(([key]) => parseInt(key.replace('lead_', '')));

    // Carica dati partner visitati
    let visitedPartners: any[] = [];
    if (visitedPartnerIds.length > 0) {
      try {
        visitedPartners = await client.searchRead(
          'res.partner',
          [['id', 'in', visitedPartnerIds]],
          ['id', 'name', 'display_name', 'street', 'city', 'zip', 'phone', 'mobile', 'partner_latitude', 'partner_longitude', 'website'],
          0
        );
      } catch (e) {
        console.warn('[GET-VISITS] Could not load visited partners:', e);
      }
    }

    // Carica dati lead visitati
    let visitedLeads: any[] = [];
    if (visitedLeadIds.length > 0) {
      try {
        visitedLeads = await client.searchRead(
          'crm.lead',
          [['id', 'in', visitedLeadIds]],
          ['id', 'name', 'partner_name', 'street', 'city', 'zip', 'phone', 'mobile', 'description', 'website'],
          0
        );
      } catch (e) {
        console.warn('[GET-VISITS] Could not load visited leads:', e);
      }
    }

    // Helper per estrarre coordinate dalla descrizione del lead
    const parseCoordinatesFromDescription = (description: string | null): { latitude: number; longitude: number } | null => {
      if (!description) return null;
      const patterns = [
        /📍\s*GPS:\s*([-\d.]+)[,\s]+([-\d.]+)/i,
        /Coordinate:\s*([-\d.]+)[,\s]+([-\d.]+)/i,
        /lat[itude]*[:\s]*([-\d.]+)[,\s]*lon[gitude]*[:\s]*([-\d.]+)/i
      ];
      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { latitude: lat, longitude: lng };
          }
        }
      }
      return null;
    };

    // Costruisci i marker per i record visitati
    const visitedMarkers: any[] = [];

    for (const partner of visitedPartners) {
      if (!partner.partner_latitude || !partner.partner_longitude) continue;
      const key = `partner_${partner.id}`;
      const visit = visits[key];
      if (!visit) continue;

      visitedMarkers.push({
        id: partner.id,
        type: 'customer',
        name: partner.display_name || partner.name,
        address: [partner.street, partner.zip, partner.city].filter(Boolean).join(', '),
        phone: partner.phone || partner.mobile,
        website: partner.website,
        latitude: partner.partner_latitude,
        longitude: partner.partner_longitude,
        color: 'green',
        visitInfo: visit
      });
    }

    for (const lead of visitedLeads) {
      const coords = parseCoordinatesFromDescription(lead.description);
      if (!coords) continue;
      const key = `lead_${lead.id}`;
      const visit = visits[key];
      if (!visit) continue;

      visitedMarkers.push({
        id: lead.id,
        type: 'lead',
        name: lead.partner_name || lead.name,
        address: [lead.street, lead.zip, lead.city].filter(Boolean).join(', '),
        phone: lead.phone || lead.mobile,
        website: lead.website,
        latitude: coords.latitude,
        longitude: coords.longitude,
        color: 'orange',
        visitInfo: visit
      });
    }

    // 6. Convert ALL vendors map to array (not filtered - always show complete list)
    const vendors = Array.from(allVendorsMap.entries()).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[GET-VISITS] Total unique records with visits: ${Object.keys(visits).length}, Vendors: ${vendors.length}, Markers: ${visitedMarkers.length}`);

    return NextResponse.json({
      success: true,
      visits,
      visitedMarkers, // Marker completi dei record visitati
      vendors,
      currentUserId,
      currentUserPartnerId, // Partner ID dell'utente corrente (per match con vendor.id nel dropdown)
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
