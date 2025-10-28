/**
 * Script per inizializzare visibilità APP "Controllo Scadenze"
 *
 * Run: npx tsx scripts/init-scadenze-visibility.ts
 */

async function initScadenzeVisibility() {
  try {
    console.log('🚀 Inizializzazione visibilità APP Controllo Scadenze...');

    const appId = 's31'; // ID dell'APP Controllo Scadenze

    // Chiama API per salvare impostazioni
    const response = await fetch('http://localhost:3000/api/apps/visibility', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          [appId]: {
            visible: true,
            visibilityGroup: 'all', // Visibile a tutti
            excludedUsers: [],
            excludedCustomers: [],
            developmentStatus: 'pronta'
          }
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Impostazioni salvate con successo!');
      console.log(`   APP ID: ${appId}`);
      console.log('   visible: true');
      console.log('   visibilityGroup: all');
      console.log('   developmentStatus: pronta');
    } else {
      console.error('❌ Errore salvataggio:', data.error);
    }

  } catch (error) {
    console.error('❌ Errore:', error);
  }
}

initScadenzeVisibility();
