/**
 * Aggiunge traduzioni a TUTTI i 15 articoli blog (ID 75-89)
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data: any = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Connesso come ${ODOO_CONFIG.username}`);
  return data.result.uid;
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
        kwargs: {
          context: { lang: lang }
        }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    console.log(`❌ Errore: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Traduzioni per articoli 80-89
const TRANSLATIONS = [
  {
    id: 80, // Guanciale vs Pancetta
    de: {
      name: 'Guanciale vs Pancetta: Was ist der Unterschied und Wann Welches Verwenden',
      subtitle: 'Der definitive Leitfaden für italienische Restaurantbesitzer',
      website_meta_title: 'Guanciale vs Pancetta | Unterschiede und Verwendung | LAPA',
      website_meta_description: 'Guanciale oder Pancetta? Entdecken Sie die Unterschiede und warum Guanciale für Carbonara essentiell ist.',
    },
    fr: {
      name: 'Guanciale vs Pancetta: Quelle est la Différence et Quand les Utiliser',
      subtitle: 'Le guide définitif pour les restaurateurs italiens',
      website_meta_title: 'Guanciale vs Pancetta | Différences et Utilisations | LAPA',
      website_meta_description: 'Guanciale ou pancetta? Découvrez les différences et pourquoi le guanciale est essentiel pour la carbonara.',
    },
    en: {
      name: 'Guanciale vs Pancetta: What is the Difference and When to Use Each',
      subtitle: 'The definitive guide for Italian restaurateurs',
      website_meta_title: 'Guanciale vs Pancetta | Differences and Uses | LAPA',
      website_meta_description: 'Guanciale or pancetta? Discover the differences and why guanciale is essential for carbonara.',
    }
  },
  {
    id: 81, // Come Conservare Correttamente i Prodotti Freschi
    de: {
      name: 'Wie Man Frische Italienische Produkte Richtig Lagert',
      subtitle: 'Praktischer Leitfaden für Restaurantbesitzer: Temperaturen, Zeiten und Tipps',
      website_meta_title: 'Frische Italienische Produkte Lagern | Leitfaden | LAPA',
      website_meta_description: 'Wie lagert man Mozzarella, Wurstwaren und andere frische italienische Produkte richtig? Kompletter Leitfaden.',
    },
    fr: {
      name: 'Comment Conserver Correctement les Produits Frais Italiens',
      subtitle: 'Guide pratique pour restaurateurs: températures, durées et conseils',
      website_meta_title: 'Conserver Produits Frais Italiens | Guide | LAPA',
      website_meta_description: 'Comment conserver mozzarella, charcuteries et autres produits frais italiens? Guide complet.',
    },
    en: {
      name: 'How to Properly Store Fresh Italian Products',
      subtitle: 'Practical guide for restaurateurs: temperatures, times and tips',
      website_meta_title: 'Store Fresh Italian Products | Guide | LAPA',
      website_meta_description: 'How to store mozzarella, cured meats and other fresh Italian products? Complete guide.',
    }
  },
  {
    id: 82, // Olio Extravergine d'Oliva: Guida alla Scelta
    de: {
      name: 'Natives Olivenöl Extra: Auswahlhilfe für Restaurants',
      subtitle: 'DOP, IGP, Blend: Welches Öl für Ihr Lokal wählen',
      website_meta_title: 'Olivenöl Extra für Restaurants | Auswahlhilfe | LAPA',
      website_meta_description: 'Wie wählt man das beste Olivenöl extra für Ihr Restaurant? DOP vs IGP, fruchtig vs mild.',
    },
    fr: {
      name: 'Huile d\'Olive Extra Vierge: Guide de Choix pour Restaurants',
      subtitle: 'DOP, IGP, assemblage: quelle huile choisir pour votre établissement',
      website_meta_title: 'Huile Olive Extra Vierge Restaurants | Guide | LAPA',
      website_meta_description: 'Comment choisir la meilleure huile d\'olive extra vierge pour votre restaurant? DOP vs IGP.',
    },
    en: {
      name: 'Extra Virgin Olive Oil: Selection Guide for Restaurants',
      subtitle: 'DOP, IGP, blend: which oil to choose for your establishment',
      website_meta_title: 'Extra Virgin Olive Oil Restaurants | Guide | LAPA',
      website_meta_description: 'How to choose the best extra virgin olive oil for your restaurant? DOP vs IGP.',
    }
  },
  {
    id: 83, // Pasta Fresca vs Pasta Secca
    de: {
      name: 'Frische Pasta vs Trockene Pasta: Leitfaden für Restaurantbesitzer',
      subtitle: 'Wann welche verwenden für perfekte Ergebnisse',
      website_meta_title: 'Frische Pasta vs Trockene Pasta | Restaurant Leitfaden | LAPA',
      website_meta_description: 'Frische oder trockene Pasta in Ihrem Restaurant? Leitfaden um zu verstehen, wann welche zu verwenden ist.',
    },
    fr: {
      name: 'Pâtes Fraîches vs Pâtes Sèches: Guide pour Restaurateurs',
      subtitle: 'Quand utiliser l\'une ou l\'autre pour des résultats parfaits',
      website_meta_title: 'Pâtes Fraîches vs Sèches | Guide Restaurant | LAPA',
      website_meta_description: 'Pâtes fraîches ou sèches dans votre restaurant? Guide pour comprendre quand utiliser chacune.',
    },
    en: {
      name: 'Fresh Pasta vs Dried Pasta: Guide for Restaurateurs',
      subtitle: 'When to use each for perfect results',
      website_meta_title: 'Fresh Pasta vs Dried Pasta | Restaurant Guide | LAPA',
      website_meta_description: 'Fresh or dried pasta in your restaurant? Guide to understand when to use each.',
    }
  },
  {
    id: 84, // I Formaggi DOP Italiani
    de: {
      name: 'Italienische DOP-Käse die Jedes Restaurant Haben Muss',
      subtitle: 'Leitfaden zu zertifizierten Käsen: Parmigiano, Pecorino, Gorgonzola und mehr',
      website_meta_title: 'Italienische DOP Käse Restaurants | Leitfaden | LAPA',
      website_meta_description: 'Welche italienischen DOP-Käse in Ihrem Restaurant servieren? Leitfaden zu Parmigiano, Pecorino, Gorgonzola.',
    },
    fr: {
      name: 'Les Fromages DOP Italiens que Tout Restaurant Doit Avoir',
      subtitle: 'Guide des fromages certifiés: Parmigiano, Pecorino, Gorgonzola et autres',
      website_meta_title: 'Fromages DOP Italiens Restaurants | Guide | LAPA',
      website_meta_description: 'Quels fromages DOP italiens servir dans votre restaurant? Guide Parmigiano, Pecorino, Gorgonzola.',
    },
    en: {
      name: 'Italian DOP Cheeses Every Restaurant Must Have',
      subtitle: 'Guide to certified cheeses: Parmigiano, Pecorino, Gorgonzola and more',
      website_meta_title: 'Italian DOP Cheeses Restaurants | Guide | LAPA',
      website_meta_description: 'Which Italian DOP cheeses to serve in your restaurant? Guide to Parmigiano, Pecorino, Gorgonzola.',
    }
  },
  {
    id: 85, // Pomodori per Pizza
    de: {
      name: 'Tomaten für Pizza: San Marzano und Qualitätsalternativen',
      subtitle: 'Wie man die richtigen Tomaten für eine perfekte Pizzasauce wählt',
      website_meta_title: 'Tomaten Pizza San Marzano | Auswahlhilfe | LAPA',
      website_meta_description: 'San Marzano DOP oder Alternativen? Wie man Tomaten für Pizzasauce wählt. Leitfaden für Pizzabäcker.',
    },
    fr: {
      name: 'Tomates pour Pizza: San Marzano et Alternatives de Qualité',
      subtitle: 'Comment choisir les bonnes tomates pour une sauce pizza parfaite',
      website_meta_title: 'Tomates Pizza San Marzano | Guide de Choix | LAPA',
      website_meta_description: 'San Marzano DOP ou alternatives? Comment choisir les tomates pour sauce pizza. Guide pour pizzaïolos.',
    },
    en: {
      name: 'Tomatoes for Pizza: San Marzano and Quality Alternatives',
      subtitle: 'How to choose the right tomatoes for a perfect pizza sauce',
      website_meta_title: 'Tomatoes Pizza San Marzano | Selection Guide | LAPA',
      website_meta_description: 'San Marzano DOP or alternatives? How to choose tomatoes for pizza sauce. Guide for pizza makers.',
    }
  },
  {
    id: 86, // Attrezzature Essenziali per una Pizzeria
    de: {
      name: 'Wesentliche Ausstattung für eine Pizzeria: Die Komplette Liste',
      subtitle: 'Vom Ofen bis zur Schaufel: Alles was Sie zum Starten brauchen',
      website_meta_title: 'Pizzeria Ausstattung Komplette Liste | Leitfaden | LAPA',
      website_meta_description: 'Welche Ausstattung braucht man für eine Pizzeria? Komplette Liste: Öfen, Kneter, Arbeitsplatten.',
    },
    fr: {
      name: 'Équipements Essentiels pour une Pizzeria: La Liste Complète',
      subtitle: 'Du four à la pelle: tout ce qu\'il faut pour démarrer',
      website_meta_title: 'Équipements Pizzeria Liste Complète | Guide | LAPA',
      website_meta_description: 'Quels équipements faut-il pour une pizzeria? Liste complète: fours, pétrins, plans de travail.',
    },
    en: {
      name: 'Essential Equipment for a Pizzeria: The Complete List',
      subtitle: 'From oven to peel: everything you need to get started',
      website_meta_title: 'Pizzeria Equipment Complete List | Guide | LAPA',
      website_meta_description: 'What equipment do you need for a pizzeria? Complete list: ovens, mixers, work surfaces.',
    }
  },
  {
    id: 87, // I Salumi Italiani per Ristoranti
    de: {
      name: 'Italienische Wurstwaren für Restaurants: Kompletter Leitfaden',
      subtitle: 'Prosciutto, Speck, Salami und mehr: Was anbieten und wie lagern',
      website_meta_title: 'Italienische Wurstwaren Restaurants | Leitfaden | LAPA',
      website_meta_description: 'Welche italienischen Wurstwaren in Ihrem Restaurant anbieten? Leitfaden zu Prosciutto, Speck, Salami.',
    },
    fr: {
      name: 'La Charcuterie Italienne pour Restaurants: Guide Complet',
      subtitle: 'Prosciutto, Speck, Salami et autres: quoi proposer et comment conserver',
      website_meta_title: 'Charcuterie Italienne Restaurants | Guide | LAPA',
      website_meta_description: 'Quelles charcuteries italiennes proposer dans votre restaurant? Guide prosciutto, speck, salami.',
    },
    en: {
      name: 'Italian Cured Meats for Restaurants: Complete Guide',
      subtitle: 'Prosciutto, Speck, Salami and more: what to offer and how to store',
      website_meta_title: 'Italian Cured Meats Restaurants | Guide | LAPA',
      website_meta_description: 'Which Italian cured meats to offer in your restaurant? Guide to prosciutto, speck, salami.',
    }
  },
  {
    id: 88, // Come Creare un Menu Italiano Autentico
    de: {
      name: 'Wie Man ein Authentisches Italienisches Menü für Ihr Restaurant Erstellt',
      subtitle: 'Struktur, wesentliche Gerichte und Tipps um sich abzuheben',
      website_meta_title: 'Italienisches Restaurant Menü | Wie Erstellen | LAPA',
      website_meta_description: 'Wie strukturiert man ein authentisches italienisches Menü? Leitfaden: Vorspeisen, Primi, Secondi, Dolci.',
    },
    fr: {
      name: 'Comment Créer un Menu Italien Authentique pour Votre Restaurant',
      subtitle: 'Structure, plats essentiels et conseils pour se différencier',
      website_meta_title: 'Menu Restaurant Italien | Comment le Créer | LAPA',
      website_meta_description: 'Comment structurer un menu italien authentique? Guide: antipasti, primi, secondi, dolci.',
    },
    en: {
      name: 'How to Create an Authentic Italian Menu for Your Restaurant',
      subtitle: 'Structure, essential dishes and tips to stand out',
      website_meta_title: 'Italian Restaurant Menu | How to Create | LAPA',
      website_meta_description: 'How to structure an authentic Italian menu? Guide: antipasti, primi, secondi, dolci.',
    }
  },
  {
    id: 89, // Consegna Prodotti Freschi
    de: {
      name: 'Lieferung Frischer Produkte: Was bei einem Lieferanten zu Suchen',
      subtitle: 'Kühlkette, Zeitplanung und Zuverlässigkeit',
      website_meta_title: 'Lieferung Frischer Produkte Restaurants | Leitfaden | LAPA',
      website_meta_description: 'Wie wählt man einen Lieferanten für frische Produkte? Leitfaden zu Kühlkette und Lieferhäufigkeit.',
    },
    fr: {
      name: 'Livraison de Produits Frais: Que Rechercher chez un Fournisseur',
      subtitle: 'Chaîne du froid, délais et fiabilité',
      website_meta_title: 'Livraison Produits Frais Restaurants | Guide | LAPA',
      website_meta_description: 'Comment choisir un fournisseur pour produits frais? Guide sur chaîne du froid et fréquence de livraison.',
    },
    en: {
      name: 'Fresh Products Delivery: What to Look for in a Supplier',
      subtitle: 'Cold chain, timing and reliability',
      website_meta_title: 'Fresh Products Delivery Restaurants | Guide | LAPA',
      website_meta_description: 'How to choose a supplier for fresh products? Guide on cold chain and delivery frequency.',
    }
  }
];

async function main() {
  console.log('🌐 AGGIUNTA TRADUZIONI - ARTICOLI 80-89');
  console.log('='.repeat(60));

  await authenticate();

  let successCount = 0;
  let errorCount = 0;

  for (const article of TRANSLATIONS) {
    console.log(`\n📝 Articolo ID ${article.id}:`);

    // Tedesco
    const deSuccess = await writeWithLang('blog.post', [article.id], article.de, 'de_CH');
    if (deSuccess) {
      console.log(`   ✅ DE: ${article.de.name.substring(0, 40)}...`);
      successCount++;
    } else {
      console.log(`   ❌ DE: Errore`);
      errorCount++;
    }

    // Francese
    const frSuccess = await writeWithLang('blog.post', [article.id], article.fr, 'fr_CH');
    if (frSuccess) {
      console.log(`   ✅ FR: ${article.fr.name.substring(0, 40)}...`);
      successCount++;
    } else {
      console.log(`   ❌ FR: Errore`);
      errorCount++;
    }

    // Inglese
    const enSuccess = await writeWithLang('blog.post', [article.id], article.en, 'en_US');
    if (enSuccess) {
      console.log(`   ✅ EN: ${article.en.name.substring(0, 40)}...`);
      successCount++;
    } else {
      console.log(`   ❌ EN: Errore`);
      errorCount++;
    }

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RISULTATO FINALE');
  console.log('='.repeat(60));
  console.log(`✅ Traduzioni aggiunte: ${successCount}`);
  console.log(`❌ Errori: ${errorCount}`);
  console.log(`\n🎉 TOTALE: 15 articoli x 4 lingue = 60 versioni!`);
  console.log(`\n💡 Verifica su lapa.ch cambiando lingua nel menu!`);
}

main();
