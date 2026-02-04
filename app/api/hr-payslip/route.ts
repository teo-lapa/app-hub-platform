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

    if (action === 'employee-bonus') {
      // Ottiene il bonus CUMULATIVO disponibile per un dipendente
      // Somma bonus_real di tutti i mesi precedenti e sottrae i bonus già ritirati
      const employeeId = searchParams.get('employeeId');
      const month = searchParams.get('month'); // formato YYYY-MM (mese della busta paga)

      if (!employeeId) {
        return NextResponse.json({ error: 'employeeId richiesto' }, { status: 400 });
      }

      // 1. Trova il dipendente e il suo user_id
      const employee = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['id', '=', parseInt(employeeId)]],
        fields: ['id', 'name', 'user_id'],
      });

      if (!employee || employee.length === 0) {
        return NextResponse.json({ error: 'Dipendente non trovato' }, { status: 404 });
      }

      const userId = employee[0].user_id ? employee[0].user_id[0] : null;

      if (!userId) {
        return NextResponse.json({
          success: true,
          bonus_available: 0,
          bonus_withdrawn: 0,
          bonus_remaining: 0,
          message: 'Dipendente senza user_id (non è un venditore)',
        });
      }

      // 2. Trova il team di vendita del venditore
      const teamMembers = await callOdoo(cookies, 'crm.team.member', 'search_read', [], {
        domain: [['user_id', '=', userId]],
        fields: ['id', 'crm_team_id', 'user_id'],
      });

      if (!teamMembers || teamMembers.length === 0) {
        return NextResponse.json({
          success: true,
          bonus_available: 0,
          bonus_withdrawn: 0,
          bonus_remaining: 0,
          message: 'Venditore non assegnato a nessun team',
        });
      }

      const teamId = teamMembers[0].crm_team_id[0];
      const teamName = teamMembers[0].crm_team_id[1];

      // 3. Determina il range di mesi da calcolare (da Novembre 2025 al mese precedente alla busta)
      // Il sistema parte da Novembre 2025
      const startMonth = new Date(2025, 10, 1); // Novembre 2025 (mese 10 = novembre in JS)

      let endMonth: Date;
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        endMonth = new Date(year, monthNum - 2, 1); // Mese precedente alla busta paga
      } else {
        const now = new Date();
        endMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }

      // 4. Calcola bonus_real totale da tutti i mesi precedenti
      let totalBonusReal = 0;
      const monthsDetail: Array<{ month: string; bonus_theoretical: number; bonus_real: number; payment_percentage: number }> = [];
      const today = new Date();

      let currentMonth = new Date(startMonth);
      while (currentMonth <= endMonth) {
        const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        const monthsBack = (today.getFullYear() - currentMonth.getFullYear()) * 12 + (today.getMonth() - currentMonth.getMonth());

        try {
          const compensiUrl = new URL(request.url);
          compensiUrl.pathname = '/api/compensi-venditori';
          compensiUrl.searchParams.set('teamId', teamId.toString());
          compensiUrl.searchParams.set('monthsBack', monthsBack.toString());

          const compensiResponse = await fetch(compensiUrl.toString(), {
            headers: { 'cookie': request.headers.get('cookie') || '' },
          });

          if (compensiResponse.ok) {
            const compensiData = await compensiResponse.json();
            const teamData = compensiData.teams?.[0];

            if (teamData && teamData.bonus_real > 0) {
              totalBonusReal += teamData.bonus_real;
              monthsDetail.push({
                month: monthStr,
                bonus_theoretical: teamData.bonus_theoretical || 0,
                bonus_real: teamData.bonus_real || 0,
                payment_percentage: teamData.payment_percentage || 0,
              });
            }
          }
        } catch (e) {
          console.error(`Errore calcolo bonus per ${monthStr}:`, e);
        }

        // Passa al mese successivo
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      // 5. Calcola bonus già ritirati dalle buste paga precedenti
      // Cerca tutte le buste paga di questo dipendente con linea BONUS_VENDITE
      const payslips = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
        domain: [
          ['employee_id', '=', parseInt(employeeId)],
          ['date_from', '>=', '2025-11-01'], // Dal mese di partenza del sistema
        ],
        fields: ['id', 'name', 'date_from'],
      });

      let totalBonusWithdrawn = 0;
      for (const payslip of payslips) {
        const lines = await callOdoo(cookies, 'hr.payslip.line', 'search_read', [], {
          domain: [
            ['slip_id', '=', payslip.id],
            ['code', '=', 'BONUS_VENDITE'],
          ],
          fields: ['amount'],
        });

        for (const line of lines) {
          totalBonusWithdrawn += line.amount || 0;
        }
      }

      // 6. Calcola bonus rimanente (disponibile - ritirato)
      const bonusRemaining = Math.max(0, totalBonusReal - totalBonusWithdrawn);

      // 7. Restituisce il riepilogo completo
      return NextResponse.json({
        success: true,
        employee: {
          id: employee[0].id,
          name: employee[0].name,
          user_id: userId,
        },
        team: {
          id: teamId,
          name: teamName,
        },
        period: {
          from: '2025-11',
          to: `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, '0')}`,
        },
        bonus_total_real: totalBonusReal,     // Totale bonus maturati
        bonus_withdrawn: totalBonusWithdrawn,  // Totale già ritirato in buste paga
        bonus_available: bonusRemaining,       // Disponibile da ritirare (pre-compilato nel campo)
        months_detail: monthsDetail,           // Dettaglio per mese
      });
    }

    if (action === 'team-bonus-cumulative') {
      // Calcola il bonus cumulativo per un team di vendita (da Nov 2024 ad oggi)
      // Combina bonus_real di ogni mese + bonus ritirato per calcolare il disponibile
      const teamId = searchParams.get('teamId');

      if (!teamId) {
        return NextResponse.json({ error: 'teamId richiesto' }, { status: 400 });
      }

      const today = new Date();
      const startMonth = new Date(2025, 10, 1); // Novembre 2025
      // Calcola fino al mese precedente (il mese corrente è ancora in corso)
      const endMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      let totalBonusReal = 0;
      const monthsDetail: Array<{ month: string; bonus_theoretical: number; bonus_real: number; payment_percentage: number }> = [];

      let currentMonth = new Date(startMonth);
      while (currentMonth <= endMonth) {
        const monthsBack = (today.getFullYear() - currentMonth.getFullYear()) * 12 + (today.getMonth() - currentMonth.getMonth());
        const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

        try {
          const compensiUrl = new URL(request.url);
          compensiUrl.pathname = '/api/compensi-venditori';
          compensiUrl.searchParams.set('teamId', teamId);
          compensiUrl.searchParams.set('monthsBack', monthsBack.toString());

          const compensiResponse = await fetch(compensiUrl.toString(), {
            headers: { 'cookie': request.headers.get('cookie') || '' },
          });

          if (compensiResponse.ok) {
            const compensiData = await compensiResponse.json();
            // compensi-venditori returns { salespeople: [...] } format
            const teamData = compensiData.salespeople?.find((s: any) => s.id === parseInt(teamId));

            if (teamData && teamData.bonus_real > 0) {
              totalBonusReal += teamData.bonus_real;
              monthsDetail.push({
                month: monthStr,
                bonus_theoretical: teamData.bonus_theoretical || 0,
                bonus_real: teamData.bonus_real || 0,
                payment_percentage: teamData.payment_percentage || 0,
              });
            }
          }
        } catch (e) {
          console.error(`Errore calcolo bonus cumulativo per ${monthStr}:`, e);
        }

        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      // Calcola bonus ritirato tramite buste paga (riusa la stessa logica di team-bonus-withdrawn)
      // Trova membri del team
      const teamMembersCum = await callOdoo(cookies, 'crm.team.member', 'search_read', [], {
        domain: [['crm_team_id', '=', parseInt(teamId)]],
        fields: ['id', 'user_id'],
      });

      const userIdsCum = teamMembersCum
        .filter((m: any) => m.user_id)
        .map((m: any) => m.user_id[0]);

      let totalBonusWithdrawn = 0;

      if (userIdsCum.length > 0) {
        const employeesCum = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
          domain: [['user_id', 'in', userIdsCum]],
          fields: ['id'],
        });

        const employeeIdsCum = employeesCum.map((e: any) => e.id);

        if (employeeIdsCum.length > 0) {
          const payslipsCum = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
            domain: [
              ['employee_id', 'in', employeeIdsCum],
              ['date_from', '>=', '2025-11-01'],
            ],
            fields: ['id'],
          });

          for (const payslip of payslipsCum) {
            const lines = await callOdoo(cookies, 'hr.payslip.line', 'search_read', [], {
              domain: [
                ['slip_id', '=', payslip.id],
                ['code', '=', 'BONUS_VENDITE'],
              ],
              fields: ['amount'],
            });

            for (const line of lines) {
              if (line.amount > 0) {
                totalBonusWithdrawn += line.amount;
              }
            }
          }
        }
      }

      const bonusAvailable = Math.max(0, totalBonusReal - totalBonusWithdrawn);

      return NextResponse.json({
        success: true,
        team_id: parseInt(teamId),
        period: {
          from: '2025-11',
          to: `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, '0')}`,
        },
        bonus_total_real: totalBonusReal,
        bonus_withdrawn: totalBonusWithdrawn,
        bonus_available: bonusAvailable,
        months_detail: monthsDetail,
      });
    }

    if (action === 'team-bonus-withdrawn') {
      // Ottiene il totale bonus ritirati per un team di vendita
      // Usato nella Dashboard Compensi per mostrare "Bonus Ritirato"
      const teamId = searchParams.get('teamId');

      if (!teamId) {
        return NextResponse.json({ error: 'teamId richiesto' }, { status: 400 });
      }

      // 1. Trova tutti i membri del team
      const teamMembers = await callOdoo(cookies, 'crm.team.member', 'search_read', [], {
        domain: [['crm_team_id', '=', parseInt(teamId)]],
        fields: ['id', 'user_id'],
      });

      if (!teamMembers || teamMembers.length === 0) {
        return NextResponse.json({
          success: true,
          team_id: parseInt(teamId),
          bonus_withdrawn: 0,
          members_count: 0,
          message: 'Nessun membro nel team',
        });
      }

      // 2. Trova gli employee_id corrispondenti ai user_id
      const userIds = teamMembers
        .filter((m: any) => m.user_id)
        .map((m: any) => m.user_id[0]);

      if (userIds.length === 0) {
        return NextResponse.json({
          success: true,
          team_id: parseInt(teamId),
          bonus_withdrawn: 0,
          members_count: 0,
          message: 'Nessun venditore con user_id nel team',
        });
      }

      const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['user_id', 'in', userIds]],
        fields: ['id', 'name', 'user_id'],
      });

      const employeeIds = employees.map((e: any) => e.id);

      if (employeeIds.length === 0) {
        return NextResponse.json({
          success: true,
          team_id: parseInt(teamId),
          bonus_withdrawn: 0,
          members_count: 0,
          message: 'Nessun dipendente HR collegato ai venditori',
        });
      }

      // 3. Cerca tutte le buste paga dei dipendenti del team dal 1 Novembre 2024
      const payslips = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
        domain: [
          ['employee_id', 'in', employeeIds],
          ['date_from', '>=', '2025-11-01'],
        ],
        fields: ['id', 'name', 'employee_id', 'date_from'],
      });

      // 4. Somma tutti i bonus BONUS_VENDITE
      let totalBonusWithdrawn = 0;
      const withdrawnDetails: Array<{
        employee: string;
        payslip: string;
        date: string;
        amount: number;
      }> = [];

      for (const payslip of payslips) {
        const lines = await callOdoo(cookies, 'hr.payslip.line', 'search_read', [], {
          domain: [
            ['slip_id', '=', payslip.id],
            ['code', '=', 'BONUS_VENDITE'],
          ],
          fields: ['amount'],
        });

        for (const line of lines) {
          if (line.amount > 0) {
            totalBonusWithdrawn += line.amount;
            withdrawnDetails.push({
              employee: payslip.employee_id[1],
              payslip: payslip.name,
              date: payslip.date_from,
              amount: line.amount,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        team_id: parseInt(teamId),
        bonus_withdrawn: totalBonusWithdrawn,
        members_count: employees.length,
        payslips_count: payslips.length,
        details: withdrawnDetails,
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
        'employee-bonus?employeeId=X&month=YYYY-MM - Bonus disponibile per dipendente',
        'team-bonus-withdrawn?teamId=X - Bonus ritirati per team',
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
      // Crea busta paga seguendo il workflow completo di Odoo:
      // 1. Crea payslip (Odoo auto-compila contratto, struttura, journal dal dipendente)
      // 2. Chiama compute_sheet (crea le righe dalla struttura stipendio)
      // 3. Aggiorna la riga NET con il valore estratto dal PDF
      // 4. Aggiunge riga BONUS_VENDITE se presente
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

      // Trova il nome del dipendente
      const employee = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['id', '=', employeeId]],
        fields: ['id', 'name'],
        limit: 1,
      });
      const employeeName = employee[0]?.name || `Dipendente ${employeeId}`;
      const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
      const payslipName = `Busta Paga ${monthNames[monthNum - 1]} ${year} - ${employeeName}`;

      // STEP 1: Crea la busta paga - Odoo compila automaticamente:
      // - contract_id (dal contratto attivo del dipendente)
      // - struct_id (dalla struttura del contratto)
      // - journal_id (dal tipo di struttura)
      const payslipData: any = {
        name: payslipName,
        employee_id: employeeId,
        date_from: dateFrom,
        date_to: dateTo,
      };

      // Date opzionali
      if (closingDate) {
        payslipData.paid_date = closingDate;
      }
      if (paidDate) {
        payslipData.date = paidDate;
      }

      const payslipId = await callOdoo(cookies, 'hr.payslip', 'create', [payslipData]);
      console.log('[create-payslip] Payslip creato:', payslipId);

      if (!payslipId) {
        return NextResponse.json({ error: 'Errore creazione busta paga' }, { status: 500 });
      }

      // STEP 2: Chiama compute_sheet - Odoo crea le righe dalla struttura stipendio
      // Questo è equivalente al bottone "Foglio di calcolo" nell'interfaccia
      await callOdoo(cookies, 'hr.payslip', 'compute_sheet', [[payslipId]]);
      console.log('[create-payslip] compute_sheet eseguito');

      // STEP 3: Trova la riga NET creata da compute_sheet e aggiornala con il valore dal PDF
      const netLines = await callOdoo(cookies, 'hr.payslip.line', 'search_read', [], {
        domain: [['slip_id', '=', payslipId], ['code', '=', 'NET']],
        fields: ['id', 'name', 'code', 'amount', 'total'],
      });

      if (netLines && netLines.length > 0) {
        // Aggiorna la riga NET esistente (creata da compute_sheet) con il valore reale
        await callOdoo(cookies, 'hr.payslip.line', 'write', [
          [netLines[0].id],
          { amount: netAmount, total: netAmount }
        ]);
        console.log('[create-payslip] NET aggiornato:', netLines[0].id, '→', netAmount);
      } else {
        console.warn('[create-payslip] Riga NET non trovata dopo compute_sheet');
      }

      // STEP 4: Se c'è bonus, aggiungi una riga BONUS_VENDITE
      if (bonusAmount && bonusAmount > 0) {
        const bonusRule = await callOdoo(cookies, 'hr.salary.rule', 'search_read', [], {
          domain: [['code', '=', 'BONUS_VENDITE']],
          fields: ['id', 'name', 'code', 'category_id'],
        });

        if (bonusRule && bonusRule.length > 0) {
          // Prendi contract_id e employee_id dal payslip per la riga bonus
          const payslipInfo = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
            domain: [['id', '=', payslipId]],
            fields: ['contract_id', 'employee_id'],
          });
          const contractId = payslipInfo[0]?.contract_id?.[0];

          const bonusLineData: any = {
            slip_id: payslipId,
            name: 'Bonus Vendite',
            code: 'BONUS_VENDITE',
            category_id: bonusRule[0].category_id[0],
            salary_rule_id: bonusRule[0].id,
            amount: bonusAmount,
            quantity: 1,
            rate: 100,
            total: bonusAmount,
            sequence: 200,
          };
          if (contractId) {
            bonusLineData.contract_id = contractId;
          }

          const bonusLineId = await callOdoo(cookies, 'hr.payslip.line', 'create', [bonusLineData]);
          // Forza total
          if (bonusLineId) {
            await callOdoo(cookies, 'hr.payslip.line', 'write', [[bonusLineId], { total: bonusAmount }]);
          }
          console.log('[create-payslip] BONUS_VENDITE aggiunto:', bonusLineId, '→', bonusAmount);
        }
      }

      // Segna la busta paga come "edited" (modificata manualmente)
      await callOdoo(cookies, 'hr.payslip', 'write', [[payslipId], { edited: true }]);

      // La busta paga resta in stato "In attesa" (verify).
      // L'utente la completa manualmente da Odoo quando vuole,
      // e a quel punto viene creata la voce contabile.

      // STEP 5: Se c'è PDF, allegalo alla busta paga
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

      // Leggi la busta paga completa
      const newPayslip = await callOdoo(cookies, 'hr.payslip', 'search_read', [], {
        domain: [['id', '=', payslipId]],
        fields: ['id', 'name', 'number', 'employee_id', 'date_from', 'date_to', 'state', 'struct_id', 'journal_id', 'contract_id', 'net_wage'],
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
