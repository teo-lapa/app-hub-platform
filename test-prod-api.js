// Test API production
const BASE_URL = 'https://app-hub-platform-3tatpanw4-teo-lapas-projects.vercel.app';

async function testProdAPI() {
  console.log('🧪 Testing production API...\n');

  const payload = {
    picking_id: 1,
    signature: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    notes: 'Test signature from script'
  };

  try {
    console.log('📤 Calling /api/delivery/save-signature...');
    const response = await fetch(`${BASE_URL}/api/delivery/save-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log('Raw response:', text.substring(0, 500));

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.log('\n❌ Response is not JSON!');
      return;
    }

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 500) {
      console.log('\n❌ ERRORE 500 - Dettagli:');
      console.log('Error:', data.error);
      console.log('Details:', data.details);
      if (data.stack) {
        console.log('Stack:', data.stack);
      }
    } else if (response.ok) {
      console.log('\n✅ SUCCESS');
    }
  } catch (error) {
    console.error('\n❌ Errore chiamata:', error.message);
  }
}

testProdAPI();
