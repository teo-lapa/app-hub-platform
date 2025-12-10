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

async function readRecords(model: string, ids: number[], fields: string[], lang?: string): Promise<any[]> {
  const kwargs: any = {
    fields
  };

  if (lang) {
    kwargs.context = { lang };
  }

  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/read`, {
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
        method: 'read',
        args: [ids],
        kwargs
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    console.error('Errore:', JSON.stringify(data.error, null, 2));
    return [];
  }
  return data.result || [];
}

async function main() {
  await authenticate();
  console.log('Autenticazione completata\n');

  console.log('='.repeat(80));
  console.log('LETTURA CONTENUTO ARTICOLO 75 CON METODO READ');
  console.log('='.repeat(80));
  console.log('');

  // Leggi senza lingua
  console.log('1. LETTURA SENZA LINGUA SPECIFICA:\n');
  const articlesDefault = await readRecords('blog.post', [75], ['id', 'name', 'content']);
  if (articlesDefault.length > 0) {
    const article = articlesDefault[0];
    console.log(`ID: ${article.id}`);
    console.log(`Name: ${article.name}`);
    console.log(`Content type: ${typeof article.content}`);
    console.log(`Content length: ${(article.content || '').length} caratteri`);
    console.log(`\nPrimi 1000 caratteri del content:`);
    console.log((article.content || '').substring(0, 1000));
    console.log('...\n');
  }

  console.log('-'.repeat(80));
  console.log('');

  // Leggi con lingua inglese
  console.log('2. LETTURA CON LINGUA INGLESE (en_US):\n');
  const articlesEN = await readRecords('blog.post', [75], ['id', 'name', 'content'], 'en_US');
  if (articlesEN.length > 0) {
    const article = articlesEN[0];
    console.log(`ID: ${article.id}`);
    console.log(`Name: ${article.name}`);
    console.log(`Content type: ${typeof article.content}`);
    console.log(`Content length: ${(article.content || '').length} caratteri`);
    console.log(`\nPrimi 1000 caratteri del content:`);
    console.log((article.content || '').substring(0, 1000));
    console.log('...\n');
  }

  console.log('-'.repeat(80));
  console.log('');

  // Leggi con lingua tedesca
  console.log('3. LETTURA CON LINGUA TEDESCA (de_CH):\n');
  const articlesDE = await readRecords('blog.post', [75], ['id', 'name', 'content'], 'de_CH');
  if (articlesDE.length > 0) {
    const article = articlesDE[0];
    console.log(`ID: ${article.id}`);
    console.log(`Name: ${article.name}`);
    console.log(`Content type: ${typeof article.content}`);
    console.log(`Content length: ${(article.content || '').length} caratteri`);
    console.log(`\nPrimi 1000 caratteri del content:`);
    console.log((article.content || '').substring(0, 1000));
    console.log('...\n');
  }

  console.log('='.repeat(80));
}

main();
