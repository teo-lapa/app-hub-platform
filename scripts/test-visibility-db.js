// Script per verificare cosa c'è DAVVERO salvato nel database Vercel KV
const { getAllAppVisibilities } = require('../lib/kv');

async function testVisibilityDB() {
  console.log('🔍 VERIFICO COSA È SALVATO NEL DATABASE...\n');

  try {
    const allVisibilities = await getAllAppVisibilities();

    console.log(`📊 Totale app con visibilità salvata: ${allVisibilities.length}\n`);

    // Cerca Stella AI Assistant
    const stella = allVisibilities.find(v => v.appId === 's17');

    if (stella) {
      console.log('✅ TROVATA: Stella AI Assistant (s17)');
      console.log('=====================================\n');
      console.log('RAW DATA dal database:');
      console.log(JSON.stringify(stella, null, 2));
      console.log('\n');

      console.log('DETTAGLI:');
      console.log(`  visible: ${stella.visible}`);
      console.log(`  visibilityGroup: ${stella.visibilityGroup}`);
      console.log(`  developmentStatus: ${stella.developmentStatus}`);
      console.log(`  excludedUsers (tipo): ${typeof stella.excludedUsers}`);
      console.log(`  excludedUsers (array): ${Array.isArray(stella.excludedUsers)}`);
      console.log(`  excludedUsers (length): ${stella.excludedUsers?.length || 0}`);
      console.log(`  excludedUsers (valori):`, stella.excludedUsers);
      console.log(`  excludedCustomers (tipo): ${typeof stella.excludedCustomers}`);
      console.log(`  excludedCustomers (array): ${Array.isArray(stella.excludedCustomers)}`);
      console.log(`  excludedCustomers (length): ${stella.excludedCustomers?.length || 0}`);
      console.log(`  excludedCustomers (valori):`, stella.excludedCustomers);

      console.log('\n🔍 ANALISI EXCLUDEDUSERS:');
      if (stella.excludedUsers && stella.excludedUsers.length > 0) {
        stella.excludedUsers.forEach((item, idx) => {
          const isEmail = item.includes('@');
          const isNumber = !isNaN(Number(item));
          console.log(`  [${idx}] "${item}" - ${isEmail ? '✉️ EMAIL' : isNumber ? '🔢 ID' : '❓ SCONOSCIUTO'}`);
        });
      } else {
        console.log('  ❌ NESSUN UTENTE ESCLUSO!');
      }

    } else {
      console.log('❌ NON TROVATA: Stella AI Assistant (s17)');
      console.log('\nApp disponibili nel DB:');
      allVisibilities.forEach(v => {
        console.log(`  - ${v.appId}`);
      });
    }

  } catch (error) {
    console.error('❌ ERRORE:', error);
  }
}

testVisibilityDB();
