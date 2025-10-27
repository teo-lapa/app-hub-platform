/**
 * Test API adesso per vedere quante interazioni restituisce
 */

async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/maestro/customers/2421');
    const data = await response.json();

    console.log('🔍 API RESPONSE:');
    console.log(`Interazioni nell'API: ${data.interactions?.length || 0}`);
    console.log('\nIDs delle interazioni:');
    data.interactions?.forEach((i: any, idx: number) => {
      console.log(`${idx + 1}. ID: ${i.id} | ${i.interaction_type} | ${i.interaction_date}`);
    });
  } catch (error) {
    console.error('Errore:', error);
  }
}

testAPI();
