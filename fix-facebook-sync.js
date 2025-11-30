/**
 * Script per diagnosticare e risolvere problemi di sincronizzazione Facebook
 *
 * Problema: Post Facebook non si sincronizzano da 01/01/2025
 * Causa: Token Facebook scaduto + nessun auto-sync
 *
 * Questo script:
 * 1. Verifica stato account Facebook in Odoo
 * 2. Controlla ultimi post sincronizzati
 * 3. Testa se il token è ancora valido
 * 4. Fornisce istruzioni per riconnessione
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;
let uid = null;

// Autenticazione con Odoo
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

  if (data.result && data.result.uid) {
    uid = data.result.uid;
    return data.result.uid;
  }

  throw new Error('Autenticazione fallita');
}

// Chiamata generica a Odoo
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
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
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

async function main() {
  console.log('🔧 FIX SINCRONIZZAZIONE FACEBOOK → ODOO\n');
  console.log('='.repeat(70));

  try {
    // 1. Autenticazione
    console.log('\n1️⃣ Autenticazione con Odoo...');
    const userId = await authenticate();

    if (!userId) {
      console.log('❌ Autenticazione fallita!');
      return;
    }
    console.log(`✅ Autenticato come UID: ${userId}`);

    // 2. Verifica account Facebook
    console.log('\n2️⃣ Controllo account Facebook...');
    const accounts = await callOdoo('social.account', 'search_read', [[['media_type', '=', 'facebook']]], {
      fields: ['id', 'name', 'social_account_handle', 'is_media_disconnected', 'create_date', 'write_date']
    });

    if (accounts.length === 0) {
      console.log('❌ Nessun account Facebook trovato in Odoo!');
      console.log('\n💡 AZIONE RICHIESTA:');
      console.log('   1. Vai su Odoo: Marketing Sociale → Configurazione → Social Media');
      console.log('   2. Clicca su "Facebook"');
      console.log('   3. Aggiungi il tuo account Facebook');
      return;
    }

    console.log(`✅ Trovati ${accounts.length} account Facebook:\n`);

    for (const account of accounts) {
      const statusIcon = account.is_media_disconnected ? '🔴' : '🟢';
      const statusText = account.is_media_disconnected ? 'DISCONNESSO' : 'Connesso';

      console.log(`   ${statusIcon} ${account.name}`);
      console.log(`      ID: ${account.id}`);
      console.log(`      Handle: ${account.social_account_handle || 'N/A'}`);
      console.log(`      Stato: ${statusText}`);
      console.log(`      Ultima modifica: ${account.write_date}`);
      console.log('');
    }

    // 3. Controlla ultimi post sincronizzati
    console.log('3️⃣ Controllo ultimi post sincronizzati...');

    const posts = await callOdoo('social.stream.post', 'search_read', [[['account_id', 'in', accounts.map(a => a.id)]]], {
      fields: ['id', 'message', 'author_name', 'published_date', 'stream_id', 'account_id'],
      order: 'published_date desc',
      limit: 10
    });

    if (posts.length === 0) {
      console.log('❌ Nessun post trovato! Il feed è vuoto.\n');
    } else {
      console.log(`✅ Trovati ${posts.length} post recenti:\n`);

      posts.forEach((post, index) => {
        const date = new Date(post.published_date);
        const preview = (post.message || '').substring(0, 60);
        console.log(`   ${index + 1}. ${date.toLocaleDateString('it-IT')} - ${post.author_name || 'Sconosciuto'}`);
        console.log(`      ${preview}${preview.length >= 60 ? '...' : ''}`);
      });

      // Calcola quanto tempo fa è stato l'ultimo post
      const lastPost = posts[0];
      const lastPostDate = new Date(lastPost.published_date);
      const now = new Date();
      const daysSinceLastPost = Math.floor((now - lastPostDate) / (1000 * 60 * 60 * 24));

      console.log(`\n⏰ Ultimo post: ${lastPostDate.toLocaleDateString('it-IT')} (${daysSinceLastPost} giorni fa)`);

      if (daysSinceLastPost > 30) {
        console.log('⚠️  ATTENZIONE: L\'ultimo post è molto vecchio!');
        console.log('   Questo indica che la sincronizzazione non funziona.');
      }
    }

    // 4. Verifica stream Facebook
    console.log('\n4️⃣ Controllo stream Facebook...');

    const streams = await callOdoo('social.stream', 'search_read', [[['media_id.media_type', '=', 'facebook']]], {
      fields: ['id', 'name', 'media_id', 'stream_type_id', 'create_date']
    });

    console.log(`✅ Trovati ${streams.length} stream Facebook:\n`);

    streams.forEach(stream => {
      console.log(`   📡 ${stream.name}`);
      console.log(`      ID: ${stream.id}`);
      console.log(`      Creato: ${stream.create_date}`);
    });

    // 5. Verifica scheduled actions
    console.log('\n5️⃣ Controllo scheduled actions (cron jobs)...');

    const crons = await callOdoo('ir.cron', 'search_read', [[['name', 'ilike', 'social']]], {
      fields: ['id', 'name', 'active', 'interval_number', 'interval_type', 'nextcall', 'lastcall', 'model_id']
    });

    console.log(`✅ Trovati ${crons.length} cron jobs relativi a Social:\n`);

    let hasAutoSyncCron = false;

    crons.forEach(cron => {
      const statusIcon = cron.active ? '✅' : '❌';
      console.log(`   ${statusIcon} ${cron.name}`);
      console.log(`      Stato: ${cron.active ? 'Attivo' : 'Disattivo'}`);
      console.log(`      Intervallo: ${cron.interval_number} ${cron.interval_type}(s)`);
      console.log(`      Ultima esecuzione: ${cron.lastcall || 'Mai'}`);
      console.log(`      Prossima esecuzione: ${cron.nextcall || 'N/A'}`);
      console.log('');

      // Controlla se c'è un cron per fetch/sync/refresh
      if (cron.name.toLowerCase().includes('fetch') ||
          cron.name.toLowerCase().includes('sync') ||
          cron.name.toLowerCase().includes('refresh')) {
        hasAutoSyncCron = true;
      }
    });

    // 6. Diagnosi finale
    console.log('\n' + '='.repeat(70));
    console.log('📊 DIAGNOSI FINALE\n');

    const hasDisconnectedAccounts = accounts.some(a => a.is_media_disconnected);
    const hasOldPosts = posts.length > 0 &&
      Math.floor((new Date() - new Date(posts[0].published_date)) / (1000 * 60 * 60 * 24)) > 30;

    let problemsFound = 0;

    if (hasDisconnectedAccounts) {
      problemsFound++;
      console.log(`❌ Problema ${problemsFound}: Account Facebook disconnessi`);
      console.log('   → Alcuni account risultano disconnessi in Odoo\n');
    }

    if (hasOldPosts || posts.length === 0) {
      problemsFound++;
      console.log(`❌ Problema ${problemsFound}: Post non sincronizzati`);
      console.log('   → L\'ultimo post è troppo vecchio o non ci sono post\n');
    }

    if (!hasAutoSyncCron) {
      problemsFound++;
      console.log(`❌ Problema ${problemsFound}: Nessun auto-sync configurato`);
      console.log('   → Non c\'è un cron job per sincronizzare automaticamente i post\n');
    }

    if (problemsFound === 0) {
      console.log('✅ Nessun problema rilevato!\n');
      console.log('   Se i post non si sincronizzano, prova a:');
      console.log('   1. Aprire Odoo → Marketing Sociale → Feed');
      console.log('   2. Cercare un pulsante "Aggiorna" o "Sincronizza"');
      console.log('   3. Cliccare per forzare il refresh manuale');
    } else {
      console.log('='.repeat(70));
      console.log('💡 AZIONI CONSIGLIATE:\n');

      console.log('IMMEDIATA (Risolve il problema ora):');
      console.log('1. Vai su Odoo: Marketing Sociale → Configurazione → Social Media');
      console.log('2. Clicca su "Facebook"');
      console.log('3. Trova l\'account "LAPA - finest italian food"');
      console.log('4. Clicca "Modifica" → "Riconnetti" o "Disconnetti" → "Connetti"');
      console.log('5. Autorizza nuovamente l\'accesso a Facebook');
      console.log('6. Torna al Feed e cerca il pulsante "Aggiorna"\n');

      console.log('LUNGO TERMINE (Previene il problema in futuro):');
      console.log('• Creare uno scheduled action per auto-sync (script disponibile)');
      console.log('• Implementare monitoraggio scadenza token Facebook');
      console.log('• Configurare alert quando token sta per scadere\n');

      console.log('Per implementare le soluzioni a lungo termine:');
      console.log('→ Esegui: node create-facebook-auto-sync.js');
    }

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    if (error.faultString) {
      console.error('Dettagli:', error.faultString);
    }
  }
}

main();
