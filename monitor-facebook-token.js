/**
 * Script per monitorare la scadenza del token Facebook
 *
 * Token Facebook Page Access:
 * - Short-lived: 1-2 ore
 * - Long-lived: 60 giorni
 * - Dopo 60 giorni: Token scade e sincronizzazione si blocca
 *
 * Questo script:
 * 1. Controlla tutti gli account social in Odoo
 * 2. Calcola quando scade il token (approssimativo basato su write_date)
 * 3. Avvisa se il token sta per scadere o è scaduto
 * 4. Fornisce istruzioni per rinnovare
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

// Durata token (giorni)
const TOKEN_EXPIRY_DAYS = 60;
const WARNING_THRESHOLD_DAYS = 7; // Avvisa se mancano meno di 7 giorni

let cookies = null;

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: USERNAME,
        password: PASSWORD
      },
      id: 1
    })
  });

  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      setCookies = cookieHeader.split(',').map(c => c.trim());
    }
  }

  if (setCookies && setCookies.length > 0) {
    cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
  }

  const data = await response.json();

  if (!data.result || !data.result.uid) {
    throw new Error('Autenticazione fallita');
  }
}

async function callOdoo(model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Errore sconosciuto');
  }

  return data.result;
}

function getStatusIcon(daysRemaining) {
  if (daysRemaining <= 0) return '🔴';
  if (daysRemaining <= WARNING_THRESHOLD_DAYS) return '🟡';
  return '🟢';
}

function getStatusText(daysRemaining) {
  if (daysRemaining <= 0) return 'SCADUTO';
  if (daysRemaining <= WARNING_THRESHOLD_DAYS) return 'IN SCADENZA';
  return 'OK';
}

async function main() {
  console.log('📊 MONITORAGGIO TOKEN FACEBOOK\n');
  console.log('='.repeat(70));

  try {
    // Autenticazione
    console.log('\n🔐 Autenticazione...');
    await authenticate();
    console.log('✅ Autenticato\n');

    // Recupera tutti gli account social
    console.log('📱 Recupero account social...\n');

    const accounts = await callOdoo('social.account', 'search_read', [[]], {
      fields: [
        'id',
        'name',
        'media_type',
        'social_account_handle',
        'is_media_disconnected',
        'create_date',
        'write_date'
      ]
    });

    if (accounts.length === 0) {
      console.log('❌ Nessun account social trovato in Odoo!');
      return;
    }

    console.log(`Trovati ${accounts.length} account social:\n`);
    console.log('='.repeat(70));

    const now = new Date();
    let expiredCount = 0;
    let warningCount = 0;
    let okCount = 0;

    for (const account of accounts) {
      // Calcola età del token basandosi su write_date
      // NOTA: Questo è approssimativo perché write_date può cambiare per altri motivi
      const lastUpdate = new Date(account.write_date);
      const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
      const daysRemaining = TOKEN_EXPIRY_DAYS - daysSinceUpdate;

      const statusIcon = getStatusIcon(daysRemaining);
      const statusText = getStatusText(daysRemaining);

      // Conta status
      if (daysRemaining <= 0) expiredCount++;
      else if (daysRemaining <= WARNING_THRESHOLD_DAYS) warningCount++;
      else okCount++;

      console.log(`\n${statusIcon} ${account.name} (${account.media_type})`);
      console.log(`   Handle: ${account.social_account_handle || 'N/A'}`);
      console.log(`   Stato Odoo: ${account.is_media_disconnected ? 'Disconnesso' : 'Connesso'}`);
      console.log(`   Ultimo aggiornamento: ${account.write_date}`);
      console.log(`   Giorni da ultimo aggiornamento: ${daysSinceUpdate}`);

      if (daysRemaining > 0) {
        console.log(`   Token scade tra circa: ${daysRemaining} giorni`);
        console.log(`   Stato token: ${statusText}`);
      } else {
        console.log(`   Token scaduto da circa: ${Math.abs(daysRemaining)} giorni`);
        console.log(`   Stato token: ${statusText} ⚠️`);
      }

      // Warning specifici
      if (account.media_type === 'facebook') {
        if (daysRemaining <= 0) {
          console.log('\n   ❌ AZIONE RICHIESTA:');
          console.log('      Il token Facebook è probabilmente scaduto!');
          console.log('      Riconnetti l\'account per ripristinare la sincronizzazione.');
        } else if (daysRemaining <= WARNING_THRESHOLD_DAYS) {
          console.log('\n   ⚠️  ATTENZIONE:');
          console.log(`      Il token Facebook scadrà tra circa ${daysRemaining} giorni!`);
          console.log('      Considera di riconnettere l\'account preventivamente.');
        }
      }

      console.log('   ' + '-'.repeat(66));
    }

    // Sommario
    console.log('\n' + '='.repeat(70));
    console.log('📊 SOMMARIO\n');
    console.log(`   Total account: ${accounts.length}`);
    console.log(`   🟢 OK: ${okCount}`);
    console.log(`   🟡 In scadenza: ${warningCount}`);
    console.log(`   🔴 Scaduti: ${expiredCount}`);

    // Raccomandazioni
    console.log('\n' + '='.repeat(70));
    console.log('💡 RACCOMANDAZIONI\n');

    if (expiredCount > 0) {
      console.log('❌ CRITICO: Alcuni token sono scaduti!');
      console.log('   → Riconnetti immediatamente gli account scaduti');
      console.log('   → I post non si sincronizzano finché il token non è rinnovato\n');
    }

    if (warningCount > 0) {
      console.log('⚠️  ATTENZIONE: Alcuni token stanno per scadere!');
      console.log('   → Pianifica la riconnessione degli account in scadenza');
      console.log(`   → Riconnettere preventivamente evita interruzioni del servizio\n`);
    }

    if (okCount === accounts.length) {
      console.log('✅ Tutti i token sono OK!');
      console.log('   → Nessuna azione immediata richiesta');
      console.log('   → Continua a monitorare regolarmente\n');
    }

    console.log('COME RICONNETTERE:');
    console.log('1. Vai su Odoo: Marketing Sociale → Configurazione → Social Media');
    console.log('2. Clicca sul social network (es. Facebook)');
    console.log('3. Trova l\'account da rinnovare');
    console.log('4. Clicca "Modifica" → "Riconnetti"');
    console.log('5. Autorizza nuovamente l\'accesso');

    console.log('\nPROSSIMI PASSI:');
    console.log('→ Per verificare lo stato della sincronizzazione: node fix-facebook-sync.js');
    console.log('→ Per testare il cron di sync: node test-social-stream-sync-cron.js');

    console.log('\n' + '='.repeat(70));

    // Exit code basato sullo stato
    if (expiredCount > 0) process.exit(1); // Errore se ci sono token scaduti
    if (warningCount > 0) process.exit(2); // Warning se ci sono token in scadenza
    process.exit(0); // OK

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    process.exit(3);
  }
}

main();
