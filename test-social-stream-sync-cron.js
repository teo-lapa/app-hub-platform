/**
 * Test script per Vercel Cron: Social Stream Sync
 *
 * Questo script testa l'endpoint /api/cron/social-stream-sync
 * che sincronizza i post dai social network in Odoo
 */

// Per test locale, usa questo endpoint
const ENDPOINT_URL = 'http://localhost:3000/api/cron/social-stream-sync';

// Per test in production/staging, decommenta:
// const ENDPOINT_URL = 'https://your-app.vercel.app/api/cron/social-stream-sync';

// Secret per authorization (deve matchare CRON_SECRET in .env)
const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret-here';

async function testSocialStreamSync() {
  console.log('🧪 TEST SOCIAL STREAM SYNC CRON\n');
  console.log('='.repeat(70));
  console.log(`\nEndpoint: ${ENDPOINT_URL}`);
  console.log('Chiamata in corso...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(ENDPOINT_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });

    const duration = Date.now() - startTime;

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms\n`);

    const data = await response.json();

    if (response.ok || response.status === 207) {
      console.log('✅ SYNC COMPLETATO\n');
      console.log('Risultati:');
      console.log(`  - Success: ${data.success}`);
      console.log(`  - Timestamp: ${data.timestamp}`);
      console.log(`  - Duration: ${data.duration}`);
      console.log(`  - Synced Streams: ${data.syncedStreams}`);

      if (data.errors && data.errors.length > 0) {
        console.log(`\n⚠️  Errori (${data.errors.length}):`);
        data.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
    } else {
      console.log('❌ SYNC FALLITO\n');
      console.log('Errore:', data.error || data);
    }

    console.log('\n' + '='.repeat(70));

    if (response.ok) {
      console.log('\n💡 PROSSIMI PASSI:');
      console.log('1. Verifica che i nuovi post appaiano in Odoo');
      console.log('2. Controlla i log del cron in Vercel Dashboard');
      console.log('3. Verifica che il cron si esegua automaticamente ogni ora');
      console.log('\nPer verificare lo stato in Odoo:');
      console.log('→ node fix-facebook-sync.js');
    } else if (response.status === 401) {
      console.log('\n💡 ERRORE AUTORIZZAZIONE:');
      console.log('Il CRON_SECRET non è corretto o mancante.');
      console.log('Assicurati che .env contenga:');
      console.log('CRON_SECRET=your-secret-here');
    } else {
      console.log('\n💡 DEBUG:');
      console.log('Controlla i log dell\'applicazione per dettagli sull\'errore.');
    }

  } catch (error) {
    console.error('\n❌ ERRORE DI RETE:', error.message);
    console.log('\n💡 POSSIBILI CAUSE:');
    console.log('1. L\'applicazione Next.js non è in esecuzione');
    console.log('   → Esegui: npm run dev');
    console.log('2. L\'endpoint URL non è corretto');
    console.log('3. Problema di connessione');
  }

  console.log('\n' + '='.repeat(70));
}

// Mostra menu se eseguito senza argomenti
if (process.argv.includes('--help')) {
  console.log(`
USAGE: node test-social-stream-sync-cron.js [options]

OPTIONS:
  --help       Mostra questo messaggio
  --local      Test endpoint locale (default)
  --staging    Test endpoint staging
  --prod       Test endpoint production

EXAMPLES:
  node test-social-stream-sync-cron.js
  node test-social-stream-sync-cron.js --staging

NOTES:
  - Assicurati che l'app Next.js sia in esecuzione (npm run dev)
  - Il CRON_SECRET deve essere configurato in .env
  - In production, il cron viene eseguito automaticamente da Vercel
  `);
  process.exit(0);
}

testSocialStreamSync();
