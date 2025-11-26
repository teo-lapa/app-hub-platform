// Script di test per investigare i journal Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

let uid = null;
let sessionId = null;
let cookies = null;

async function authenticate() {
  console.log('🔐 Autenticazione a Odoo...');

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
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.result && data.result.uid) {
    uid = data.result.uid;
    sessionId = data.result.session_id;
    console.log(`✅ Autenticato! UID: ${uid}, Session ID: ${sessionId}`);
    return true;
  }

  throw new Error('Autenticazione fallita: ' + JSON.stringify(data));
}

async function searchRead(model, domain, fields, limit = 100) {
  const headers = {
    'Content-Type': 'application/json'
  };

  // Usa i cookie completi se disponibili, altrimenti usa session_id
  if (cookies) {
    headers['Cookie'] = cookies;
  } else if (sessionId) {
    headers['Cookie'] = `session_id=${sessionId}`;
  }

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: 'search_read',
        args: [],
        kwargs: {
          domain: domain,
          fields: fields,
          limit: limit,
          offset: 0
        }
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('❌ Errore searchRead:', data.error);
    throw new Error(data.error.message || 'Search failed');
  }

  return data.result || [];
}

async function main() {
  try {
    // 1. Autentica
    await authenticate();

    console.log('\n📊 Test 1: Carica TUTTI i journal (senza filtri)');
    const allJournals = await searchRead(
      'account.journal',
      [],
      ['id', 'name', 'code', 'type', 'currency_id', 'bank_account_id']
    );

    console.log(`✅ Trovati ${allJournals.length} journal totali`);

    // Raggruppa per tipo
    const byType = {};
    allJournals.forEach(j => {
      if (!byType[j.type]) byType[j.type] = [];
      byType[j.type].push(j);
    });

    console.log('\n📋 Journal per tipo:');
    Object.keys(byType).forEach(type => {
      console.log(`  ${type}: ${byType[type].length} journal`);
      byType[type].forEach(j => {
        console.log(`    - [${j.id}] ${j.name} (${j.code})`);
      });
    });

    console.log('\n📊 Test 2: Filtro solo type=bank');
    const bankOnly = await searchRead(
      'account.journal',
      [['type', '=', 'bank']],
      ['id', 'name', 'code', 'type', 'currency_id', 'bank_account_id']
    );
    console.log(`✅ Trovati ${bankOnly.length} journal di tipo 'bank':`);
    bankOnly.forEach(j => {
      console.log(`  - [${j.id}] ${j.name} (${j.code})`);
    });

    console.log('\n📊 Test 3: Filtro type=bank OR type=cash');
    const bankOrCash = await searchRead(
      'account.journal',
      ['|', ['type', '=', 'bank'], ['type', '=', 'cash']],
      ['id', 'name', 'code', 'type', 'currency_id', 'bank_account_id']
    );
    console.log(`✅ Trovati ${bankOrCash.length} journal di tipo 'bank' o 'cash':`);
    bankOrCash.forEach(j => {
      console.log(`  - [${j.id}] ${j.name} (${j.code}) - tipo: ${j.type}`);
    });

    console.log('\n📊 Test 4: Recupera IBAN per i journal bancari');
    const journalsWithBankAccount = bankOrCash.filter(j => j.bank_account_id && j.bank_account_id.length > 0);
    console.log(`✅ ${journalsWithBankAccount.length} journal hanno bank_account_id`);

    if (journalsWithBankAccount.length > 0) {
      const bankAccountIds = journalsWithBankAccount.map(j => j.bank_account_id[0]);
      console.log(`📞 Carico IBAN per bank_account_id: ${bankAccountIds.join(', ')}`);

      const bankAccounts = await searchRead(
        'res.partner.bank',
        [['id', 'in', bankAccountIds]],
        ['id', 'acc_number', 'sanitized_acc_number']
      );

      console.log(`✅ Trovati ${bankAccounts.length} account bancari:`);
      bankAccounts.forEach(ba => {
        console.log(`  - [${ba.id}] IBAN: ${ba.sanitized_acc_number || ba.acc_number}`);
      });

      // Mappa journal -> IBAN
      console.log('\n📋 Journal completi con IBAN:');
      const ibanMap = new Map(bankAccounts.map(ba => [ba.id, ba.sanitized_acc_number || ba.acc_number]));

      journalsWithBankAccount.forEach(j => {
        const iban = ibanMap.get(j.bank_account_id[0]);
        const currency = Array.isArray(j.currency_id) ? j.currency_id[1].split(' ')[0] : 'N/A';
        console.log(`  - [${j.id}] ${j.name} (${j.code})`);
        console.log(`    Tipo: ${j.type}, Valuta: ${currency}, IBAN: ${iban || 'N/A'}`);
      });
    }

    console.log('\n✅ Test completato!');

  } catch (error) {
    console.error('❌ Errore durante il test:', error);
    console.error(error.stack);
  }
}

main();
