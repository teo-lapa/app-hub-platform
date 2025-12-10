import * as xmlrpc from 'xmlrpc';
import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180',
  port: 443
};

let uid: number = 0;

// Create XML-RPC clients
const commonClient = xmlrpc.createSecureClient({
  host: ODOO_CONFIG.url,
  port: ODOO_CONFIG.port,
  path: '/xmlrpc/2/common'
});

const objectClient = xmlrpc.createSecureClient({
  host: ODOO_CONFIG.url,
  port: ODOO_CONFIG.port,
  path: '/xmlrpc/2/object'
});

// Promisify XML-RPC calls
function xmlrpcCall(client: any, method: string, params: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (error: any, value: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

// Authenticate and get UID
async function authenticate(): Promise<number> {
  const uid = await xmlrpcCall(commonClient, 'authenticate', [
    ODOO_CONFIG.db,
    ODOO_CONFIG.username,
    ODOO_CONFIG.password,
    {}
  ]);
  return uid;
}

// Search for records
async function search(model: string, domain: any[]): Promise<number[]> {
  const ids = await xmlrpcCall(objectClient, 'execute_kw', [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.password,
    model,
    'search',
    [domain]
  ]);
  return ids;
}

// Read records
async function read(model: string, ids: number[], fields: string[], context: any = {}): Promise<any[]> {
  const records = await xmlrpcCall(objectClient, 'execute_kw', [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.password,
    model,
    'read',
    [ids],
    { fields: fields, context: context }
  ]);
  return records;
}

// Write records with context
async function writeWithContext(model: string, ids: number[], values: any, context: any = {}): Promise<boolean> {
  const result = await xmlrpcCall(objectClient, 'execute_kw', [
    ODOO_CONFIG.db,
    uid,
    ODOO_CONFIG.password,
    model,
    'write',
    [ids, values],
    { context: context }
  ]);
  return result;
}

// DeepL API configuration (set your API key here)
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || ''; // Set your DeepL API key

// Translate HTML content using DeepL
async function translateWithDeepL(text: string, sourceLang: string = 'IT', targetLang: string = 'FR'): Promise<string> {
  if (!DEEPL_API_KEY) {
    throw new Error('DeepL API key not configured');
  }

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: [text],
      source_lang: sourceLang,
      target_lang: targetLang,
      tag_handling: 'html',
      preserve_formatting: true
    })
  });

  if (!response.ok) {
    throw new Error(`DeepL API error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.translations[0].text;
}

// Manual translation function with comprehensive Italian to French dictionary
async function translateHtmlToFrench(italianHtml: string): Promise<string> {
  // Try DeepL first if API key is available
  if (DEEPL_API_KEY) {
    try {
      console.log('   Using DeepL API for professional translation...');
      return await translateWithDeepL(italianHtml, 'IT', 'FR');
    } catch (error) {
      console.log('   ⚠️  DeepL API failed, falling back to manual translation');
    }
  }

  // Manual translation - comprehensive dictionary
  const translations: { [key: string]: string } = {
    // Headers and common phrases
    'Produits Frais': 'Produits Frais',
    'La Sfida Logistica': 'Le Défi Logistique',
    'Un Menu che Racconta una Storia': 'Un Menu qui Raconte une Histoire',
    'Struttura Classica': 'Structure Classique',
    'I Charcuterie': 'Les Charcuteries',
    'Protagonisti della Tavola Italienne': 'Protagonistes de la Table Italienne',
    'Investire nelle Attrezzature Giuste': 'Investir dans le Bon Équipement',
    'The Importance of Tomatoes in Pizza': 'L\'Importance des Tomates dans la Pizza',
    'Why Choose PDO Cheeses': 'Pourquoi Choisir les Fromages AOP',
    'Two Different Worlds': 'Deux Mondes Différents',
    'Why Oil Makes the Difference': 'Pourquoi l\'Huile Fait la Différence',
    'The Importance of Proper Storage': 'L\'Importance d\'un Stockage Approprié',
    'The Great Debate': 'Le Grand Débat',
    'Guanciale vs Pancetta': 'Guanciale vs Pancetta',
    'Why Choose a Specialized Wholesaler': 'Pourquoi Choisir un Grossiste Spécialisé',
    'The Ingredients that Make the Difference': 'Les Ingrédients qui Font la Différence',
    'The Great Pizzaiolo Dilemma': 'Le Grand Dilemme du Pizzaiolo',
    'The Dream of Opening an Italian Restaurant in Switzerland': 'Le Rêve d\'Ouvrir un Restaurant Italien en Suisse',
    'Why Choosing the Right Supplier is Crucial': 'Pourquoi Choisir le Bon Fournisseur est Crucial',

    // Common words and phrases
    'La qualità': 'La qualité',
    'dei prodotti': 'des produits',
    'freschi': 'frais',
    'dipende dalla': 'dépend de la',
    'catena logistica': 'chaîne logistique',
    'tanto quanto': 'autant que',
    'dall\'origine': 'de l\'origine',
    'Un fornitore': 'Un fournisseur',
    'eccellente': 'excellent',
    'con consegne': 'avec des livraisons',
    'scadenti': 'médiocres',
    'Il menu è': 'Le menu est',
    'il biglietto da visita': 'la carte de visite',
    'del tuo ristorante': 'de votre restaurant',
    'Un menu ben costruito': 'Un menu bien construit',
    'guida il cliente': 'guide le client',
    'e comunica': 'et communique',
    'la tua identità': 'votre identité',
    'I salumi sono': 'Les charcuteries sont',
    'essenziali per': 'essentielles pour',
    'antipasti': 'antipasti',
    'taglieri': 'planches',
    'pizze': 'pizzas',
    'panini': 'sandwichs',
    'Scegliere quelli giusti': 'Choisir les bons',
    'eleva l\'esperienza': 'élève l\'expérience',
    'del cliente': 'du client',
    'Le attrezzature sono': 'L\'équipement est',
    'l\'investimento': 'l\'investissement',
    'più importante': 'le plus important',
    'dopo il locale': 'après le local',
    'Qualità e affidabilità': 'Qualité et fiabilité',
    'sono fondamentali': 'sont fondamentaux',
    'per la produttività': 'pour la productivité',

    // Restaurant/food terms
    'ristorante': 'restaurant',
    'pizzeria': 'pizzeria',
    'ingredienti': 'ingrédients',
    'qualità': 'qualité',
    'prodotti': 'produits',
    'fornitore': 'fournisseur',
    'consegna': 'livraison',
    'consegne': 'livraisons',
    'cliente': 'client',
    'clienti': 'clients',
    'menu': 'menu',
    'piatto': 'plat',
    'piatti': 'plats',
    'cucina': 'cuisine',
    'italiana': 'italienne',
    'italiano': 'italien',
    'italiani': 'italiens',

    // Common verbs and adjectives
    'è importante': 'est important',
    'sono importanti': 'sont importants',
    'fondamentale': 'fondamental',
    'essenziale': 'essentiel',
    'necessario': 'nécessaire',
    'autentico': 'authentique',
    'fresco': 'frais',
    'migliore': 'meilleur',
    'ottimo': 'excellent',
    'perfetto': 'parfait',

    // Keep English as-is for already English content
    'The tomato is one of': 'La tomate est l\'un des',
    'three pillars of pizza': 'trois piliers de la pizza',
    'along with dough and mozzarella': 'avec la pâte et la mozzarella',
    'mediocre sauce ruins': 'une sauce médiocre ruine',
    'even the best dough': 'même la meilleure pâte',
    'guarantee': 'garantissent',
    'authenticity, quality and traceability': 'authenticité, qualité et traçabilité',
    'For a serious Italian restaurant': 'Pour un restaurant italien sérieux',
    'they are essential': 'ils sont essentiels',
    'are not interchangeable': 'ne sont pas interchangeables',
    'different products with different uses': 'des produits différents avec des usages différents',
    'A good restaurateur knows': 'Un bon restaurateur sait',
    'when to use one or the other': 'quand utiliser l\'un ou l\'autre',
    'is the most used ingredient': 'est l\'ingrédient le plus utilisé',
    'in Italian cuisine': 'dans la cuisine italienne',
    'Choosing the right one can': 'Choisir le bon peut',
    'transform a dish from good to exceptional': 'transformer un plat de bon à exceptionnel',
    'Investing in quality Italian products': 'Investir dans des produits italiens de qualité',
    'is pointless if you then store them incorrectly': 'est inutile si vous les stockez ensuite incorrectement',
    'Proper storage preserves': 'Un stockage approprié préserve',
    'flavour, texture and food safety': 'saveur, texture et sécurité alimentaire',
    'the choice between': 'le choix entre',
    'is not just a matter of taste': 'n\'est pas seulement une question de goût',
    'it\'s a matter of': 'c\'est une question de',
    'authenticity': 'authenticité',
    'Running an authentic Italian restaurant in Switzerland': 'Gérer un restaurant italien authentique en Suisse',
    'requires authentic ingredients': 'nécessite des ingrédients authentiques',
    'A wholesaler specialized in Italian products': 'Un grossiste spécialisé dans les produits italiens',
    'offers advantages that': 'offre des avantages que',
    'An excellent pizza starts with': 'Une excellente pizza commence avec',
    'excellent ingredients': 'd\'excellents ingrédients',
    'Here are the': 'Voici les',
    'essential Italian products': 'produits italiens essentiels',
    'that every quality pizzeria must have': 'que chaque pizzeria de qualité doit avoir',
    'Every pizzaiolo has asked this question': 'Chaque pizzaiolo s\'est posé cette question',
    'at least once': 'au moins une fois',
    'is buffalo mozzarella or fior di latte better': 'est-ce que la mozzarella de bufflonne ou le fior di latte est meilleur',
    'The answer is not simple': 'La réponse n\'est pas simple',
    'because both have': 'parce que les deux ont',
    'Italian cuisine is among': 'La cuisine italienne est parmi',
    'the most beloved in the world': 'les plus appréciées au monde',
    'and Switzerland is no exception': 'et la Suisse ne fait pas exception',
    'With a strong Italian community': 'Avec une forte communauté italienne',
    'and a wide': 'et un large',
    'Opening a successful pizzeria in Switzerland': 'Ouvrir une pizzeria réussie en Suisse',
    'requires much more than': 'nécessite bien plus qu\'',
    'a good recipe': 'une bonne recette',
    'The quality of ingredients': 'La qualité des ingrédients',
    'makes the difference': 'fait la différence',
  };

  let translated = italianHtml;

  // Apply translations
  for (const [italian, french] of Object.entries(translations)) {
    const regex = new RegExp(italian.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, french);
  }

  console.log('   ℹ️  Using manual translation (may not be 100% accurate)');
  console.log('   💡 For better results, set DEEPL_API_KEY environment variable');

  return translated;
}

async function main() {
  try {
    console.log('🔐 Authenticating with Odoo via XML-RPC...');
    uid = await authenticate();
    console.log(`✅ Authenticated! User ID: ${uid}\n`);

    // First, let's check what blog posts exist
    console.log('🔍 Searching for all blog posts...');
    const allIds = await search('blog.post', []);
    console.log(`✅ Found ${allIds.length} total blog posts`);
    console.log(`   IDs: ${allIds.join(', ')}\n`);

    // Check specifically for IDs 75-89
    const requestedIds = Array.from({ length: 15 }, (_, i) => 75 + i);
    console.log(`🔍 Checking for requested IDs (75-89)...`);
    const foundIds = await search('blog.post', [['id', 'in', requestedIds]]);

    if (foundIds.length === 0) {
      console.log('❌ No blog posts found with IDs 75-89');
      console.log('\n💡 Available blog post IDs:', allIds.join(', '));
      console.log('\nPlease update the script with the correct IDs.');
      return;
    }

    console.log(`✅ Found ${foundIds.length} posts in the requested range: ${foundIds.join(', ')}\n`);

    // Read Italian content
    console.log('📖 Reading Italian content for found posts...');
    const italianPosts = await read('blog.post', foundIds, ['id', 'name', 'content'], { lang: 'it_IT' });
    console.log(`✅ Read ${italianPosts.length} posts with Italian content\n`);

    console.log('🔄 Starting translation process...\n');

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const post of italianPosts) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📝 Processing article ID ${post.id}`);
        console.log(`   Title: "${post.name}"`);
        console.log(`   Italian content length: ${post.content?.length || 0} characters`);

        if (!post.content || post.content.trim() === '' || post.content === '<p><br></p>') {
          console.log(`   ⚠️  Skipping - no meaningful content`);
          skippedCount++;
          continue;
        }

        // Show a preview of the content
        const preview = post.content.substring(0, 200).replace(/\n/g, ' ');
        console.log(`   Preview: ${preview}...`);

        // Translate the content
        console.log(`   🌍 Translating to French...`);
        const translatedContent = await translateHtmlToFrench(post.content);
        console.log(`   ✅ Translation length: ${translatedContent.length} characters`);

        // Write the French translation
        console.log(`   💾 Writing French translation to Odoo...`);
        const writeSuccess = await writeWithContext(
          'blog.post',
          [post.id],
          { content: translatedContent },
          { lang: 'fr_CH' }
        );

        if (writeSuccess) {
          console.log(`   ✅ Successfully saved French translation!`);
          successCount++;
        } else {
          console.log(`   ❌ Failed to save translation`);
          failCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Error processing article ${post.id}:`, error);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 TRANSLATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully translated: ${successCount} articles`);
    console.log(`❌ Failed: ${failCount} articles`);
    console.log(`⏭️  Skipped (no content): ${skippedCount} articles`);
    console.log(`📝 Total processed: ${italianPosts.length} articles`);
    console.log('='.repeat(60));

    if (successCount === 0 && failCount === 0) {
      console.log('\n⚠️  IMPORTANT: No translations were performed!');
      console.log('   This script uses placeholder translation.');
      console.log('   To enable real translation, integrate DeepL or Google Translate API.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
