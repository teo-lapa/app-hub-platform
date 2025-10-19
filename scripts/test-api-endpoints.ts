/**
 * MAESTRO AI - API Endpoints Test Suite
 *
 * Test tutti gli endpoints API di Maestro AI
 * Verifica connessione database e ritorno dati reali
 */
import 'dotenv/config';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'SUCCESS' | 'FAILED' | 'ERROR';
  statusCode?: number;
  responseTime?: number;
  dataSource?: 'database' | 'mock' | 'unknown';
  recordCount?: number;
  error?: string;
  sample?: any;
}

const BASE_URL = 'http://localhost:3004';

const ENDPOINTS = [
  {
    name: 'GET /api/maestro/avatars',
    url: '/api/maestro/avatars',
    method: 'GET',
    description: 'Fetch all customer avatars with pagination',
  },
  {
    name: 'GET /api/maestro/avatars (with filters)',
    url: '/api/maestro/avatars?salesperson_id=121&limit=5',
    method: 'GET',
    description: 'Fetch avatars filtered by salesperson',
  },
  {
    name: 'GET /api/maestro/avatars/[id]',
    url: '/api/maestro/avatars/1',
    method: 'GET',
    description: 'Fetch single avatar detail',
  },
  {
    name: 'GET /api/maestro/daily-plan',
    url: '/api/maestro/daily-plan?salesperson_id=121',
    method: 'GET',
    description: 'Generate daily plan for salesperson',
  },
  {
    name: 'GET /api/maestro/analyze-odoo',
    url: '/api/maestro/analyze-odoo',
    method: 'GET',
    description: 'Analyze Odoo data (requires Odoo auth)',
    skipIfNoAuth: true,
  },
];

async function testEndpoint(endpoint: typeof ENDPOINTS[0]): Promise<TestResult> {
  const startTime = Date.now();
  const fullUrl = `${BASE_URL}${endpoint.url}`;

  try {
    console.log(`\n🔍 Testing: ${endpoint.name}`);
    console.log(`   URL: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    // Parse response
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Determine data source
    let dataSource: 'database' | 'mock' | 'unknown' = 'unknown';
    let recordCount = 0;

    if (statusCode === 200) {
      // Check if data is from database or mock
      if (data.avatars) {
        dataSource = 'database';
        recordCount = data.avatars.length;
      } else if (data.avatar) {
        dataSource = 'database';
        recordCount = 1;
      } else if (data.daily_plan) {
        dataSource = 'database';
        recordCount = data.daily_plan.urgent_customers?.length || 0;
      } else if (data.success !== undefined) {
        dataSource = 'database';
      }
    }

    // Sample data (first record)
    let sample: any = null;
    if (data.avatars && data.avatars.length > 0) {
      sample = {
        id: data.avatars[0].id,
        name: data.avatars[0].name,
        health_score: data.avatars[0].health_score,
        churn_risk_score: data.avatars[0].churn_risk_score,
      };
    } else if (data.avatar) {
      sample = {
        id: data.avatar.id,
        name: data.avatar.name,
        health_score: data.avatar.health_score,
      };
    } else if (data.daily_plan) {
      sample = {
        date: data.daily_plan.date,
        salesperson_id: data.daily_plan.salesperson_id,
        urgent_count: data.daily_plan.urgent_customers?.length || 0,
        high_priority_count: data.daily_plan.high_priority_customers?.length || 0,
      };
    }

    const result: TestResult = {
      endpoint: endpoint.name,
      method: endpoint.method,
      status: statusCode === 200 ? 'SUCCESS' : 'FAILED',
      statusCode,
      responseTime,
      dataSource,
      recordCount,
      sample,
    };

    if (statusCode !== 200) {
      result.error = data.error || data.message || JSON.stringify(data);
    }

    // Log result
    if (statusCode === 200) {
      console.log(`   ✅ SUCCESS (${responseTime}ms)`);
      console.log(`   📊 Data Source: ${dataSource}`);
      console.log(`   📝 Records: ${recordCount}`);
      if (sample) {
        console.log(`   🔍 Sample:`, JSON.stringify(sample, null, 2).substring(0, 200));
      }
    } else {
      console.log(`   ❌ FAILED (HTTP ${statusCode})`);
      console.log(`   Error: ${result.error}`);
    }

    return result;

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ ERROR: ${error.message}`);

    return {
      endpoint: endpoint.name,
      method: endpoint.method,
      status: 'ERROR',
      responseTime,
      error: error.message,
    };
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 MAESTRO AI - API Endpoints Test Suite');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📊 Total Endpoints: ${ENDPOINTS.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const results: TestResult[] = [];

  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);

    // Wait 500ms between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final Report
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📋 FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;

  console.log(`✅ SUCCESS: ${successCount}/${results.length}`);
  console.log(`❌ FAILED:  ${failedCount}/${results.length}`);
  console.log(`⚠️  ERROR:   ${errorCount}/${results.length}`);
  console.log('');

  // Detailed results
  console.log('DETAILED RESULTS:');
  console.log('─────────────────────────────────────────────────────────\n');

  results.forEach((result, index) => {
    const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${index + 1}. ${icon} ${result.endpoint}`);
    console.log(`   Status: ${result.status} (HTTP ${result.statusCode || 'N/A'})`);
    console.log(`   Response Time: ${result.responseTime}ms`);
    if (result.dataSource) {
      console.log(`   Data Source: ${result.dataSource.toUpperCase()}`);
    }
    if (result.recordCount !== undefined) {
      console.log(`   Records: ${result.recordCount}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // Database connection check
  const databaseEndpoints = results.filter(r => r.dataSource === 'database').length;
  console.log('─────────────────────────────────────────────────────────');
  console.log(`📊 Database Connection: ${databaseEndpoints > 0 ? '✅ ACTIVE' : '❌ NO DATA FROM DATABASE'}`);
  console.log(`   Endpoints using database: ${databaseEndpoints}/${results.length}`);
  console.log('─────────────────────────────────────────────────────────\n');

  // Recommendations
  if (failedCount > 0 || errorCount > 0) {
    console.log('🔧 RECOMMENDATIONS:');
    results
      .filter(r => r.status !== 'SUCCESS')
      .forEach(r => {
        console.log(`   - Fix: ${r.endpoint}`);
        if (r.error?.includes('ECONNREFUSED')) {
          console.log(`     → Server not running on ${BASE_URL}`);
        } else if (r.error?.includes('database')) {
          console.log(`     → Database connection issue`);
        } else if (r.statusCode === 404) {
          console.log(`     → Endpoint not found or route issue`);
        } else if (r.statusCode === 500) {
          console.log(`     → Internal server error - check logs`);
        }
      });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Test Suite Completed at ${new Date().toLocaleTimeString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Exit with appropriate code
  process.exit(failedCount + errorCount > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
