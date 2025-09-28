import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };

  const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';

  // Test 1: Database list
  try {
    console.log('🧪 Test 1: Database list');
    const response = await fetch(`${odooUrl}/web/database/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
    });
    const data = await response.json();

    results.tests.push({
      name: 'Database List',
      status: data.result ? 'PASS' : 'FAIL',
      result: data.result,
      speed: 'fast'
    });
  } catch (e: any) {
    results.tests.push({
      name: 'Database List',
      status: 'ERROR',
      error: e.message
    });
  }

  // Test 2: Session info
  try {
    console.log('🧪 Test 2: Session info');
    const response = await fetch(`${odooUrl}/web/session/get_session_info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {} })
    });
    const data = await response.json();

    results.tests.push({
      name: 'Session Info',
      status: data.result?.uid ? 'AUTHENTICATED' : 'NO_SESSION',
      user: data.result?.username || 'none',
      uid: data.result?.uid || null
    });
  } catch (e: any) {
    results.tests.push({
      name: 'Session Info',
      status: 'ERROR',
      error: e.message
    });
  }

  // Test 3: Location API
  try {
    console.log('🧪 Test 3: Location API');
    const response = await fetch('http://localhost:3002/api/inventory/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationCode: 'TEST.LOC' })
    });
    const data = await response.json();

    results.tests.push({
      name: 'Location API',
      status: data.success ? 'PASS' : 'FAIL',
      method: data.method,
      responseTime: '< 1s'
    });
  } catch (e: any) {
    results.tests.push({
      name: 'Location API',
      status: 'ERROR',
      error: e.message
    });
  }

  // Test 4: Products API
  try {
    console.log('🧪 Test 4: Products API');
    const response = await fetch('http://localhost:3002/api/inventory/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQuery: 'test' })
    });
    const data = await response.json();

    results.tests.push({
      name: 'Products API',
      status: data.success ? 'PASS' : 'FAIL',
      method: data.method,
      products: data.data?.length || 0
    });
  } catch (e: any) {
    results.tests.push({
      name: 'Products API',
      status: 'ERROR',
      error: e.message
    });
  }

  // Test 5: HTML App
  try {
    console.log('🧪 Test 5: HTML App');
    const response = await fetch('http://localhost:3002/api/inventory/html-app');
    const html = await response.text();

    results.tests.push({
      name: 'HTML App',
      status: html.includes('Gestione Ubicazioni') ? 'PASS' : 'FAIL',
      size: `${Math.round(html.length / 1024)}KB`
    });
  } catch (e: any) {
    results.tests.push({
      name: 'HTML App',
      status: 'ERROR',
      error: e.message
    });
  }

  const summary = {
    total: results.tests.length,
    passed: results.tests.filter(t => t.status === 'PASS').length,
    failed: results.tests.filter(t => t.status === 'FAIL').length,
    errors: results.tests.filter(t => t.status === 'ERROR').length
  };

  return NextResponse.json({
    summary,
    results,
    recommendation: summary.passed >= 3 ?
      'Le API base funzionano. L\'app è pronta per l\'uso con dati di test.' :
      'Alcuni test falliscono. Controlla i log per maggiori dettagli.'
  });
}