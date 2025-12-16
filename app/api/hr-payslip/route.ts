/**
 * API HR PAYSLIP - Gestione Buste Paga e Bonus
 *
 * GET /api/hr-payslip - Lista regole salariali e buste paga
 * GET /api/hr-payslip?action=salary-rules - Lista tutte le regole salariali
 * GET /api/hr-payslip?action=payslips&employeeId=X - Buste paga di un dipendente
 * GET /api/hr-payslip?action=bonus&teamId=X&month=YYYY-MM - Bonus ritirati per team/mese
 *
 * POST /api/hr-payslip - Crea regola salariale o aggiunge bonus a busta paga
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

/**
 * POST - Crea regola salariale o aggiunge linea bonus a busta paga
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📊 [HR-PAYSLIP] POST /api/hr-payslip');

    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!cookies) {
      return NextResponse.json({ error: 'Autenticazione Odoo fallita' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'create-salary-rule') {
      // Crea una nuova regola salariale (es. Bonus Vendite)
      const { name, code, categoryId, structureId } = body;

      if (!name || !code) {
        return NextResponse.json({ error: 'name e code sono richiesti' }, { status: 400 });
      }

      // Prima verifica se esiste già
      const existing = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
        domain: [['code', '=', code]],
        fields: ['id', 'name', 'code'],
      });

      if (existing && existing.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'Regola salariale già esistente',
          rule: existing[0],
        });
      }

      // Trova la categoria "Netto" (o altra categoria specificata)
      let catId = categoryId;
      if (!catId) {
        const categories = await callOdoo(cookies, 'hr.salary.rule.category', 'search_read', [], {
          domain: [],
          fields: ['id', 'name', 'code'],
        });
        console.log('Categorie trovate:', categories);

        // Cerca categoria "Netto" o "NET" o "Allowance" o "ALW"
        const netCat = categories.find((c: any) =>
          c.code === 'NET' || c.code === 'ALW' || c.name.toLowerCase().includes('netto') || c.name.toLowerCase().includes('allowance')
        );
        catId = netCat?.id || categories[0]?.id;
      }

      // Trova la struttura stipendio (se non specificata)
      let structId = structureId;
      if (!structId) {
        const structures = await callOdoo(cookies, 'hr.payroll.structure', 'search_read', [], {
          domain: [],
          fields: ['id', 'name'],
        });
        console.log('Strutture trovate:', structures);
        structId = structures[0]?.id;
      }

      // Crea la regola salariale
      const ruleId = await callOdoo(cookies, 'hr.salary.rule', 'create', [{
        name: name,
        code: code,
        category_id: catId,
        struct_id: structId,
        sequence: 100, // Dopo le altre regole
        amount_select: 'fix', // Importo fisso (inserito manualmente)
        amount_fix: 0, // Default 0, sarà modificato per ogni busta paga
        quantity: 1,
        active: true,
      }]);

      const newRule = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
        domain: [['id', '=', ruleId]],
        fields: ['id', 'name', 'code', 'category_id', 'struct_id'],
      });

      return NextResponse.json({
        success: true,
        message: 'Regola salariale creata',
        rule: newRule[0],
      });
    }

    if (action === 'add-bonus-line') {
      // Aggiunge una linea bonus a una busta paga esistente
      const { payslipId, amount, name } = body;

      if (!payslipId || amount === undefined) {
        return NextResponse.json({ error: 'payslipId e amount sono richiesti' }, { status: 400 });
      }

      // Trova la regola BONUS_VENDITE
      const bonusRule = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
        domain: [['code', '=', 'BONUS_VENDITE']],
        fields: ['id', 'name', 'code', 'category_id'],
      });

      if (!bonusRule || bonusRule.length === 0) {
        return NextResponse.json({
          error: 'Regola BONUS_VENDITE non trovata. Creala prima con action=create-salary-rule'
        }, { status: 400 });
      }

      // Crea la linea nella busta paga
      const lineId = await callOdoo(cookies, 'hr.payslip.line', 'create', [{
        slip_id: payslipId,
        name: name || 'Bonus Vendite',
        code: 'BONUS_VENDITE',
        category_id: bonusRule[0].category_id[0],
        salary_rule_id: bonusRule[0].id,
        amount: amount,
        quantity: 1,
        rate: 100,
        sequence: 100,
      }]);

      return NextResponse.json({
        success: true,
        message: 'Linea bonus aggiunta alla busta paga',
        lineId: lineId,
        payslipId: payslipId,
        amount: amount,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Azione non riconosciuta',
      availableActions: [
        'create-salary-rule - Crea una nuova regola salariale',
        'add-bonus-line - Aggiunge linea bonus a busta paga',
      ],
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ [HR-PAYSLIP] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
