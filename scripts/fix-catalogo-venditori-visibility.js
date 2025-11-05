/**
 * Script per verificare e correggere la visibilità del "Catalogo Venditori [S]" (ID: s6)
 *
 * Questo script:
 * 1. Controlla le impostazioni attuali dell'app s6 in Vercel KV
 * 2. Mostra esattamente cosa è configurato
 * 3. Corregge le impostazioni per renderla visibile ai dipendenti
 */

const { kv } = require('@vercel/kv');

const APP_ID = 's6'; // Catalogo Venditori [S]

async function checkAndFixVisibility() {
  console.log('🔍 Controllo visibilità per "Catalogo Venditori [S]" (ID: s6)...\n');

  try {
    // Leggi le impostazioni attuali
    const currentSettings = await kv.get(`app_visibility:${APP_ID}`);

    console.log('📋 Impostazioni attuali:');
    if (!currentSettings) {
      console.log('  ⚠️  NESSUNA IMPOSTAZIONE TROVATA - App usa default (visibile a tutti)');
      console.log('');
      console.log('💡 Questo significa che l\'app DOVREBBE essere visibile.');
      console.log('   Se non la vedi, il problema potrebbe essere:');
      console.log('   1. Filtri di categoria attivi nella dashboard');
      console.log('   2. Ricerca attiva che esclude l\'app');
      console.log('   3. Cache del browser non aggiornata');
      console.log('');
      console.log('🔧 Vuoi creare impostazioni esplicite? (imposterà visibilità per dipendenti)');

      // Crea impostazioni esplicite
      const newSettings = {
        excludedUsers: [],
        excludedCustomers: [],
        visible: true,
        visibilityGroup: 'all', // Visibile sia a dipendenti che clienti
        developmentStatus: 'pronta'
      };

      console.log('\n✅ Creando nuove impostazioni:');
      console.log(JSON.stringify(newSettings, null, 2));

      await kv.set(`app_visibility:${APP_ID}`, newSettings);

      console.log('\n✅ Impostazioni salvate con successo!');
      console.log('🔄 Ricarica la dashboard per vedere le modifiche.');

    } else {
      console.log(JSON.stringify(currentSettings, null, 2));
      console.log('');

      // Analizza le impostazioni
      const issues = [];

      if (!currentSettings.visible) {
        issues.push('❌ visible = false (app nascosta)');
      }

      if (currentSettings.visibilityGroup === 'none') {
        issues.push('❌ visibilityGroup = "none" (nessuno può vedere)');
      }

      if (currentSettings.visibilityGroup === 'portal') {
        issues.push('❌ visibilityGroup = "portal" (solo clienti, NON dipendenti)');
      }

      if (currentSettings.developmentStatus === 'in_sviluppo' && !currentSettings.visible) {
        issues.push('❌ developmentStatus = "in_sviluppo" con visible = false');
      }

      if (issues.length > 0) {
        console.log('🚨 PROBLEMI TROVATI:');
        issues.forEach(issue => console.log(`  ${issue}`));
        console.log('');

        // Correggi automaticamente
        const fixedSettings = {
          ...currentSettings,
          visible: true,
          visibilityGroup: 'all', // Visibile a tutti i gruppi
          developmentStatus: 'pronta', // Pronta per produzione
          excludedUsers: currentSettings.excludedUsers || [],
          excludedCustomers: currentSettings.excludedCustomers || []
        };

        console.log('🔧 Correzione automatica in corso...');
        console.log('Nuove impostazioni:');
        console.log(JSON.stringify(fixedSettings, null, 2));

        await kv.set(`app_visibility:${APP_ID}`, fixedSettings);

        console.log('\n✅ Impostazioni corrette con successo!');
        console.log('🔄 Ricarica la dashboard per vedere le modifiche.');

      } else {
        console.log('✅ Le impostazioni sembrano corrette!');
        console.log('');
        console.log('📊 Riepilogo:');
        console.log(`  - Visibile: ${currentSettings.visible ? '✅ Sì' : '❌ No'}`);
        console.log(`  - Gruppo: ${currentSettings.visibilityGroup || 'all'}`);
        console.log(`  - Stato: ${currentSettings.developmentStatus || 'pronta'}`);
        console.log(`  - Utenti esclusi: ${(currentSettings.excludedUsers || []).length}`);
        console.log(`  - Clienti esclusi: ${(currentSettings.excludedCustomers || []).length}`);
        console.log('');

        if ((currentSettings.excludedUsers || []).length > 0) {
          console.log('👥 Utenti esclusi:');
          currentSettings.excludedUsers.forEach(user => {
            console.log(`  - ${user}`);
          });
          console.log('');
        }

        console.log('💡 Se ancora non vedi l\'app, controlla:');
        console.log('   1. Che il tuo utente NON sia nella lista "Utenti esclusi"');
        console.log('   2. Che tu sia loggato come dipendente (role: "dipendente" o "admin")');
        console.log('   3. Che non ci siano filtri di categoria attivi');
        console.log('   4. Prova a ricaricare la pagina (Ctrl+F5 per svuotare cache)');
      }
    }

    console.log('');
    console.log('🏁 Controllo completato!');

  } catch (error) {
    console.error('❌ Errore:', error);

    if (error.message?.includes('KV_REST_API')) {
      console.log('');
      console.log('💡 Assicurati di eseguire questo script in produzione o con le env var:');
      console.log('   - KV_REST_API_URL');
      console.log('   - KV_REST_API_TOKEN');
    }
  }
}

// Esegui lo script
checkAndFixVisibility();
