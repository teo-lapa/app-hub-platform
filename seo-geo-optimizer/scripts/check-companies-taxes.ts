/**
 * Script per verificare le aziende e le aliquote associate
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

    // 1. Lista tutte le aziende
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🏢 AZIENDE NEL SISTEMA');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const companies = await callOdoo(cookies, 'res.company', 'search_read', [[]], {
      fields: ['id', 'name', 'country_id', 'vat', 'currency_id'],
      limit: 20
    });

    companies.forEach((c: any) => {
      console.log(`📋 ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Paese: ${c.country_id ? c.country_id[1] : 'N/A'}`);
      console.log(`   VAT: ${c.vat || 'N/A'}`);
      console.log(`   Valuta: ${c.currency_id ? c.currency_id[1] : 'N/A'}`);
      console.log('');
    });

    // 2. Verifica le aliquote appena create e la loro azienda
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 ALIQUOTE INTRA UE CREATE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const intraEuTaxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
      ['name', 'ilike', 'Intra UE']
    ]], {
      fields: ['id', 'name', 'company_id', 'description', 'amount'],
      limit: 20
    });

    if (intraEuTaxes.length === 0) {
      console.log('⚠️  Nessuna aliquota "Intra UE" trovata');
    } else {
      intraEuTaxes.forEach((t: any) => {
        console.log(`📋 ${t.name}`);
        console.log(`   ID: ${t.id}`);
        console.log(`   Azienda: ${t.company_id ? t.company_id[1] : 'N/A'} (ID: ${t.company_id ? t.company_id[0] : 'N/A'})`);
        console.log(`   Descrizione: ${t.description || 'N/A'}`);
        console.log('');
      });
    }

    // 3. Mostra tutte le aliquote per azienda
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 ALIQUOTE 0% PER AZIENDA');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const company of companies) {
      console.log(`\n🏢 ${company.name} (ID: ${company.id}):`);

      const taxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
        ['company_id', '=', company.id],
        ['amount', '=', 0],
        ['type_tax_use', '=', 'sale']
      ]], {
        fields: ['id', 'name', 'description'],
        limit: 20
      });

      if (taxes.length === 0) {
        console.log('   Nessuna aliquota 0% vendita');
      } else {
        taxes.forEach((t: any) => {
          console.log(`   • ${t.name} (ID: ${t.id})`);
          if (t.description) {
            console.log(`     "${t.description}"`);
          }
        });
      }
    }

    console.log('\n');

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
