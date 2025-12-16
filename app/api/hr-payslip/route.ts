/**
 * API HR PAYSLIP - Gestione Buste Paga e Bonus
 *
 * GET /api/hr-payslip - Lista regole salariali e buste paga
 * GET /api/hr-payslip?action=salary-rules - Lista tutte le regole salariali
 * GET /api/hr-payslip?action=payslips&employeeId=X - Buste paga di un dipendente
 * GET /api/hr-payslip?action=bonus&teamId=X&month=YYYY-MM - Bonus ritirati per team/mese
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [HR-PAYSLIP] GET /api/hr-payslip');

    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!cookies) {
      return NextResponse.json({ error: 'Autenticazione Odoo fallita' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'salary-rules';

    if (action === 'salary-rules') {
      // Lista tutte le regole salariali disponibili
      const rules = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
        domain: [],
        fields: ['id', 'name', 'code', 'category_id', 'active'],
        order: 'name',
      });

      return NextResponse.json({
        success: true,
        action: 'salary-rules',
        count: rules.length,
        rules: rules,
      });
    }

    if (action === 'payslip-lines') {
      // Lista le linee di una busta paga specifica
      const payslipId = searchParams.get('payslipId');

      if (!payslipId) {
        return NextResponse.json({ error: 'payslipId richiesto' }, { status: 400 });
      }

      const lines = await callOdoo(cookies, 'hr.payslip.line', 'search_read', [], {
        domain: [['slip_id', '=', parseInt(payslipId)]],
        fields: ['id', 'name', 'code', 'amount', 'category_id', 'salary_rule_id'],
        order: 'sequence',
      });

      return NextResponse.json({
        success: true,
        action: 'payslip-lines',
        payslipId: parseInt(payslipId),
        count: lines.length,
        lines: lines,
      });
    }

    if (action === 'payslips') {
      // Lista buste paga (tutte o per dipendente)
      const employeeId = searchParams.get('employeeId');
      const month = searchParams.get('month'); // formato YYYY-MM

      let domain: any[] = [];

      if (employeeId) {
        domain.push(['employee_id', '=', parseInt(employeeId)]);
      }

      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];
        domain.push(['date_from', '>=', startDate]);
        domain.push(['date_to', '<=', endDate]);
      }

      const payslips = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
        domain: domain,
        fields: ['id', 'name', 'employee_id', 'date_from', 'date_to', 'state', 'net_wage'],
        order: 'date_from desc',
        limit: 50,
      });

      return NextResponse.json({
        success: true,
        action: 'payslips',
        count: payslips.length,
        payslips: payslips,
      });
    }

    if (action === 'employees') {
      // Lista dipendenti con il loro user_id per mapping con sales team
      const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['active', '=', true]],
        fields: ['id', 'name', 'user_id', 'department_id', 'job_title', 'work_email'],
        order: 'name',
      });

      return NextResponse.json({
        success: true,
        action: 'employees',
        count: employees.length,
        employees: employees,
      });
    }

    // Default: mostra info generali
    return NextResponse.json({
      success: true,
      message: 'API HR Payslip',
      actions: [
        'salary-rules - Lista regole salariali',
        'payslips - Lista buste paga',
        'payslip-lines?payslipId=X - Linee di una busta paga',
        'employees - Lista dipendenti',
      ],
    });

  } catch (error: any) {
    console.error('❌ [HR-PAYSLIP] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
