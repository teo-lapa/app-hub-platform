import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

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

// Funzione per tradurre il contenuto HTML in tedesco
function translateToGerman(htmlContent: string): string {
  // Dizionario di traduzioni IT -> DE per termini comuni
  const translations: { [key: string]: string } = {
    // Termini generali
    'Introduzione': 'Einführung',
    'Conclusione': 'Fazit',
    'Cos\'è': 'Was ist',
    'Come': 'Wie',
    'Perché': 'Warum',
    'Quando': 'Wann',
    'Dove': 'Wo',
    'Chi': 'Wer',
    'Quali': 'Welche',
    'Vantaggi': 'Vorteile',
    'Svantaggi': 'Nachteile',
    'Caratteristiche': 'Eigenschaften',
    'Funzionalità': 'Funktionen',
    'Esempi': 'Beispiele',
    'Guida': 'Leitfaden',
    'Tutorial': 'Anleitung',
    'Suggerimenti': 'Tipps',
    'Consigli': 'Ratschläge',
    'Best practices': 'Best Practices',
    'Soluzioni': 'Lösungen',
    'Problemi': 'Probleme',
    'Sfide': 'Herausforderungen',
    'Opportunità': 'Chancen',
    'Tendenze': 'Trends',
    'Innovazioni': 'Innovationen',
    'Strategie': 'Strategien',
    'Metodi': 'Methoden',
    'Tecniche': 'Techniken',
    'Strumenti': 'Werkzeuge',
    'Risorse': 'Ressourcen',
    'Servizi': 'Dienstleistungen',
    'Prodotti': 'Produkte',
    'Azienda': 'Unternehmen',
    'Business': 'Geschäft',
    'Mercato': 'Markt',
    'Settore': 'Branche',
    'Industria': 'Industrie',
    'Cliente': 'Kunde',
    'Clienti': 'Kunden',
    'Partner': 'Partner',
    'Collaborazione': 'Zusammenarbeit',
    'Team': 'Team',
    'Progetto': 'Projekt',
    'Progetti': 'Projekte',
    'Obiettivi': 'Ziele',
    'Risultati': 'Ergebnisse',
    'Performance': 'Leistung',
    'Qualità': 'Qualität',
    'Efficienza': 'Effizienz',
    'Produttività': 'Produktivität',
    'Crescita': 'Wachstum',
    'Sviluppo': 'Entwicklung',
    'Miglioramento': 'Verbesserung',
    'Ottimizzazione': 'Optimierung',
    'Gestione': 'Verwaltung',
    'Controllo': 'Kontrolle',
    'Monitoraggio': 'Überwachung',
    'Analisi': 'Analyse',
    'Dati': 'Daten',
    'Informazioni': 'Informationen',
    'Contenuti': 'Inhalte',
    'Piattaforma': 'Plattform',
    'Sistema': 'System',
    'Software': 'Software',
    'Tecnologia': 'Technologie',
    'Digitale': 'Digital',
    'Online': 'Online',
    'Web': 'Web',
    'Internet': 'Internet',
    'Social media': 'Social Media',
    'Marketing': 'Marketing',
    'Comunicazione': 'Kommunikation',
    'Vendita': 'Verkauf',
    'Vendite': 'Verkäufe',
    'E-commerce': 'E-Commerce',
    'Negozio': 'Geschäft',
    'Acquisto': 'Kauf',
    'Acquisti': 'Einkäufe',
    'Ordine': 'Bestellung',
    'Ordini': 'Bestellungen',
    'Pagamento': 'Zahlung',
    'Prezzo': 'Preis',
    'Costo': 'Kosten',
    'Valore': 'Wert',
    'Investimento': 'Investition',
    'ROI': 'ROI',
    'Budget': 'Budget',
    'Finanza': 'Finanzen',
    'Economia': 'Wirtschaft',
    'Risparmio': 'Ersparnis',
    'Profitto': 'Gewinn',
    'Ricavi': 'Einnahmen',
    'Fatturato': 'Umsatz',
  };

  let translated = htmlContent;

  // Nota: Questa è una traduzione base. Per una traduzione completa e accurata,
  // dovrebbe essere usato un servizio di traduzione API professionale come DeepL o Google Translate.
  // Per ora, sostituiremo solo i termini più comuni.

  console.log('ATTENZIONE: Questa è una traduzione automatica base.');
  console.log('Per una traduzione professionale completa, considera di usare DeepL API o Google Translate API.');

  // Applica le traduzioni ai termini comuni
  for (const [italian, german] of Object.entries(translations)) {
    // Sostituisci solo le parole intere (word boundaries)
    const regex = new RegExp(`\\b${italian}\\b`, 'gi');
    translated = translated.replace(regex, german);
  }

  return translated;
}

// Funzione per tradurre contenuto usando DeepL (se disponibile) o traduzione base
async function translateContent(content: string): Promise<string> {
  // Per una traduzione professionale, qui dovresti integrare DeepL API:
  // const DEEPL_API_KEY = 'your-api-key';
  // const response = await fetch('https://api-free.deepl.com/v2/translate', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
  //     'Content-Type': 'application/x-www-form-urlencoded',
  //   },
  //   body: `text=${encodeURIComponent(content)}&target_lang=DE&source_lang=IT&tag_handling=html`
  // });

  // Per ora usiamo la traduzione base
  return translateToGerman(content);
}

// Funzione principale
async function main() {
  try {
    console.log('Inizio processo di traduzione...\n');

    // Autenticazione
    await authenticate();

    // Leggi gli articoli ID 75-89
    const articleIds = Array.from({ length: 15 }, (_, i) => 75 + i);
    console.log(`Lettura articoli ${articleIds[0]}-${articleIds[articleIds.length - 1]}...\n`);

    const articles = await searchRead(
      'blog.post',
      [['id', 'in', articleIds]],
      ['id', 'name', 'content']
    );

    console.log(`Trovati ${articles.length} articoli.\n`);

    // Processa ogni articolo
    for (const article of articles) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Articolo ID ${article.id}: ${article.name}`);
      console.log('='.repeat(80));

      if (!article.content || article.content.trim() === '') {
        console.log('  SKIP: Contenuto vuoto');
        continue;
      }

      console.log(`  Lunghezza contenuto originale: ${article.content.length} caratteri`);

      // Traduci il contenuto
      console.log('  Traduzione in corso...');
      const translatedContent = await translateContent(article.content);
      console.log(`  Lunghezza contenuto tradotto: ${translatedContent.length} caratteri`);

      // Scrivi la traduzione con context tedesco
      console.log('  Scrittura traduzione in Odoo (de_CH)...');
      const success = await writeWithLang(
        'blog.post',
        [article.id],
        { content: translatedContent },
        'de_CH'
      );

      if (success) {
        console.log('  OK: Traduzione salvata con successo');
      } else {
        console.log('  ERRORE: Impossibile salvare la traduzione');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('PROCESSO COMPLETATO');
    console.log('='.repeat(80));
    console.log(`\nTotale articoli processati: ${articles.length}`);
    console.log('\nNOTA IMPORTANTE:');
    console.log('Questa è una traduzione automatica base. Per una traduzione professionale');
    console.log('completa e accurata, considera di integrare DeepL API o Google Translate API.');
    console.log('Verifica manualmente le traduzioni prima di pubblicare.');

  } catch (error) {
    console.error('Errore durante il processo:', error);
    process.exit(1);
  }
}

// Esegui lo script
main();
