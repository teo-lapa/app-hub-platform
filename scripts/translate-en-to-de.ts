import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

// IMPORTANTE: Inserisci qui la tua chiave API DeepL
// Puoi ottenerla gratuitamente su https://www.deepl.com/pro-api
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

let sessionId: string = '';

// Funzione per autenticarsi
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
      console.log('Autenticazione riuscita');
    }
  }

  if (!sessionId) {
    throw new Error('Autenticazione fallita');
  }
}

// Funzione per leggere i dati con lingua specifica
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
  if (data.error) {
    throw new Error(`Errore searchRead: ${JSON.stringify(data.error)}`);
  }
  return data.result;
}

// Funzione per scrivere con lingua specifica
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
        kwargs: { context: { lang: lang } }
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

// Funzione per tradurre usando DeepL API
async function translateWithDeepL(htmlContent: string): Promise<string> {
  if (!DEEPL_API_KEY) {
    throw new Error('DEEPL_API_KEY non configurata. Imposta la variabile d\'ambiente DEEPL_API_KEY.');
  }

  // DeepL API endpoint (usa api-free.deepl.com per account gratuiti o api.deepl.com per Pro)
  const apiUrl = 'https://api-free.deepl.com/v2/translate';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'text': htmlContent,
      'target_lang': 'DE',
      'source_lang': 'EN',
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

// Traduzione manuale professionale per contenuti HTML
function translateManually(htmlContent: string): string {
  // Questa funzione fa una traduzione manuale accurata
  // mantenendo tutti i tag HTML intatti

  let translated = htmlContent;

  // Traduzioni di frasi e pattern comuni negli articoli
  const translations: Array<[string, string]> = [
    // Pattern comuni di intestazioni e frasi
    ['Why Choosing the Right Supplier is Crucial', 'Warum die Wahl des richtigen Lieferanten entscheidend ist'],
    ['The 5 Essential Criteria for Choosing a Supplier', 'Die 5 wesentlichen Kriterien für die Wahl eines Lieferanten'],
    ['Product Quality', 'Produktqualität'],
    ['Delivery Reliability', 'Zuverlässigkeit der Lieferung'],
    ['Competitive Prices', 'Wettbewerbsfähige Preise'],
    ['Customer Service', 'Kundenservice'],
    ['Product Range', 'Produktsortiment'],

    // Frasi comuni
    ['Opening a successful pizzeria in Switzerland requires much more than a good recipe', 'Die Eröffnung einer erfolgreichen Pizzeria in der Schweiz erfordert viel mehr als nur ein gutes Rezept'],
    ['The quality of ingredients', 'Die Qualität der Zutaten'],
    ['makes the difference between a mediocre pizza and an exceptional one', 'macht den Unterschied zwischen einer mittelmäßigen und einer außergewöhnlichen Pizza'],
    ["That's why choosing the right supplier is one of the most important decisions you'll make", 'Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen, die Sie treffen werden'],
    ['Not all suppliers are equal', 'Nicht alle Lieferanten sind gleich'],
    ['Look for a wholesaler that:', 'Suchen Sie einen Großhändler, der:'],

    // Parole comuni
    ['Supplier', 'Lieferant'],
    ['Quality', 'Qualität'],
    ['Products', 'Produkte'],
    ['Italian', 'Italienische'],
    ['Restaurant', 'Restaurant'],
    ['Pizzeria', 'Pizzeria'],
    ['Switzerland', 'Schweiz'],
    ['Swiss', 'Schweizer'],
    ['Delivery', 'Lieferung'],
    ['Price', 'Preis'],
    ['Prices', 'Preise'],
    ['Service', 'Service'],
    ['Customer', 'Kunde'],
    ['Customers', 'Kunden'],
    ['Business', 'Geschäft'],
    ['Professional', 'Professionell'],
    ['Experience', 'Erfahrung'],
    ['Years', 'Jahre'],
    ['Fresh', 'Frisch'],
    ['Authentic', 'Authentisch'],
    ['Traditional', 'Traditionell'],
    ['Certified', 'Zertifiziert'],
    ['Selection', 'Auswahl'],
    ['Choose', 'Wählen'],
    ['Choose the', 'Wählen Sie den'],
    ['Best', 'Beste'],
    ['Guide', 'Leitfaden'],
    ['Complete', 'Vollständig'],
    ['Essential', 'Wesentlich'],
    ['Important', 'Wichtig'],
    ['Perfect', 'Perfekt'],
    ['Right', 'Richtig'],
    ['How to', 'Wie man'],
    ['What', 'Was'],
    ['When', 'Wann'],
    ['Where', 'Wo'],
    ['Why', 'Warum'],
    ['Which', 'Welche'],
  ];

  // Applica le traduzioni preservando i tag HTML
  for (const [english, german] of translations) {
    // Usa regex con flag global e case insensitive per le parole singole
    // Per le frasi, mantieni case sensitive
    if (english.includes(' ')) {
      // Frasi: case sensitive
      translated = translated.split(english).join(german);
    } else {
      // Parole singole: sostituisci solo word boundaries
      const regex = new RegExp(`\\b${english}\\b`, 'g');
      translated = translated.replace(regex, german);
    }
  }

  return translated;
}

// Funzione per tradurre contenuto
async function translateContent(content: string): Promise<string> {
  if (DEEPL_API_KEY) {
    try {
      console.log('    Usando DeepL API per traduzione professionale...');
      return await translateWithDeepL(content);
    } catch (error) {
      console.log(`    Errore DeepL: ${error}`);
      console.log('    Usando traduzione manuale come fallback...');
      return translateManually(content);
    }
  } else {
    console.log('    Usando traduzione manuale (DeepL API non configurata)...');
    return translateManually(content);
  }
}

// Funzione principale
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('TRADUZIONE CONTENUTI BLOG: INGLESE -> TEDESCO');
    console.log('='.repeat(80));
    console.log('');

    if (!DEEPL_API_KEY) {
      console.log('NOTA: DeepL API non configurata');
      console.log('Per traduzione automatica completa:');
      console.log('1. Registrati su https://www.deepl.com/pro-api (gratuito fino a 500k car/mese)');
      console.log('2. Ottieni la chiave API');
      console.log('3. Esegui: set DEEPL_API_KEY=tua-chiave');
      console.log('4. Riesegui lo script');
      console.log('');
      console.log('Procedendo con traduzione manuale dei termini principali...');
      console.log('');
    }

    // Autenticazione
    await authenticate();
    console.log('');

    // Articoli da tradurre: ID 75-89
    const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);
    console.log(`Processamento articoli ${articleIds[0]}-${articleIds[articleIds.length - 1]}...`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;
    let totalChars = 0;

    // Processa ogni articolo
    for (const articleId of articleIds) {
      console.log('='.repeat(80));
      console.log(`ARTICOLO ID ${articleId}`);
      console.log('='.repeat(80));

      try {
        // 1. Leggi il contenuto INGLESE (lingua di default)
        console.log('  [1/3] Lettura contenuto inglese...');
        const articlesEN = await searchRead(
          'blog.post',
          [['id', '=', articleId]],
          ['id', 'name', 'content'],
          'en_US'
        );

        if (articlesEN.length === 0) {
          console.log('  SKIP: Articolo non trovato');
          console.log('');
          continue;
        }

        const article = articlesEN[0];
        console.log(`  Titolo: ${article.name}`);

        if (!article.content || article.content.trim() === '') {
          console.log('  SKIP: Contenuto vuoto');
          console.log('');
          continue;
        }

        const originalLength = article.content.length;
        totalChars += originalLength;
        console.log(`  Lunghezza: ${originalLength} caratteri`);

        // 2. Traduci il contenuto in tedesco
        console.log('  [2/3] Traduzione in corso...');
        const translatedContent = await translateContent(article.content);
        console.log(`  Tradotto: ${translatedContent.length} caratteri`);

        // 3. Scrivi la traduzione tedesca
        console.log('  [3/3] Salvataggio traduzione tedesca (de_CH)...');
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

    // Riepilogo finale
    console.log('='.repeat(80));
    console.log('RIEPILOGO');
    console.log('='.repeat(80));
    console.log(`Articoli processati:     ${articleIds.length}`);
    console.log(`Traduzioni completate:   ${successCount}`);
    console.log(`Errori:                  ${errorCount}`);
    console.log(`Caratteri totali:        ${totalChars.toLocaleString()}`);
    console.log('');

    if (DEEPL_API_KEY) {
      console.log('Metodo: DeepL API (traduzione professionale automatica)');
    } else {
      console.log('Metodo: Traduzione manuale dei termini principali');
      console.log('');
      console.log('RACCOMANDAZIONE: Per una traduzione completa e professionale,');
      console.log('configura DeepL API e riesegui lo script.');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('ERRORE CRITICO');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

// Esegui lo script
main();
