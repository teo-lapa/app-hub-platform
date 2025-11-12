// Test per vedere cosa c'è nel DB per app 1
require('dotenv').config({ path: '.env.local' });
const { kv } = require('@vercel/kv');

async function test() {
  try {
    const app1 = await kv.get('app_visibility:1');
    console.log('\n🎯 App "1" (Menu App) nel database:');
    console.log(JSON.stringify(app1, null, 2));
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    process.exit(0);
  }
}

test();
