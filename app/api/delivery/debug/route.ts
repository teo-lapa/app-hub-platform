import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const uidNum = typeof uid === 'string' ? parseInt(uid) : uid;

    // Cerca dipendente
    const employees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [['user_id', '=', uidNum]],
        fields: ['id', 'name', 'user_id'],
        limit: 10
      }
    );

    // Cerca TUTTI i dipendenti per confronto
    const allEmployees = await callOdoo(
      cookies,
      'hr.employee',
      'search_read',
      [],
      {
        domain: [],
        fields: ['id', 'name', 'user_id'],
        limit: 50
      }
    );

    // Prendi un documento qualsiasi per vedere il driver_id
    const samplePickings = await callOdoo(
      cookies,
      'stock.picking',
      'search_read',
      [],
      {
        domain: [
          ['picking_type_id.code', '=', 'outgoing'],
          ['state', 'in', ['assigned', 'done']]
        ],
        fields: ['id', 'name', 'driver_id'],
        limit: 30
      }
    );

    return NextResponse.json({
      uid: uidNum,
      employeesFound: employees.length,
      employeeDetails: employees,
      allEmployees: allEmployees.map(e => ({
        id: e.id,
        name: e.name,
        user_id: e.user_id
      })),
      samplePickings: samplePickings.map(p => ({
        name: p.name,
        driver_id: p.driver_id
      }))
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
