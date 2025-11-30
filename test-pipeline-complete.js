/**
 * TEST PIPELINE COMPLETA
 * Testa l'intera pipeline di enrichment contatti:
 * 1. Odoo Python client (test diretto)
 * 2. Jetson endpoint Odoo
 * 3. Pipeline completa con Gemini + Moneyhouse + Odoo
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configurazione
const JETSON_URL = 'http://10.0.0.108:3100';
const VERCEL_URL = 'https://app-hub-platform-kwi5xczzu-teo-lapas-projects.vercel.app';
const TEST_IMAGE = path.join(__dirname, 'test-business-card-real.jpg');

// Colori console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '='.repeat(80), 'bright');
  log(title, 'bright');
  log('='.repeat(80), 'bright');
}

// ==============================================
// TEST 1: Odoo Python Client (diretto)
// ==============================================

async function test1_OdooClient() {
  section('TEST 1: Odoo Python Client (Direct)');

  try {
    log('\n[1/3] Testing partner creation...', 'cyan');

    const testPartner = {
      name: 'Test Pipeline Complete',
      email: 'test-pipeline@example.com',
      phone: '+41 79 999 88 77',
      is_company: false,
      type: 'contact'
    };

    const scriptPath = path.join(__dirname, 'jetson-deployment', 'server', 'odoo-client.py');
    const dataJson = JSON.stringify(testPartner);

    // Set environment variables
    const env = {
      ...process.env,
      ODOO_URL: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
      ODOO_DB: 'lapadevadmin-lapa-v2-main-7268478',
      ODOO_USERNAME: 'apphubplatform@lapa.ch',
      ODOO_PASSWORD: 'apphubplatform2025'
    };

    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" create_partner '${dataJson}'`,
      { env, timeout: 30000 }
    );

    if (stderr) {
      log(`Warning: ${stderr}`, 'yellow');
    }

    const result = JSON.parse(stdout.trim());

    if (result.success) {
      log(`✓ Partner created successfully!`, 'green');
      log(`  Partner ID: ${result.partner_id}`, 'bright');
      log(`  Name: ${result.partner.display_name}`, 'bright');
      log(`  Link: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=${result.partner_id}&model=res.partner`, 'cyan');
      return { success: true, partnerId: result.partner_id };
    } else {
      throw new Error(result.error || 'Partner creation failed');
    }

  } catch (error) {
    log(`✗ Test 1 FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// ==============================================
// TEST 2: Jetson Odoo Endpoint
// ==============================================

async function test2_JetsonEndpoint() {
  section('TEST 2: Jetson Odoo Endpoint');

  try {
    log('\n[2/3] Testing Jetson /api/v1/odoo/create-contact...', 'cyan');

    const testPartner = {
      name: 'Test Jetson Endpoint',
      email: 'test-jetson@example.com',
      phone: '+41 79 888 77 66',
      is_company: false
    };

    const response = await fetch(`${JETSON_URL}/api/v1/odoo/create-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner: testPartner })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      log(`✓ Jetson endpoint working!`, 'green');
      log(`  Partner ID: ${result.partner_id}`, 'bright');
      log(`  Name: ${result.partner.display_name}`, 'bright');
      return { success: true, partnerId: result.partner_id };
    } else {
      throw new Error(result.error || 'Jetson endpoint failed');
    }

  } catch (error) {
    log(`✗ Test 2 FAILED: ${error.message}`, 'red');
    log(`  Make sure Jetson server is running on ${JETSON_URL}`, 'yellow');
    return { success: false, error: error.message };
  }
}

// ==============================================
// TEST 3: Jetson Company Complete
// ==============================================

async function test3_JetsonCompanyComplete() {
  section('TEST 3: Jetson Company Complete (with owners)');

  try {
    log('\n[3/3] Testing Jetson /api/v1/odoo/create-company-complete...', 'cyan');

    const testData = {
      company: {
        name: 'Test Company SA',
        vat: 'CHE-123.456.789',
        email: 'info@testcompany.ch',
        phone: '+41 44 123 45 67',
        street: 'Bahnhofstrasse 1',
        zip: '8001',
        city: 'Zürich',
        comment: 'Test company\nRating: A\nPagatori: buoni'
      },
      owners: [
        {
          name: 'Mario Rossi',
          function: 'CEO',
          comment: 'Partecipazione: 60%'
        },
        {
          name: 'Laura Bianchi',
          function: 'CFO',
          comment: 'Partecipazione: 40%'
        }
      ],
      contact: {
        name: 'Giovanni Verdi',
        function: 'Sales Manager',
        email: 'g.verdi@testcompany.ch',
        mobile: '+41 79 555 44 33'
      }
    };

    const response = await fetch(`${JETSON_URL}/api/v1/odoo/create-company-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      log(`✓ Company complete created!`, 'green');
      log(`  Company ID: ${result.result.company_id}`, 'bright');
      log(`  Company: ${result.result.company.display_name}`, 'bright');
      log(`  Owners created: ${result.result.owners.length}`, 'bright');
      result.result.owners.forEach((o, i) => {
        log(`    ${i + 1}. ${o.display_name} (${o.function || 'N/A'})`, 'cyan');
      });
      if (result.result.contact) {
        log(`  Contact: ${result.result.contact.display_name}`, 'bright');
      }
      log(`  Link: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=${result.result.company_id}&model=res.partner`, 'cyan');
      return { success: true, companyId: result.result.company_id };
    } else {
      throw new Error(result.error || 'Company creation failed');
    }

  } catch (error) {
    log(`✗ Test 3 FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// ==============================================
// TEST 4: Pipeline Completa (Vercel)
// ==============================================

async function test4_PipelineComplete() {
  section('TEST 4: Pipeline Completa (Gemini + Moneyhouse + Odoo)');

  try {
    if (!fs.existsSync(TEST_IMAGE)) {
      log(`⚠ Test image not found: ${TEST_IMAGE}`, 'yellow');
      log(`  Skipping full pipeline test`, 'yellow');
      return { success: false, skipped: true };
    }

    log('\n[4/4] Testing /api/scan-contatto-complete...', 'cyan');
    log(`  Image: ${TEST_IMAGE}`, 'bright');

    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_IMAGE));

    const url = new URL('/api/scan-contatto-complete', VERCEL_URL);

    return new Promise((resolve, reject) => {
      const req = https.request({
        method: 'POST',
        host: url.host,
        path: url.pathname,
        headers: form.getHeaders()
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.success) {
              log(`✓ Pipeline completed successfully!`, 'green');
              log(`\n📊 Processing Times:`, 'cyan');
              log(`  OCR (Gemini): ${result.processing.ocrDuration}ms`, 'bright');
              log(`  Moneyhouse: ${result.processing.moneyhouseDuration}ms`, 'bright');
              log(`  Odoo: ${result.processing.odooDuration}ms`, 'bright');
              log(`  Total: ${result.processing.totalDuration}ms`, 'bright');

              log(`\n📄 Extracted Data:`, 'cyan');
              log(`  Document Type: ${result.extractedData.documentType || 'N/A'}`, 'bright');
              log(`  Company: ${result.extractedData.companyName || 'N/A'}`, 'bright');
              log(`  UID: ${result.extractedData.companyUID || 'N/A'}`, 'bright');

              if (result.moneyhouseData) {
                log(`\n🏢 Moneyhouse Data:`, 'cyan');
                log(`  Legal Name: ${result.moneyhouseData.legalName}`, 'bright');
                log(`  Credit Rating: ${result.moneyhouseData.financial?.creditRating || 'N/A'}`, 'bright');
                log(`  Payment Behavior: ${result.moneyhouseData.financial?.paymentBehavior || 'N/A'}`, 'bright');
                log(`  Owners Found: ${result.moneyhouseData.owners?.length || 0}`, 'bright');
              }

              if (result.odooResult) {
                log(`\n💾 Odoo Results:`, 'cyan');
                if (result.odooResult.company_id) {
                  log(`  Company ID: ${result.odooResult.company_id}`, 'green');
                  log(`  Link: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#id=${result.odooResult.company_id}&model=res.partner`, 'cyan');
                }
                if (result.odooResult.owners) {
                  log(`  Owners Created: ${result.odooResult.owners.length}`, 'bright');
                }
                if (result.odooResult.contact) {
                  log(`  Contact Created: ${result.odooResult.contact.display_name}`, 'bright');
                }
              }

              if (result.warnings && result.warnings.length > 0) {
                log(`\n⚠ Warnings:`, 'yellow');
                result.warnings.forEach(w => log(`  - ${w}`, 'yellow'));
              }

              resolve({ success: true, result });
            } else {
              throw new Error(result.error || 'Pipeline failed');
            }
          } catch (err) {
            log(`✗ Parse error: ${err.message}`, 'red');
            log(`Raw response: ${data}`, 'yellow');
            resolve({ success: false, error: err.message });
          }
        });
      });

      req.on('error', (err) => {
        log(`✗ Request error: ${err.message}`, 'red');
        resolve({ success: false, error: err.message });
      });

      form.pipe(req);
    });

  } catch (error) {
    log(`✗ Test 4 FAILED: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// ==============================================
// MAIN TEST RUNNER
// ==============================================

async function runAllTests() {
  section('INIZIO TEST SUITE - PIPELINE COMPLETA');

  const startTime = Date.now();
  const results = {};

  // Test 1: Odoo Python Client
  results.test1 = await test1_OdooClient();
  if (!results.test1.success) {
    log('\n⚠ Test 1 failed - skipping remaining tests', 'yellow');
    process.exit(1);
  }

  await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa 1s

  // Test 2: Jetson Endpoint
  results.test2 = await test2_JetsonEndpoint();
  if (!results.test2.success) {
    log('\n⚠ Test 2 failed - Jetson may not be running', 'yellow');
  }

  await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa 1s

  // Test 3: Jetson Company Complete
  if (results.test2.success) {
    results.test3 = await test3_JetsonCompanyComplete();
  }

  await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa 1s

  // Test 4: Pipeline Completa
  results.test4 = await test4_PipelineComplete();

  // SUMMARY
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  section('TEST SUMMARY');

  log('\n📊 Results:', 'cyan');
  log(`  Test 1 (Odoo Python):      ${results.test1.success ? '✓ PASS' : '✗ FAIL'}`, results.test1.success ? 'green' : 'red');
  log(`  Test 2 (Jetson Endpoint):  ${results.test2?.success ? '✓ PASS' : '✗ FAIL'}`, results.test2?.success ? 'green' : 'red');
  log(`  Test 3 (Company Complete): ${results.test3?.success ? '✓ PASS' : '✗ FAIL'}`, results.test3?.success ? 'green' : 'red');
  log(`  Test 4 (Full Pipeline):    ${results.test4?.success ? '✓ PASS' : results.test4?.skipped ? '⊘ SKIP' : '✗ FAIL'}`, results.test4?.success ? 'green' : 'yellow');

  log(`\n⏱  Total Duration: ${duration}s`, 'bright');

  const allPassed = results.test1.success &&
    results.test2?.success &&
    results.test3?.success &&
    (results.test4?.success || results.test4?.skipped);

  if (allPassed) {
    log('\n' + '='.repeat(80), 'green');
    log('✓✓✓ ALL TESTS PASSED! ✓✓✓', 'green');
    log('='.repeat(80), 'green');
    process.exit(0);
  } else {
    log('\n' + '='.repeat(80), 'red');
    log('✗✗✗ SOME TESTS FAILED ✗✗✗', 'red');
    log('='.repeat(80), 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests();
