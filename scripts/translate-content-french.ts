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

// Funzione per tradurre il contenuto HTML in francese
function translateToFrench(htmlContent: string): string {
  // Dizionario di traduzioni IT -> FR per termini comuni
  const translations: { [key: string]: string } = {
    // Termini generali
    'Introduzione': 'Introduction',
    'Conclusione': 'Conclusion',
    'Cos\'è': 'Qu\'est-ce que',
    'Come': 'Comment',
    'Perché': 'Pourquoi',
    'Quando': 'Quand',
    'Dove': 'Où',
    'Chi': 'Qui',
    'Quali': 'Quels',
    'Vantaggi': 'Avantages',
    'Svantaggi': 'Inconvénients',
    'Caratteristiche': 'Caractéristiques',
    'Funzionalità': 'Fonctionnalités',
    'Esempi': 'Exemples',
    'Guida': 'Guide',
    'Tutorial': 'Tutoriel',
    'Suggerimenti': 'Conseils',
    'Consigli': 'Conseils',
    'Best practices': 'Bonnes pratiques',
    'Soluzioni': 'Solutions',
    'Problemi': 'Problèmes',
    'Sfide': 'Défis',
    'Opportunità': 'Opportunités',
    'Tendenze': 'Tendances',
    'Innovazioni': 'Innovations',
    'Strategie': 'Stratégies',
    'Metodi': 'Méthodes',
    'Tecniche': 'Techniques',
    'Strumenti': 'Outils',
    'Risorse': 'Ressources',
    'Servizi': 'Services',
    'Prodotti': 'Produits',
    'Azienda': 'Entreprise',
    'Business': 'Business',
    'Mercato': 'Marché',
    'Settore': 'Secteur',
    'Industria': 'Industrie',
    'Cliente': 'Client',
    'Clienti': 'Clients',
    'Partner': 'Partenaire',
    'Collaborazione': 'Collaboration',
    'Team': 'Équipe',
    'Progetto': 'Projet',
    'Progetti': 'Projets',
    'Obiettivi': 'Objectifs',
    'Risultati': 'Résultats',
    'Performance': 'Performance',
    'Qualità': 'Qualité',
    'Efficienza': 'Efficacité',
    'Produttività': 'Productivité',
    'Crescita': 'Croissance',
    'Sviluppo': 'Développement',
    'Miglioramento': 'Amélioration',
    'Ottimizzazione': 'Optimisation',
    'Gestione': 'Gestion',
    'Controllo': 'Contrôle',
    'Monitoraggio': 'Surveillance',
    'Analisi': 'Analyse',
    'Dati': 'Données',
    'Informazioni': 'Informations',
    'Contenuti': 'Contenus',
    'Piattaforma': 'Plateforme',
    'Sistema': 'Système',
    'Software': 'Logiciel',
    'Tecnologia': 'Technologie',
    'Digitale': 'Numérique',
    'Online': 'En ligne',
    'Web': 'Web',
    'Internet': 'Internet',
    'Social media': 'Réseaux sociaux',
    'Marketing': 'Marketing',
    'Comunicazione': 'Communication',
    'Vendita': 'Vente',
    'Vendite': 'Ventes',
    'E-commerce': 'E-commerce',
    'Negozio': 'Magasin',
    'Acquisto': 'Achat',
    'Acquisti': 'Achats',
    'Ordine': 'Commande',
    'Ordini': 'Commandes',
    'Pagamento': 'Paiement',
    'Prezzo': 'Prix',
    'Costo': 'Coût',
    'Valore': 'Valeur',
    'Investimento': 'Investissement',
    'ROI': 'ROI',
    'Budget': 'Budget',
    'Finanza': 'Finance',
    'Economia': 'Économie',
    'Risparmio': 'Économie',
    'Profitto': 'Profit',
    'Ricavi': 'Revenus',
    'Fatturato': 'Chiffre d\'affaires',
    // Termini specifici del settore food/ristorazione
    'Ristorante': 'Restaurant',
    'Ristoranti': 'Restaurants',
    'Pizzeria': 'Pizzeria',
    'Pizzerie': 'Pizzerias',
    'Cucina': 'Cuisine',
    'Chef': 'Chef',
    'Ingredienti': 'Ingrédients',
    'Ingrediente': 'Ingrédient',
    'Fornitore': 'Fournisseur',
    'Fornitori': 'Fournisseurs',
    'Grossista': 'Grossiste',
    'Consegna': 'Livraison',
    'Fresco': 'Frais',
    'Freschi': 'Frais',
    'Italiano': 'Italien',
    'Italiana': 'Italienne',
    'Italiani': 'Italiens',
    'Italiane': 'Italiennes',
    'Svizzera': 'Suisse',
    'Menu': 'Menu',
    'Ricetta': 'Recette',
    'Ricette': 'Recettes',
    'Farina': 'Farine',
    'Mozzarella': 'Mozzarella',
    'Pomodoro': 'Tomate',
    'Pomodori': 'Tomates',
    'Olio': 'Huile',
    'Pasta': 'Pâtes',
    'Formaggio': 'Fromage',
    'Formaggi': 'Fromages',
    'Salumi': 'Charcuterie',
    'Prosciutto': 'Jambon',
    'Autentico': 'Authentique',
    'Tradizionale': 'Traditionnel',
    'Artigianale': 'Artisanal',
    'DOP': 'AOP',
    'IGP': 'IGP',
    'Biologico': 'Biologique',
  };

  let translated = htmlContent;

  console.log('ATTENZIONE: Questa è una traduzione automatica base.');
  console.log('Per una traduzione professionale completa, considera di usare DeepL API o Google Translate API.');

  // Applica le traduzioni ai termini comuni
  for (const [italian, french] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${italian}\\b`, 'gi');
    translated = translated.replace(regex, french);
  }

  return translated;
}

// Funzione per tradurre contenuto
async function translateContent(content: string): Promise<string> {
  return translateToFrench(content);
}

// Funzione principale
async function main() {
  try {
    console.log('Inizio processo di traduzione IT -> FR...\n');

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

      // Scrivi la traduzione con context francese
      console.log('  Scrittura traduzione in Odoo (fr_CH)...');
      const success = await writeWithLang(
        'blog.post',
        [article.id],
        { content: translatedContent },
        'fr_CH'
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
