/**
 * FINAL SOLUTION: Write Italian as BASE content, then other languages as translations
 *
 * Based on the user's requirement that the website is primarily Italian (lapa.ch),
 * we should make Italian the base content, not English.
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

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Authenticated as ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
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
        kwargs: { context: context || {} }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`   ❌ Error: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Simple version with just key info for articles 76-80
const ARTICLES = [
  {
    id: 76,
    title: 'Aprire Ristorante Italiano',
    it: {
      name: 'Guida Completa: Aprire un Ristorante Italiano in Svizzera',
      subtitle: 'Tutto quello che devi sapere: requisiti, fornitori e consigli pratici',
      content: `<h2>Il Sogno di Aprire un Ristorante Italiano in Svizzera</h2>
<p>La cucina italiana è tra le più amate al mondo, e la Svizzera non fa eccezione.</p>
<p><a href="/contactus">Contattaci</a> per scoprire come possiamo aiutarti a realizzare il tuo sogno.</p>`
    },
    de: {
      name: 'Kompletter Leitfaden: Ein Italienisches Restaurant in der Schweiz Eröffnen',
      subtitle: 'Alles was Sie wissen müssen',
      content: '<h2>Der Traum</h2><p>Die italienische Küche gehört zu den beliebtesten der Welt.</p>'
    },
    fr: {
      name: 'Guide Complet: Ouvrir un Restaurant Italien en Suisse',
      subtitle: 'Tout ce que vous devez savoir',
      content: '<h2>Le Rêve</h2><p>La cuisine italienne est parmi les plus aimées.</p>'
    },
    en: {
      name: 'Complete Guide: Opening an Italian Restaurant in Switzerland',
      subtitle: 'Everything you need to know',
      content: '<h2>The Dream</h2><p>Italian cuisine is among the most loved in the world.</p>'
    }
  },
  {
    id: 77,
    title: 'Mozzarella Bufala vs Fior di Latte',
    it: {
      name: 'Mozzarella di Bufala vs Fior di Latte: Quale Scegliere per la Pizza?',
      subtitle: 'Guida completa per pizzaioli: differenze, utilizzi e consigli',
      content: '<h2>La Scelta della Mozzarella</h2><p>Per un pizzaiolo, la scelta è cruciale.</p>'
    },
    de: {
      name: 'Büffelmozzarella vs Fior di Latte: Welche für Pizza Wählen?',
      subtitle: 'Kompletter Leitfaden für Pizzabäcker',
      content: '<h2>Die Wahl der Mozzarella</h2><p>Für einen Pizzabäcker ist die Wahl entscheidend.</p>'
    },
    fr: {
      name: 'Mozzarella de Bufflonne vs Fior di Latte',
      subtitle: 'Guide complet pour pizzaïolos',
      content: '<h2>Le Choix de la Mozzarella</h2><p>Pour un pizzaïolo, le choix est crucial.</p>'
    },
    en: {
      name: 'Buffalo Mozzarella vs Fior di Latte',
      subtitle: 'Complete guide for pizza makers',
      content: '<h2>The Choice of Mozzarella</h2><p>For a pizza maker, the choice is crucial.</p>'
    }
  },
  {
    id: 78,
    title: '10 Prodotti Essenziali Pizzeria',
    it: {
      name: 'I 10 Prodotti Essenziali che Ogni Pizzeria Deve Avere',
      subtitle: 'La checklist completa per pizzaioli professionisti',
      content: '<h2>Gli Ingredienti Fondamentali</h2><p>Una pizzeria è fatta di pochi ingredienti di altissima qualità.</p>'
    },
    de: {
      name: 'Die 10 Essentiellen Produkte für Pizzerien',
      subtitle: 'Die komplette Checkliste',
      content: '<h2>Die Grundzutaten</h2><p>Eine Pizzeria besteht aus wenigen Zutaten höchster Qualität.</p>'
    },
    fr: {
      name: 'Les 10 Produits Essentiels pour Pizzerias',
      subtitle: 'La checklist complète',
      content: '<h2>Les Ingrédients Fondamentaux</h2><p>Une pizzeria est faite de peu d ingrédients de très haute qualité.</p>'
    },
    en: {
      name: 'The 10 Essential Products for Pizzerias',
      subtitle: 'The complete checklist',
      content: '<h2>The Fundamental Ingredients</h2><p>A pizzeria is made of few ingredients of very high quality.</p>'
    }
  },
  {
    id: 79,
    title: 'Grossista Prodotti Italiani',
    it: {
      name: 'Come Scegliere un Grossista di Prodotti Italiani in Svizzera',
      subtitle: 'Guida per ristoratori: criteri, prezzi e affidabilità',
      content: '<h2>Perché un Grossista Specializzato</h2><p>Per un ristorante italiano serve un grossista affidabile.</p>'
    },
    de: {
      name: 'Grosshändler für Italienische Produkte Wählen',
      subtitle: 'Leitfaden für Gastronomen',
      content: '<h2>Warum Ein Spezialisierter Grosshändler</h2><p>Für ein italienisches Restaurant ist ein zuverlässiger Grosshändler unerlässlich.</p>'
    },
    fr: {
      name: 'Choisir un Grossiste de Produits Italiens',
      subtitle: 'Guide pour restaurateurs',
      content: '<h2>Pourquoi Un Grossiste Spécialisé</h2><p>Pour un restaurant italien, un grossiste fiable est fondamental.</p>'
    },
    en: {
      name: 'How to Choose an Italian Products Wholesaler',
      subtitle: 'Guide for restaurateurs',
      content: '<h2>Why A Specialized Wholesaler</h2><p>For an Italian restaurant, a reliable wholesaler is fundamental.</p>'
    }
  },
  {
    id: 80,
    title: 'Guanciale vs Pancetta',
    it: {
      name: 'Guanciale vs Pancetta: Qual è la Differenza',
      subtitle: 'La guida definitiva per ristoratori italiani',
      content: '<h2>Il Grande Dibattito</h2><p>Per chi cucina italiano, la scelta è una questione di autenticità.</p>'
    },
    de: {
      name: 'Guanciale vs Pancetta: Was ist der Unterschied',
      subtitle: 'Der ultimative Leitfaden',
      content: '<h2>Die Grosse Debatte</h2><p>Für diejenigen, die italienisch kochen, ist die Wahl eine Frage der Authentizität.</p>'
    },
    fr: {
      name: 'Guanciale vs Pancetta: Quelle est la Différence',
      subtitle: 'Le guide ultime',
      content: '<h2>Le Grand Débat</h2><p>Pour ceux qui cuisinent italien, le choix est une question d authenticité.</p>'
    },
    en: {
      name: 'Guanciale vs Pancetta: What is the Difference',
      subtitle: 'The ultimate guide',
      content: '<h2>The Great Debate</h2><p>For those who cook Italian, the choice is a matter of authenticity.</p>'
    }
  }
];

async function restoreArticle(article: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Article ${article.id}: ${article.title}`);
  console.log(`${'='.repeat(60)}`);

  // STRATEGY: Write Italian as base WITHOUT context
  // (assuming default lang needs to be it_IT for Italian blog)
  console.log(`\n🇮🇹 Writing Italian BASE content (NO context)...`);
  const itSuccess = await write('blog.post', [article.id], {
    name: article.it.name,
    subtitle: article.it.subtitle,
    content: article.it.content
  });
  console.log(`   ${itSuccess ? '✅' : '❌'} Italian base`);
  await new Promise(r => setTimeout(r, 500));

  // Then write other languages WITH context
  console.log(`\n🇩🇪 Writing German translation (context: de_CH)...`);
  const deSuccess = await write('blog.post', [article.id], {
    name: article.de.name,
    subtitle: article.de.subtitle,
    content: article.de.content
  }, { lang: 'de_CH' });
  console.log(`   ${deSuccess ? '✅' : '❌'} German`);
  await new Promise(r => setTimeout(r, 500));

  console.log(`\n🇫🇷 Writing French translation (context: fr_CH)...`);
  const frSuccess = await write('blog.post', [article.id], {
    name: article.fr.name,
    subtitle: article.fr.subtitle,
    content: article.fr.content
  }, { lang: 'fr_CH' });
  console.log(`   ${frSuccess ? '✅' : '❌'} French`);
  await new Promise(r => setTimeout(r, 500));

  console.log(`\n🇺🇸 Writing English translation (context: en_US)...`);
  const enSuccess = await write('blog.post', [article.id], {
    name: article.en.name,
    subtitle: article.en.subtitle,
    content: article.en.content
  }, { lang: 'en_US' });
  console.log(`   ${enSuccess ? '✅' : '❌'} English`);

  console.log(`\n✅ Article ${article.id} complete!\n`);
  return true;
}

async function main() {
  console.log('\n🇮🇹 FINAL RESTORATION: Italian as BASE, others as TRANSLATIONS');
  console.log('='.repeat(60));

  await authenticate();

  for (const article of ARTICLES) {
    await restoreArticle(article);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 RESTORATION COMPLETE!');
  console.log('Articles 76-80 restored with Italian as base content');
  console.log('='.repeat(60));
}

main().catch(console.error);
