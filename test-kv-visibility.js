// Test script per vedere cosa c'è nel Vercel KV
require('dotenv').config({ path: '.env.local' });
const { kv } = require('@vercel/kv');

async function testKV() {
  try {
    console.log('🔍 Cercando tutte le chiavi app_visibility...');
    const keys = await kv.keys('app_visibility:*');
    console.log(`\n📊 Trovate ${keys.length} app con impostazioni di visibilità:\n`);

    for (const key of keys) {
      const data = await kv.get(key);
      const appId = key.replace('app_visibility:', '');
      console.log(`\n🔑 ${appId}`);
      console.log(JSON.stringify(data, null, 2));
      console.log('---');
    }

    // Testa specificamente l'app "1" (Menu App)
    console.log('\n\n🎯 Test specifico per app "1" (Menu App):');
    const app1 = await kv.get('app_visibility:1');
    console.log(JSON.stringify(app1, null, 2));

  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

testKV();
