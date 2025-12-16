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
      // Lista dipendenti con il loro user_id e company_id per mapping con sales team
      const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['active', '=', true]],
        fields: ['id', 'name', 'user_id', 'department_id', 'job_title', 'work_email', 'company_id'],
        order: 'name',
      });

      return NextResponse.json({
        success: true,
        action: 'employees',
        count: employees.length,
        employees: employees,
      });
    }

    if (action === 'payslip-structure') {
      // Esplora la struttura completa di una busta paga per capire i campi
      const payslipId = searchParams.get('payslipId');

      if (!payslipId) {
        return NextResponse.json({ error: 'payslipId richiesto' }, { status: 400 });
      }

      // Leggi tutti i campi della busta paga
      const payslip = await callOdoo(cookies, 'hr.payslip', 'read', [[parseInt(payslipId)]]);

      return NextResponse.json({
        success: true,
        action: 'payslip-structure',
        payslip: payslip[0],
      });
    }

    if (action === 'payslip-fields') {
      // Ottiene la definizione di tutti i campi del modello hr.payslip
      const fields = await callOdoo(cookies, 'hr.payslip', 'fields_get', [], {
        attributes: ['string', 'type', 'required', 'readonly'],
      });

      // Filtra solo i campi relativi alle date
      const dateFields = Object.entries(fields)
        .filter(([key, value]: [string, any]) =>
          value.type === 'date' || value.type === 'datetime' ||
          key.includes('date') || key.includes('paid')
        )
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, any>);

      return NextResponse.json({
        success: true,
        action: 'payslip-fields',
        dateFields: dateFields,
        allFields: fields,
      });
    }

    if (action === 'contracts') {
      // Lista contratti per vedere la struttura stipendio associata
      const employeeId = searchParams.get('employeeId');

      let domain: any[] = [['state', '=', 'open']];
      if (employeeId) {
        domain.push(['employee_id', '=', parseInt(employeeId)]);
      }

      const contracts = await callOdoo(cookies, 'hr.contract', 'search_read', [], {
        domain: domain,
        fields: ['id', 'name', 'employee_id', 'wage', 'state', 'date_start', 'date_end'],
        order: 'date_start desc',
      });

      return NextResponse.json({
        success: true,
        action: 'contracts',
        count: contracts.length,
        contracts: contracts,
      });
    }

    if (action === 'structures') {
      // Lista strutture stipendio disponibili
      const structures = await callOdoo(cookies, 'hr.payroll.structure', 'search_read', [], {
        domain: [],
        fields: ['id', 'name', 'code', 'rule_ids'],
        order: 'name',
      });

      return NextResponse.json({
        success: true,
        action: 'structures',
        count: structures.length,
        structures: structures,
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

    if (action === 'create-payslip') {
      // Crea una nuova busta paga con netto, bonus opzionale e PDF allegato
      const { employeeId, month, netAmount, bonusAmount, paidDate, closingDate, pdfBase64, pdfFilename } = body;

      if (!employeeId || !month || netAmount === undefined) {
        return NextResponse.json({
          error: 'employeeId, month e netAmount sono richiesti'
        }, { status: 400 });
      }

      // Calcola date dal mese (formato YYYY-MM)
      const [year, monthNum] = month.split('-').map(Number);
      const dateFrom = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
      const dateTo = new Date(year, monthNum, 0).toISOString().split('T')[0];

      // Trova il nome del dipendente per creare il nome della busta paga
      const employee = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['id', '=', employeeId]],
        fields: ['id', 'name'],
        limit: 1,
      });
      const employeeName = employee[0]?.name || `Dipendente ${employeeId}`;

      // Crea il nome della busta paga
      const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const payslipName = `Busta Paga ${monthNames[monthNum - 1]} ${year} - ${employeeName}`;

      // Trova la struttura stipendio default
      let structId = null;
      try {
        const structures = await callOdoo(cookies, 'hr.payroll.structure', 'search_read', [], {
          domain: [],
          fields: ['id'],
          limit: 1,
        });
        structId = structures[0]?.id;
      } catch (e) {
        console.log('Strutture payroll non disponibili, continuo senza');
      }

      // Crea la busta paga
      const payslipData: any = {
        name: payslipName,
        employee_id: employeeId,
        date_from: dateFrom,
        date_to: dateTo,
        state: 'draft',
      };

      // Aggiungi date opzionali se fornite
      // paid_date = Data di pagamento
      // date_conto = Data Conto (data chiusura contabile)
      if (paidDate) {
        payslipData.paid_date = paidDate;
      }
      if (closingDate) {
        payslipData.date_conto = closingDate;
      }

      if (structId) {
        payslipData.struct_id = structId;
      }

      const payslipId = await callOdoo(cookies, 'hr.payslip', 'create', [payslipData]);

      if (!payslipId) {
        return NextResponse.json({ error: 'Errore creazione busta paga' }, { status: 500 });
      }

      // Trova la regola NET per aggiungere il netto
      const netRule = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
        domain: [['code', '=', 'NET']],
        fields: ['id', 'name', 'code', 'category_id'],
        limit: 1,
      });

      if (netRule && netRule.length > 0) {
        // Aggiungi linea netto
        await callOdoo(cookies, 'hr.payslip.line', 'create', [{
          slip_id: payslipId,
          name: 'Retribuzione netta',
          code: 'NET',
          category_id: netRule[0].category_id[0],
          salary_rule_id: netRule[0].id,
          amount: netAmount,
          quantity: 1,
          rate: 100,
          sequence: 99,
        }]);
      }

      // Se c'è bonus, aggiungilo
      if (bonusAmount && bonusAmount > 0) {
        const bonusRule = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
          domain: [['code', '=', 'BONUS_VENDITE']],
          fields: ['id', 'name', 'code', 'category_id'],
        });

        if (bonusRule && bonusRule.length > 0) {
          await callOdoo(cookies, 'hr.payslip.line', 'create', [{
            slip_id: payslipId,
            name: 'Bonus Vendite',
            code: 'BONUS_VENDITE',
            category_id: bonusRule[0].category_id[0],
            salary_rule_id: bonusRule[0].id,
            amount: bonusAmount,
            quantity: 1,
            rate: 100,
            sequence: 100,
          }]);
        }
      }

      // Se c'è PDF, allegalo alla busta paga
      let attachmentId = null;
      if (pdfBase64) {
        attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
          name: pdfFilename || `Busta_Paga_${month}.pdf`,
          type: 'binary',
          datas: pdfBase64,
          res_model: 'hr.payslip',
          res_id: payslipId,
          mimetype: 'application/pdf',
        }]);
      }

      // Leggi la busta paga creata
      const newPayslip = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
        domain: [['id', '=', payslipId]],
        fields: ['id', 'name', 'employee_id', 'date_from', 'date_to', 'state', 'net_wage'],
      });

      return NextResponse.json({
        success: true,
        message: 'Busta paga creata con successo',
        payslip: newPayslip[0],
        attachmentId: attachmentId,
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
