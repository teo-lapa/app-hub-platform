import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string = '';

async function authenticate(): Promise<void> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password,
      },
      id: Date.now(),
    }),
  });

  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    const match = setCookieHeader.match(/session_id=([^;]+)/);
    if (match) {
      sessionId = match[1];
    }
  }
}

async function callOdooMethod(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
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
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    console.log('Errore:', JSON.stringify(data.error, null, 2));
  }
  return data.result;
}

async function main() {
  await authenticate();
  console.log('Autenticazione completata\n');

  console.log('='.repeat(80));
  console.log('VERIFICA SISTEMA DI TRADUZIONE ODOO');
  console.log('='.repeat(80));
  console.log('');

  // 1. Controlla i campi del modello blog.post
  console.log('1. Controllo campi model blog.post...\n');
  const fields = await callOdooMethod('ir.model.fields', 'search_read', [], {
    domain: [['model', '=', 'blog.post'], ['name', 'in', ['name', 'content']]],
    fields: ['name', 'field_description', 'translate', 'ttype']
  });

  console.log('Campi trovati:');
  fields.forEach((field: any) => {
    console.log(`  - ${field.name}: ${field.field_description}`);
    console.log(`    Tipo: ${field.ttype}`);
    console.log(`    Traducibile: ${field.translate ? 'SÌ' : 'NO'}`);
    console.log('');
  });

  console.log('-'.repeat(80));
  console.log('');

  // 2. Leggi articolo ID 75 senza context
  console.log('2. Lettura articolo ID 75 SENZA context lingua...\n');
  const article = await callOdooMethod('blog.post', 'search_read', [], {
    domain: [['id', '=', 75]],
    fields: ['id', 'name', 'content']
  });

  if (article && article.length > 0) {
    console.log(`ID: ${article[0].id}`);
    console.log(`Name: ${article[0].name}`);
    console.log(`Content length: ${(article[0].content || '').length} caratteri`);
    console.log(`Content preview: ${(article[0].content || '').substring(0, 200)}...`);
  }

  console.log('');
  console.log('-'.repeat(80));
  console.log('');

  // 3. Leggi con context en_US
  console.log('3. Lettura articolo ID 75 CON context en_US...\n');
  const articleEN = await callOdooMethod('blog.post', 'search_read', [], {
    domain: [['id', '=', 75]],
    fields: ['id', 'name', 'content'],
    context: { lang: 'en_US' }
  });

  if (articleEN && articleEN.length > 0) {
    console.log(`ID: ${articleEN[0].id}`);
    console.log(`Name: ${articleEN[0].name}`);
    console.log(`Content length: ${(articleEN[0].content || '').length} caratteri`);
    console.log(`Content preview: ${(articleEN[0].content || '').substring(0, 200)}...`);
  }

  console.log('');
  console.log('-'.repeat(80));
  console.log('');

  // 4. Leggi con context de_CH
  console.log('4. Lettura articolo ID 75 CON context de_CH...\n');
  const articleDE = await callOdooMethod('blog.post', 'search_read', [], {
    domain: [['id', '=', 75]],
    fields: ['id', 'name', 'content'],
    context: { lang: 'de_CH' }
  });

  if (articleDE && articleDE.length > 0) {
    console.log(`ID: ${articleDE[0].id}`);
    console.log(`Name: ${articleDE[0].name}`);
    console.log(`Content length: ${(articleDE[0].content || '').length} caratteri`);
    console.log(`Content preview: ${(articleDE[0].content || '').substring(0, 200)}...`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('');

  // 5. Verifica traduzioni esistenti tramite ir.translation
  console.log('5. Controllo traduzioni esistenti per articolo ID 75...\n');
  const translations = await callOdooMethod('ir.translation', 'search_read', [], {
    domain: [
      ['name', '=', 'blog.post,content'],
      ['res_id', '=', 75]
    ],
    fields: ['id', 'name', 'lang', 'source', 'value', 'state']
  });

  console.log(`Trovate ${translations.length} traduzioni per il campo content:`);
  translations.forEach((trans: any) => {
    console.log(`  - Lingua: ${trans.lang}`);
    console.log(`    Stato: ${trans.state}`);
    console.log(`    Lunghezza valore: ${(trans.value || '').length} caratteri`);
    console.log(`    Preview: ${(trans.value || '').substring(0, 100)}...`);
    console.log('');
  });

  console.log('='.repeat(80));
}

main();
