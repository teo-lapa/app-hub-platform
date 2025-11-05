/**
 * Quick script to check supplier cadences status
 */

import { sql } from '@vercel/postgres';

async function checkCadences() {
  try {
    console.log('🔍 Checking supplier cadences...\n');

    // Check all suppliers with cadences
    const result = await sql`
      SELECT
        id,
        name,
        is_active,
        cadence_value,
        cadence_type,
        next_order_date,
        days_until_next_order,
        last_cadence_order_date
      FROM supplier_cadences
      WHERE days_until_next_order IS NOT NULL
      ORDER BY days_until_next_order ASC
      LIMIT 20
    `;

    console.log(`Found ${result.rows.length} suppliers with cadences:\n`);

    result.rows.forEach((row) => {
      const status = row.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      const urgency =
        row.days_until_next_order === 0 ? '🔴 TODAY' :
        row.days_until_next_order === 1 ? '🟠 TOMORROW' :
        row.days_until_next_order <= 7 ? '🟡 THIS WEEK' :
        '🟢 FUTURE';

      console.log(`${status} ${urgency} | ${row.name}`);
      console.log(`  Cadence: every ${row.cadence_value} days (${row.cadence_type})`);
      console.log(`  Next order: ${row.next_order_date} (in ${row.days_until_next_order} days)`);
      console.log(`  Last order: ${row.last_cadence_order_date || 'never'}`);
      console.log('');
    });

    // Count by status
    const statsResult = await sql`
      SELECT
        is_active,
        COUNT(*) as count,
        COUNT(CASE WHEN days_until_next_order = 0 THEN 1 END) as today,
        COUNT(CASE WHEN days_until_next_order = 1 THEN 1 END) as tomorrow,
        COUNT(CASE WHEN days_until_next_order <= 7 AND days_until_next_order > 1 THEN 1 END) as this_week
      FROM supplier_cadences
      GROUP BY is_active
    `;

    console.log('\n📊 Statistics:');
    console.log('================');
    statsResult.rows.forEach((row) => {
      console.log(`${row.is_active ? 'ACTIVE' : 'INACTIVE'}: ${row.count} suppliers`);
      console.log(`  - Today: ${row.today}`);
      console.log(`  - Tomorrow: ${row.tomorrow}`);
      console.log(`  - This week: ${row.this_week}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCadences();
