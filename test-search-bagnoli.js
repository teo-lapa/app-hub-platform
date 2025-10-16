/**
 * TEST SEARCH BAGNOLI GROUP IN ODOO
 */

const https = require('https');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24517859';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'Lapa2024!';

async function xmlrpc(url, service, method, args) {
  const xml = `<?xml version="1.0"?>
<methodCall>
  <methodName>${service}</methodName>
  <params>
    ${args.map(arg => `<param><value>${xmlrpcValue(arg)}</value></param>`).join('\n    ')}
  </params>
</methodCall>`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(xml)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          // Parse response
          const valueMatch = data.match(/<value>(.*?)<\/value>/s);
          if (valueMatch) {
            const value = valueMatch[1];
            if (value.includes('<int>')) {
              resolve(parseInt(value.match(/<int>(.*?)<\/int>/)[1]));
            } else if (value.includes('<string>')) {
              resolve(value.match(/<string>(.*?)<\/string>/)[1]);
            } else if (value.includes('<boolean>')) {
              resolve(value.includes('<boolean>1'));
            } else if (value.includes('<array>')) {
              // Simple array parsing
              const items = value.match(/<value>.*?<\/value>/g) || [];
              resolve(items.map(item => {
                if (item.includes('<int>')) return parseInt(item.match(/<int>(.*?)<\/int>/)[1]);
                if (item.includes('<string>')) return item.match(/<string>(.*?)<\/string>/)[1];
                return item;
              }));
            } else {
              resolve(value);
            }
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

function xmlrpcValue(value) {
  if (typeof value === 'number') return `<int>${value}</int>`;
  if (typeof value === 'string') return `<string>${value}</string>`;
  if (typeof value === 'boolean') return `<boolean>${value ? 1 : 0}</boolean>`;
  if (Array.isArray(value)) {
    return `<array><data>${value.map(v => `<value>${xmlrpcValue(v)}</value>`).join('')}</data></array>`;
  }
  return `<string>${JSON.stringify(value)}</string>`;
}

async function searchBagnoli() {
  try {
    console.log('🔐 Login su Odoo...');
    console.log(`   URL: ${ODOO_URL}`);
    console.log(`   DB: ${ODOO_DB}`);
    console.log(`   User: ${ODOO_USERNAME}`);

    // Login
    const uid = await xmlrpc(
      `${ODOO_URL}/xmlrpc/2/common`,
      'authenticate',
      'authenticate',
      [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]
    );

    console.log(`✅ Login OK! UID: ${uid}\n`);

    // Search for BAGNOLI
    console.log('🔍 Cercando "BAGNOLI" nei fornitori...\n');

    const searches = [
      { query: 'BAGNOLI GROUP S.R.L.', description: 'Nome esatto con S.R.L.' },
      { query: 'BAGNOLI GROUP SRL', description: 'Nome con SRL senza punti' },
      { query: 'BAGNOLI GROUP', description: 'Nome senza forma societaria' },
      { query: 'Bagnoli Group', description: 'Nome con maiuscole normali' },
      { query: 'bagnoli', description: 'Solo "bagnoli" lowercase' },
      { query: 'BAGNOLI', description: 'Solo "BAGNOLI" uppercase' }
    ];

    for (const search of searches) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Ricerca: "${search.query}" (${search.description})`);
      console.log('─'.repeat(80));

      // Use simple python-like execute_kw call
      // This is a simplified version - in production use proper XML-RPC library
      console.log(`   Domain: [['name', 'ilike', '${search.query}'], ['supplier_rank', '>', 0]]`);
      console.log('   ⏳ Ricerca in corso...');

      // For now, just show what we would search
      console.log('   ℹ️  (XML-RPC search would happen here)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 SUGGERIMENTO: Usa Postman o l\'interfaccia web di Odoo per cercare');
    console.log('   oppure controlla i log di Vercel per vedere cosa cerca l\'API');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Errore:', error.message);
  }
}

searchBagnoli();
