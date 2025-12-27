/**
 * Script per aggiungere le etichette alle aliquote IVA intracomunitarie
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// ID delle aliquote da aggiornare (create precedentemente)
const TAXES_TO_UPDATE = [
  {
    id: 527,
    name: 'IVA 0% Cessioni Intra UE - Art. 41',
    invoice_label: 'Intra UE Art.41'
  },
  {
    id: 528,
    name: 'IVA 0% Servizi Intra UE - Art. 196',
    invoice_label: 'Intra UE Art.196'
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

async function main() {
  try {
    const cookies = await authenticate();

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🏷️  AGGIORNAMENTO ETICHETTE ALIQUOTE INTRA UE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    for (const tax of TAXES_TO_UPDATE) {
      console.log(`📝 Aggiornamento: ${tax.name}`);
      console.log(`   Nuova etichetta: "${tax.invoice_label}"`);

      await callOdoo(cookies, 'account.tax', 'write', [[tax.id], {
        invoice_label: tax.invoice_label
      }]);

      console.log(`   ✅ Aggiornata!\n`);
    }

    // Verifica finale
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('🔍 VERIFICA FINALE');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    const taxIds = TAXES_TO_UPDATE.map(t => t.id);
    const taxes = await callOdoo(cookies, 'account.tax', 'read', [taxIds], {
      fields: ['id', 'name', 'description', 'invoice_label', 'l10n_it_exempt_reason']
    });

    taxes.forEach((tax: any) => {
      console.log(`📋 ${tax.name}`);
      console.log(`   Descrizione: ${tax.description}`);
      console.log(`   Etichetta fattura: ${tax.invoice_label || 'N/A'}`);
      console.log(`   Codice esenzione: ${tax.l10n_it_exempt_reason}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('✅ ETICHETTE AGGIORNATE CON SUCCESSO!');
    console.log('═══════════════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ ERRORE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
