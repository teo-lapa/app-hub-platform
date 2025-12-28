/**
 * Test using XML-RPC endpoint for update_field_translations
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let uid: number = 0;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/xmlrpc/2/common`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${ODOO_DB}</string></value></param>
    <param><value><string>${ODOO_USERNAME}</string></value></param>
    <param><value><string>${ODOO_PASSWORD}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`
  });

  const text = await response.text();
  const match = text.match(/<int>(\d+)<\/int>/);
  if (match) {
    uid = parseInt(match[1]);
    return uid;
  }
  throw new Error('Auth failed');
}

async function executeKw(model: string, method: string, args: any[]): Promise<string> {
  const argsXml = JSON.stringify(args);

  const response = await fetch(`${ODOO_URL}/xmlrpc/2/object`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: `<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>${ODOO_DB}</string></value></param>
    <param><value><int>${uid}</int></value></param>
    <param><value><string>${ODOO_PASSWORD}</string></value></param>
    <param><value><string>${model}</string></value></param>
    <param><value><string>${method}</string></value></param>
    <param><value><array><data>${argsXml}</data></array></value></param>
  </params>
</methodCall>`
  });

  return await response.text();
}

async function main() {
  console.log('🔐 Autenticazione XML-RPC...\n');
  await authenticate();
  console.log(`✅ UID: ${uid}\n`);

  const articlePath = join(__dirname, '../data/new-articles-2025/article-01-fiordilatte-pizza-napoletana.json');
  const article = JSON.parse(readFileSync(articlePath, 'utf-8'));
  const itData = article.translations.it_IT;

  console.log('📝 Questo è solo un test per vedere se XML-RPC funziona meglio\n');
  console.log('   Non creerò un articolo, solo testerò l\'endpoint\n');

  // Test a simple read operation first
  console.log('🔍 Test lettura articolo 376 con XML-RPC...\n');

  const result = await executeKw('blog.post', 'read', [[376], ['name']]);
  console.log('Risposta XML-RPC:');
  console.log(result.substring(0, 500));
}

main().catch(console.error);
