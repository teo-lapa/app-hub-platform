/**
 * Script per trovare i codici di esenzione IVA italiani disponibili in Odoo
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

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

async function main() {
  try {
    const cookies = await authenticate();

    // 1. Cerca i campi della tassa per vedere i campi italiani
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔍 RICERCA CAMPI account.tax');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const taxFields = await callOdoo(cookies, 'account.tax', 'fields_get', [[
      'l10n_it_exempt_reason',
      'l10n_it_law_reference',
      'l10n_it_kind_exoneration'
    ]], { attributes: ['string', 'type', 'selection'] });

    console.log('📋 Campi italiani disponibili:');
    for (const [fieldName, fieldInfo] of Object.entries(taxFields) as any) {
      console.log(`\n   ${fieldName}:`);
      console.log(`   • Etichetta: ${fieldInfo.string}`);
      console.log(`   • Tipo: ${fieldInfo.type}`);
      if (fieldInfo.selection) {
        console.log(`   • Valori disponibili:`);
        fieldInfo.selection.forEach((s: any) => {
          console.log(`     - ${s[0]}: ${s[1]}`);
        });
      }
    }

    // 2. Guarda come sono configurate le aliquote 0% esistenti per ItaEmpire
    console.log('\n\n═══════════════════════════════════════════════════════════════════');
    console.log('🔍 ALIQUOTE 0% ESISTENTI PER ITAEMPIRE (con campi italiani)');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const existingTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
      ['company_id', '=', 6], // ItaEmpire
      ['amount', '=', 0]
    ]], {
      fields: [
        'id', 'name', 'description',
        'l10n_it_exempt_reason', 'l10n_it_law_reference', 'l10n_it_kind_exoneration'
      ],
      limit: 20
    });

    existingTaxes.forEach((tax: any) => {
      console.log(`📋 ${tax.name} (ID: ${tax.id})`);
      console.log(`   Descrizione: ${tax.description || 'N/A'}`);
      console.log(`   Codice esenzione: ${tax.l10n_it_kind_exoneration || 'N/A'}`);
      console.log(`   Motivo esenzione: ${tax.l10n_it_exempt_reason || 'N/A'}`);
      console.log(`   Riferimento legge: ${tax.l10n_it_law_reference || 'N/A'}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
