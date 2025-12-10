import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

// DeepL API Key (opzionale)
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

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

  if (!sessionId) {
    throw new Error('Autenticazione fallita');
  }
}

async function readRecords(model: string, ids: number[], fields: string[], lang?: string): Promise<any[]> {
  const kwargs: any = { fields };
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
    throw new Error(`Errore read: ${JSON.stringify(data.error)}`);
  }
  return data.result || [];
}

async function writeWithLang(model: string, ids: number[], values: any, lang: string): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
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
        method: 'write',
        args: [ids, values],
        kwargs: { context: { lang } }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    throw new Error(`Errore write: ${JSON.stringify(data.error)}`);
  }
  return data.result === true;
}

async function translateWithDeepL(htmlContent: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY non configurata');
  }

  const apiUrl = 'https://api-free.deepl.com/v2/translate';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'text': htmlContent,
      'target_lang': targetLang,
      'source_lang': sourceLang,
      'tag_handling': 'html',
      'preserve_formatting': '1',
      'formality': 'default'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore DeepL API (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();

  if (!data.translations || data.translations.length === 0) {
    throw new Error('Nessuna traduzione ricevuta da DeepL');
  }

  return data.translations[0].text;
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('TRADUZIONE CONTENUTI BLOG: INGLESE -> TEDESCO');
    console.log('='.repeat(80));
    console.log('');

    if (!DEEPL_API_KEY) {
      console.log('ATTENZIONE: DeepL API non configurata!');
      console.log('Configura DEEPL_API_KEY per traduzione automatica professionale.');
      console.log('');
      console.log('Uscita.');
      return;
    }

    await authenticate();
    console.log('Autenticazione completata');
    console.log('');

    const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const articleId of articleIds) {
      console.log('-'.repeat(80));
      console.log(`ARTICOLO ID ${articleId}`);
      console.log('-'.repeat(80));

      try {
        // 1. Leggi contenuto inglese
        const articlesEN = await readRecords('blog.post', [articleId], ['id', 'name', 'content'], 'en_US');

        if (articlesEN.length === 0) {
          console.log('  SKIP: Articolo non trovato');
          skipCount++;
          continue;
        }

        const article = articlesEN[0];
        console.log(`  Titolo EN: ${article.name}`);

        // Verifica se il contenuto esiste e non è vuoto
        if (!article.content || article.content === '{}' || article.content.trim() === '' || article.content.length < 10) {
          console.log(`  SKIP: Contenuto vuoto o non valido (${(article.content || '').length} caratteri)`);
          skipCount++;
          continue;
        }

        console.log(`  Contenuto EN: ${article.content.length} caratteri`);

        // 2. Traduci con DeepL
        console.log('  Traduzione in corso...');
        const translatedContent = await translateWithDeepL(article.content, 'EN', 'DE');
        console.log(`  Tradotto: ${translatedContent.length} caratteri`);

        // 3. Scrivi traduzione tedesca
        console.log('  Salvataggio...');
        const success = await writeWithLang(
          'blog.post',
          [articleId],
          { content: translatedContent },
          'de_CH'
        );

        if (success) {
          console.log('  OK: Traduzione salvata con successo');
          successCount++;
        } else {
          console.log('  ERRORE: Impossibile salvare');
          errorCount++;
        }

      } catch (error) {
        console.log(`  ERRORE: ${error}`);
        errorCount++;
      }

      console.log('');
    }

    console.log('='.repeat(80));
    console.log('RIEPILOGO');
    console.log('='.repeat(80));
    console.log(`Articoli controllati:    ${articleIds.length}`);
    console.log(`Traduzioni completate:   ${successCount}`);
    console.log(`Articoli saltati:        ${skipCount}`);
    console.log(`Errori:                  ${errorCount}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('ERRORE CRITICO:', error);
    process.exit(1);
  }
}

main();
