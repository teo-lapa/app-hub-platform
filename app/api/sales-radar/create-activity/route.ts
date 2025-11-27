import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface CreateActivityBody {
  partner_id?: number;
  lead_id?: number;
  activity_type: 'call' | 'meeting' | 'task' | 'appointment';
  summary: string;
  note?: string;
  date_deadline?: string; // ISO date string YYYY-MM-DD
  priority?: 'low' | 'medium' | 'high';
}

/**
 * POST /api/sales-radar/create-activity
 *
 * Crea un'attività (mail.activity) su un contatto o lead in Odoo
 *
 * Body:
 * - partner_id: number - ID del contatto
 * - lead_id: number (opzionale) - ID del lead collegato
 * - activity_type: 'call' | 'meeting' | 'task' | 'appointment' - Tipo attività
 * - summary: string - Titolo dell'attività
 * - note: string (opzionale) - Note aggiuntive
 * - date_deadline: string (opzionale) - Data scadenza YYYY-MM-DD
 * - priority: 'low' | 'medium' | 'high' (opzionale) - Priorità (default: medium)
 *
 * Risposta:
 * - success: boolean
 * - activity_id: number - ID dell'attività creata
 * - activity: oggetto attività creata
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);
    const body: CreateActivityBody = await request.json();

    // Validate required fields
    if (!body.partner_id && !body.lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Campo "partner_id" o "lead_id" richiesto'
      }, { status: 400 });
    }

    if (!body.summary || !body.summary.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Campo "summary" richiesto'
      }, { status: 400 });
    }

    // Determina se è un lead o un partner
    const isLead = !!body.lead_id;
    const resModel = isLead ? 'crm.lead' : 'res.partner';
    const resId = isLead ? body.lead_id : body.partner_id;

    console.log(`📅 [CREATE-ACTIVITY] Creating activity for ${resModel} ${resId}:`, body.summary);

    // Get current user ID
    let currentUserId: number | null = null;
    try {
      const currentUser = await client.getCurrentUser();
      currentUserId = currentUser?.id || null;
      console.log(`👤 [CREATE-ACTIVITY] Current user: ${currentUser?.name} (ID: ${currentUserId})`);
    } catch (error) {
      console.warn('⚠️ [CREATE-ACTIVITY] Cannot get current user:', error);
    }

    // Get activity type ID based on type
    let activityTypeId: number | false = false;

    try {
      // Common activity types in Odoo:
      // - "mail.mail_activity_data_call" - Phone Call
      // - "mail.mail_activity_data_meeting" - Meeting
      // - "mail.mail_activity_data_todo" - To-Do
      const activityTypeMap: Record<string, string> = {
        'call': 'mail.mail_activity_data_call',
        'meeting': 'mail.mail_activity_data_meeting',
        'appointment': 'mail.mail_activity_data_meeting',
        'task': 'mail.mail_activity_data_todo'
      };

      const typeXmlId = activityTypeMap[body.activity_type] || 'mail.mail_activity_data_todo';

      // Search for activity type by XML ID
      const activityTypes = await client.callKw(
        'mail.activity.type',
        'search_read',
        [[]],
        {
          fields: ['id', 'name'],
          limit: 20
        }
      );

      console.log(`📋 [CREATE-ACTIVITY] Available activity types:`, activityTypes.map((t: any) => `${t.name} (${t.id})`));

      // Try to match by name (fallback)
      const typeNameMap: Record<string, string[]> = {
        'call': ['Call', 'Chiamata', 'Telefonata'],
        'meeting': ['Meeting', 'Riunione', 'Appuntamento'],
        'appointment': ['Meeting', 'Riunione', 'Appuntamento'],
        'task': ['To-Do', 'Task', 'Attività', 'Todo']
      };

      const possibleNames = typeNameMap[body.activity_type] || ['To-Do'];
      const matchingType = activityTypes.find((t: any) =>
        possibleNames.some(name => t.name.toLowerCase().includes(name.toLowerCase()))
      );

      if (matchingType) {
        activityTypeId = matchingType.id;
        console.log(`✅ [CREATE-ACTIVITY] Found activity type: ${matchingType.name} (ID: ${activityTypeId})`);
      } else {
        // Use first available type as fallback
        activityTypeId = activityTypes[0]?.id || false;
        console.log(`⚠️ [CREATE-ACTIVITY] Using fallback activity type: ${activityTypes[0]?.name} (ID: ${activityTypeId})`);
      }
    } catch (error) {
      console.warn('⚠️ [CREATE-ACTIVITY] Cannot find activity type:', error);
    }

    // Prepare activity values
    const activityValues: any = {
      res_model: resModel, // Model = crm.lead o res.partner
      res_id: resId, // ID del lead o contatto
      summary: body.summary,
      note: body.note || false,
      activity_type_id: activityTypeId,
      date_deadline: body.date_deadline || new Date().toISOString().split('T')[0], // Default oggi
      user_id: currentUserId || false, // Assegna all'utente corrente
    };

    // Remove false values
    Object.keys(activityValues).forEach(key => {
      if (activityValues[key] === false) {
        delete activityValues[key];
      }
    });

    console.log(`📋 [CREATE-ACTIVITY] Activity values:`, activityValues);

    // Create activity
    const newActivityId = await client.callKw(
      'mail.activity',
      'create',
      [activityValues]
    );

    if (!newActivityId) {
      throw new Error('Creazione attività fallita');
    }

    console.log(`✅ [CREATE-ACTIVITY] Activity created: ID ${newActivityId}`);

    // Get created activity with all details
    const createdActivities = await client.searchRead(
      'mail.activity',
      [['id', '=', newActivityId]],
      [
        'id', 'summary', 'note', 'date_deadline',
        'activity_type_id', 'res_model', 'res_id', 'user_id', 'create_date'
      ],
      1
    );

    const createdActivity = createdActivities[0];

    return NextResponse.json({
      success: true,
      activity_id: newActivityId,
      activity: {
        id: createdActivity.id,
        summary: createdActivity.summary,
        note: createdActivity.note || '',
        date_deadline: createdActivity.date_deadline,
        activity_type: createdActivity.activity_type_id ? createdActivity.activity_type_id[1] : '',
        user: createdActivity.user_id ? createdActivity.user_id[1] : '',
        create_date: createdActivity.create_date
      }
    });

  } catch (error) {
    console.error('❌ [CREATE-ACTIVITY] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la creazione dell\'attività',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
