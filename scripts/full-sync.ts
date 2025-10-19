/**
 * MAESTRO AI - Full Sync
 * Sincronizza TUTTI i clienti attivi da Odoo (ultimi 4 mesi)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { syncCustomersFromOdoo } from '../lib/maestro/sync-odoo-v2';

async function fullSync() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 MAESTRO AI - FULL SYNC');
  console.log('='.repeat(80) + '\n');

  console.log('⚠️  ATTENZIONE: Questo sincronizzerà TUTTI i clienti attivi da Odoo.');
  console.log('   Stimato: ~231 clienti (ultimi 4 mesi)');
  console.log('   Tempo stimato: ~5 minuti\n');

  const startTime = Date.now();

  try {
    // 0 = unlimited, sync all
    const result = await syncCustomersFromOdoo(0);

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(80));
    console.log('✅ FULL SYNC COMPLETATO!');
    console.log('='.repeat(80));
    console.log(`\n📊 Risultati:\n`);
    console.log(`   ✅ Clienti sincronizzati: ${result.synced}`);
    console.log(`   ❌ Errori: ${result.errors}`);
    console.log(`   ⏱️  Tempo: ${duration} minuti`);

    if (result.errorDetails && result.errorDetails.length > 0) {
      console.log(`\n⚠️  Dettagli errori:\n`);
      result.errorDetails.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    console.log('\n🎯 Prossimi step:\n');
    console.log('   1. Verifica dati: npx tsx scripts/view-sync-results.ts');
    console.log('   2. Testa frontend: http://localhost:3004/maestro-ai');
    console.log('   3. Deploy: vercel deploy\n');

  } catch (error) {
    console.error('\n❌ FULL SYNC FALLITO:', error);
    process.exit(1);
  }
}

fullSync();
