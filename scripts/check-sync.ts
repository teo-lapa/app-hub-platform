/**
 * Check MAESTRO AI Sync Results
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function checkSync() {
  console.log('🔍 Checking MAESTRO AI sync results...\n');

  try {
    // Check customer_avatars
    const avatars = await sql`
      SELECT
        id,
        odoo_partner_id,
        company_name,
        total_orders,
        total_revenue,
        health_score,
        churn_risk_score,
        upsell_potential_score,
        engagement_score,
        assigned_salesperson_name
      FROM customer_avatars
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log(`✅ Found ${avatars.rows.length} customer avatars:\n`);

    avatars.rows.forEach((avatar: any, i: number) => {
      console.log(`${i + 1}. ${avatar.company_name} (ID: ${avatar.odoo_partner_id})`);
      console.log(`   📊 Orders: ${avatar.total_orders} | Revenue: €${Number(avatar.total_revenue).toFixed(2)}`);
      console.log(`   🎯 Health: ${avatar.health_score} | Churn: ${avatar.churn_risk_score} | Upsell: ${avatar.upsell_potential_score}`);
      console.log(`   👤 Salesperson: ${avatar.assigned_salesperson_name || 'N/A'}\n`);
    });

    // Check total count
    const count = await sql`SELECT COUNT(*) as total FROM customer_avatars`;
    console.log(`\n📈 Total avatars in database: ${count.rows[0].total}\n`);

    // Check if sync is recent
    const latest = await sql`
      SELECT created_at
      FROM customer_avatars
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (latest.rows.length > 0) {
      const lastSync = new Date(latest.rows[0].created_at);
      const now = new Date();
      const minutesAgo = Math.floor((now.getTime() - lastSync.getTime()) / 1000 / 60);
      console.log(`⏰ Last sync: ${minutesAgo} minutes ago\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSync();
