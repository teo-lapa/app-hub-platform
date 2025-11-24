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

    // 3. Fetch ALL chatter messages (not just FEEDBACK SALES RADAR)
    // This includes notes, tracking changes, and all vendor interactions
    let allMessages: any[] = [];
    try {
      allMessages = await client.searchRead(
        'mail.message',
        [
          ['date', '>=', startDateStr],
          ['model', 'in', ['crm.lead', 'res.partner']],
          ['message_type', 'in', ['comment', 'notification']]
        ],
        ['id', 'body', 'date', 'author_id', 'model', 'res_id', 'create_uid', 'message_type', 'subtype_id', 'tracking_value_ids'],
        500
      );
      console.log(`[SALES-RADAR-ACTIVITY] Found ${allMessages.length} messages`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching messages:', e);
    }

    // 4. Fetch tracking values for field changes (stage, active, tags, etc.)
    let trackingValues: any[] = [];
    const messageIds = allMessages.map(m => m.id);
    if (messageIds.length > 0) {
      try {
        trackingValues = await client.searchRead(
          'mail.tracking.value',
          [
            ['mail_message_id', 'in', messageIds]
          ],
          ['id', 'field', 'old_value_char', 'new_value_char', 'old_value_integer', 'new_value_integer', 'mail_message_id'],
          500
        );
        console.log(`[SALES-RADAR-ACTIVITY] Found ${trackingValues.length} tracking values`);
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching tracking values:', e);
      }
    }

    // Create map of tracking values by message ID
    const trackingByMessage: Record<number, any[]> = {};
    trackingValues.forEach(tv => {
      const msgId = Array.isArray(tv.mail_message_id) ? tv.mail_message_id[0] : tv.mail_message_id;
      if (!trackingByMessage[msgId]) {
        trackingByMessage[msgId] = [];
      }
      trackingByMessage[msgId].push(tv);
    });

    // 5. Get unique user IDs to fetch user names
    const userIds = new Set<number>();
    leadsCreated.forEach(lead => {
      if (lead.create_uid && Array.isArray(lead.create_uid)) {
        userIds.add(lead.create_uid[0]);
      }
    });
    allMessages.forEach(msg => {
      if (msg.author_id && Array.isArray(msg.author_id)) {
        userIds.add(msg.author_id[0]);
      }
      if (msg.create_uid && Array.isArray(msg.create_uid)) {
        userIds.add(msg.create_uid[0]);
      }
    });

    // 6. Fetch user details
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

    // 7. Fetch lead/partner names for messages
    const leadIdsSet = new Set(allMessages.filter(m => m.model === 'crm.lead').map(m => m.res_id));
    const partnerIdsSet = new Set(allMessages.filter(m => m.model === 'res.partner').map(m => m.res_id));
    const leadIds = Array.from(leadIdsSet);
    const partnerIds = Array.from(partnerIdsSet);

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

    // 8. Build activity timeline
    const activities: Array<{
      id: string;
      type: 'lead_created' | 'voice_note' | 'written_note' | 'stage_change' |
            'lead_archived' | 'lead_reactivated' | 'tag_added' | 'tag_removed' |
            'note_added' | 'field_updated';
      timestamp: string;
      userId: number;
      userName: string;
      targetName: string;
      targetType: 'lead' | 'partner';
      targetId: number;
      location?: { lat: number; lng: number };
      preview?: string;
      fieldName?: string;
      oldValue?: string;
      newValue?: string;
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

    // Add message-based activities
    allMessages.forEach(msg => {
      const authorId = msg.author_id?.[0] || msg.create_uid?.[0] || 0;
      const targetType = msg.model === 'crm.lead' ? 'lead' : 'partner';
      const targetName = targetType === 'lead'
        ? leadsMap[msg.res_id] || `Lead #${msg.res_id}`
        : partnersMap[msg.res_id] || `Cliente #${msg.res_id}`;

      // Skip if author is "Utente" (automatic imports)
      const userName = usersMap[authorId]?.name || 'Utente';
      if (userName === 'Utente') return;

      // Check if this message has tracking values (field changes)
      const tracking = trackingByMessage[msg.id] || [];

      if (tracking.length > 0) {
        // Process each field change
        tracking.forEach(tv => {
          let activityType: typeof activities[0]['type'] = 'field_updated';
          let preview = '';

          // Stage change
          if (tv.field === 'stage_id') {
            activityType = 'stage_change';
            preview = `${tv.old_value_char || 'N/A'} → ${tv.new_value_char || 'N/A'}`;
          }
          // Lead archived
          else if (tv.field === 'active' && tv.old_value_integer === 1 && tv.new_value_integer === 0) {
            activityType = 'lead_archived';
            preview = 'Lead archiviato';
          }
          // Lead reactivated
          else if (tv.field === 'active' && tv.old_value_integer === 0 && tv.new_value_integer === 1) {
            activityType = 'lead_reactivated';
            preview = 'Lead riattivato';
          }
          // Tag changes
          else if (tv.field === 'tag_ids') {
            const oldTags = tv.old_value_char || '';
            const newTags = tv.new_value_char || '';

            // Check for "Non interessato", "Non in Target", "Chiuso definitivamente"
            if (newTags.includes('Non interessato') && !oldTags.includes('Non interessato')) {
              activityType = 'tag_added';
              preview = '🚫 Non interessato';
            } else if (newTags.includes('Non in Target') && !oldTags.includes('Non in Target')) {
              activityType = 'tag_added';
              preview = '❌ Non in Target';
            } else if (newTags.includes('Chiuso definitivamente') && !oldTags.includes('Chiuso definitivamente')) {
              activityType = 'tag_added';
              preview = '🔒 Chiuso definitivamente';
            } else {
              activityType = 'tag_added';
              preview = `${oldTags || 'Nessun tag'} → ${newTags}`;
            }
          }
          // Other field changes
          else {
            preview = `${tv.field}: ${tv.old_value_char || tv.old_value_integer || 'N/A'} → ${tv.new_value_char || tv.new_value_integer || 'N/A'}`;
          }

          activities.push({
            id: `track_${tv.id}`,
            type: activityType,
            timestamp: msg.date,
            userId: authorId,
            userName,
            targetName,
            targetType: targetType as 'lead' | 'partner',
            targetId: msg.res_id,
            preview,
            fieldName: tv.field,
            oldValue: tv.old_value_char || String(tv.old_value_integer || ''),
            newValue: tv.new_value_char || String(tv.new_value_integer || '')
          });
        });
      }
      // Check if it's a Sales Radar note (voice or written)
      else if (msg.body?.includes('FEEDBACK SALES RADAR')) {
        const isVoice = msg.body?.includes('Nota Vocale');

        // Extract preview text from body
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
          userName,
          targetName,
          targetType: targetType as 'lead' | 'partner',
          targetId: msg.res_id,
          preview
        });
      }
      // Regular note/comment (not Sales Radar specific)
      else if (msg.message_type === 'comment' && msg.body && msg.body.trim().length > 0) {
        // Extract text from HTML
        const textMatch = msg.body.match(/<p>([^<]+)<\/p>/);
        let preview = textMatch ? textMatch[1] : msg.body.replace(/<[^>]+>/g, '').substring(0, 100);
        if (preview.length > 100) preview += '...';

        // Skip empty or very short notes
        if (preview.trim().length < 5) return;

        activities.push({
          id: `note_${msg.id}`,
          type: 'note_added',
          timestamp: msg.date,
          userId: authorId,
          userName,
          targetName,
          targetType: targetType as 'lead' | 'partner',
          targetId: msg.res_id,
          preview
        });
      }
    });

    // Sort by timestamp descending (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 9. Calculate statistics per vendor
    const vendorStats: Record<number, {
      userId: number;
      userName: string;
      leadsCreated: number;
      voiceNotes: number;
      writtenNotes: number;
      stageChanges: number;
      leadsArchived: number;
      leadsReactivated: number;
      tagsAdded: number;
      notesAdded: number;
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
          stageChanges: 0,
          leadsArchived: 0,
          leadsReactivated: 0,
          tagsAdded: 0,
          notesAdded: 0,
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
      } else if (act.type === 'stage_change') {
        vendorStats[act.userId].stageChanges++;
      } else if (act.type === 'lead_archived') {
        vendorStats[act.userId].leadsArchived++;
      } else if (act.type === 'lead_reactivated') {
        vendorStats[act.userId].leadsReactivated++;
      } else if (act.type === 'tag_added') {
        vendorStats[act.userId].tagsAdded++;
      } else if (act.type === 'note_added') {
        vendorStats[act.userId].notesAdded++;
      }
    });

    // Convert to array and sort by total interactions
    const vendorStatsArray = Object.values(vendorStats)
      .sort((a, b) => b.totalInteractions - a.totalInteractions);

    // 10. Build summary
    const summary = {
      totalInteractions: activities.length,
      leadsCreated: activities.filter(a => a.type === 'lead_created').length,
      voiceNotes: activities.filter(a => a.type === 'voice_note').length,
      writtenNotes: activities.filter(a => a.type === 'written_note').length,
      stageChanges: activities.filter(a => a.type === 'stage_change').length,
      leadsArchived: activities.filter(a => a.type === 'lead_archived').length,
      leadsReactivated: activities.filter(a => a.type === 'lead_reactivated').length,
      tagsAdded: activities.filter(a => a.type === 'tag_added').length,
      notesAdded: activities.filter(a => a.type === 'note_added').length,
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
