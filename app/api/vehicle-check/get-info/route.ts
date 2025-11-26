import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid || !cookies) {
      return NextResponse.json({
        error: 'Sessione non valida. Effettua nuovamente il login.'
      }, { status: 401 });
    }

    console.log('✅ [VEHICLE-CHECK] Utente autenticato con UID:', uid);

    // 1. Get employee from session (pattern from list/route.ts)
    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;

    const employees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [['user_id', '=', uidNum]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (employees.length === 0) {
      console.log('⚠️ [VEHICLE-CHECK] Nessun hr.employee trovato per UID:', uidNum);
      return NextResponse.json({
        error: 'Employee non trovato. Contatta l\'amministratore.'
      }, { status: 404 });
    }

    const employeeId = employees[0].id;
    const driverName = employees[0].name;

    console.log('✅ [VEHICLE-CHECK] Employee trovato:', { employeeId, driverName });

    // 2. Get vehicle assigned to this employee
    const vehicles = await callOdoo(
      cookies,
      'fleet.vehicle',
      'search_read',
      [],
      {
        domain: [['driver_employee_id', '=', employeeId]],  // FIXED: use driver_employee_id not driver_id
        fields: ['id', 'name', 'license_plate', 'category_id'],
        limit: 1
      }
    );

    if (vehicles.length === 0) {
      console.log('⚠️ [VEHICLE-CHECK] Nessun veicolo assegnato per employee:', employeeId);
      return NextResponse.json({
        error: 'Nessun veicolo assegnato. Contatta il fleet manager.'
      }, { status: 404 });
    }

    const vehicle = vehicles[0];
    console.log('✅ [VEHICLE-CHECK] Veicolo trovato:', vehicle);

    // 3. Get last 10 vehicle checks from chatter for persistence tracking
    const messages = await callOdoo(
      cookies,
      'mail.message',
      'search_read',
      [],
      {
        domain: [
          ['model', '=', 'fleet.vehicle'],
          ['res_id', '=', vehicle.id],
          ['body', 'ilike', 'VEHICLE_CHECK_DATA']
        ],
        fields: ['body', 'date', 'subject'],
        order: 'date DESC',
        limit: 10
      }
    );

    let previousCheck: any = null;
    let lastCheckDate: any = null;
    let openIssues: any[] = [];
    const previousChecks: any[] = [];

    // Parse all previous checks
    for (const msg of messages) {
      try {
        const body = msg.body;
        const jsonMatch = body.match(/VEHICLE_CHECK_DATA:([\s\S]*?)(?:<\/|$)/);

        if (jsonMatch && jsonMatch[1]) {
          const checkData = JSON.parse(jsonMatch[1].trim());
          previousChecks.push({
            date: msg.date,
            data: checkData
          });
        }
      } catch (parseError) {
        console.error('❌ [VEHICLE-CHECK] Errore parsing check:', parseError);
      }
    }

    if (previousChecks.length > 0) {
      previousCheck = previousChecks[0].data;
      lastCheckDate = previousChecks[0].date;

      // Calculate persistence for each issue
      // Track how many consecutive checks an issue has appeared in
      const issueHistory = new Map<string, number>();

      // Iterate through checks from newest to oldest
      for (const check of previousChecks) {
        if (check.data && check.data.categories) {
          check.data.categories.forEach((cat: any) => {
            cat.items
              .filter((item: any) => item.status === 'issue' && !item.resolved)
              .forEach((item: any) => {
                const issueKey = `${cat.id}_${item.id}`;
                const currentCount = issueHistory.get(issueKey) || 0;

                // Only increment if this is the next consecutive occurrence
                if (currentCount === 0 || previousChecks[currentCount - 1]?.data?.categories
                  ?.find((c: any) => c.id === cat.id)?.items
                  ?.find((i: any) => i.id === item.id && i.status === 'issue')) {
                  issueHistory.set(issueKey, currentCount + 1);
                }
              });
          });
        }
      }

      // Extract open issues with persistence count
      if (previousCheck && previousCheck.categories) {
        openIssues = previousCheck.categories
          .flatMap((cat: any) =>
            cat.items
              .filter((item: any) => item.status === 'issue' && !item.resolved)
              .map((item: any) => {
                const issueKey = `${cat.id}_${item.id}`;
                return {
                  id: issueKey,
                  category: cat.name,
                  category_id: cat.id,
                  item_id: item.id,
                  item: item.label,
                  note: item.note || '',
                  reported_date: previousCheck.check_date,
                  photos: item.photos || [],
                  resolved: false,
                  persistence_count: issueHistory.get(issueKey) || 1
                };
              })
          );
      }
    }

    console.log('✅ [VEHICLE-CHECK] Open issues:', openIssues.length);

    // Import vehicle check categories to initialize check data
    const { VEHICLE_CHECK_CATEGORIES } = await import('@/app/delivery/vehicle-check-config');

    // Initialize check data structure
    const checkData = {
      check_id: `check_${Date.now()}`,
      check_date: new Date().toISOString(),
      driver_id: employeeId,
      driver_name: driverName,
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      vehicle_license_plate: vehicle.license_plate,
      categories: VEHICLE_CHECK_CATEGORIES.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        items: cat.items.map(item => ({
          id: item.id,
          label: item.label,
          status: 'unchecked' as const,
          note: '',
          photos: [],
          resolved: false
        }))
      })),
      summary: {
        total_items: VEHICLE_CHECK_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0),
        ok_count: 0,
        issue_count: 0,
        unchecked_count: VEHICLE_CHECK_CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0),
        open_issues: openIssues.length,
        resolved_issues: 0
      }
    };

    return NextResponse.json({
      success: true,
      vehicle_info: {
        id: vehicle.id,
        name: vehicle.name,
        license_plate: vehicle.license_plate,
        category_id: vehicle.category_id?.[0] || null,
        category_name: vehicle.category_id?.[1] || null
      },
      driver_info: {
        id: employeeId,
        name: driverName
      },
      check_data: checkData,
      last_check_date: lastCheckDate,
      open_issues: openIssues,
      needs_weekly_check: lastCheckDate ?
        (Date.now() - new Date(lastCheckDate).getTime()) > (7 * 24 * 60 * 60 * 1000) :
        true
    });

  } catch (error: any) {
    console.error('❌ [VEHICLE-CHECK] Errore get-info:', error);
    return NextResponse.json(
      { error: error.message || 'Errore caricamento info veicolo' },
      { status: 500 }
    );
  }
}
