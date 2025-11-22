import { NextRequest, NextResponse } from 'next/server';
import {
  getDailySummary,
  getEmployeeMonthlySummary,
  getOrganizationEmployees,
} from '@/lib/time-attendance/db';
import { TAApiResponse, DailyWorkSummary } from '@/lib/time-attendance/types';

/**
 * GET /api/time-attendance/reports
 * Genera report presenze
 *
 * Query params:
 * - org_id: ID organizzazione
 * - type: 'daily' | 'monthly' | 'employee'
 * - date: Data per report giornaliero (YYYY-MM-DD)
 * - year: Anno per report mensile
 * - month: Mese per report mensile (1-12)
 * - employee_id: ID dipendente per report singolo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    const type = searchParams.get('type') || 'daily';

    if (!orgId) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'org_id richiesto',
      }, { status: 400 });
    }

    // ========== REPORT GIORNALIERO ==========
    if (type === 'daily') {
      const dateStr = searchParams.get('date');
      const date = dateStr ? new Date(dateStr) : new Date();

      const summary = await getDailySummary(orgId, date);

      // Calcola statistiche
      const totalEmployees = summary.length;
      const employeesPresent = summary.filter(s => s.clock_in_count > 0).length;
      const totalHours = summary.reduce((acc, s) => acc + (s.total_hours || 0), 0);

      return NextResponse.json<TAApiResponse<{
        date: string;
        summary: DailyWorkSummary[];
        stats: {
          total_employees: number;
          employees_present: number;
          employees_absent: number;
          total_hours: number;
          average_hours: number;
        };
      }>>({
        success: true,
        data: {
          date: date.toISOString().split('T')[0],
          summary,
          stats: {
            total_employees: totalEmployees,
            employees_present: employeesPresent,
            employees_absent: totalEmployees - employeesPresent,
            total_hours: Math.round(totalHours * 100) / 100,
            average_hours: employeesPresent > 0
              ? Math.round((totalHours / employeesPresent) * 100) / 100
              : 0,
          },
        },
      });
    }

    // ========== REPORT MENSILE ==========
    if (type === 'monthly') {
      const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
      const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

      if (month < 1 || month > 12) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'Mese non valido (1-12)',
        }, { status: 400 });
      }

      // Ottieni tutti i dipendenti
      const employees = await getOrganizationEmployees(orgId);

      // Per ogni dipendente, ottieni il riepilogo mensile
      const employeeReports = await Promise.all(
        employees.map(async (emp) => {
          const entries = await getEmployeeMonthlySummary(emp.id, year, month);

          const daysWorked = entries.length;
          const totalHours = entries.reduce((acc, e) => acc + (e.total_hours || 0), 0);

          return {
            employee_id: emp.id,
            employee_name: emp.name,
            email: emp.email,
            role: emp.role,
            days_worked: daysWorked,
            total_hours: Math.round(totalHours * 100) / 100,
            average_hours_per_day: daysWorked > 0
              ? Math.round((totalHours / daysWorked) * 100) / 100
              : 0,
            contract_hours: emp.contract_hours_per_week
              ? (emp.contract_hours_per_week * 4.33) // ore mensili stimate
              : null,
            overtime_hours: emp.contract_hours_per_week
              ? Math.max(0, totalHours - (emp.contract_hours_per_week * 4.33))
              : null,
            daily_entries: entries,
          };
        })
      );

      // Statistiche aggregate
      const totalDaysWorked = employeeReports.reduce((acc, r) => acc + r.days_worked, 0);
      const totalHoursWorked = employeeReports.reduce((acc, r) => acc + r.total_hours, 0);

      return NextResponse.json<TAApiResponse<{
        year: number;
        month: number;
        period: string;
        employees: typeof employeeReports;
        stats: {
          total_employees: number;
          total_days_worked: number;
          total_hours_worked: number;
          average_hours_per_employee: number;
        };
      }>>({
        success: true,
        data: {
          year,
          month,
          period: `${year}-${month.toString().padStart(2, '0')}`,
          employees: employeeReports,
          stats: {
            total_employees: employees.length,
            total_days_worked: totalDaysWorked,
            total_hours_worked: Math.round(totalHoursWorked * 100) / 100,
            average_hours_per_employee: employees.length > 0
              ? Math.round((totalHoursWorked / employees.length) * 100) / 100
              : 0,
          },
        },
      });
    }

    // ========== REPORT SINGOLO DIPENDENTE ==========
    if (type === 'employee') {
      const employeeId = searchParams.get('employee_id');
      const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
      const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

      if (!employeeId) {
        return NextResponse.json<TAApiResponse<null>>({
          success: false,
          error: 'employee_id richiesto per report dipendente',
        }, { status: 400 });
      }

      const entries = await getEmployeeMonthlySummary(employeeId, year, month);

      const daysWorked = entries.length;
      const totalHours = entries.reduce((acc, e) => acc + (e.total_hours || 0), 0);

      return NextResponse.json<TAApiResponse<{
        employee_id: string;
        year: number;
        month: number;
        entries: DailyWorkSummary[];
        stats: {
          days_worked: number;
          total_hours: number;
          average_hours_per_day: number;
        };
      }>>({
        success: true,
        data: {
          employee_id: employeeId,
          year,
          month,
          entries,
          stats: {
            days_worked: daysWorked,
            total_hours: Math.round(totalHours * 100) / 100,
            average_hours_per_day: daysWorked > 0
              ? Math.round((totalHours / daysWorked) * 100) / 100
              : 0,
          },
        },
      });
    }

    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Tipo report non valido. Usa: daily, monthly, employee',
    }, { status: 400 });

  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nella generazione del report',
    }, { status: 500 });
  }
}
