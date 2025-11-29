import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Journal Cash ID
const CASH_JOURNAL_ID = 8;

interface WithdrawRequest {
  employee_id: number;
  employee_name: string;
  amount: number;
  note?: string;
}

/**
 * POST /api/registro-cassaforte/withdraw
 * Registra un prelievo dalla cassaforte creando una statement line negativa
 */
export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json();

    // Validation
    if (!body.employee_id || !body.employee_name) {
      return NextResponse.json({
        success: false,
        error: 'Dipendente non specificato',
      }, { status: 400 });
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Importo non valido',
      }, { status: 400 });
    }

    const sessionManager = getOdooSessionManager();

    // Build communication/memo
    let communication = `Prelievo Cassaforte - ${body.employee_name}`;
    if (body.note) {
      communication += ` - ${body.note}`;
    }

    const today = new Date().toISOString().split('T')[0];

    console.log('📝 Creazione prelievo nel registro Cash...');

    // Create statement line with NEGATIVE amount (withdrawal)
    const statementLineId = await sessionManager.callKw(
      'account.bank.statement.line',
      'create',
      [{
        journal_id: CASH_JOURNAL_ID,
        date: today,
        payment_ref: communication,
        amount: -body.amount, // Negative for withdrawal
      }]
    );

    console.log(`✅ Prelievo registrato: ${statementLineId}`);

    // Get move_id
    let moveId: number | null = null;
    try {
      const statementLine = await sessionManager.callKw(
        'account.bank.statement.line',
        'search_read',
        [[['id', '=', statementLineId]]],
        { fields: ['move_id'], limit: 1 }
      );
      if (statementLine.length > 0 && statementLine[0].move_id) {
        moveId = Array.isArray(statementLine[0].move_id)
          ? statementLine[0].move_id[0]
          : statementLine[0].move_id;
        console.log(`✅ Move ID associato: ${moveId}`);
      }
    } catch (e) {
      console.warn('⚠️ Errore recupero move_id:', e);
    }

    // Add note to chatter
    const noteBody = `
      <h3>💸 Prelievo Cassaforte</h3>
      <ul>
        <li><strong>Dipendente:</strong> ${body.employee_name} (ID: ${body.employee_id})</li>
        <li><strong>Importo:</strong> CHF ${body.amount.toFixed(2)}</li>
        ${body.note ? `<li><strong>Note:</strong> ${body.note}</li>` : ''}
        <li><strong>Data/Ora:</strong> ${new Date().toLocaleString('it-CH')}</li>
      </ul>
    `;

    if (moveId) {
      try {
        await sessionManager.callKw(
          'mail.message',
          'create',
          [{
            body: noteBody,
            model: 'account.move',
            res_id: moveId,
            message_type: 'comment',
            subtype_id: 2,
          }]
        );
      } catch (noteError) {
        console.warn('⚠️ Errore creazione nota sul move:', noteError);
      }
    }

    return NextResponse.json({
      success: true,
      statement_line_id: statementLineId,
      move_id: moveId,
      message: 'Prelievo registrato con successo',
      data: {
        amount: body.amount,
        employee: body.employee_name,
      },
    });

  } catch (error: any) {
    console.error('❌ Errore prelievo cassaforte:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la registrazione del prelievo',
    }, { status: 500 });
  }
}
