const xmlrpc = require('xmlrpc');

const config = {
  url: 'https://erp.lapa.ch',
  db: 'lapa',
  username: 'paul@lapa.ch',
  password: 'Lapa1957!'
};

const common = xmlrpc.createSecureClient({ host: 'erp.lapa.ch', port: 443, path: '/xmlrpc/2/common' });
const models = xmlrpc.createSecureClient({ host: 'erp.lapa.ch', port: 443, path: '/xmlrpc/2/object' });

async function authenticate() {
  return new Promise((resolve, reject) => {
    common.methodCall('authenticate', [config.db, config.username, config.password, {}], (err, uid) => {
      if (err) reject(err);
      else resolve(uid);
    });
  });
}

async function searchRead(model, domain, fields) {
  const uid = await authenticate();
  return new Promise((resolve, reject) => {
    models.methodCall('execute_kw', [
      config.db, uid, config.password,
      model, 'search_read',
      [domain],
      { fields, limit: 100 }
    ], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function main() {
  try {
    console.log('\n🔍 Cercando partner con "linde" nel nome...\n');

    const partners = await searchRead(
      'res.partner',
      [['name', 'ilike', 'linde']],
      ['id', 'name', 'is_company', 'type', 'parent_id', 'active', 'customer_rank']
    );

    console.log(`Trovati ${partners.length} partner:\n`);

    partners.forEach(p => {
      console.log(`ID: ${p.id}`);
      console.log(`Nome: ${p.name}`);
      console.log(`is_company: ${p.is_company}`);
      console.log(`type: ${p.type}`);
      console.log(`parent_id: ${p.parent_id ? p.parent_id[1] : 'null'}`);
      console.log(`active: ${p.active}`);
      console.log(`customer_rank: ${p.customer_rank}`);
      console.log('---');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
