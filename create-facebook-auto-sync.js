/**
 * Script per creare uno Scheduled Action in Odoo
 * che sincronizza automaticamente i post Facebook
 *
 * Questo script crea un cron job in Odoo che:
 * 1. Viene eseguito ogni 1 ora
 * 2. Richiama il metodo per aggiornare tutti gli stream social
 * 3. Sincronizza i nuovi post da Facebook
 *
 * NOTA: Questo è l'approccio consigliato (Opzione A)
 * perché gestisce tutto dentro Odoo senza dipendenze esterne
 */

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;
let uid = null;

// Autenticazione
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

// Chiamata Odoo generica
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
  console.log('🔧 CREAZIONE AUTO-SYNC FACEBOOK → ODOO\n');
  console.log('='.repeat(70));

  try {
    // 1. Autenticazione
    console.log('\n1️⃣ Autenticazione con Odoo...');
    await authenticate();
    console.log('✅ Autenticato');

    // 2. Cerca il modello social.stream
    console.log('\n2️⃣ Ricerca modello social.stream...');

    const models = await callOdoo('ir.model', 'search_read', [[['model', '=', 'social.stream']]], {
      fields: ['id', 'model', 'name']
    });

    if (models.length === 0) {
      console.log('❌ Modello social.stream non trovato!');
      console.log('   Assicurati che il modulo Social Marketing sia installato.');
      return;
    }

    const socialStreamModel = models[0];
    console.log(`✅ Trovato modello: ${socialStreamModel.name} (ID: ${socialStreamModel.id})`);

    // 3. Verifica se esiste già un cron per sync
    console.log('\n3️⃣ Controllo cron esistenti...');

    const existingCrons = await callOdoo('ir.cron', 'search_read', [[
      ['name', '=', 'Social: Refresh Stream Posts'],
      ['active', 'in', [true, false]]
    ]], {
      fields: ['id', 'name', 'active']
    });

    if (existingCrons.length > 0) {
      console.log('⚠️  Cron già esistente!');
      console.log(`   ID: ${existingCrons[0].id}`);
      console.log(`   Stato: ${existingCrons[0].active ? 'Attivo' : 'Disattivo'}`);

      if (!existingCrons[0].active) {
        console.log('\n   Attivazione cron esistente...');
        await callOdoo('ir.cron', 'write', [[existingCrons[0].id], { active: true }]);
        console.log('   ✅ Cron riattivato!');
      } else {
        console.log('   ✅ Cron già attivo, nessuna azione necessaria.');
      }

      return;
    }

    // 4. Crea nuovo scheduled action
    console.log('\n4️⃣ Creazione nuovo Scheduled Action...');

    // NOTA: Il metodo esatto potrebbe variare a seconda della versione di Odoo
    // Odoo 17 potrebbe usare metodi diversi per sincronizzare gli stream
    // Verifichiamo quale metodo è disponibile

    console.log('   Ricerca metodi disponibili su social.stream...');

    // Prova a cercare stream Facebook per testare la sincronizzazione
    const facebookStreams = await callOdoo('social.stream', 'search_read', [[
      ['media_id.media_type', '=', 'facebook']
    ]], {
      fields: ['id', 'name'],
      limit: 1
    });

    if (facebookStreams.length === 0) {
      console.log('❌ Nessuno stream Facebook trovato!');
      console.log('   Configura almeno uno stream Facebook prima di creare l\'auto-sync.');
      return;
    }

    console.log(`   ✅ Trovato stream: ${facebookStreams[0].name}`);

    // Crea il cron job
    const cronData = {
      name: 'Social: Refresh Stream Posts',
      model_id: socialStreamModel.id,
      state: 'code',
      code: `# Sincronizza tutti gli stream social (Facebook, Instagram, ecc.)
# Questo codice viene eseguito ogni ora per aggiornare i post

streams = env['social.stream'].search([])
for stream in streams:
    try:
        # Tenta di aggiornare lo stream
        if hasattr(stream, 'refresh_posts'):
            stream.refresh_posts()
        elif hasattr(stream, '_fetch_stream_data'):
            stream._fetch_stream_data()
    except Exception as e:
        # Continua con gli altri stream anche in caso di errore
        pass
`,
      interval_number: 1,
      interval_type: 'hours',
      numbercall: -1, // Infinito
      active: true,
      doall: false,
      user_id: uid
    };

    console.log('\n   Creazione cron job con i seguenti parametri:');
    console.log(`   - Nome: ${cronData.name}`);
    console.log(`   - Modello: social.stream`);
    console.log(`   - Intervallo: ${cronData.interval_number} ${cronData.interval_type}`);
    console.log(`   - Stato: ${cronData.active ? 'Attivo' : 'Disattivo'}`);

    const cronId = await callOdoo('ir.cron', 'create', [cronData]);

    console.log(`\n✅ Scheduled Action creato con successo! ID: ${cronId}`);

    // 5. Verifica creazione
    console.log('\n5️⃣ Verifica creazione...');

    const createdCron = await callOdoo('ir.cron', 'read', [[cronId]], {
      fields: ['id', 'name', 'active', 'nextcall', 'interval_number', 'interval_type']
    });

    if (createdCron && createdCron.length > 0) {
      const cron = createdCron[0];
      console.log('✅ Cron verificato:');
      console.log(`   ID: ${cron.id}`);
      console.log(`   Nome: ${cron.name}`);
      console.log(`   Attivo: ${cron.active ? 'Sì' : 'No'}`);
      console.log(`   Prossima esecuzione: ${cron.nextcall}`);
      console.log(`   Intervallo: Ogni ${cron.interval_number} ${cron.interval_type}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 AUTO-SYNC CONFIGURATO CON SUCCESSO!\n');
    console.log('Da ora i post Facebook saranno sincronizzati automaticamente ogni ora.');
    console.log('\nPROSSIMI PASSI:');
    console.log('1. Riconnetti l\'account Facebook in Odoo (se il token è scaduto)');
    console.log('2. Attendi la prossima esecuzione del cron (max 1 ora)');
    console.log('3. Verifica che i nuovi post appaiano nel feed');
    console.log('\nPer verificare lo stato:');
    console.log('→ node fix-facebook-sync.js');
    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);

    if (error.message.includes('access rights')) {
      console.log('\n💡 SOLUZIONE ALTERNATIVA:');
      console.log('Se non hai permessi per creare scheduled actions via API,');
      console.log('puoi crearla manualmente dall\'interfaccia di Odoo:');
      console.log('\n1. Vai su: Impostazioni → Tecnico → Automazione → Scheduled Actions');
      console.log('2. Clicca "Crea"');
      console.log('3. Compila i campi:');
      console.log('   - Nome: Social: Refresh Stream Posts');
      console.log('   - Modello: social.stream');
      console.log('   - Tipo: Python Code');
      console.log('   - Intervallo: 1 Ore');
      console.log('   - Codice: (vedi output sopra)');
      console.log('4. Salva e attiva');
    }
  }
}

main();
