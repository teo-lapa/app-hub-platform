/**
 * Script per creare aliquote IVA intracomunitarie per ItaEmpire S.r.l.
 *
 * Crea due aliquote per operazioni B2B Italia -> UE:
 * 1. Art. 41 DL 331/93 - Cessioni intracomunitarie di beni
 * 2. Art. 196 Direttiva 2006/112/CE - Reverse charge servizi UE
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// ID dell'azienda ItaEmpire S.r.l.
const ITAEMPIRE_COMPANY_ID = 6;

// Aliquote da creare
// Codici esenzione italiani per FatturaPA:
// N3.2 = Non imponibili - cessioni intracomunitarie (Art. 41 DL 331/93)
// N6.9 = Inversione contabile - altri casi (reverse charge Art. 196)
const TAXES_TO_CREATE = [
  {
    name: 'IVA 0% Cessioni Intra UE - Art. 41',
    amount: 0,
    amount_type: 'percent',
    type_tax_use: 'sale',
    description: 'Operazione non imponibile art. 41 DL 331/93',
    company_id: ITAEMPIRE_COMPANY_ID,
    l10n_it_exempt_reason: 'N3.2',  // Non imponibili - cessioni intracomunitarie
    l10n_it_law_reference: 'Art. 41 DL 331/93',
    active: true
  },
  {
    name: 'IVA 0% Servizi Intra UE - Art. 196',
    amount: 0,
    amount_type: 'percent',
    type_tax_use: 'sale',
    description: 'IVA assolta dal committente - Art. 196 Dir. 2006/112/CE',
    company_id: ITAEMPIRE_COMPANY_ID,
    l10n_it_exempt_reason: 'N6.9',  // Inversione contabile - altri casi (reverse charge)
    l10n_it_law_reference: 'Art. 196 Dir. 2006/112/CE',
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

async function findTaxGroupForCompany(cookies: string, companyId: number): Promise<number | null> {
  console.log('🔍 Ricerca gruppo fiscale italiano per ItaEmpire...');

  // ID Italia = 109 (verificato)
  const ITALY_COUNTRY_ID = 109;

  // Cerca gruppi fiscali con paese Italia
  const groups = await callOdoo(cookies, 'account.tax.group', 'search_read', [[
    ['country_id', '=', ITALY_COUNTRY_ID]
  ]], {
    fields: ['id', 'name', 'country_id'],
    limit: 50
  });

  console.log(`\n📋 Gruppi fiscali italiani disponibili (${groups.length}):`);
  groups.forEach((g: any) => {
    console.log(`   • ${g.name} (ID: ${g.id})`);
  });

  // Cerca "Fuori Campo IVA" - usato per le aliquote 0% esistenti
  const fuoriCampoGroup = groups.find((g: any) =>
    g.name.toLowerCase().includes('fuori campo')
  );

  if (fuoriCampoGroup) {
    console.log(`\n✅ Gruppo trovato: ${fuoriCampoGroup.name} (ID: ${fuoriCampoGroup.id})\n`);
    return fuoriCampoGroup.id;
  }

  // Fallback: cerca "Imponibile Escluso Art.15"
  const esclusoGroup = groups.find((g: any) =>
    g.name.toLowerCase().includes('escluso') ||
    g.name.toLowerCase().includes('art.15')
  );

  if (esclusoGroup) {
    console.log(`\n✅ Gruppo trovato: ${esclusoGroup.name} (ID: ${esclusoGroup.id})\n`);
    return esclusoGroup.id;
  }

  console.log('\n⚠️  Nessun gruppo fiscale 0% trovato, userò "Fuori Campo IVA" (ID: 119)\n');
  return 119; // Fallback hardcoded
}

async function checkExistingTaxes(cookies: string, companyId: number): Promise<any[]> {
  console.log('🔍 Verifica aliquote esistenti per ItaEmpire...');

  const existingTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['company_id', '=', companyId],
    ['type_tax_use', '=', 'sale'],
    ['amount', '=', 0]
  ]], {
    fields: ['id', 'name', 'amount', 'description'],
    limit: 50
  });

  if (existingTaxes.length > 0) {
    console.log('\n📋 Aliquote 0% vendita esistenti per ItaEmpire:');
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

async function deleteTaxesFromWrongCompany(cookies: string): Promise<void> {
  console.log('🗑️  Eliminazione aliquote create erroneamente per LAPA GmbH...');

  // Trova le aliquote create per errore
  const wrongTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
    ['company_id', '=', 1], // LAPA GmbH
    ['name', 'ilike', 'Intra UE']
  ]], {
    fields: ['id', 'name'],
    limit: 10
  });

  if (wrongTaxes.length > 0) {
    console.log('   Aliquote da eliminare:');
    for (const tax of wrongTaxes) {
      console.log(`   • ${tax.name} (ID: ${tax.id})`);
      try {
        await callOdoo(cookies, 'account.tax', 'unlink', [[tax.id]]);
        console.log(`     ✅ Eliminata`);
      } catch (error: any) {
        console.log(`     ⚠️  Non eliminata: ${error.message}`);
      }
    }
  } else {
    console.log('   Nessuna aliquota da eliminare');
  }
  console.log('');
}

async function verifyTaxes(cookies: string, taxIds: number[]): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FINALE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const taxes = await callOdoo(cookies, 'account.tax', 'read', [taxIds], {
    fields: [
      'id', 'name', 'amount', 'amount_type', 'type_tax_use', 'description',
      'tax_group_id', 'company_id', 'active',
      'l10n_it_exempt_reason', 'l10n_it_law_reference'
    ]
  });

  taxes.forEach((tax: any) => {
    console.log(`📋 ${tax.name}`);
    console.log(`   ID: ${tax.id}`);
    console.log(`   Azienda: ${tax.company_id ? tax.company_id[1] : 'N/A'}`);
    console.log(`   Aliquota: ${tax.amount}%`);
    console.log(`   Tipo: ${tax.type_tax_use}`);
    console.log(`   Descrizione fattura: "${tax.description}"`);
    console.log(`   Codice esenzione: ${tax.l10n_it_exempt_reason || 'N/A'}`);
    console.log(`   Riferimento legge: ${tax.l10n_it_law_reference || 'N/A'}`);
    console.log(`   Gruppo fiscale: ${tax.tax_group_id ? tax.tax_group_id[1] : 'N/A'}`);
    console.log(`   Attiva: ${tax.active ? 'Sì' : 'No'}`);
    console.log('');
  });
}

async function main() {
  try {
    const cookies = await authenticate();

    // 0. Elimina aliquote create per errore
    await deleteTaxesFromWrongCompany(cookies);

    // 1. Trova gruppo fiscale per ItaEmpire
    const taxGroupId = await findTaxGroupForCompany(cookies, ITAEMPIRE_COMPANY_ID);

    // 2. Verifica aliquote esistenti
    const existingTaxes = await checkExistingTaxes(cookies, ITAEMPIRE_COMPANY_ID);

    // 3. Crea le nuove aliquote
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('🔄 CREAZIONE ALIQUOTE INTRACOMUNITARIE PER ITAEMPIRE S.R.L.');
    console.log('═══════════════════════════════════════════════════════════════════');

    const createdTaxIds: number[] = [];

    for (const taxData of TAXES_TO_CREATE) {
      // Verifica se esiste già
      const exists = existingTaxes.find((t: any) =>
        t.name === taxData.name ||
        (t.name.includes('Art. 41') && taxData.name.includes('Art. 41')) ||
        (t.name.includes('Art. 196') && taxData.name.includes('Art. 196'))
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
    console.log('✅ ALIQUOTE IVA INTRACOMUNITARIE CREATE PER ITAEMPIRE S.R.L.!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log('📌 PROSSIMI PASSI:');
    console.log('   1. Vai in Odoo → Contabilità → Configurazione → Imposte');
    console.log('   2. Assicurati di essere loggato come ItaEmpire S.r.l.');
    console.log('   3. Verifica le nuove aliquote "IVA 0% Intra UE"');
    console.log('   4. Assegna le aliquote ai prodotti/clienti UE con VAT valido (VIES)');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
