import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

// GET: Fetch employees from Odoo
export async function GET(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // Fetch all active employees from Odoo
    const employees = await client.searchRead(
      'hr.employee',
      [['active', '=', true]],
      ['id', 'name', 'work_email', 'department_id', 'job_title'],
      0,
      'name'
    );

    return NextResponse.json({
      success: true,
      data: employees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        email: emp.work_email || '',
        department: emp.department_id ? emp.department_id[1] : '',
        jobTitle: emp.job_title || ''
      }))
    });

  } catch (error) {
    console.error('Errore caricamento dipendenti da Odoo:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore caricamento dipendenti',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
