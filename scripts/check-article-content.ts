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

async function searchRead(model: string, domain: any[], fields: string[], lang?: string): Promise<any[]> {
  const kwargs: any = {
    domain: domain,
    fields: fields,
    limit: false,
    order: 'id'
  };

  if (lang) {
    kwargs.context = { lang: lang };
  }

  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: model,
        method: 'search_read',
        args: [],
        kwargs: kwargs
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data.result;
}

async function main() {
  await authenticate();

  // Leggi l'articolo 75 in italiano
  console.log('='.repeat(80));
  console.log('ARTICOLO 75 - CONTENUTO ITALIANO (it_IT)');
  console.log('='.repeat(80));

  const articlesIT = await searchRead(
    'blog.post',
    [['id', '=', 75]],
    ['id', 'name', 'content'],
    'it_IT'
  );

  if (articlesIT.length > 0) {
    console.log(`\nTitolo: ${articlesIT[0].name}`);
    console.log(`\nContenuto (primi 500 caratteri):\n`);
    console.log(articlesIT[0].content?.substring(0, 500) || 'VUOTO');
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('ARTICOLO 75 - CONTENUTO INGLESE (en_US)');
  console.log('='.repeat(80));

  const articlesEN = await searchRead(
    'blog.post',
    [['id', '=', 75]],
    ['id', 'name', 'content'],
    'en_US'
  );

  if (articlesEN.length > 0) {
    console.log(`\nTitolo: ${articlesEN[0].name}`);
    console.log(`\nContenuto (primi 500 caratteri):\n`);
    console.log(articlesEN[0].content?.substring(0, 500) || 'VUOTO');
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('ARTICOLO 75 - CONTENUTO TEDESCO (de_CH)');
  console.log('='.repeat(80));

  const articlesDE = await searchRead(
    'blog.post',
    [['id', '=', 75]],
    ['id', 'name', 'content'],
    'de_CH'
  );

  if (articlesDE.length > 0) {
    console.log(`\nTitolo: ${articlesDE[0].name}`);
    console.log(`\nContenuto (primi 500 caratteri):\n`);
    console.log(articlesDE[0].content?.substring(0, 500) || 'VUOTO');
  }
}

main();
