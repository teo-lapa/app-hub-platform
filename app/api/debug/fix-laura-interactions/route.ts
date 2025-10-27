import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST() {
  try {
    // 1. Trova l'UUID corretto di Laura
    const laura = await sql`
      SELECT id, odoo_partner_id, name
      FROM customer_avatars
      WHERE odoo_partner_id = 2421
    `;

    if (laura.rows.length === 0) {
      return NextResponse.json({ error: 'Laura not found' }, { status: 404 });
    }

    const correctUUID = laura.rows[0].id;

    // 2. Trova tutte le interazioni con customer_avatar_id = 297 (wrong)
    const wrongInteractions = await sql`
      SELECT COUNT(*) as count
      FROM maestro_interactions
      WHERE customer_avatar_id = '297'
    `;

    const countBefore = wrongInteractions.rows[0].count;

    // 3. Aggiorna tutte le interazioni di Laura con l'UUID corretto
    const updateResult = await sql`
      UPDATE maestro_interactions
      SET customer_avatar_id = ${correctUUID}
      WHERE customer_avatar_id = '297'
    `;

    // 4. Verifica quante interazioni ha ora Laura
    const afterUpdate = await sql`
      SELECT COUNT(*) as count
      FROM maestro_interactions
      WHERE customer_avatar_id = ${correctUUID}
    `;

    return NextResponse.json({
      success: true,
      laura: {
        uuid: correctUUID,
        name: laura.rows[0].name
      },
      fixed: {
        interactions_with_wrong_id: countBefore,
        updated: updateResult.rowCount,
        total_interactions_now: afterUpdate.rows[0].count
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
