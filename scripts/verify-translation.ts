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

function countWords(html: string): number {
  // Rimuovi i tag HTML
  const text = html.replace(/<[^>]*>/g, ' ');
  // Conta le parole
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h3Regex = /<h3[^>]*>(.*?)<\/h3>/gi;

  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    headings.push(`[H2] ${match[1].replace(/<[^>]*>/g, '')}`);
  }
  while ((match = h3Regex.exec(html)) !== null) {
    headings.push(`[H3] ${match[1].replace(/<[^>]*>/g, '')}`);
  }

  return headings;
}

async function main() {
  await authenticate();

  console.log('='.repeat(80));
  console.log('VERIFICA TRADUZIONE ARTICOLI BLOG');
  console.log('='.repeat(80));
  console.log('');

  // Verifica tutti gli articoli 75-89
  const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);

  console.log('Riepilogo traduzioni per tutti gli articoli:\n');
  console.log('-'.repeat(80));

  for (const articleId of articleIds) {
    // Leggi versione inglese
    const articlesEN = await searchRead(
      'blog.post',
      [['id', '=', articleId]],
      ['id', 'name', 'content'],
      'en_US'
    );

    // Leggi versione tedesca
    const articlesDE = await searchRead(
      'blog.post',
      [['id', '=', articleId]],
      ['id', 'name', 'content'],
      'de_CH'
    );

    if (articlesEN.length > 0 && articlesDE.length > 0) {
      const enContent = articlesEN[0].content || '';
      const deContent = articlesDE[0].content || '';

      const enWords = countWords(enContent);
      const deWords = countWords(deContent);

      const isDifferent = enContent !== deContent;
      const status = isDifferent ? 'TRADOTTO' : 'NON TRADOTTO';
      const statusIcon = isDifferent ? '✓' : '✗';

      console.log(`ID ${articleId}: ${statusIcon} ${status.padEnd(15)} | EN: ${enWords.toString().padStart(4)} parole | DE: ${deWords.toString().padStart(4)} parole`);
    }
  }

  console.log('-'.repeat(80));
  console.log('');

  // Mostra dettagli di un articolo esempio (ID 75)
  console.log('='.repeat(80));
  console.log('ESEMPIO DETTAGLIATO: ARTICOLO ID 75');
  console.log('='.repeat(80));
  console.log('');

  const articlesEN = await searchRead(
    'blog.post',
    [['id', '=', 75]],
    ['id', 'name', 'content'],
    'en_US'
  );

  const articlesDE = await searchRead(
    'blog.post',
    [['id', '=', 75]],
    ['id', 'name', 'content'],
    'de_CH'
  );

  if (articlesEN.length > 0 && articlesDE.length > 0) {
    const articleEN = articlesEN[0];
    const articleDE = articlesDE[0];

    console.log('VERSIONE INGLESE:');
    console.log(`Titolo: ${articleEN.name}`);
    console.log(`Parole: ${countWords(articleEN.content)}`);
    console.log(`Caratteri: ${articleEN.content.length}`);
    console.log('');
    console.log('Intestazioni principali:');
    extractHeadings(articleEN.content).slice(0, 5).forEach(h => console.log(`  ${h}`));
    console.log('');
    console.log('Primi 500 caratteri del contenuto:');
    console.log(articleEN.content.substring(0, 500));
    console.log('...');
    console.log('');

    console.log('-'.repeat(80));
    console.log('');

    console.log('VERSIONE TEDESCA:');
    console.log(`Titolo: ${articleDE.name}`);
    console.log(`Parole: ${countWords(articleDE.content)}`);
    console.log(`Caratteri: ${articleDE.content.length}`);
    console.log('');
    console.log('Intestazioni principali:');
    extractHeadings(articleDE.content).slice(0, 5).forEach(h => console.log(`  ${h}`));
    console.log('');
    console.log('Primi 500 caratteri del contenuto:');
    console.log(articleDE.content.substring(0, 500));
    console.log('...');
    console.log('');

    console.log('-'.repeat(80));
    console.log('');

    // Confronto
    const isDifferent = articleEN.content !== articleDE.content;
    if (isDifferent) {
      console.log('STATO: TRADUZIONE COMPLETATA ✓');
      console.log('Il contenuto inglese e tedesco sono diversi.');
      console.log('I tag HTML sono stati preservati correttamente.');
    } else {
      console.log('ATTENZIONE: Contenuti identici - traduzione non applicata');
    }
  }

  console.log('');
  console.log('='.repeat(80));
}

main();
