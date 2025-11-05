/**
 * Script per controllare cosa è salvato nel database Vercel KV
 * per le impostazioni di visibilità
 */

const { kv } = require('@vercel/kv');

async function checkVisibilityDB() {
  try {
    console.log('🔍 Controllo database Vercel KV per Stella AI Assistant...\n');

    // Leggi le impostazioni per Stella AI Assistant (s17)
    const stellaData = await kv.get('app_visibility:s17');

    if (!stellaData) {
      console.log('❌ Nessun dato trovato per Stella AI Assistant (s17)');
      return;
    }

    console.log('✅ Dati trovati per Stella AI Assistant (s17):');
    console.log(JSON.stringify(stellaData, null, 2));

    // Analizza i dati
    console.log('\n📊 ANALISI:');
    console.log('='.repeat(60));

    if (stellaData.excludedUsers) {
      console.log(`\n👥 excludedUsers (${stellaData.excludedUsers.length} elementi):`);
      stellaData.excludedUsers.forEach((item, index) => {
        const isEmail = item.includes('@');
        const type = isEmail ? '📧 EMAIL' : '🔢 ID';
        console.log(`  ${index + 1}. ${type}: ${item}`);
      });

      // Conta email vs ID
      const emails = stellaData.excludedUsers.filter(item => item.includes('@'));
      const ids = stellaData.excludedUsers.filter(item => !item.includes('@'));

      console.log(`\n📈 RIEPILOGO excludedUsers:`);
      console.log(`  ✅ Email salvate: ${emails.length}`);
      console.log(`  ⚠️  ID numerici:   ${ids.length}`);

      if (emails.length > 0) {
        console.log(`\n✅ SUCCESSO! Le email sono state salvate correttamente!`);
        console.log(`\nEmail salvate:`);
        emails.forEach(email => console.log(`  - ${email}`));
      } else {
        console.log(`\n❌ PROBLEMA! Solo ID numerici salvati, nessuna email!`);
      }
    } else {
      console.log('\n⚠️ Nessun excludedUsers trovato');
    }

    if (stellaData.excludedCustomers) {
      console.log(`\n\n👤 excludedCustomers (${stellaData.excludedCustomers.length} elementi):`);
      stellaData.excludedCustomers.forEach((item, index) => {
        const isEmail = item.includes('@');
        const type = isEmail ? '📧 EMAIL' : '🔢 ID';
        console.log(`  ${index + 1}. ${type}: ${item}`);
      });
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

checkVisibilityDB();
