import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // 1. Trova Laura
    const laura = await sql`
      SELECT id, odoo_partner_id, name
      FROM customer_avatars
      WHERE odoo_partner_id = 2421
    `;

    if (laura.rows.length === 0) {
      return NextResponse.json({ error: 'Laura not found' }, { status: 404 });
    }

    const lauraUUID = laura.rows[0].id;

    // 2. Conta TUTTE le interazioni nel DB
    const totalCount = await sql`
      SELECT COUNT(*) as total
      FROM maestro_interactions
    `;

    // 3. Trova interazioni di Laura
    const lauraInteractions = await sql`
      SELECT
        id,
        customer_avatar_id,
        interaction_type,
        interaction_date,
        outcome,
        notes,
        salesperson_name,
        created_at
      FROM maestro_interactions
      WHERE customer_avatar_id = ${lauraUUID}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // 4. Trova interazioni orfane (senza customer valido)
    const orphaned = await sql`
      SELECT
        i.id,
        i.customer_avatar_id,
        i.interaction_date,
        i.created_at,
        i.notes
      FROM maestro_interactions i
      LEFT JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
      WHERE ca.id IS NULL
      ORDER BY i.created_at DESC
      LIMIT 50
    `;

    // 5. Trova interazioni di oggi
    const today = await sql`
      SELECT
        i.id,
        i.customer_avatar_id,
        ca.name as customer_name,
        ca.odoo_partner_id,
        i.interaction_date,
        i.created_at,
        i.notes
      FROM maestro_interactions i
      LEFT JOIN customer_avatars ca ON i.customer_avatar_id = ca.id
      WHERE DATE(i.created_at) = CURRENT_DATE
      ORDER BY i.created_at DESC
    `;

    return NextResponse.json({
      laura: {
        uuid: lauraUUID,
        odoo_partner_id: laura.rows[0].odoo_partner_id,
        name: laura.rows[0].name
      },
      stats: {
        total_interactions_in_db: totalCount.rows[0].total,
        laura_interactions: lauraInteractions.rows.length,
        orphaned_interactions: orphaned.rows.length,
        today_interactions: today.rows.length
      },
      laura_interactions: lauraInteractions.rows,
      orphaned_interactions: orphaned.rows,
      today_interactions: today.rows
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
