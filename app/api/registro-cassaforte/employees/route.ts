import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/registro-cassaforte/employees
 * Recupera tutti i dipendenti attivi da Odoo per l'enrollment/selezione
 */
export async function GET(request: NextRequest) {
  try {
    const sessionManager = getOdooSessionManager();

    // Recupera dipendenti attivi
    const employees = await sessionManager.callKw(
      'hr.employee',
      'search_read',
      [[['active', '=', true]]],
      {
        fields: ['id', 'name', 'work_email', 'department_id', 'user_id', 'image_128'],
        order: 'name asc',
      }
    );

    // Formatta i risultati
    const formattedEmployees = employees.map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      work_email: emp.work_email || '',
      department_id: emp.department_id || null,
      user_id: emp.user_id ? emp.user_id[0] : null,
      has_face_enrolled: !!emp.image_128, // Per ora usiamo image_128 come indicatore
    }));

    // Rimuovi duplicati per nome (alcuni dipendenti hanno record doppi)
    const uniqueEmployees = formattedEmployees.reduce((acc: any[], emp: any) => {
      if (!acc.find(e => e.name === emp.name)) {
        acc.push(emp);
      }
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      employees: uniqueEmployees,
      count: uniqueEmployees.length,
    });

  } catch (error: any) {
    console.error('❌ Errore recupero dipendenti:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei dipendenti',
    }, { status: 500 });
  }
}
