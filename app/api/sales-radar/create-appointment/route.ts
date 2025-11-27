import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface CreateAppointmentBody {
  partner_id?: number;
  lead_id?: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  note?: string;
}

/**
 * POST /api/sales-radar/create-appointment
 *
 * Crea un appuntamento (mail.activity di tipo meeting) su un contatto in Odoo
 *
 * Body:
 * - partner_id: number - ID del contatto
 * - lead_id: number (opzionale) - ID del lead collegato
 * - date: string - Data appuntamento YYYY-MM-DD
 * - time: string - Ora appuntamento HH:MM
 * - note: string (opzionale) - Note aggiuntive
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
    const body: CreateAppointmentBody = await request.json();

    // Validate required fields
    if (!body.partner_id && !body.lead_id) {
      return NextResponse.json({
        success: false,
        error: 'Campo "partner_id" o "lead_id" richiesto'
      }, { status: 400 });
    }

    if (!body.date || !body.time) {
      return NextResponse.json({
        success: false,
        error: 'Campi "date" e "time" richiesti'
      }, { status: 400 });
    }

    // Determina se è un lead o un partner
    const isLead = !!body.lead_id;
    const resModel = isLead ? 'crm.lead' : 'res.partner';
    const resId = isLead ? body.lead_id : body.partner_id;

    console.log(`📅 [CREATE-APPOINTMENT] Creating appointment for ${resModel} ${resId} on ${body.date} at ${body.time}`);

    // Get model ID from ir.model (Odoo requires res_model_id, not res_model!)
    let resModelId: number | null = null;
    try {
      const modelRecords = await client.callKw(
        'ir.model',
        'search_read',
        [[['model', '=', resModel]]],
        {
          fields: ['id', 'model', 'name'],
          limit: 1
        }
      );
      if (modelRecords.length > 0) {
        resModelId = modelRecords[0].id;
        console.log(`✅ [CREATE-APPOINTMENT] Model ID for ${resModel}: ${resModelId}`);
      } else {
        throw new Error(`Model ${resModel} not found in ir.model`);
      }
    } catch (error) {
      console.error('❌ [CREATE-APPOINTMENT] Cannot get model ID:', error);
      return NextResponse.json({
        success: false,
        error: `Impossibile trovare il modello ${resModel}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Get current user ID
    let currentUserId: number | null = null;
    try {
      const currentUser = await client.getCurrentUser();
      currentUserId = currentUser?.id || null;
      console.log(`👤 [CREATE-APPOINTMENT] Current user: ${currentUser?.name} (ID: ${currentUserId})`);
    } catch (error) {
      console.warn('⚠️ [CREATE-APPOINTMENT] Cannot get current user:', error);
    }

    // Get "Meeting" activity type ID
    let meetingTypeId: number | false = false;

    try {
      const activityTypes = await client.callKw(
        'mail.activity.type',
        'search_read',
        [[]],
        {
          fields: ['id', 'name'],
          limit: 20
        }
      );

      console.log(`📋 [CREATE-APPOINTMENT] Available activity types:`, activityTypes.map((t: any) => `${t.name} (${t.id})`));

      // Try to find "Meeting" type
      const meetingType = activityTypes.find((t: any) =>
        ['meeting', 'riunione', 'appuntamento'].some(keyword =>
          t.name.toLowerCase().includes(keyword)
        )
      );

      if (meetingType) {
        meetingTypeId = meetingType.id;
        console.log(`✅ [CREATE-APPOINTMENT] Found meeting type: ${meetingType.name} (ID: ${meetingTypeId})`);
      } else {
        // Use first available type as fallback
        meetingTypeId = activityTypes[0]?.id || false;
        console.log(`⚠️ [CREATE-APPOINTMENT] Using fallback activity type: ${activityTypes[0]?.name} (ID: ${meetingTypeId})`);
      }
    } catch (error) {
      console.warn('⚠️ [CREATE-APPOINTMENT] Cannot find activity type:', error);
    }

    // Prepare activity values
    const activityValues: any = {
      res_model_id: resModelId, // Model ID from ir.model (required!)
      res_id: resId, // ID del lead o contatto
      summary: `Appuntamento - ${body.date} alle ${body.time}`,
      note: body.note ? `Ora: ${body.time}\n\n${body.note}` : `Ora: ${body.time}`,
      activity_type_id: meetingTypeId,
      date_deadline: body.date, // Data scadenza = data appuntamento
      user_id: currentUserId || false, // Assegna all'utente corrente
    };

    // Remove false values
    Object.keys(activityValues).forEach(key => {
      if (activityValues[key] === false) {
        delete activityValues[key];
      }
    });

    console.log(`📋 [CREATE-APPOINTMENT] Activity values:`, activityValues);

    // Create activity
    const newActivityId = await client.callKw(
      'mail.activity',
      'create',
      [activityValues]
    );

    if (!newActivityId) {
      throw new Error('Creazione appuntamento fallita');
    }

    console.log(`✅ [CREATE-APPOINTMENT] Activity created: ID ${newActivityId}`);

    // === CREATE CALENDAR EVENT ===
    // This makes the appointment appear in Odoo Calendar
    let calendarEventId: number | null = null;
    try {
      // Create datetime strings for start and stop (1 hour duration by default)
      const startDateTime = `${body.date} ${body.time}:00`;
      const [hours, minutes] = body.time.split(':').map(Number);
      const endHours = hours + 1; // 1 hour duration
      const endTime = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const stopDateTime = `${body.date} ${endTime}:00`;

      // Get lead/partner name for the event title
      let recordName = '';
      try {
        const records = await client.searchRead(
          resModel,
          [['id', '=', resId]],
          ['name'],
          1
        );
        recordName = records[0]?.name || '';
      } catch (e) {
        console.warn('⚠️ [CREATE-APPOINTMENT] Cannot get record name:', e);
      }

      const calendarEventValues: any = {
        name: recordName ? `Appuntamento - ${recordName}` : `Appuntamento - ${body.date} alle ${body.time}`,
        start: startDateTime,
        stop: stopDateTime,
        description: body.note || '',
        user_id: currentUserId || false,
      };

      // If it's a lead, link to the opportunity
      if (isLead && body.lead_id) {
        calendarEventValues.opportunity_id = body.lead_id;
        // Also try to get the partner from the lead to add as attendee
        try {
          const leadData = await client.searchRead(
            'crm.lead',
            [['id', '=', body.lead_id]],
            ['partner_id'],
            1
          );
          if (leadData[0]?.partner_id) {
            calendarEventValues.partner_ids = [[6, 0, [leadData[0].partner_id[0]]]];
          }
        } catch (e) {
          console.warn('⚠️ [CREATE-APPOINTMENT] Cannot get partner from lead:', e);
        }
      }

      // If it's a partner (contact), add them as attendee
      if (!isLead && body.partner_id) {
        calendarEventValues.partner_ids = [[6, 0, [body.partner_id]]]; // Many2many command
      }

      // Remove false values
      Object.keys(calendarEventValues).forEach(key => {
        if (calendarEventValues[key] === false) {
          delete calendarEventValues[key];
        }
      });

      console.log(`📅 [CREATE-APPOINTMENT] Creating calendar event:`, calendarEventValues);

      calendarEventId = await client.callKw(
        'calendar.event',
        'create',
        [calendarEventValues]
      );

      console.log(`✅ [CREATE-APPOINTMENT] Calendar event created: ID ${calendarEventId}`);

    } catch (error) {
      console.warn('⚠️ [CREATE-APPOINTMENT] Cannot create calendar event:', error);
      // Don't fail the whole request if calendar event fails
    }

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
      calendar_event_id: calendarEventId,
      activity: {
        id: createdActivity.id,
        summary: createdActivity.summary,
        note: createdActivity.note || '',
        date_deadline: createdActivity.date_deadline,
        activity_type: createdActivity.activity_type_id ? createdActivity.activity_type_id[1] : '',
        user: createdActivity.user_id ? createdActivity.user_id[1] : '',
        create_date: createdActivity.create_date
      },
      odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${resId}&model=${resModel}&view_type=form`,
      calendar_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#action=158&model=calendar.event&view_type=calendar`
    });

  } catch (error) {
    console.error('❌ [CREATE-APPOINTMENT] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante la creazione dell\'appuntamento',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
