import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationEmployees,
  getEmployeesOnDuty,
  createEmployee,
  getEmployee,
} from '@/lib/time-attendance/db';
import { TAApiResponse, Employee, EmployeeWithStatus } from '@/lib/time-attendance/types';

/**
 * GET /api/time-attendance/employees?org_id=xxx
 * Lista dipendenti dell'organizzazione
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const status = searchParams.get('status'); // 'on_duty' per vedere chi e in servizio
    const includeInactive = searchParams.get('include_inactive') === 'true';

    if (!orgId) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'org_id richiesto',
      }, { status: 400 });
    }

    // Se richiesto status 'on_duty', ritorna con info stato
    if (status === 'on_duty') {
      const employees = await getEmployeesOnDuty(orgId);

      return NextResponse.json<TAApiResponse<{
        employees: EmployeeWithStatus[];
        total: number;
        on_duty_count: number;
      }>>({
        success: true,
        data: {
          employees,
          total: employees.length,
          on_duty_count: employees.filter(e => e.is_on_duty).length,
        },
      });
    }

    // Lista standard
    const employees = await getOrganizationEmployees(orgId, includeInactive);

    return NextResponse.json<TAApiResponse<{
      employees: Employee[];
      total: number;
    }>>({
      success: true,
      data: {
        employees,
        total: employees.length,
      },
    });

  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nel recupero dipendenti',
    }, { status: 500 });
  }
}

/**
 * POST /api/time-attendance/employees
 * Crea nuovo dipendente (solo admin)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id,
      email,
      name,
      password,
      phone,
      role,
      hourly_rate,
      contract_hours_per_week,
    } = body;

    // Validazione
    if (!org_id || !email || !name || !password) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'org_id, email, name e password sono obbligatori',
      }, { status: 400 });
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Email non valida',
      }, { status: 400 });
    }

    // Validazione password
    if (password.length < 6) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'La password deve essere di almeno 6 caratteri',
      }, { status: 400 });
    }

    // Validazione ruolo
    if (role && !['admin', 'manager', 'employee'].includes(role)) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Ruolo non valido. Usa: admin, manager, employee',
      }, { status: 400 });
    }

    const employee = await createEmployee({
      org_id,
      email,
      name,
      password,
      phone,
      role: role || 'employee',
      hourly_rate,
      contract_hours_per_week,
    });

    return NextResponse.json<TAApiResponse<{ employee: Employee }>>({
      success: true,
      data: { employee },
      message: `Dipendente ${name} creato con successo`,
    });

  } catch (error) {
    console.error('Create employee error:', error);

    // Check for duplicate email
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Email gia registrata per questa organizzazione',
      }, { status: 400 });
    }

    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nella creazione del dipendente',
    }, { status: 500 });
  }
}
