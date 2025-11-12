/**
 * Script per cercare il prodotto NEOFORT RAPIDO su Odoo
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

async function authenticate() {
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

  console.log('✅ Autenticazione riuscita!');
  return `session_id=${sessionMatch[1]}`;
}

async function searchProduct(cookies, searchTerm) {
  console.log(`🔍 Ricerca prodotto: "${searchTerm}"`);

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
        model: 'product.product',
        method: 'search_read',
        args: [[
          '|', '|',
          ['name', 'ilike', searchTerm],
          ['default_code', 'ilike', searchTerm],
          ['barcode', 'ilike', searchTerm]
        ]],
        kwargs: {
          fields: [
            'id',
            'name',
            'default_code',
            'barcode',
            'list_price',
            'standard_price',
            'qty_available',
            'virtual_available',
            'categ_id',
            'uom_id',
            'description',
            'description_sale',
            'type',
            'active',
            'tracking'
          ],
          limit: 10
        }
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Errore ricerca: ' + JSON.stringify(data.error));
  }

  return data.result;
}

async function main() {
  try {
    const cookies = await authenticate();
    const products = await searchProduct(cookies, 'NEOFORT');

    console.log('\n📦 Prodotti trovati:', products.length);
    console.log('=' .repeat(80));

    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      console.log('   ID:', product.id);
      console.log('   Codice:', product.default_code || 'N/A');
      console.log('   Barcode:', product.barcode || 'N/A');
      console.log('   Prezzo vendita:', product.list_price, '€');
      console.log('   Costo:', product.standard_price, '€');
      console.log('   Giacenza:', product.qty_available);
      console.log('   Disponibilità virtuale:', product.virtual_available);
      console.log('   Categoria:', product.categ_id ? product.categ_id[1] : 'N/A');
      console.log('   Unità misura:', product.uom_id ? product.uom_id[1] : 'N/A');
      console.log('   Tipo:', product.type);
      console.log('   Attivo:', product.active ? 'Sì' : 'No');
      console.log('   Tracciamento:', product.tracking || 'none');

      if (product.description_sale) {
        console.log('   Descrizione vendita:');
        console.log('   ', product.description_sale.substring(0, 200));
      }

      console.log('-'.repeat(80));
    });

  } catch (error) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }
}

main();
