/**
 * Test Time & Attendance - Verifica tutti gli utenti test
 *
 * Questo script testa l'API /api/time-attendance/contact per tutti gli utenti creati
 */

const TEST_USERS = [
  { email: 'info@testcompany-orari.test', name: 'Test Company Orari Srl', password: 'CompanyTest2025!' },
  { email: 'mario.rossi@testcompany-orari.test', name: 'Mario Rossi', password: 'MarioTest2025!' },
  { email: 'laura.bianchi@testcompany-orari.test', name: 'Laura Bianchi', password: 'LauraTest2025!' },
  { email: 'giuseppe.verdi@testcompany-orari.test', name: 'Giuseppe Verdi', password: 'GiuseppeTest2025!' },
  { email: 'anna.neri@testcompany-orari.test', name: 'Anna Neri', password: 'AnnaTest2025!' },
  { email: 'marco.gialli@testcompany-orari.test', name: 'Marco Gialli', password: 'MarcoTest2025!' },
];

const STAGING_URL = 'https://staging.hub.lapa.ch';

async function testContactAPI(email) {
  try {
    const response = await fetch(`${STAGING_URL}/api/time-attendance/contact?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    return { success: data.success, data: data.data, error: data.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testOdooLogin(email, password) {
  try {
    const response = await fetch(`${STAGING_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    return { success: data.success || !!data.uid, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 TEST TIME & ATTENDANCE - Verifica Utenti\n');
  console.log('=' .repeat(60));

  let passed = 0;
  let failed = 0;

  for (const user of TEST_USERS) {
    console.log(`\n👤 Testing: ${user.name} (${user.email})`);
    console.log('-'.repeat(50));

    // Test 1: Contact API
    console.log('  📧 Test Contact API...');
    const contactResult = await testContactAPI(user.email);
    if (contactResult.success) {
      console.log(`  ✅ Contact trovato: ${contactResult.data?.contact?.name || 'OK'}`);
      if (contactResult.data?.company) {
        console.log(`     Azienda: ${contactResult.data.company.name}`);
      }
      if (contactResult.data?.employees?.length > 0) {
        console.log(`     Dipendenti: ${contactResult.data.employees.length}`);
      }
      passed++;
    } else {
      console.log(`  ❌ Contact API fallita: ${contactResult.error}`);
      failed++;
    }

    // Test 2: Odoo Login
    console.log('  🔐 Test Odoo Login...');
    const loginResult = await testOdooLogin(user.email, user.password);
    if (loginResult.success) {
      console.log(`  ✅ Login OK`);
      passed++;
    } else {
      console.log(`  ❌ Login fallito: ${loginResult.error || JSON.stringify(loginResult.data)}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 RISULTATI: ${passed} passati, ${failed} falliti`);
  console.log('\n📋 CREDENZIALI PER TEST MANUALE:');
  console.log('-'.repeat(60));
  TEST_USERS.forEach(u => {
    console.log(`${u.name.padEnd(25)} | ${u.email.padEnd(40)} | ${u.password}`);
  });
  console.log('\n🌐 URL Login: https://staging.hub.lapa.ch/dashboard');
  console.log('📍 Time & Attendance: https://staging.hub.lapa.ch/time-attendance');
}

runTests().catch(console.error);
