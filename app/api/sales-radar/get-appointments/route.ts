import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partner_id = searchParams.get('partner_id');
    const lead_id = searchParams.get('lead_id');

    if (!partner_id && !lead_id) {
      return NextResponse.json({
        success: false,
        error: 'partner_id o lead_id richiesto'
      }, { status: 400 });
    }

    // Connect to Odoo
    const client = await getOdooClient();

    // Build domain for searching appointments
    const domain: any[] = [];

    if (partner_id) {
      domain.push(['partner_ids', 'in', [parseInt(partner_id)]]);
    }

    if (lead_id) {
      // Search by opportunity_id
      domain.push(['opportunity_id', '=', parseInt(lead_id)]);
    }

    // Get current date for filtering upcoming appointments
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('[GET-APPOINTMENTS] Searching with domain:', domain);

    // Search appointments
    const appointments = await client.searchRead(
      'calendar.event',
      domain,
      [
        'id',
        'name',
        'start',
        'stop',
        'start_date',
        'duration',
        'description',
        'location',
        'allday',
        'partner_ids',
        'opportunity_id',
        'user_id' // Assigned user
      ],
      100, // limit
      0    // offset
    );

    console.log(`[GET-APPOINTMENTS] Found ${appointments.length} appointments`);

    // Categorize appointments
    const upcoming: any[] = [];
    const past: any[] = [];

    appointments.forEach((appt: any) => {
      const apptDate = appt.start || appt.start_date;
      if (apptDate && apptDate >= now) {
        upcoming.push(appt);
      } else {
        past.push(appt);
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        total: appointments.length,
        upcoming: upcoming.length,
        past: past.length,
        appointments: {
          upcoming,
          past
        }
      }
    });

  } catch (error) {
    console.error('[GET-APPOINTMENTS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante il caricamento degli appuntamenti',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
