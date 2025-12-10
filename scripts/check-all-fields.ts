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

async function readAll(model: string, ids: number[]): Promise<any[]> {
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
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data.result || [];
}

async function main() {
  await authenticate();

  console.log('Lettura TUTTI i campi dell\'articolo ID 75...\n');

  const articles = await readAll('blog.post', [75]);

  if (articles.length > 0) {
    const article = articles[0];

    console.log('CAMPI DISPONIBILI:');
    console.log('='.repeat(80));

    // Campi che potrebbero contenere il contenuto
    const contentFields = ['content', 'body', 'description', 'subtitle', 'teaser'];

    contentFields.forEach(field => {
      if (article[field] !== undefined) {
        const value = article[field];
        console.log(`\n${field.toUpperCase()}:`);
        console.log(`  Tipo: ${typeof value}`);
        console.log(`  Lunghezza: ${(value || '').length} caratteri`);
        if (value && typeof value === 'string' && value.length > 0) {
          console.log(`  Preview: ${value.substring(0, 300)}`);
        }
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\nALTRI CAMPI RILEVANTI:');
    console.log('='.repeat(80));

    const otherFields = ['id', 'name', 'blog_id', 'author_id', 'create_date', 'write_date'];
    otherFields.forEach(field => {
      if (article[field] !== undefined) {
        console.log(`${field}: ${JSON.stringify(article[field])}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\nTUTTI I CAMPI:');
    console.log(Object.keys(article).join(', '));
  }
}

main();
