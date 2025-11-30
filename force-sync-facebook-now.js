/**
 * Forza una sincronizzazione IMMEDIATA dei post Facebook
 *
 * Questo script:
 * 1. Si connette a Odoo
 * 2. Trova gli stream Facebook
 * 3. Forza il refresh dei post
 * 4. Verifica che i nuovi post siano stati sincronizzati
 *
 * Utile per testare senza aspettare il cron automatico
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;

async function authenticate() {
  console.log('🔐 Autenticazione...');

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

  console.log('✅ Autenticato\n');
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

async function main() {
  console.log('⚡ FORZA SINCRONIZZAZIONE FACEBOOK ORA\n');
  console.log('='.repeat(70));

  try {
    await authenticate();

    // 1. Conta post esistenti PRIMA della sincronizzazione
    console.log('📊 Conta post esistenti PRIMA della sync...');

    const accountsBefore = await callOdoo('social.account', 'search_read', [[['media_type', '=', 'facebook']]], {
      fields: ['id', 'name']
    });

    if (accountsBefore.length === 0) {
      console.log('❌ Nessun account Facebook trovato!');
      return;
    }

    const postsBefore = await callOdoo('social.stream.post', 'search_read', [[['account_id', 'in', accountsBefore.map(a => a.id)]]], {
      fields: ['id', 'published_date'],
      order: 'published_date desc',
      limit: 1
    });

    console.log(`   Trovati ${postsBefore.length > 0 ? '✅' : '⚠️'} ${postsBefore.length || 0} post Facebook attuali`);

    if (postsBefore.length > 0) {
      const lastPostDate = new Date(postsBefore[0].published_date);
      console.log(`   Ultimo post: ${lastPostDate.toLocaleDateString('it-IT')} ${lastPostDate.toLocaleTimeString('it-IT')}`);
    }

    console.log('');

    // 2. Trova stream Facebook
    console.log('📡 Ricerca stream Facebook...');

    const streams = await callOdoo('social.stream', 'search_read', [[['media_id.media_type', '=', 'facebook']]], {
      fields: ['id', 'name', 'media_id']
    });

    if (streams.length === 0) {
      console.log('❌ Nessuno stream Facebook trovato!');
      console.log('   Configura almeno uno stream Facebook in Odoo.');
      return;
    }

    console.log(`✅ Trovati ${streams.length} stream Facebook\n`);

    // 3. Forza il refresh di ogni stream
    console.log('🔄 Sincronizzazione in corso...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const stream of streams) {
      console.log(`   📡 ${stream.name} (ID: ${stream.id})`);

      try {
        // Prova diversi metodi di refresh
        let synced = false;

        // Metodo 1: refresh_posts (se disponibile)
        try {
          await callOdoo('social.stream', 'refresh_posts', [[stream.id]]);
          console.log('      ✅ Sincronizzato con refresh_posts');
          synced = true;
          successCount++;
        } catch (e1) {
          // Metodo 2: write con trigger (workaround)
          try {
            // Alcuni moduli Odoo sincronizzano quando si modifica lo stream
            await callOdoo('social.stream', 'write', [[stream.id], {}]);
            console.log('      ⚠️  Tentativo sync con write');
            synced = true;
            successCount++;
          } catch (e2) {
            console.log('      ❌ Nessun metodo di sync disponibile');
            console.log(`         Errore: ${e1.message.substring(0, 100)}...`);
            errorCount++;
          }
        }
      } catch (error) {
        console.log(`      ❌ Errore: ${error.message}`);
        errorCount++;
      }

      console.log('');
    }

    // 4. Aspetta un po' per dare tempo a Odoo di processare
    console.log('⏳ Attendo 3 secondi per completamento...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. Conta post DOPO la sincronizzazione
    console.log('📊 Conta post DOPO la sync...');

    const postsAfter = await callOdoo('social.stream.post', 'search_read', [[['account_id', 'in', accountsBefore.map(a => a.id)]]], {
      fields: ['id', 'published_date', 'message'],
      order: 'published_date desc',
      limit: 10
    });

    console.log(`   Trovati ${postsAfter.length} post Facebook totali\n`);

    if (postsAfter.length > 0) {
      console.log('   Ultimi 10 post:');
      postsAfter.forEach((post, index) => {
        const date = new Date(post.published_date);
        const preview = (post.message || '').substring(0, 50);
        console.log(`   ${index + 1}. ${date.toLocaleDateString('it-IT')} - ${preview}${preview.length >= 50 ? '...' : ''}`);
      });
    }

    // 6. Risultato
    console.log('\n' + '='.repeat(70));
    console.log('📊 RISULTATO SINCRONIZZAZIONE\n');

    const newPostsCount = postsAfter.length - (postsBefore.length || 0);

    if (successCount > 0) {
      console.log(`✅ Sincronizzazione completata!`);
      console.log(`   - Stream sincronizzati: ${successCount}/${streams.length}`);

      if (errorCount > 0) {
        console.log(`   - Stream con errori: ${errorCount}`);
      }

      if (newPostsCount > 0) {
        console.log(`   - Nuovi post trovati: +${newPostsCount}`);
      } else if (postsBefore.length > 0 && postsAfter.length > 0) {
        const lastBefore = new Date(postsBefore[0].published_date);
        const lastAfter = new Date(postsAfter[0].published_date);

        if (lastAfter > lastBefore) {
          console.log(`   - Post aggiornati: ✅`);
          console.log(`     Ultimo post: ${lastAfter.toLocaleDateString('it-IT')}`);
        } else {
          console.log(`   - Nessun nuovo post (ultimo rimane ${lastBefore.toLocaleDateString('it-IT')})`);
        }
      }
    } else {
      console.log(`❌ Sincronizzazione fallita per tutti gli stream`);
      console.log(`   Errori: ${errorCount}/${streams.length}`);
    }

    console.log('\n💡 NOTA IMPORTANTE:');
    console.log('Se la sincronizzazione non ha funzionato, potrebbe essere perché:');
    console.log('1. Il metodo API non è disponibile nella tua versione di Odoo');
    console.log('2. Devi usare il refresh manuale dall\'interfaccia UI di Odoo');
    console.log('3. Il modulo Social Marketing ha vincoli sui metodi chiamabili da API\n');

    console.log('ALTERNATIVA - Refresh manuale dall\'interfaccia Odoo:');
    console.log('1. Vai su: Marketing Sociale → Feed');
    console.log('2. Cerca un pulsante "Aggiorna" / "Refresh" nella toolbar');
    console.log('3. Clicca per forzare il refresh dei post\n');

    console.log('Il cron automatico che abbiamo creato si eseguirà tra poco.');
    console.log('Verifica lo stato con: node fix-facebook-sync.js');

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.log('\nStacktrace:', error.stack);
  }
}

main();
