import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/valida-fatture/apply-corrections
 *
 * Applica le correzioni alla fattura bozza in Odoo
 */
export async function POST(request: NextRequest) {
  try {
    const { invoice_id, corrections } = await request.json();

    if (!invoice_id || !corrections) {
      return NextResponse.json(
        { error: 'invoice_id e corrections richiesti' },
        { status: 400 }
      );
    }

    console.log(`🔧 [APPLY-CORRECTIONS] Starting corrections for invoice ${invoice_id}`);
    console.log(`📝 [APPLY-CORRECTIONS] ${corrections.length} corrections to apply`);

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    let updated_lines = 0;
    let deleted_lines = 0;
    let created_lines = 0;
    const errors: string[] = [];

    // Applica ogni correzione
    for (const correction of corrections) {
      try {
        if (correction.action === 'update' && correction.line_id) {
          // UPDATE: Modifica riga esistente
          console.log(`✏️ [APPLY-CORRECTIONS] Updating line ${correction.line_id}`);

          await callOdoo(
            cookies,
            'account.move.line',
            'write',
            [[correction.line_id], correction.changes]
          );

          updated_lines++;
          console.log(`✅ [APPLY-CORRECTIONS] Line ${correction.line_id} updated`);

        } else if (correction.action === 'delete' && correction.line_id) {
          // DELETE: Elimina riga
          console.log(`🗑️ [APPLY-CORRECTIONS] Deleting line ${correction.line_id}`);

          await callOdoo(
            cookies,
            'account.move.line',
            'unlink',
            [[correction.line_id]]
          );

          deleted_lines++;
          console.log(`✅ [APPLY-CORRECTIONS] Line ${correction.line_id} deleted`);

        } else if (correction.action === 'create' && correction.new_line) {
          // CREATE: Nuova riga (solo se approvata dall'utente)
          if (!correction.requires_user_approval) {
            console.log(`➕ [APPLY-CORRECTIONS] Creating new line`);

            const newLineData = {
              move_id: invoice_id,
              ...correction.new_line,
              display_type: false, // Assicura che non sia una riga di sezione
            };

            await callOdoo(
              cookies,
              'account.move.line',
              'create',
              [newLineData]
            );

            created_lines++;
            console.log(`✅ [APPLY-CORRECTIONS] New line created`);
          } else {
            console.log(`⏭️ [APPLY-CORRECTIONS] Skipping create (requires user approval)`);
          }
        }

      } catch (error: any) {
        console.error(`❌ [APPLY-CORRECTIONS] Error applying correction:`, error);
        errors.push(`${correction.action} failed: ${error.message}`);
      }
    }

    // Dopo le modifiche, ricarica la fattura per verificare il nuovo totale
    console.log('🔄 [APPLY-CORRECTIONS] Reloading invoice to verify new total...');

    const updatedInvoice = await callOdoo(
      cookies,
      'account.move',
      'read',
      [[invoice_id]],
      {
        fields: ['amount_total', 'amount_untaxed', 'amount_tax']
      }
    );

    const newTotal = updatedInvoice[0]?.amount_total || 0;

    console.log(`✅ [APPLY-CORRECTIONS] Corrections applied! New total: €${newTotal}`);

    return NextResponse.json({
      success: true,
      updated_lines,
      deleted_lines,
      created_lines,
      new_total: newTotal,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('❌ [APPLY-CORRECTIONS] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore applicazione correzioni' },
      { status: 500 }
    );
  }
}
