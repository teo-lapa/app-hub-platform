/**
 * Debug German content for article 419
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });
  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }
  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function main() {
  console.log('🔐 Autenticazione...\n');
  await authenticate();

  const postId = 419;

  console.log('📋 VERIFICA CONTENUTO TEDESCO:\n');
  console.log('='.repeat(70));

  const post = await callOdoo('blog.post', 'read', [[postId], ['content']], {
    context: { lang: 'de_CH' }
  });

  if (post && post.length > 0) {
    const content = post[0].content;

    // Find the section with lists
    const listSection = content.substring(content.indexOf('Häufiger Fehler'), content.indexOf('Häufiger Fehler') + 1000);

    console.log('\n📋 SEZIONE TEDESCA CON LISTE (primi 1000 caratteri):\n');
    console.log(listSection);
    console.log('\n' + '='.repeat(70));

    // Extract just the first list
    const firstList = content.match(/<ol[^>]*>[\s\S]*?<\/ol>/i);
    if (firstList) {
      console.log('\n📋 PRIMA LISTA COMPLETA:\n');
      console.log(firstList[0]);
    }

    // Count how many times the problematic text appears
    const problemText = 'Neapolitanischer Fior di Latte hat einen';
    const count = (content.match(new RegExp(problemText, 'g')) || []).length;
    console.log(`\n⚠️  Testo problematico "${problemText}" appare ${count} volte\n`);
  }

  console.log('\n📋 TRADUZIONI DEI SEGMENTI:\n');
  const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});

  if (fieldTrans && fieldTrans[0] && fieldTrans[0].length > 0) {
    const segments = fieldTrans[0];

    // Find segments related to the list
    const listSegments = segments.filter((s: any) =>
      s.source.includes('Neapolitanischer') ||
      s.lang_data?.de_CH?.includes('Neapolitanischer')
    );

    console.log(`Segmenti che contengono "Neapolitanischer": ${listSegments.length}\n`);

    listSegments.slice(0, 10).forEach((seg: any, i: number) => {
      console.log(`\n${i + 1}. SOURCE:`);
      console.log(`   ${seg.source.substring(0, 100)}...`);
      console.log(`   DE_CH:`);
      console.log(`   ${seg.lang_data?.de_CH?.substring(0, 100) || 'N/A'}...`);
    });
  }
}

main().catch(console.error);
