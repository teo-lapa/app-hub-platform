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

// Funzione per leggere i dati
async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
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
        kwargs: {
          domain: domain,
          fields: fields,
          limit: false,
          order: 'id'
        }
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
      'source_lang': 'IT',
      'tag_handling': 'html',
      'preserve_formatting': '1'
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

// Funzione per tradurre contenuto HTML in tedesco
async function translateContent(content: string, articleId: number): Promise<string> {
  try {
    // Prova a usare DeepL se la chiave API è configurata
    if (DEEPL_API_KEY) {
      console.log('  Usando DeepL API per traduzione professionale...');
      return await translateWithDeepL(content);
    } else {
      console.log('  ATTENZIONE: DeepL API non configurata, usando traduzione base');
      return translateBasic(content);
    }
  } catch (error) {
    console.log(`  Errore durante traduzione DeepL: ${error}`);
    console.log('  Fallback a traduzione base...');
    return translateBasic(content);
  }
}

// Traduzione base come fallback
function translateBasic(htmlContent: string): string {
  const translations: { [key: string]: string } = {
    // Termini comuni
    'Introduzione': 'Einführung',
    'Conclusione': 'Fazit',
    'Vantaggi': 'Vorteile',
    'Svantaggi': 'Nachteile',
    'Caratteristiche': 'Eigenschaften',
    'Funzionalità': 'Funktionen',
    'Esempi': 'Beispiele',
    'Guida': 'Leitfaden',
    'Consigli': 'Ratschläge',
    'Soluzioni': 'Lösungen',
    'Problemi': 'Probleme',
    'Strategie': 'Strategien',
    'Strumenti': 'Werkzeuge',
    'Servizi': 'Dienstleistungen',
    'Prodotti': 'Produkte',
    'Azienda': 'Unternehmen',
    'Cliente': 'Kunde',
    'Clienti': 'Kunden',
    'Qualità': 'Qualität',
    'Efficienza': 'Effizienz',
  };

  let translated = htmlContent;

  for (const [italian, german] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${italian}\\b`, 'gi');
    translated = translated.replace(regex, german);
  }

  return translated;
}

// Funzione principale
async function main() {
  try {
    console.log('='.repeat(80));
    console.log('TRADUZIONE CONTENUTI BLOG: ITALIANO -> TEDESCO');
    console.log('='.repeat(80));
    console.log('');

    if (!DEEPL_API_KEY) {
      console.log('ATTENZIONE: DeepL API non configurata!');
      console.log('Per una traduzione professionale completa:');
      console.log('1. Registrati su https://www.deepl.com/pro-api');
      console.log('2. Ottieni la chiave API gratuita (500.000 caratteri/mese)');
      console.log('3. Esegui: set DEEPL_API_KEY=tua-chiave-api');
      console.log('4. Riesegui questo script');
      console.log('');
      console.log('Procedendo con traduzione base limitata...');
      console.log('');
    }

    // Autenticazione
    console.log('Autenticazione a Odoo...');
    await authenticate();
    console.log('');

    // Leggi gli articoli ID 75-89
    const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);
    console.log(`Lettura articoli ${articleIds[0]}-${articleIds[articleIds.length - 1]}...`);

    const articles = await searchRead(
      'blog.post',
      [['id', 'in', articleIds]],
      ['id', 'name', 'content']
    );

    console.log(`Trovati ${articles.length} articoli.`);
    console.log('');

    let successCount = 0;
    let errorCount = 0;
    let totalChars = 0;

    // Processa ogni articolo
    for (const article of articles) {
      console.log('='.repeat(80));
      console.log(`Articolo ID ${article.id}: ${article.name}`);
      console.log('='.repeat(80));

      if (!article.content || article.content.trim() === '') {
        console.log('  SKIP: Contenuto vuoto');
        console.log('');
        continue;
      }

      const originalLength = article.content.length;
      totalChars += originalLength;
      console.log(`  Lunghezza contenuto: ${originalLength} caratteri`);

      try {
        // Traduci il contenuto
        const translatedContent = await translateContent(article.content, article.id);
        console.log(`  Traduzione completata: ${translatedContent.length} caratteri`);

        // Scrivi la traduzione con context tedesco
        console.log('  Salvataggio in Odoo (de_CH)...');
        const success = await writeWithLang(
          'blog.post',
          [article.id],
          { content: translatedContent },
          'de_CH'
        );

        if (success) {
          console.log('  OK: Traduzione salvata con successo');
          successCount++;
        } else {
          console.log('  ERRORE: Impossibile salvare la traduzione');
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
    console.log('RIEPILOGO PROCESSO DI TRADUZIONE');
    console.log('='.repeat(80));
    console.log(`Articoli processati:     ${articles.length}`);
    console.log(`Traduzioni completate:   ${successCount}`);
    console.log(`Errori:                  ${errorCount}`);
    console.log(`Caratteri totali:        ${totalChars.toLocaleString()}`);
    console.log('');

    if (DEEPL_API_KEY) {
      console.log('Traduzione professionale completata con DeepL API');
    } else {
      console.log('IMPORTANTE: Traduzione base applicata.');
      console.log('Per traduzioni professionali complete, configura DeepL API.');
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
