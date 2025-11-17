/**
 * MAESTRO AI - Final Test Suite
 * Test tutti gli endpoints con timeout estesi
 */
import 'dotenv/config';

interface TestResult {
  endpoint: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  statusCode?: number;
  responseTime?: number;
  recordCount?: number;
  error?: string;
}

const BASE_URL = 'http://localhost:3004';
const TIMEOUT_MS = 30000; // 30 seconds

async function testWithTimeout(
  name: string,
  url: string,
  timeoutMs: number
): Promise<TestResult> {
  const startTime = Date.now();
  const fullUrl = `${BASE_URL}${url}`;

  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${fullUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    let recordCount = 0;
    if (data.avatars) recordCount = data.avatars.length;
    else if (data.avatar) recordCount = 1;
    else if (data.daily_plan) recordCount = 1;

    const status = response.status === 200 ? 'SUCCESS' : 'FAILED';

    console.log(`   ${status === 'SUCCESS' ? '✅' : '❌'} ${status} (${responseTime}ms, HTTP ${response.status})`);
    if (recordCount) console.log(`   📊 Records: ${recordCount}`);

    return {
      endpoint: name,
      status,
      statusCode: response.status,
      responseTime,
      recordCount,
      error: data.error || undefined,
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (error.name === 'AbortError') {
      console.log(`   ⏱️  TIMEOUT after ${responseTime}ms`);
      return {
        endpoint: name,
        status: 'TIMEOUT',
        responseTime,
        error: `Timeout after ${timeoutMs}ms`,
      };
    }

    console.log(`   ❌ ERROR: ${error.message}`);
    return {
      endpoint: name,
      status: 'ERROR',
      responseTime,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 MAESTRO AI - Final API Test Suite');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`⏱️  Timeout: ${TIMEOUT_MS}ms per request`);
  console.log('═══════════════════════════════════════════════════════════');

  const tests = [
    { name: 'GET /api/maestro/avatars', url: '/api/maestro/avatars' },
    { name: 'GET /api/maestro/avatars (filtered)', url: '/api/maestro/avatars?limit=5' },
    { name: 'GET /api/maestro/avatars/1', url: '/api/maestro/avatars/1' },
    { name: 'GET /api/maestro/daily-plan', url: '/api/maestro/daily-plan?salesperson_id=121' },
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await testWithTimeout(test.name, test.url, TIMEOUT_MS);
    results.push(result);
    // REMOVED SLEEP - run tests immediately // Wait 500ms between tests
  }

  // Final Report
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📋 FINAL REPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.status === 'SUCCESS').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const timeoutCount = results.filter(r => r.status === 'TIMEOUT').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;

  console.log(`✅ SUCCESS:  ${successCount}/${results.length}`);
  console.log(`❌ FAILED:   ${failedCount}/${results.length}`);
  console.log(`⏱️  TIMEOUT:  ${timeoutCount}/${results.length}`);
  console.log(`⚠️  ERROR:    ${errorCount}/${results.length}`);
  console.log('');

  console.log('DETAILED RESULTS:');
  console.log('─────────────────────────────────────────────────────────\n');

  results.forEach((result, index) => {
    const icons = {
      SUCCESS: '✅',
      FAILED: '❌',
      TIMEOUT: '⏱️',
      ERROR: '⚠️',
    };
    const icon = icons[result.status];

    console.log(`${index + 1}. ${icon} ${result.endpoint}`);
    console.log(`   Status: ${result.status}${result.statusCode ? ` (HTTP ${result.statusCode})` : ''}`);
    console.log(`   Response Time: ${result.responseTime}ms`);
    if (result.recordCount) {
      console.log(`   Records: ${result.recordCount}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Test Suite Completed at ${new Date().toLocaleTimeString()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Database status
  console.log('📊 DATABASE STATUS:');
  console.log(`   - Connection: ${successCount > 0 ? '✅ ACTIVE' : '❌ FAILED'}`);
  console.log(`   - Endpoints returning data: ${results.filter(r => r.recordCount && r.recordCount > 0).length}`);

  // Recommendations
  if (timeoutCount > 0) {
    console.log('\n⚠️  NOTE: Some endpoints timed out. This might be due to:');
    console.log('   - Next.js dev server hot reloading');
    console.log('   - Please restart the dev server and try again');
  }

  if (successCount === results.length) {
    console.log('\n🎉 ALL TESTS PASSED!');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${results.length - successCount} test(s) did not pass`);
    process.exit(1);
  }
}

runTests();
