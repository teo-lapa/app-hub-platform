/**
 * Direct test of XML-RPC client to debug parsing issues
 */

const https = require('https');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

function buildXMLRPC(methodName, params) {
  const paramsXML = params.map(p => valueToXML(p)).join('');
  return `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXML}
  </params>
</methodCall>`;
}

function valueToXML(value) {
  if (value === null || value === undefined) {
    return '<param><value><boolean>0</boolean></value></param>';
  }
  if (typeof value === 'boolean') {
    return `<param><value><boolean>${value ? '1' : '0'}</boolean></value></param>`;
  }
  if (typeof value === 'number') {
    return `<param><value><int>${value}</int></value></param>`;
  }
  if (typeof value === 'string') {
    return `<param><value><string>${escapeXML(value)}</string></value></param>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<param><value><array><data>${arrayData}</data></array></value></param>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<param><value><struct>${members}</struct></value></param>`;
  }
  return '<param><value><string></string></value></param>';
}

function valueToXMLData(value) {
  if (value === null || value === undefined) {
    return '<value><boolean>0</boolean></value>';
  }
  if (typeof value === 'boolean') {
    return `<value><boolean>${value ? '1' : '0'}</boolean></value>`;
  }
  if (typeof value === 'number') {
    return `<value><int>${value}</int></value>`;
  }
  if (typeof value === 'string') {
    return `<value><string>${escapeXML(value)}</string></value>`;
  }
  if (Array.isArray(value)) {
    const arrayData = value.map(v => valueToXMLData(v)).join('');
    return `<value><array><data>${arrayData}</data></array></value>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value)
      .map(([k, v]) => `<member><name>${k}</name>${valueToXMLData(v)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return '<value><string></string></value>';
}

function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function testXMLRPC() {
  console.log('=== Testing XML-RPC Client ===\n');

  // Step 1: Authenticate
  console.log('[1/3] Authenticating...');
  const authBody = buildXMLRPC('authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]);

  const authResponse = await fetch(`${ODOO_URL}/xmlrpc/2/common`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: authBody
  });

  const authXML = await authResponse.text();
  console.log('Auth XML response:', authXML.substring(0, 200));

  const uidMatch = authXML.match(/<int>(\d+)<\/int>/);
  const uid = parseInt(uidMatch[1], 10);
  console.log('✓ UID:', uid, '\n');

  // Step 2: Create partner
  console.log('[2/3] Creating test partner...');
  const partnerData = {
    name: 'Test Direct XML-RPC',
    type: 'contact'
  };

  const createBody = buildXMLRPC('execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'res.partner',
    'create',
    [[partnerData]],
    {}
  ]);

  const createResponse = await fetch(`${ODOO_URL}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: createBody
  });

  const createXML = await createResponse.text();
  console.log('Create XML response:', createXML);

  const partnerIdMatch = createXML.match(/<int>(\d+)<\/int>/);
  const partnerId = partnerIdMatch ? parseInt(partnerIdMatch[1], 10) : null;
  console.log('✓ Partner ID:', partnerId, typeof partnerId, '\n');

  // Step 3: Search_read partner
  console.log('[3/3] Reading partner back...');
  const searchBody = buildXMLRPC('execute_kw', [
    ODOO_DB,
    uid,
    ODOO_PASSWORD,
    'res.partner',
    'search_read',
    [[['id', '=', partnerId]]],
    { fields: ['id', 'name', 'display_name'], limit: 1 }
  ]);

  const searchResponse = await fetch(`${ODOO_URL}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: searchBody
  });

  const searchXML = await searchResponse.text();
  console.log('Search XML response (first 2000 chars):');
  console.log(searchXML.substring(0, 2000));
  console.log('\n✓ Test complete!');
}

testXMLRPC().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
