/**
 * Script per trovare i gruppi fiscali italiani
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || process.env.ODOO_ADMIN_PASSWORD || '');

async function authenticate(): Promise<string> {
  console.log('ðŸ” Autenticazione con Odoo...');

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

  console.log('âœ… Autenticazione riuscita!\n');
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

    // Trova il country_id dell'Italia
    console.log('ðŸ” Ricerca ID paese Italia...');
    const italy = await callOdoo(cookies, 'res.country', 'search_read', [[
      ['code', '=', 'IT']
    ]], {
      fields: ['id', 'name', 'code'],
      limit: 1
    });

    if (italy.length === 0) {
      throw new Error('Italia non trovata!');
    }

    const italyId = italy[0].id;
    console.log(`âœ… Italia trovata: ID ${italyId}\n`);

    // Cerca tutti i gruppi fiscali
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸ“‹ TUTTI I GRUPPI FISCALI');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

    const allGroups = await callOdoo(cookies, 'account.tax.group', 'search_read', [[]], {
      fields: ['id', 'name', 'country_id'],
      limit: 100
    });

    // Filtra per Italia
    const italianGroups = allGroups.filter((g: any) => g.country_id && g.country_id[0] === italyId);
    const swissGroups = allGroups.filter((g: any) => g.country_id && g.country_id[1]?.includes('Switzerland'));
    const noCountryGroups = allGroups.filter((g: any) => !g.country_id);

    console.log('ðŸ‡®ðŸ‡¹ GRUPPI ITALIANI:');
    if (italianGroups.length === 0) {
      console.log('   Nessuno trovato');
    } else {
      italianGroups.forEach((g: any) => {
        console.log(`   â€¢ ${g.name} (ID: ${g.id})`);
      });
    }

    console.log('\nðŸ‡¨ðŸ‡­ GRUPPI SVIZZERI:');
    swissGroups.forEach((g: any) => {
      console.log(`   â€¢ ${g.name} (ID: ${g.id})`);
    });

    console.log('\nðŸŒ GRUPPI SENZA PAESE:');
    noCountryGroups.forEach((g: any) => {
      console.log(`   â€¢ ${g.name} (ID: ${g.id})`);
    });

    // Verifica le aliquote esistenti per ItaEmpire e i loro gruppi
    console.log('\n\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸ“‹ ALIQUOTE ESISTENTI PER ITAEMPIRE E I LORO GRUPPI');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

    const taxes = await callOdoo(cookies, 'account.tax', 'search_read', [[
      ['company_id', '=', 6]
    ]], {
      fields: ['id', 'name', 'tax_group_id', 'amount'],
      limit: 20
    });

    taxes.forEach((t: any) => {
      console.log(`   â€¢ ${t.name} (${t.amount}%) â†’ Gruppo: ${t.tax_group_id ? `${t.tax_group_id[1]} (ID: ${t.tax_group_id[0]})` : 'N/A'}`);
    });

  } catch (error: any) {
    console.error('\nâŒ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
