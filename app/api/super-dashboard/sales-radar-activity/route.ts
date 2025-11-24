import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-dashboard/sales-radar-activity
 *
 * Recupera le attività recenti dal Sales Radar:
 * - Lead creati con tag "Sales Radar"
 * - Note/messaggi nel chatter (vocali e scritte)
 * - Statistiche per venditore
 *
 * Query params:
 * - period: 'today' | 'week' | 'month' (default: 'week')
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

    // Parse period parameter
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'week';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'week':
      default:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    console.log(`[SALES-RADAR-ACTIVITY] Fetching activity for period: ${period}, from: ${startDateStr}`);

    // 1. Find "Sales Radar" tag ID
    let salesRadarTagId: number | null = null;
    try {
      const tags = await client.searchRead(
        'crm.tag',
        [['name', '=', 'Sales Radar']],
        ['id'],
        1
      );
      if (tags.length > 0) {
        salesRadarTagId = tags[0].id;
      }
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Could not find Sales Radar tag:', e);
    }

    // 2. Fetch leads created with Sales Radar tag in the period
    let leadsCreated: any[] = [];
    if (salesRadarTagId) {
      try {
        leadsCreated = await client.searchRead(
          'crm.lead',
          [
            ['tag_ids', 'in', [salesRadarTagId]],
            ['create_date', '>=', startDateStr]
          ],
          ['id', 'name', 'create_date', 'create_uid', 'partner_latitude', 'partner_longitude', 'street', 'phone'],
          100
        );
        console.log(`[SALES-RADAR-ACTIVITY] Found ${leadsCreated.length} leads created`);
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching leads:', e);
      }
    }

    // 3. Fetch chatter messages with "FEEDBACK SALES RADAR" in body
    // These are the voice/written notes from Sales Radar
    let salesRadarMessages: any[] = [];
    try {
      salesRadarMessages = await client.searchRead(
        'mail.message',
        [
          ['body', 'ilike', 'FEEDBACK SALES RADAR'],
          ['date', '>=', startDateStr],
          ['model', 'in', ['crm.lead', 'res.partner']]
        ],
        ['id', 'body', 'date', 'author_id', 'model', 'res_id', 'create_uid'],
        200
      );
      console.log(`[SALES-RADAR-ACTIVITY] Found ${salesRadarMessages.length} Sales Radar messages`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching messages:', e);
    }

    // 4. Get unique user IDs to fetch user names
    const userIds = new Set<number>();
    leadsCreated.forEach(lead => {
      if (lead.create_uid && Array.isArray(lead.create_uid)) {
        userIds.add(lead.create_uid[0]);
      }
    });
    salesRadarMessages.forEach(msg => {
      if (msg.author_id && Array.isArray(msg.author_id)) {
        userIds.add(msg.author_id[0]);
      }
    });

    // 5. Fetch user details
    let usersMap: Record<number, { name: string; email?: string }> = {};
    if (userIds.size > 0) {
      try {
        const users = await client.searchRead(
          'res.partner',
          [['id', 'in', Array.from(userIds)]],
          ['id', 'name', 'email'],
          0
        );
        users.forEach((u: any) => {
          usersMap[u.id] = { name: u.name, email: u.email };
        });
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching users:', e);
      }
    }

    // 6. Fetch lead/partner names for messages
    const leadIds = salesRadarMessages.filter(m => m.model === 'crm.lead').map(m => m.res_id);
    const partnerIds = salesRadarMessages.filter(m => m.model === 'res.partner').map(m => m.res_id);

    let leadsMap: Record<number, string> = {};
    let partnersMap: Record<number, string> = {};

    if (leadIds.length > 0) {
      try {
        const leads = await client.callKw(
          'crm.lead',
          'search_read',
          [[['id', 'in', leadIds]]],
          { fields: ['id', 'name'], context: { active_test: false } }
        );
        leads.forEach((l: any) => {
          leadsMap[l.id] = l.name;
        });
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching lead names:', e);
      }
    }

    if (partnerIds.length > 0) {
      try {
        const partners = await client.callKw(
          'res.partner',
          'search_read',
          [[['id', 'in', partnerIds]]],
          { fields: ['id', 'name'], context: { active_test: false } }
        );
        partners.forEach((p: any) => {
          partnersMap[p.id] = p.name;
        });
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching partner names:', e);
      }
    }

    // 7. Build activity timeline
    const activities: Array<{
      id: string;
      type: 'lead_created' | 'voice_note' | 'written_note';
      timestamp: string;
      userId: number;
      userName: string;
      targetName: string;
      targetType: 'lead' | 'partner';
      targetId: number;
      location?: { lat: number; lng: number };
      preview?: string;
    }> = [];

    // Add lead creation activities
    leadsCreated.forEach(lead => {
      const userId = lead.create_uid?.[0] || 0;
      activities.push({
        id: `lead_${lead.id}`,
        type: 'lead_created',
        timestamp: lead.create_date,
        userId,
        userName: usersMap[userId]?.name || 'Utente',
        targetName: lead.name,
        targetType: 'lead',
        targetId: lead.id,
        location: lead.partner_latitude && lead.partner_longitude ? {
          lat: lead.partner_latitude,
          lng: lead.partner_longitude
        } : undefined
      });
    });

    // Add note activities
    salesRadarMessages.forEach(msg => {
      const authorId = msg.author_id?.[0] || 0;
      const isVoice = msg.body?.includes('Nota Vocale');
      const targetType = msg.model === 'crm.lead' ? 'lead' : 'partner';
      const targetName = targetType === 'lead'
        ? leadsMap[msg.res_id] || `Lead #${msg.res_id}`
        : partnersMap[msg.res_id] || `Cliente #${msg.res_id}`;

      // Extract preview text from body (remove HTML tags)
      let preview = '';
      const noteMatch = msg.body?.match(/<strong>📝 Nota:<\/strong><\/p><p>([^<]+)/);
      if (noteMatch) {
        preview = noteMatch[1].substring(0, 100);
        if (noteMatch[1].length > 100) preview += '...';
      }

      activities.push({
        id: `msg_${msg.id}`,
        type: isVoice ? 'voice_note' : 'written_note',
        timestamp: msg.date,
        userId: authorId,
        userName: usersMap[authorId]?.name || 'Utente',
        targetName,
        targetType: targetType as 'lead' | 'partner',
        targetId: msg.res_id,
        preview
      });
    });

    // Sort by timestamp descending (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 8. Calculate statistics per vendor
    const vendorStats: Record<number, {
      userId: number;
      userName: string;
      leadsCreated: number;
      voiceNotes: number;
      writtenNotes: number;
      totalInteractions: number;
    }> = {};

    activities.forEach(act => {
      if (!vendorStats[act.userId]) {
        vendorStats[act.userId] = {
          userId: act.userId,
          userName: act.userName,
          leadsCreated: 0,
          voiceNotes: 0,
          writtenNotes: 0,
          totalInteractions: 0
        };
      }

      vendorStats[act.userId].totalInteractions++;

      if (act.type === 'lead_created') {
        vendorStats[act.userId].leadsCreated++;
      } else if (act.type === 'voice_note') {
        vendorStats[act.userId].voiceNotes++;
      } else if (act.type === 'written_note') {
        vendorStats[act.userId].writtenNotes++;
      }
    });

    // Convert to array and sort by total interactions
    const vendorStatsArray = Object.values(vendorStats)
      .sort((a, b) => b.totalInteractions - a.totalInteractions);

    // 9. Build summary
    const summary = {
      totalInteractions: activities.length,
      leadsCreated: activities.filter(a => a.type === 'lead_created').length,
      voiceNotes: activities.filter(a => a.type === 'voice_note').length,
      writtenNotes: activities.filter(a => a.type === 'written_note').length,
      activeVendors: vendorStatsArray.length,
      period,
      startDate: startDateStr
    };

    console.log(`[SALES-RADAR-ACTIVITY] Summary:`, summary);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        activities: activities.slice(0, 50), // Limit to 50 most recent
        vendorStats: vendorStatsArray
      }
    });

  } catch (error) {
    console.error('[SALES-RADAR-ACTIVITY] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il recupero delle attività',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
