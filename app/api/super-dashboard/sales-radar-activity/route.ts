import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-dashboard/sales-radar-activity
 *
 * Recupera SOLO le attività che provengono dall'app Sales Radar:
 * - Lead creati con tag "Sales Radar"
 * - Note vocali/scritte con "FEEDBACK SALES RADAR" nel body
 * - Appuntamenti calendario collegati a lead Sales Radar
 * - Attività schedulate su lead Sales Radar
 * - Cambi stato, archiviazioni, tag sui lead Sales Radar
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

    console.log(`[SALES-RADAR-ACTIVITY] Fetching ONLY Sales Radar activities for period: ${period}, from: ${startDateStr}`);

    // 1. Find ALL Sales Radar related tags using multiple search strategies
    // Tags used by Sales Radar app: "Sales Radar", "Non interessato", "Non in Target", etc.
    let salesRadarTagIds: number[] = [];
    try {
      // First, get ALL tags from CRM to see what's available
      const allTags = await client.searchRead(
        'crm.tag',
        [],
        ['id', 'name'],
        0
      );
      console.log(`[SALES-RADAR-ACTIVITY] All available CRM tags: ${allTags.map((t: any) => `${t.name}(${t.id})`).join(', ')}`);

      // Filter tags that match Sales Radar patterns (case insensitive)
      // Tags from mark-not-target: "Chiuso definitivamente", "Non interessato", "Non in Target"
      // Main tag: "Sales Radar"
      const salesRadarPatterns = [
        /sales\s*radar/i,
        /non\s*interessato/i,
        /non\s*in\s*target/i,
        /chiuso\s*definitivamente/i
      ];

      const matchingTags = allTags.filter((t: any) =>
        salesRadarPatterns.some(pattern => pattern.test(t.name))
      );

      if (matchingTags.length > 0) {
        salesRadarTagIds = matchingTags.map((t: any) => t.id);
        console.log(`[SALES-RADAR-ACTIVITY] Found Sales Radar tags: ${matchingTags.map((t: any) => `${t.name}(${t.id})`).join(', ')}`);
      } else {
        console.warn('[SALES-RADAR-ACTIVITY] No Sales Radar tags found! Available tags:', allTags.map((t: any) => t.name).join(', '));
      }
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching tags:', e);
    }

    // 2. Fetch leads with ANY Sales Radar tag created in the period (including archived)
    let leadsCreated: any[] = [];
    let salesRadarLeadIds: number[] = [];
    try {
      // CRITICAL: Fetch leads with ANY of the Sales Radar tags
      if (salesRadarTagIds.length > 0) {
        // Use callKw with active_test: false to include archived leads
        leadsCreated = await client.callKw(
          'crm.lead',
          'search_read',
          [[
            ['create_date', '>=', startDateStr],
            ['tag_ids', 'in', salesRadarTagIds]
          ]],
          {
            fields: ['id', 'name', 'create_date', 'create_uid', 'partner_latitude', 'partner_longitude', 'street', 'phone', 'tag_ids', 'active'],
            limit: 500,
            context: { active_test: false }
          }
        );
        salesRadarLeadIds = leadsCreated.map((l: any) => l.id);
      } else {
        console.warn('[SALES-RADAR-ACTIVITY] No Sales Radar tags found, returning empty leads');
      }
      console.log(`[SALES-RADAR-ACTIVITY] Found ${leadsCreated.length} Sales Radar leads created (including archived with Non interessato/Non in Target)`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching leads:', e);
    }

    // 3. Also fetch ALL leads with ANY Sales Radar tag (including ARCHIVED) for linking activities
    let allSalesRadarLeadIds: number[] = [...salesRadarLeadIds];
    try {
      if (salesRadarTagIds.length > 0) {
        // Use callKw with active_test: false to include archived leads
        const allSalesRadarLeads = await client.callKw(
          'crm.lead',
          'search_read',
          [[['tag_ids', 'in', salesRadarTagIds]]],
          { fields: ['id'], context: { active_test: false } }
        );
        allSalesRadarLeadIds = allSalesRadarLeads.map((l: any) => l.id);
        console.log(`[SALES-RADAR-ACTIVITY] Found ${allSalesRadarLeadIds.length} total Sales Radar leads (including archived) for activity linking`);
      }
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching all Sales Radar leads:', e);
    }

    // 4. Fetch calendar events ONLY linked to Sales Radar leads (via opportunity_id)
    let calendarEvents: any[] = [];
    try {
      if (allSalesRadarLeadIds.length > 0) {
        const calendarFilters: any[] = [
          ['create_date', '>=', startDateStr],
          ['opportunity_id', 'in', allSalesRadarLeadIds]
        ];

        calendarEvents = await client.searchRead(
          'calendar.event',
          calendarFilters,
          ['id', 'name', 'start', 'create_date', 'create_uid', 'partner_ids', 'description', 'location', 'opportunity_id'],
          500
        );
      }
      console.log(`[SALES-RADAR-ACTIVITY] Found ${calendarEvents.length} calendar events linked to Sales Radar leads`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching calendar events:', e);
    }

    // 5. Fetch scheduled activities ONLY linked to Sales Radar leads
    let scheduledActivities: any[] = [];
    try {
      if (allSalesRadarLeadIds.length > 0) {
        const activityFilters: any[] = [
          ['create_date', '>=', startDateStr],
          ['res_model', '=', 'crm.lead'],
          ['res_id', 'in', allSalesRadarLeadIds]
        ];

        scheduledActivities = await client.searchRead(
          'mail.activity',
          activityFilters,
          ['id', 'summary', 'note', 'date_deadline', 'create_date', 'create_uid', 'res_model', 'res_id', 'activity_type_id', 'user_id'],
          500
        );
      }
      console.log(`[SALES-RADAR-ACTIVITY] Found ${scheduledActivities.length} scheduled activities on Sales Radar leads`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching scheduled activities:', e);
    }

    // 6. Fetch chatter messages ONLY from Sales Radar leads
    let allMessages: any[] = [];
    try {
      if (allSalesRadarLeadIds.length > 0) {
        // Only fetch messages on Sales Radar leads
        allMessages = await client.searchRead(
          'mail.message',
          [
            ['date', '>=', startDateStr],
            ['model', '=', 'crm.lead'],
            ['res_id', 'in', allSalesRadarLeadIds],
            ['message_type', 'in', ['comment', 'notification']]
          ],
          ['id', 'body', 'date', 'author_id', 'model', 'res_id', 'create_uid', 'message_type', 'subtype_id', 'tracking_value_ids'],
          1000
        );
      }
      console.log(`[SALES-RADAR-ACTIVITY] Found ${allMessages.length} messages on Sales Radar leads`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching messages:', e);
    }

    // 7. Fetch tracking values for field changes
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
          1000
        );
        console.log(`[SALES-RADAR-ACTIVITY] Found ${trackingValues.length} tracking values`);
      } catch (e) {
        console.warn('[SALES-RADAR-ACTIVITY] Error fetching tracking values:', e);
      }
    }

    // Create map of tracking values by message ID
    const trackingByMessage: Record<number, any[]> = {};
    const uniqueFields = new Set<string>();
    trackingValues.forEach(tv => {
      const msgId = Array.isArray(tv.mail_message_id) ? tv.mail_message_id[0] : tv.mail_message_id;
      if (!trackingByMessage[msgId]) {
        trackingByMessage[msgId] = [];
      }
      trackingByMessage[msgId].push(tv);
      uniqueFields.add(tv.field);
    });
    console.log(`[SALES-RADAR-ACTIVITY] Unique tracked fields: ${Array.from(uniqueFields).join(', ')}`);

    // Log any tag-related tracking values for debugging
    const tagTrackings = trackingValues.filter(tv =>
      tv.field?.toLowerCase().includes('tag') ||
      tv.old_value_char?.toLowerCase().includes('interessato') ||
      tv.new_value_char?.toLowerCase().includes('interessato') ||
      tv.old_value_char?.toLowerCase().includes('target') ||
      tv.new_value_char?.toLowerCase().includes('target')
    );
    if (tagTrackings.length > 0) {
      console.log(`[SALES-RADAR-ACTIVITY] Tag-related trackings: ${JSON.stringify(tagTrackings.slice(0, 5))}`);
    }

    // 8. Get unique user IDs to fetch user names
    const userIds = new Set<number>();
    leadsCreated.forEach(lead => {
      if (lead.create_uid && Array.isArray(lead.create_uid)) {
        userIds.add(lead.create_uid[0]);
      }
    });
    calendarEvents.forEach(event => {
      if (event.create_uid && Array.isArray(event.create_uid)) {
        userIds.add(event.create_uid[0]);
      }
    });
    scheduledActivities.forEach(act => {
      if (act.create_uid && Array.isArray(act.create_uid)) {
        userIds.add(act.create_uid[0]);
      }
      if (act.user_id && Array.isArray(act.user_id)) {
        userIds.add(act.user_id[0]);
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

    // 9. Fetch user details
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

    // Fetch ALL res.users to create partner_id -> user_id mapping
    // This is needed to normalize IDs (messages use partner_id, but we want to group by user_id)
    let resUsersMap: Record<number, string> = {}; // user_id -> name
    let partnerToUserMap: Record<number, number> = {}; // partner_id -> user_id
    try {
      const resUsers = await client.searchRead(
        'res.users',
        [['active', 'in', [true, false]]], // Include inactive users
        ['id', 'name', 'partner_id'],
        0
      );
      resUsers.forEach((u: any) => {
        resUsersMap[u.id] = u.name;
        // Create reverse mapping: partner_id -> user_id
        if (u.partner_id && Array.isArray(u.partner_id)) {
          partnerToUserMap[u.partner_id[0]] = u.id;
          usersMap[u.partner_id[0]] = { name: u.name };
        }
      });
      console.log(`[SALES-RADAR-ACTIVITY] Loaded ${resUsers.length} users for ID normalization`);
    } catch (e) {
      console.warn('[SALES-RADAR-ACTIVITY] Error fetching res.users:', e);
    }

    // 10. Fetch lead names for messages (no partners since we only fetch from leads now)
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

    // Helper function to get user name and normalize user ID
    // This ensures that both res.users IDs and res.partner IDs map to the same user
    const getUserInfo = (id: number, isResUserId: boolean = false): { id: number; name: string } => {
      if (isResUserId) {
        // id is already a res.users ID
        return {
          id,
          name: resUsersMap[id] || (id > 0 ? 'Utente sconosciuto' : 'Sistema')
        };
      } else {
        // id is a res.partner ID, need to convert to res.users ID
        const normalizedUserId = partnerToUserMap[id] || id;
        const name = resUsersMap[normalizedUserId] || usersMap[id]?.name || (id > 0 ? 'Utente sconosciuto' : 'Sistema');
        return { id: normalizedUserId, name };
      }
    };

    // 11. Build activity timeline
    const activities: Array<{
      id: string;
      type: 'lead_created' | 'voice_note' | 'written_note' | 'stage_change' |
            'lead_archived' | 'lead_reactivated' | 'tag_added' | 'tag_removed' |
            'note_added' | 'field_updated' | 'calendar_event' | 'scheduled_activity';
      timestamp: string;
      userId: number;
      userName: string;
      targetName: string;
      targetType: 'lead' | 'partner' | 'calendar' | 'activity';
      targetId: number;
      location?: { lat: number; lng: number };
      preview?: string;
      fieldName?: string;
      oldValue?: string;
      newValue?: string;
    }> = [];

    // Add lead creation activities
    leadsCreated.forEach(lead => {
      const rawUserId = lead.create_uid?.[0] || 0;
      const userInfo = getUserInfo(rawUserId, true);

      // Skip system users
      if (userInfo.name === 'Utente' || userInfo.name === 'OdooBot') return;

      activities.push({
        id: `lead_${lead.id}`,
        type: 'lead_created',
        timestamp: lead.create_date,
        userId: userInfo.id,
        userName: userInfo.name,
        targetName: lead.name,
        targetType: 'lead',
        targetId: lead.id,
        location: lead.partner_latitude && lead.partner_longitude ? {
          lat: lead.partner_latitude,
          lng: lead.partner_longitude
        } : undefined
      });
    });

    // Add calendar event activities
    calendarEvents.forEach(event => {
      const rawUserId = event.create_uid?.[0] || 0;
      const userInfo = getUserInfo(rawUserId, true);

      // Skip system users
      if (userInfo.name === 'Utente' || userInfo.name === 'OdooBot') return;

      activities.push({
        id: `calendar_${event.id}`,
        type: 'calendar_event',
        timestamp: event.create_date,
        userId: userInfo.id,
        userName: userInfo.name,
        targetName: event.name || 'Appuntamento',
        targetType: 'calendar',
        targetId: event.id,
        preview: event.location || (event.start ? `Inizio: ${new Date(event.start).toLocaleString('it-IT')}` : undefined)
      });
    });

    // Add scheduled activity activities
    scheduledActivities.forEach(act => {
      const rawUserId = act.create_uid?.[0] || 0;
      const userInfo = getUserInfo(rawUserId, true);

      // Skip system users
      if (userInfo.name === 'Utente' || userInfo.name === 'OdooBot') return;

      const activityTypeName = act.activity_type_id ?
        (Array.isArray(act.activity_type_id) ? act.activity_type_id[1] : 'Attività') : 'Attività';

      activities.push({
        id: `activity_${act.id}`,
        type: 'scheduled_activity',
        timestamp: act.create_date,
        userId: userInfo.id,
        userName: userInfo.name,
        targetName: act.summary || activityTypeName,
        targetType: 'activity',
        targetId: act.id,
        preview: act.date_deadline ? `Scadenza: ${act.date_deadline}` : undefined
      });
    });

    // Add message-based activities
    allMessages.forEach(msg => {
      // author_id is a res.partner ID, need to normalize to res.users ID
      const authorPartnerId = msg.author_id?.[0] || 0;
      const userInfo = getUserInfo(authorPartnerId, false); // false = it's a partner_id
      const targetType = msg.model === 'crm.lead' ? 'lead' : 'partner';
      const targetName = targetType === 'lead'
        ? leadsMap[msg.res_id] || `Lead #${msg.res_id}`
        : partnersMap[msg.res_id] || `Cliente #${msg.res_id}`;

      // Skip system users and automatic imports
      if (userInfo.name === 'Utente' || userInfo.name === 'OdooBot' || userInfo.name === 'Sistema') return;

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
            userId: userInfo.id,
            userName: userInfo.name,
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
          userId: userInfo.id,
          userName: userInfo.name,
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
          userId: userInfo.id,
          userName: userInfo.name,
          targetName,
          targetType: targetType as 'lead' | 'partner',
          targetId: msg.res_id,
          preview
        });
      }
    });

    // Sort by timestamp descending (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 12. Calculate statistics per vendor
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
      calendarEvents: number;
      scheduledActivities: number;
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
          calendarEvents: 0,
          scheduledActivities: 0,
          totalInteractions: 0
        };
      }

      vendorStats[act.userId].totalInteractions++;

      switch (act.type) {
        case 'lead_created':
          vendorStats[act.userId].leadsCreated++;
          break;
        case 'voice_note':
          vendorStats[act.userId].voiceNotes++;
          break;
        case 'written_note':
          vendorStats[act.userId].writtenNotes++;
          break;
        case 'stage_change':
          vendorStats[act.userId].stageChanges++;
          break;
        case 'lead_archived':
          vendorStats[act.userId].leadsArchived++;
          break;
        case 'lead_reactivated':
          vendorStats[act.userId].leadsReactivated++;
          break;
        case 'tag_added':
          vendorStats[act.userId].tagsAdded++;
          break;
        case 'note_added':
          vendorStats[act.userId].notesAdded++;
          break;
        case 'calendar_event':
          vendorStats[act.userId].calendarEvents++;
          break;
        case 'scheduled_activity':
          vendorStats[act.userId].scheduledActivities++;
          break;
      }
    });

    // Convert to array and sort by total interactions
    const vendorStatsArray = Object.values(vendorStats)
      .filter(v => v.userName !== 'Utente' && v.userName !== 'OdooBot' && v.userName !== 'Sistema')
      .sort((a, b) => b.totalInteractions - a.totalInteractions);

    // 13. Build summary
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
      calendarEvents: activities.filter(a => a.type === 'calendar_event').length,
      scheduledActivities: activities.filter(a => a.type === 'scheduled_activity').length,
      activeVendors: vendorStatsArray.length,
      period,
      startDate: startDateStr
    };

    console.log(`[SALES-RADAR-ACTIVITY] Summary:`, summary);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        activities: activities.slice(0, 200), // Increased limit to 200
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
