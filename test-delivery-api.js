// Test script per verificare le API delivery
const BASE_URL = 'http://localhost:3000';

async function testSaveSignature() {
  console.log('\n🧪 TEST 1: Save Signature API');
  console.log('================================');

  const payload = {
    picking_id: 1,
    signature: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    notes: 'Test signature'
  };

  try {
    const response = await fetch(`${BASE_URL}/api/delivery/save-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_id=test123'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 500) {
      console.log('❌ ERRORE 500 - Dettagli:', data);
    } else if (response.ok) {
      console.log('✅ SUCCESS');
    }
  } catch (error) {
    console.error('❌ Errore chiamata:', error.message);
  }
}

async function testValidate() {
  console.log('\n🧪 TEST 2: Validate API');
  console.log('================================');

  const payload = {
    picking_id: 1,
    products: [],
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    notes: 'Test validate',
    completion_type: 'signature'
  };

  try {
    const response = await fetch(`${BASE_URL}/api/delivery/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_id=test123'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 500) {
      console.log('❌ ERRORE 500 - Dettagli:', data);
    } else if (response.ok) {
      console.log('✅ SUCCESS');
    }
  } catch (error) {
    console.error('❌ Errore chiamata:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Avvio test API Delivery...\n');

  await testSaveSignature();
  await testValidate();

  console.log('\n✅ Test completati!\n');
}

runTests().catch(console.error);
