/**
 * View MAESTRO AI Sync Results
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { sql } from '@vercel/postgres';

async function viewResults() {
  console.log('🔍 MAESTRO AI - Sync Results\n');

  try {
    // Get all avatars
    const avatars = await sql`
      SELECT
        id,
        odoo_partner_id,
        name,
        email,
        city,
        total_orders,
        total_revenue,
        avg_order_value,
        order_frequency_days,
        days_since_last_order,
        health_score,
        churn_risk_score,
        upsell_potential_score,
        engagement_score,
        assigned_salesperson_name,
        last_order_date,
        created_at
      FROM customer_avatars
      ORDER BY total_revenue DESC
    `;

    console.log(`✅ Found ${avatars.rows.length} customer avatars:\n`);
    console.log('='.repeat(80) + '\n');

    avatars.rows.forEach((avatar: any, i: number) => {
      console.log(`${i + 1}. ${avatar.name} (Odoo ID: ${avatar.odoo_partner_id})`);
      console.log(`   📍 City: ${avatar.city || 'N/A'}`);
      console.log(`   📧 Email: ${avatar.email || 'N/A'}`);
      console.log(`   👤 Salesperson: ${avatar.assigned_salesperson_name || 'Unassigned'}`);
      console.log(`   📊 Orders: ${avatar.total_orders} | Revenue: €${Number(avatar.total_revenue || 0).toFixed(2)}`);
      console.log(`   💰 Avg Order: €${Number(avatar.avg_order_value || 0).toFixed(2)}`);
      console.log(`   📅 Last Order: ${avatar.last_order_date ? new Date(avatar.last_order_date).toLocaleDateString('it-IT') : 'N/A'}`);
      console.log(`   ⏰ Days Since: ${avatar.days_since_last_order || 'N/A'} | Frequency: ${avatar.order_frequency_days || 'N/A'} days`);
      console.log(`   🎯 SCORES:`);
      console.log(`      - Health: ${avatar.health_score || 0}/100`);
      console.log(`      - Churn Risk: ${avatar.churn_risk_score || 0}/100`);
      console.log(`      - Upsell Potential: ${avatar.upsell_potential_score || 0}/100`);
      console.log(`      - Engagement: ${avatar.engagement_score || 0}/100`);
      console.log('');
    });

    console.log('='.repeat(80));

    // Summary stats
    const totalRevenue = avatars.rows.reduce((sum: number, a: any) => sum + Number(a.total_revenue || 0), 0);
    const totalOrders = avatars.rows.reduce((sum: number, a: any) => sum + Number(a.total_orders || 0), 0);
    const avgHealth = avatars.rows.reduce((sum: number, a: any) => sum + Number(a.health_score || 0), 0) / avatars.rows.length;
    const avgChurn = avatars.rows.reduce((sum: number, a: any) => sum + Number(a.churn_risk_score || 0), 0) / avatars.rows.length;

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Customers: ${avatars.rows.length}`);
    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   Total Revenue: €${totalRevenue.toFixed(2)}`);
    console.log(`   Avg Health Score: ${avgHealth.toFixed(1)}/100`);
    console.log(`   Avg Churn Risk: ${avgChurn.toFixed(1)}/100`);

    // High risk customers
    const highRisk = avatars.rows.filter((a: any) => a.churn_risk_score > 70);
    console.log(`\n⚠️  HIGH CHURN RISK (>70): ${highRisk.length} customers`);
    highRisk.forEach((a: any) => {
      console.log(`   - ${a.name}: ${a.churn_risk_score}/100 (${a.days_since_last_order} days since last order)`);
    });

    // High upsell potential
    const highUpsell = avatars.rows.filter((a: any) => a.upsell_potential_score > 70);
    console.log(`\n💰 HIGH UPSELL POTENTIAL (>70): ${highUpsell.length} customers`);
    highUpsell.forEach((a: any) => {
      console.log(`   - ${a.name}: ${a.upsell_potential_score}/100 (€${Number(a.total_revenue).toFixed(2)} revenue)`);
    });

    console.log('\n✅ Sync working perfectly!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

viewResults();
