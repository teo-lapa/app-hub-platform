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
      res_model: resModel, // Model = crm.lead o res.partner
      res_id: resId, // ID del lead o contatto
      summary: `Appuntamento - ${body.date} alle ${body.time}`,
      note: body.note ? `Ora: ${body.time}\n\n${body.note}` : `Ora: ${body.time}`,
      activity_type_id: meetingTypeId,
      date_deadline: body.date, // Data scadenza = data appuntamento
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

    console.log(`✅ [CREATE-APPOINTMENT] Appointment created: ID ${newActivityId}`);

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
      },
      odoo_url: `${process.env.NEXT_PUBLIC_ODOO_URL}/web#id=${resId}&model=${resModel}&view_type=form`
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
