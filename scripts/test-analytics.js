/**
 * Test script for Maestro Analytics API
 *
 * Usage:
 *   node scripts/test-analytics.js
 */

const API_URL = process.env.API_URL || 'http://localhost:3010';

async function testAnalytics() {
  console.log('\n📊 Testing Maestro Analytics API...\n');
  console.log(`API URL: ${API_URL}/api/maestro/analytics\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/maestro/analytics`);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.kpis || !data.topPerformers || !data.churnAlerts || !data.revenueByMonth || !data.healthDistribution) {
      throw new Error('Invalid response structure');
    }

    console.log('✅ API Response Successful');
    console.log(`⏱️  Response Time: ${duration}ms\n`);

    // Display KPIs
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 KEY PERFORMANCE INDICATORS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total Revenue:      €${data.kpis.totalRevenue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Total Orders:       ${data.kpis.totalOrders.toLocaleString()}`);
    console.log(`Active Customers:   ${data.kpis.activeCustomers}`);
    console.log(`Avg Order Value:    €${data.kpis.avgOrderValue.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('');

    // Display Top Salespeople
    console.log('═══════════════════════════════════════════════════════════');
    console.log('👥 TOP PERFORMERS - BY SALESPERSON');
    console.log('═══════════════════════════════════════════════════════════');
    data.topPerformers.bySalesperson.slice(0, 5).forEach((sp, idx) => {
      console.log(`${idx + 1}. ${sp.name}`);
      console.log(`   Revenue: €${sp.revenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })} | Orders: ${sp.orders} | Customers: ${sp.customerCount}`);
    });
    console.log('');

    // Display Top Customers
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏆 TOP PERFORMERS - BY CUSTOMER');
    console.log('═══════════════════════════════════════════════════════════');
    data.topPerformers.byCustomer.slice(0, 5).forEach((customer, idx) => {
      console.log(`${idx + 1}. ${customer.name}`);
      console.log(`   Revenue: €${customer.revenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })} | Orders: ${customer.orders} | Health: ${customer.healthScore}/100`);
    });
    console.log('');

    // Display Churn Alerts
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`⚠️  CHURN ALERTS (${data.churnAlerts.length} high-risk customers)`);
    console.log('═══════════════════════════════════════════════════════════');
    if (data.churnAlerts.length > 0) {
      data.churnAlerts.forEach((alert, idx) => {
        console.log(`${idx + 1}. ${alert.name} (${alert.city || 'N/A'})`);
        console.log(`   Churn Risk: ${alert.churnRisk}/100 | Health: ${alert.healthScore}/100 | Days Since Last Order: ${alert.daysSinceLastOrder}`);
      });
    } else {
      console.log('No high-risk customers! 🎉');
    }
    console.log('');

    // Display Revenue Trend
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 REVENUE BY MONTH (Last 6 Months)');
    console.log('═══════════════════════════════════════════════════════════');
    data.revenueByMonth.forEach(month => {
      const bar = '█'.repeat(Math.floor(month.revenue / 1000));
      console.log(`${month.month}: €${month.revenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })} (${month.orders} orders)`);
      console.log(`           ${bar}`);
    });
    console.log('');

    // Display Health Distribution
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💚 CUSTOMER HEALTH DISTRIBUTION');
    console.log('═══════════════════════════════════════════════════════════');
    const total = data.healthDistribution.healthy + data.healthDistribution.warning + data.healthDistribution.critical;
    const healthPct = ((data.healthDistribution.healthy / total) * 100).toFixed(1);
    const warningPct = ((data.healthDistribution.warning / total) * 100).toFixed(1);
    const criticalPct = ((data.healthDistribution.critical / total) * 100).toFixed(1);

    console.log(`Healthy (≥80):   ${data.healthDistribution.healthy} (${healthPct}%)`);
    console.log(`Warning (50-79): ${data.healthDistribution.warning} (${warningPct}%)`);
    console.log(`Critical (<50):  ${data.healthDistribution.critical} (${criticalPct}%)`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ All tests passed!');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
testAnalytics();
