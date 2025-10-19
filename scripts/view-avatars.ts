/**
 * View Customer Avatars - Query Database
 *
 * Run: npx tsx scripts/view-avatars.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { sql } from '@vercel/postgres';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
  console.log('📊 CUSTOMER AVATARS DATABASE VIEW\n');

  try {
    // Top 20 avatars by revenue
    const topSpenders = await sql`
      SELECT
        name,
        total_orders,
        total_revenue,
        avg_order_value,
        health_score,
        churn_risk_score,
        upsell_potential_score,
        days_since_last_order
      FROM customer_avatars
      ORDER BY total_revenue DESC
      LIMIT 20
    `;

    console.log('🏆 TOP 20 CUSTOMERS BY REVENUE\n');
    console.log('┌─────┬──────────────────────────────┬────────┬──────────┬─────────┬────────┬───────┬──────────┬──────────┐');
    console.log('│ #   │ Name                         │ Orders │ Revenue  │ Avg     │ Health │ Churn │ Upsell   │ Days Ago │');
    console.log('├─────┼──────────────────────────────┼────────┼──────────┼─────────┼────────┼───────┼──────────┼──────────┤');

    topSpenders.rows.forEach((row: any, i) => {
      const name = row.name.substring(0, 28).padEnd(28);
      const orders = String(row.total_orders).padStart(6);
      const revenue = `€${parseFloat(row.total_revenue).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`.padStart(9);
      const avg = `€${parseFloat(row.avg_order_value).toLocaleString('it-IT', { minimumFractionDigits: 0 })}`.padStart(8);
      const health = String(row.health_score).padStart(6);
      const churn = String(row.churn_risk_score).padStart(5);
      const upsell = String(row.upsell_potential_score).padStart(8);
      const daysAgo = String(row.days_since_last_order).padStart(8);

      console.log(`│ ${String(i + 1).padStart(3)} │ ${name} │ ${orders} │ ${revenue} │ ${avg} │ ${health} │ ${churn} │ ${upsell} │ ${daysAgo} │`);
    });

    console.log('└─────┴──────────────────────────────┴────────┴──────────┴─────────┴────────┴───────┴──────────┴──────────┘\n');

    // High churn risk customers
    const highChurn = await sql`
      SELECT
        name,
        days_since_last_order,
        order_frequency_days,
        churn_risk_score,
        total_revenue
      FROM customer_avatars
      WHERE churn_risk_score > 60
      ORDER BY churn_risk_score DESC
    `;

    if (highChurn.rows.length > 0) {
      console.log(`🚨 HIGH CHURN RISK CUSTOMERS (${highChurn.rows.length})\n`);
      console.log('┌──────────────────────────────┬──────────┬───────────┬───────┬──────────┐');
      console.log('│ Name                         │ Days Ago │ Frequency │ Churn │ Revenue  │');
      console.log('├──────────────────────────────┼──────────┼───────────┼───────┼──────────┤');

      highChurn.rows.forEach((row: any) => {
        const name = row.name.substring(0, 28).padEnd(28);
        const daysAgo = String(row.days_since_last_order).padStart(8);
        const freq = row.order_frequency_days ? String(row.order_frequency_days).padStart(9) : '    N/A  ';
        const churn = String(row.churn_risk_score).padStart(5);
        const revenue = `€${parseFloat(row.total_revenue).toLocaleString('it-IT')}`.padStart(9);

        console.log(`│ ${name} │ ${daysAgo} │ ${freq} │ ${churn} │ ${revenue} │`);
      });

      console.log('└──────────────────────────────┴──────────┴───────────┴───────┴──────────┘\n');
    }

    // Summary statistics
    const stats = await sql`
      SELECT
        COUNT(*) as total,
        SUM(total_revenue) as total_revenue,
        AVG(health_score) as avg_health,
        AVG(churn_risk_score) as avg_churn,
        AVG(upsell_potential_score) as avg_upsell,
        COUNT(*) FILTER (WHERE churn_risk_score > 70) as critical_churn,
        COUNT(*) FILTER (WHERE churn_risk_score BETWEEN 40 AND 70) as medium_churn,
        COUNT(*) FILTER (WHERE churn_risk_score < 40) as low_churn
      FROM customer_avatars
    `;

    const stat = stats.rows[0];

    console.log('📈 OVERALL STATISTICS\n');
    console.log(`Total Customers: ${stat.total}`);
    console.log(`Total Revenue: €${parseFloat(stat.total_revenue).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`);
    console.log(`Average Health Score: ${parseFloat(stat.avg_health).toFixed(1)}/100`);
    console.log(`Average Churn Risk: ${parseFloat(stat.avg_churn).toFixed(1)}/100`);
    console.log(`Average Upsell Potential: ${parseFloat(stat.avg_upsell).toFixed(1)}/100\n`);

    console.log('Churn Risk Distribution:');
    console.log(`  🔴 Critical (>70): ${stat.critical_churn} customers`);
    console.log(`  🟠 Medium (40-70): ${stat.medium_churn} customers`);
    console.log(`  🟢 Low (<40): ${stat.low_churn} customers\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
