import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export const dynamic = 'force-dynamic';

/**
 * DEBUG ENDPOINT: Verifica campi stock.picking.batch in Odoo
 * GET /api/debug/batch-fields
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🔍 Recupero campi stock.picking.batch...');

    const response = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'ir.model.fields',
          method: 'search_read',
          args: [[['model', '=', 'stock.picking.batch']]],
          kwargs: {
            fields: ['name', 'field_description', 'ttype', 'relation', 'required'],
            limit: 200,
            order: 'name'
          }
        },
        id: 1
      })
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 500 });
    }

    const fields = data.result || [];

    // Filtra campi custom
    const customFields = fields.filter((f: any) => f.name.startsWith('x_studio'));

    // Campi rilevanti
    const relevantFields = fields.filter((f: any) =>
      ['name', 'user_id', 'picking_ids', 'state', 'scheduled_date', 'picking_type_id'].includes(f.name)
    );

    // Verifica campi cercati
    const autistaField = fields.find((f: any) => f.name === 'x_studio_autista_del_giro');
    const autoField = fields.find((f: any) => f.name === 'x_studio_auto_del_giro');

    return NextResponse.json({
      success: true,
      totalFields: fields.length,
      customFields: customFields.map((f: any) => ({
        name: f.name,
        type: f.ttype,
        relation: f.relation,
        label: f.field_description,
        required: f.required
      })),
      relevantStandardFields: relevantFields.map((f: any) => ({
        name: f.name,
        type: f.ttype,
        relation: f.relation,
        required: f.required
      })),
      targetFields: {
        autista: autistaField ? {
          exists: true,
          name: autistaField.name,
          type: autistaField.ttype,
          relation: autistaField.relation,
          required: autistaField.required
        } : { exists: false },
        auto: autoField ? {
          exists: true,
          name: autoField.name,
          type: autoField.ttype,
          relation: autoField.relation,
          required: autoField.required
        } : { exists: false }
      }
    });

  } catch (error: any) {
    console.error('❌ Error checking batch fields:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
