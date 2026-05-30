/**
 * Verify article 420 in all languages
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = (process.env.ODOO_PASSWORD || '');

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
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘          VERIFICA ARTICOLO 420 - TUTTE LE LINGUE          â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n');

  console.log('ðŸ” Autenticazione...');
  await authenticate();
  console.log('âœ…\n');

  const postId = 420;
  const languages = {
    'it_IT': 'ITALIANO ðŸ‡®ðŸ‡¹',
    'de_CH': 'TEDESCO ðŸ‡©ðŸ‡ª',
    'fr_CH': 'FRANCESE ðŸ‡«ðŸ‡·',
    'en_US': 'INGLESE ðŸ‡¬ðŸ‡§'
  };

  console.log('='.repeat(70));

  for (const [lang, langName] of Object.entries(languages)) {
    console.log(`\n${langName}:`);
    console.log('-'.repeat(70));

    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'subtitle', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];

      console.log(`\nðŸ“ TITOLO: ${p.name}\n`);

      if (p.content) {
        // Extract first ordered list
        const firstList = p.content.match(/<ol[^>]*>([\s\S]*?)<\/ol>/);
        if (firstList) {
          const listItems = firstList[1].match(/<li>(.*?)<\/li>/g);
          if (listItems) {
            console.log(`ðŸ“‹ PRIMA LISTA (${listItems.length} elementi):\n`);
            listItems.forEach((item, i) => {
              const text = item.replace(/<[^>]+>/g, '').trim();
              console.log(`   ${i + 1}. ${text.substring(0, 100)}`);
            });
          }
        }

        // Check for problematic text in German
        if (lang === 'de_CH') {
          const problemCount = (p.content.match(/Neapolitanischer Fior di Latte hat einen/g) || []).length;
          if (problemCount > 5) {
            console.log(`\n   âš ï¸  PROBLEMA: "${problemCount}" occorrenze di testo ripetuto`);
          } else {
            console.log(`\n   âœ… OK: Nessun testo ripetuto anomalo`);
          }
        }

        const textContent = p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`\nðŸ“– CONTENUTO (primi 200 caratteri):`);
        console.log(`   ${textContent.substring(0, 200)}...\n`);
      }
    }
  }

  console.log('='.repeat(70));
  console.log('\nâ“ VERIFICA DIVERSITÃ€ CONTENUTI:\n');

  const contents: string[] = [];
  for (const lang of Object.keys(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['content']], {
      context: { lang }
    });
    if (post && post.length > 0 && post[0].content) {
      const textContent = post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      contents.push(textContent.substring(0, 200));
    }
  }

  const uniqueContents = new Set(contents);

  if (uniqueContents.size === 1) {
    console.log('âŒ PROBLEMA: Tutti i contenuti sono IDENTICI!');
  } else if (uniqueContents.size === 4) {
    console.log('âœ… PERFETTO: Tutti i contenuti sono DIVERSI!');
    console.log('   Ogni lingua ha il suo testo tradotto.\n');
  } else {
    console.log(`âš ï¸  PARZIALE: ${uniqueContents.size}/4 contenuti diversi`);
  }
}

main().catch(console.error);
