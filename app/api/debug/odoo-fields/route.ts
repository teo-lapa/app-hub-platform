import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/odoo-fields?model=account.bank.statement.line
 * Interroga Odoo per ottenere i campi di un modello
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model') || 'account.bank.statement.line';

    const sessionManager = getOdooSessionManager();

    // Ottieni i campi del modello
    const fields = await sessionManager.callKw(
      model,
      'fields_get',
      [],
      { attributes: ['string', 'type', 'required', 'readonly'] }
    );

    // Filtra solo i campi rilevanti (required o comuni)
    const relevantFields: Record<string, any> = {};
    for (const [fieldName, fieldInfo] of Object.entries(fields as Record<string, any>)) {
      if (fieldInfo.required ||
          ['journal_id', 'date', 'amount', 'partner_id', 'payment_ref', 'ref', 'name', 'statement_id', 'move_id'].includes(fieldName)) {
        relevantFields[fieldName] = fieldInfo;
      }
    }

    return NextResponse.json({
      success: true,
      model: model,
      all_fields_count: Object.keys(fields).length,
      relevant_fields: relevantFields,
    });

  } catch (error: any) {
    console.error('❌ Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
