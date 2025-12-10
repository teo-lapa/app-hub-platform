/**
 * Aggiunge traduzioni agli articoli blog esistenti usando il sistema corretto di Odoo
 * con context={'lang': 'xx_XX'}
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

// Write con context per la lingua
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

// Traduzioni per i primi 5 articoli principali
const TRANSLATIONS = [
  {
    id: 75, // Come Scegliere il Fornitore Giusto per la Tua Pizzeria
    de: {
      name: 'So Wählen Sie den Richtigen Lieferanten für Ihre Pizzeria in der Schweiz',
      subtitle: 'Kompletter Leitfaden für Gastronomen: Kriterien, Qualität und Service',
      website_meta_title: 'Pizzeria Lieferant Schweiz | Auswahlhilfe | LAPA',
      website_meta_description: 'Erfahren Sie, wie Sie den besten Lieferanten für Ihre Pizzeria in der Schweiz auswählen. Qualität, Lieferung, Service.',
    },
    fr: {
      name: 'Comment Choisir le Bon Fournisseur pour Votre Pizzeria en Suisse',
      subtitle: 'Guide complet pour restaurateurs: critères, qualité et service',
      website_meta_title: 'Fournisseur Pizzeria Suisse | Guide de Choix | LAPA',
      website_meta_description: 'Découvrez comment choisir le meilleur fournisseur pour votre pizzeria en Suisse. Qualité, livraison, service.',
    },
    en: {
      name: 'How to Choose the Right Supplier for Your Pizzeria in Switzerland',
      subtitle: 'Complete guide for restaurateurs: criteria, quality and service',
      website_meta_title: 'Pizzeria Supplier Switzerland | Selection Guide | LAPA',
      website_meta_description: 'Discover how to choose the best supplier for your pizzeria in Switzerland. Quality, delivery, service.',
    }
  },
  {
    id: 76, // Guida Completa: Aprire un Ristorante Italiano
    de: {
      name: 'Kompletter Leitfaden: Ein Italienisches Restaurant in der Schweiz Eröffnen',
      subtitle: 'Alles was Sie wissen müssen: Anforderungen, Lieferanten und praktische Tipps',
      website_meta_title: 'Italienisches Restaurant Schweiz Eröffnen | Leitfaden | LAPA',
      website_meta_description: 'Möchten Sie ein italienisches Restaurant in der Schweiz eröffnen? Kompletter Leitfaden mit Anforderungen und Tipps.',
    },
    fr: {
      name: 'Guide Complet: Ouvrir un Restaurant Italien en Suisse',
      subtitle: 'Tout ce que vous devez savoir: exigences, fournisseurs et conseils pratiques',
      website_meta_title: 'Ouvrir Restaurant Italien Suisse | Guide Complet | LAPA',
      website_meta_description: 'Vous voulez ouvrir un restaurant italien en Suisse? Guide complet avec exigences et conseils pratiques.',
    },
    en: {
      name: 'Complete Guide: Opening an Italian Restaurant in Switzerland',
      subtitle: 'Everything you need to know: requirements, suppliers and practical tips',
      website_meta_title: 'Open Italian Restaurant Switzerland | Complete Guide | LAPA',
      website_meta_description: 'Want to open an Italian restaurant in Switzerland? Complete guide with requirements and practical tips.',
    }
  },
  {
    id: 77, // Mozzarella di Bufala vs Fior di Latte
    de: {
      name: 'Büffelmozzarella vs Fior di Latte: Was für die Pizza Wählen?',
      subtitle: 'Kompletter Leitfaden für Pizzabäcker: Unterschiede, Verwendung und Tipps',
      website_meta_title: 'Büffelmozzarella vs Fior di Latte | Pizza Guide | LAPA',
      website_meta_description: 'Büffelmozzarella oder Fior di Latte für Pizza? Entdecken Sie die Unterschiede und wann welche zu verwenden ist.',
    },
    fr: {
      name: 'Mozzarella di Bufala vs Fior di Latte: Que Choisir pour la Pizza?',
      subtitle: 'Guide complet pour pizzaïolos: différences, utilisations et conseils',
      website_meta_title: 'Mozzarella Bufala vs Fior di Latte | Guide Pizza | LAPA',
      website_meta_description: 'Mozzarella di bufala ou fior di latte pour la pizza? Découvrez les différences et quand utiliser chacune.',
    },
    en: {
      name: 'Buffalo Mozzarella vs Fior di Latte: Which to Choose for Pizza?',
      subtitle: 'Complete guide for pizza makers: differences, uses and tips',
      website_meta_title: 'Buffalo Mozzarella vs Fior di Latte | Pizza Guide | LAPA',
      website_meta_description: 'Buffalo mozzarella or fior di latte for pizza? Discover the differences and when to use each.',
    }
  },
  {
    id: 78, // I 10 Prodotti Italiani Indispensabili per una Pizzeria
    de: {
      name: 'Die 10 Unverzichtbaren Italienischen Produkte für eine Erfolgreiche Pizzeria',
      subtitle: 'Die komplette Liste der Zutaten, die nicht fehlen dürfen',
      website_meta_title: '10 Unverzichtbare Pizzeria-Produkte | Komplette Liste | LAPA',
      website_meta_description: 'Welche italienischen Produkte dürfen in einer Pizzeria nicht fehlen? Die 10 essentiellen Zutaten.',
    },
    fr: {
      name: 'Les 10 Produits Italiens Indispensables pour une Pizzeria à Succès',
      subtitle: 'La liste complète des ingrédients qui ne doivent pas manquer',
      website_meta_title: '10 Produits Indispensables Pizzeria | Liste Complète | LAPA',
      website_meta_description: 'Quels produits italiens ne doivent pas manquer dans une pizzeria? Les 10 ingrédients essentiels.',
    },
    en: {
      name: 'The 10 Essential Italian Products for a Successful Pizzeria',
      subtitle: 'The complete list of ingredients you cannot be without',
      website_meta_title: '10 Essential Pizzeria Products | Complete List | LAPA',
      website_meta_description: 'Which Italian products are essential for a pizzeria? The 10 essential ingredients.',
    }
  },
  {
    id: 79, // Grossista Prodotti Italiani in Svizzera
    de: {
      name: 'Grosshändler für Italienische Produkte in der Schweiz: Den Besten Wählen',
      subtitle: 'Leitfaden für Restaurants und Pizzerien auf der Suche nach einem zuverlässigen Lieferanten',
      website_meta_title: 'Grosshändler Italienische Produkte Schweiz | Auswahlhilfe | LAPA',
      website_meta_description: 'Suchen Sie einen Grosshändler für italienische Produkte in der Schweiz? Leitfaden zur Auswahl.',
    },
    fr: {
      name: 'Grossiste Produits Italiens en Suisse: Comment Choisir le Meilleur',
      subtitle: 'Guide pour restaurants et pizzerias à la recherche d\'un fournisseur fiable',
      website_meta_title: 'Grossiste Produits Italiens Suisse | Guide de Choix | LAPA',
      website_meta_description: 'Vous cherchez un grossiste de produits italiens en Suisse? Guide pour choisir le bon fournisseur.',
    },
    en: {
      name: 'Italian Products Wholesaler in Switzerland: How to Choose the Best',
      subtitle: 'Guide for restaurants and pizzerias looking for a reliable supplier',
      website_meta_title: 'Italian Products Wholesaler Switzerland | Selection Guide | LAPA',
      website_meta_description: 'Looking for an Italian products wholesaler in Switzerland? Guide to choosing the right supplier.',
    }
  }
];

async function main() {
  console.log('🌐 AGGIUNTA TRADUZIONI AGLI ARTICOLI BLOG');
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

    // Pausa per non sovraccaricare
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RISULTATO');
  console.log('='.repeat(60));
  console.log(`✅ Traduzioni aggiunte: ${successCount}`);
  console.log(`❌ Errori: ${errorCount}`);
  console.log(`\n💡 Ora quando cambi lingua sul sito, vedrai la versione tradotta!`);
}

main();
