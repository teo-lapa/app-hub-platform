/**
 * Script per creare aliquote IVA intracomunitarie in Odoo
 *
 * Crea due aliquote per operazioni B2B Italia -> UE:
 * 1. Art. 41 DL 331/93 - Cessioni intracomunitarie di beni
 * 2. Art. 196 Direttiva 2006/112/CE - Reverse charge servizi UE
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Aliquote da creare
const TAXES_TO_CREATE = [
  {
    name: 'IVA 0% Cessioni Intra UE - Art. 41',
    amount: 0,
    amount_type: 'percent',
    type_tax_use: 'sale',
    description: 'Operazione non imponibile art. 41 DL 331/93',
    active: true
  },
  {
    name: 'IVA 0% Servizi Intra UE - Art. 196',
    amount: 0,
    amount_type: 'percent',
    type_tax_use: 'sale',
    description: 'IVA assolta dal committente - Art. 196 Dir. 2006/112/CE',
    active: true
  }
];

async function authenticate(): Promise<string> {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticazione riuscita!\n');
  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies: string, model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function findTaxGroup(cookies: string): Promise<number | null> {
  console.log('🔍 Ricerca gruppo fiscale "Non imponibile"...');

  // Cerca gruppi fiscali esistenti
  const groups = await callOdoo(cookies, 'account.tax.group', 'search_read', [[]], {
    fields: ['id', 'name'],
    limit: 50
  });

  console.log('\n📋 Gruppi fiscali disponibili:');
  groups.forEach((g: any) => {
    console.log(`   • ${g.name} (ID: ${g.id})`);
  });

  // Cerca gruppo "Non imponibile" o simile
  const nonImponibile = groups.find((g: any) =>
    g.name.toLowerCase().includes('non imponibile') ||
    g.name.toLowerCase().includes('esente') ||
    g.name.toLowerCase().includes('0%') ||
    g.name.toLowerCase().includes('fuori campo')
  );

  if (nonImponibile) {
    console.log(`\n✅ Gruppo trovato: ${nonImponibile.name} (ID: ${nonImponibile.id})\n`);
    return nonImponibile.id;
  }

  console.log('\n⚠️  Nessun gruppo "Non imponibile" trovato. Useremo il primo disponibile.\n');
  return groups.length > 0 ? groups[0].id : null;
}

async function checkExistingTaxes(cookies: string): Promise<any[]> {
  console.log('🔍 Verifica aliquote esistenti...');

  const existingTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['type_tax_use', '=', 'sale'],
    ['amount', '=', 0]
  ]], {
    fields: ['id', 'name', 'amount', 'description'],
    limit: 50
  });

  if (existingTaxes.length > 0) {
    console.log('\n📋 Aliquote 0% vendita esistenti:');
    existingTaxes.forEach((t: any) => {
      console.log(`   • ${t.name} - "${t.description || 'nessuna descrizione'}"`);
    });
    console.log('');
  }

  return existingTaxes;
}

async function createTax(cookies: string, taxData: any, taxGroupId: number | null): Promise<number> {
  console.log(`\n📝 Creazione aliquota: ${taxData.name}`);

  const values: any = {
    ...taxData
  };

  if (taxGroupId) {
    values.tax_group_id = taxGroupId;
  }

  const taxId = await callOdoo(cookies, 'account.tax', 'create', [values]);

  console.log(`   ✅ Creata con ID: ${taxId}`);
  return taxId;
}

async function verifyTaxes(cookies: string, taxIds: number[]): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FINALE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const taxes = await callOdoo(cookies, 'account.tax', 'read', [taxIds], {
    fields: ['id', 'name', 'amount', 'amount_type', 'type_tax_use', 'description', 'tax_group_id', 'active']
  });

  taxes.forEach((tax: any) => {
    console.log(`📋 ${tax.name}`);
    console.log(`   ID: ${tax.id}`);
    console.log(`   Aliquota: ${tax.amount}%`);
    console.log(`   Tipo: ${tax.type_tax_use}`);
    console.log(`   Descrizione fattura: "${tax.description}"`);
    console.log(`   Gruppo fiscale: ${tax.tax_group_id ? tax.tax_group_id[1] : 'N/A'}`);
    console.log(`   Attiva: ${tax.active ? 'Sì' : 'No'}`);
    console.log('');
  });
}

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Trova gruppo fiscale
    const taxGroupId = await findTaxGroup(cookies);

    // 2. Verifica aliquote esistenti
    const existingTaxes = await checkExistingTaxes(cookies);

    // 3. Crea le nuove aliquote
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🔄 CREAZIONE ALIQUOTE INTRACOMUNITARIE');
    console.log('═══════════════════════════════════════════════════════════════════');

    const createdTaxIds: number[] = [];

    for (const taxData of TAXES_TO_CREATE) {
      // Verifica se esiste già
      const exists = existingTaxes.find((t: any) =>
        t.name === taxData.name ||
        (t.description && t.description.includes(taxData.description.split(' ')[0]))
      );

      if (exists) {
        console.log(`\n⚠️  Aliquota "${taxData.name}" già esistente (ID: ${exists.id})`);
        createdTaxIds.push(exists.id);
      } else {
        const taxId = await createTax(cookies, taxData, taxGroupId);
        createdTaxIds.push(taxId);
      }
    }

    // 4. Verifica finale
    await verifyTaxes(cookies, createdTaxIds);

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ ALIQUOTE IVA INTRACOMUNITARIE CREATE CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📌 PROSSIMI PASSI:');
    console.log('   1. Vai in Odoo → Contabilità → Configurazione → Imposte');
    console.log('   2. Verifica le nuove aliquote "IVA 0% Intra UE"');
    console.log('   3. Assegna le aliquote ai prodotti/clienti UE con VAT valido (VIES)');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
