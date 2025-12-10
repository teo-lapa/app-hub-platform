/**
 * URGENT: Restore blog articles 76-80
 * This script restores content for articles that were accidentally destroyed
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

  const data: any = await response.json();
  if (data.error) {
    console.log(`❌ Error: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Article content for restoration
const ARTICLES_CONTENT = {
  // Article 76 = aprire-ristorante-italiano
  76: {
    it_IT: {
      name: 'Guida Completa: Aprire un Ristorante Italiano in Svizzera',
      subtitle: 'Tutto quello che devi sapere: requisiti, fornitori e consigli pratici',
      content: `
<h2>Il Sogno di Aprire un Ristorante Italiano in Svizzera</h2>
<p>La cucina italiana è tra le più amate al mondo, e la Svizzera non fa eccezione. Con una forte comunità italiana e una passione diffusa per pizza, pasta e prodotti mediterranei, aprire un ristorante italiano può essere un'ottima opportunità di business.</p>

<h2>Requisiti Legali e Permessi</h2>

<h3>Permesso di Lavoro</h3>
<p>Se non sei cittadino svizzero o UE, avrai bisogno di un permesso di lavoro. I cittadini UE godono della libera circolazione.</p>

<h3>Licenze Necessarie</h3>
<ul>
<li><strong>Patente di esercizio</strong> - Obbligatoria per servire alcolici</li>
<li><strong>Certificato HACCP</strong> - Per la sicurezza alimentare</li>
<li><strong>Registrazione commerciale</strong> - Presso il registro di commercio cantonale</li>
<li><strong>Assicurazioni</strong> - RC, incendio, infortuni</li>
</ul>

<h3>Norme Igieniche</h3>
<p>La Svizzera ha standard igienici molto elevati. La tua cucina deve rispettare le normative cantonali sulla ristorazione.</p>

<h2>Trovare la Location Giusta</h2>
<p>La posizione è cruciale. Considera:</p>
<ul>
<li>Traffico pedonale e visibilità</li>
<li>Parcheggio disponibile</li>
<li>Concorrenza nella zona</li>
<li>Costo dell'affitto (varia molto tra cantoni)</li>
</ul>

<h2>Scegliere i Fornitori</h2>
<p>La qualità degli ingredienti definisce il tuo ristorante. Per un autentico ristorante italiano, hai bisogno di:</p>
<ul>
<li>Pasta fresca e secca di qualità</li>
<li>Formaggi italiani DOP (Parmigiano, Pecorino, Mozzarella)</li>
<li>Salumi autentici (Prosciutto di Parma, Guanciale, Speck)</li>
<li>Olio extravergine d'oliva</li>
<li>Pomodori San Marzano</li>
<li>Vini italiani</li>
</ul>

<p><strong>LAPA</strong> è il grossista di riferimento per ristoranti italiani in Svizzera, con oltre 3.000 prodotti autentici e consegna in tutto il paese.</p>

<h2>Budget Iniziale</h2>
<p>Aprire un ristorante in Svizzera richiede un investimento significativo:</p>
<ul>
<li>Ristrutturazione locale: CHF 50.000 - 200.000</li>
<li>Attrezzature cucina: CHF 30.000 - 100.000</li>
<li>Arredamento: CHF 20.000 - 80.000</li>
<li>Stock iniziale: CHF 10.000 - 30.000</li>
<li>Marketing lancio: CHF 5.000 - 20.000</li>
<li>Capitale circolante: CHF 30.000 - 50.000</li>
</ul>

<h2>Consigli per il Successo</h2>
<ol>
<li><strong>Autenticità</strong> - Non cercare di piacere a tutti, resta fedele alla cucina italiana</li>
<li><strong>Qualità costante</strong> - Meglio un menu ridotto ma eccellente</li>
<li><strong>Fornitori affidabili</strong> - La qualità degli ingredienti è fondamentale</li>
<li><strong>Personale formato</strong> - Investi nella formazione del team</li>
<li><strong>Marketing locale</strong> - Google My Business, social media, passaparola</li>
</ol>

<h2>Conclusione</h2>
<p>Aprire un ristorante italiano in Svizzera è una sfida, ma con la giusta preparazione e i partner giusti, può diventare un successo. LAPA è qui per supportarti con prodotti di qualità e un servizio dedicato.</p>

<p><a href="/contactus">Contattaci</a> per scoprire come possiamo aiutarti a realizzare il tuo sogno.</p>
`,
      website_meta_title: 'Aprire Ristorante Italiano Svizzera | Guida Completa | LAPA',
      website_meta_description: 'Vuoi aprire un ristorante italiano in Svizzera? Guida completa con requisiti, permessi, fornitori e consigli pratici. Scopri come iniziare con LAPA.'
    },
    de_DE: {
      name: 'Kompletter Leitfaden: Ein Italienisches Restaurant in der Schweiz Eröffnen',
      subtitle: 'Alles was Sie wissen müssen: Anforderungen, Lieferanten und praktische Tipps',
      content: `
<h2>Der Traum, ein Italienisches Restaurant in der Schweiz zu Eröffnen</h2>
<p>Die italienische Küche gehört zu den beliebtesten der Welt, und die Schweiz ist keine Ausnahme. Mit einer starken italienischen Gemeinschaft und einer weit verbreiteten Leidenschaft für Pizza, Pasta und mediterrane Produkte kann die Eröffnung eines italienischen Restaurants eine hervorragende Geschäftsmöglichkeit sein.</p>

<h2>Rechtliche Anforderungen und Genehmigungen</h2>

<h3>Arbeitsbewilligung</h3>
<p>Wenn Sie kein Schweizer oder EU-Bürger sind, benötigen Sie eine Arbeitsbewilligung. EU-Bürger geniessen Freizügigkeit.</p>

<h3>Erforderliche Lizenzen</h3>
<ul>
<li><strong>Wirtschaftspatent</strong> - Obligatorisch für Alkoholausschank</li>
<li><strong>HACCP-Zertifikat</strong> - Für Lebensmittelsicherheit</li>
<li><strong>Handelsregistereintrag</strong> - Beim kantonalen Handelsregister</li>
<li><strong>Versicherungen</strong> - Haftpflicht, Feuer, Unfälle</li>
</ul>

<h3>Hygienevorschriften</h3>
<p>Die Schweiz hat sehr hohe Hygienestandards. Ihre Küche muss die kantonalen Gastronomievorschriften erfüllen.</p>

<h2>Den Richtigen Standort Finden</h2>
<p>Der Standort ist entscheidend. Berücksichtigen Sie:</p>
<ul>
<li>Fußgängerverkehr und Sichtbarkeit</li>
<li>Verfügbare Parkplätze</li>
<li>Wettbewerb in der Gegend</li>
<li>Mietkosten (variieren stark zwischen Kantonen)</li>
</ul>

<h2>Lieferanten Auswählen</h2>
<p>Die Qualität der Zutaten definiert Ihr Restaurant. Für ein authentisches italienisches Restaurant benötigen Sie:</p>
<ul>
<li>Hochwertige frische und getrocknete Pasta</li>
<li>Italienische DOP-Käse (Parmigiano, Pecorino, Mozzarella)</li>
<li>Authentische Wurstwaren (Prosciutto di Parma, Guanciale, Speck)</li>
<li>Natives Olivenöl extra</li>
<li>San Marzano Tomaten</li>
<li>Italienische Weine</li>
</ul>

<p><strong>LAPA</strong> ist der führende Grosshändler für italienische Restaurants in der Schweiz mit über 3.000 authentischen Produkten und Lieferung im ganzen Land.</p>

<h2>Anfangsinvestition</h2>
<p>Die Eröffnung eines Restaurants in der Schweiz erfordert eine erhebliche Investition:</p>
<ul>
<li>Lokalumbau: CHF 50.000 - 200.000</li>
<li>Küchenausstattung: CHF 30.000 - 100.000</li>
<li>Einrichtung: CHF 20.000 - 80.000</li>
<li>Anfangsbestand: CHF 10.000 - 30.000</li>
<li>Launch-Marketing: CHF 5.000 - 20.000</li>
<li>Betriebskapital: CHF 30.000 - 50.000</li>
</ul>

<h2>Tipps für den Erfolg</h2>
<ol>
<li><strong>Authentizität</strong> - Versuchen Sie nicht, allen zu gefallen, bleiben Sie der italienischen Küche treu</li>
<li><strong>Konstante Qualität</strong> - Besser eine kleinere, aber exzellente Speisekarte</li>
<li><strong>Zuverlässige Lieferanten</strong> - Die Qualität der Zutaten ist fundamental</li>
<li><strong>Geschultes Personal</strong> - Investieren Sie in Teamschulung</li>
<li><strong>Lokales Marketing</strong> - Google My Business, Social Media, Mundpropaganda</li>
</ol>

<h2>Fazit</h2>
<p>Die Eröffnung eines italienischen Restaurants in der Schweiz ist eine Herausforderung, aber mit der richtigen Vorbereitung und den richtigen Partnern kann es ein Erfolg werden. LAPA unterstützt Sie mit Qualitätsprodukten und engagiertem Service.</p>

<p><a href="/contactus">Kontaktieren Sie uns</a>, um zu erfahren, wie wir Ihnen helfen können, Ihren Traum zu verwirklichen.</p>
`,
      website_meta_title: 'Italienisches Restaurant Schweiz Eröffnen | Leitfaden | LAPA',
      website_meta_description: 'Möchten Sie ein italienisches Restaurant in der Schweiz eröffnen? Kompletter Leitfaden mit Anforderungen, Genehmigungen, Lieferanten und praktischen Tipps.'
    },
    fr_FR: {
      name: 'Guide Complet: Ouvrir un Restaurant Italien en Suisse',
      subtitle: 'Tout ce que vous devez savoir: exigences, fournisseurs et conseils pratiques',
      content: `
<h2>Le Rêve d'Ouvrir un Restaurant Italien en Suisse</h2>
<p>La cuisine italienne est l'une des plus aimées au monde, et la Suisse ne fait pas exception. Avec une forte communauté italienne et une passion répandue pour la pizza, les pâtes et les produits méditerranéens, ouvrir un restaurant italien peut être une excellente opportunité commerciale.</p>

<h2>Exigences Légales et Permis</h2>

<h3>Permis de Travail</h3>
<p>Si vous n'êtes pas citoyen suisse ou UE, vous aurez besoin d'un permis de travail. Les citoyens de l'UE bénéficient de la libre circulation.</p>

<h3>Licences Nécessaires</h3>
<ul>
<li><strong>Patente d'exploitation</strong> - Obligatoire pour servir de l'alcool</li>
<li><strong>Certificat HACCP</strong> - Pour la sécurité alimentaire</li>
<li><strong>Inscription au registre du commerce</strong> - Auprès du registre cantonal</li>
<li><strong>Assurances</strong> - RC, incendie, accidents</li>
</ul>

<h3>Normes d'Hygiène</h3>
<p>La Suisse a des normes d'hygiène très élevées. Votre cuisine doit respecter les réglementations cantonales sur la restauration.</p>

<h2>Trouver le Bon Emplacement</h2>
<p>L'emplacement est crucial. Considérez:</p>
<ul>
<li>Trafic piétonnier et visibilité</li>
<li>Parking disponible</li>
<li>Concurrence dans la zone</li>
<li>Coût du loyer (varie beaucoup entre cantons)</li>
</ul>

<h2>Choisir les Fournisseurs</h2>
<p>La qualité des ingrédients définit votre restaurant. Pour un restaurant italien authentique, vous avez besoin de:</p>
<ul>
<li>Pâtes fraîches et sèches de qualité</li>
<li>Fromages italiens DOP (Parmigiano, Pecorino, Mozzarella)</li>
<li>Charcuterie authentique (Prosciutto di Parma, Guanciale, Speck)</li>
<li>Huile d'olive extra vierge</li>
<li>Tomates San Marzano</li>
<li>Vins italiens</li>
</ul>

<p><strong>LAPA</strong> est le grossiste de référence pour les restaurants italiens en Suisse, avec plus de 3'000 produits authentiques et livraison dans tout le pays.</p>

<h2>Budget Initial</h2>
<p>Ouvrir un restaurant en Suisse nécessite un investissement important:</p>
<ul>
<li>Rénovation du local: CHF 50'000 - 200'000</li>
<li>Équipement de cuisine: CHF 30'000 - 100'000</li>
<li>Mobilier: CHF 20'000 - 80'000</li>
<li>Stock initial: CHF 10'000 - 30'000</li>
<li>Marketing de lancement: CHF 5'000 - 20'000</li>
<li>Capital de roulement: CHF 30'000 - 50'000</li>
</ul>

<h2>Conseils pour le Succès</h2>
<ol>
<li><strong>Authenticité</strong> - N'essayez pas de plaire à tout le monde, restez fidèle à la cuisine italienne</li>
<li><strong>Qualité constante</strong> - Mieux vaut un menu réduit mais excellent</li>
<li><strong>Fournisseurs fiables</strong> - La qualité des ingrédients est fondamentale</li>
<li><strong>Personnel formé</strong> - Investissez dans la formation de l'équipe</li>
<li><strong>Marketing local</strong> - Google My Business, réseaux sociaux, bouche-à-oreille</li>
</ol>

<h2>Conclusion</h2>
<p>Ouvrir un restaurant italien en Suisse est un défi, mais avec la bonne préparation et les bons partenaires, cela peut devenir un succès. LAPA est là pour vous soutenir avec des produits de qualité et un service dédié.</p>

<p><a href="/contactus">Contactez-nous</a> pour découvrir comment nous pouvons vous aider à réaliser votre rêve.</p>
`,
      website_meta_title: 'Ouvrir Restaurant Italien Suisse | Guide Complet | LAPA',
      website_meta_description: 'Vous voulez ouvrir un restaurant italien en Suisse? Guide complet avec exigences, permis, fournisseurs et conseils pratiques. Découvrez comment commencer avec LAPA.'
    },
    en_EN: {
      name: 'Complete Guide: Opening an Italian Restaurant in Switzerland',
      subtitle: 'Everything you need to know: requirements, suppliers and practical advice',
      content: `
<h2>The Dream of Opening an Italian Restaurant in Switzerland</h2>
<p>Italian cuisine is among the most loved in the world, and Switzerland is no exception. With a strong Italian community and a widespread passion for pizza, pasta and Mediterranean products, opening an Italian restaurant can be an excellent business opportunity.</p>

<h2>Legal Requirements and Permits</h2>

<h3>Work Permit</h3>
<p>If you are not a Swiss or EU citizen, you will need a work permit. EU citizens enjoy free movement.</p>

<h3>Necessary Licenses</h3>
<ul>
<li><strong>Operating license</strong> - Mandatory to serve alcohol</li>
<li><strong>HACCP certificate</strong> - For food safety</li>
<li><strong>Commercial registration</strong> - At the cantonal commercial register</li>
<li><strong>Insurance</strong> - Liability, fire, accidents</li>
</ul>

<h3>Hygiene Standards</h3>
<p>Switzerland has very high hygiene standards. Your kitchen must comply with cantonal catering regulations.</p>

<h2>Finding the Right Location</h2>
<p>Location is crucial. Consider:</p>
<ul>
<li>Foot traffic and visibility</li>
<li>Available parking</li>
<li>Competition in the area</li>
<li>Rent cost (varies greatly between cantons)</li>
</ul>

<h2>Choosing Suppliers</h2>
<p>The quality of ingredients defines your restaurant. For an authentic Italian restaurant, you need:</p>
<ul>
<li>Quality fresh and dry pasta</li>
<li>Italian DOP cheeses (Parmigiano, Pecorino, Mozzarella)</li>
<li>Authentic cured meats (Prosciutto di Parma, Guanciale, Speck)</li>
<li>Extra virgin olive oil</li>
<li>San Marzano tomatoes</li>
<li>Italian wines</li>
</ul>

<p><strong>LAPA</strong> is the leading wholesaler for Italian restaurants in Switzerland, with over 3,000 authentic products and delivery throughout the country.</p>

<h2>Initial Budget</h2>
<p>Opening a restaurant in Switzerland requires a significant investment:</p>
<ul>
<li>Premises renovation: CHF 50,000 - 200,000</li>
<li>Kitchen equipment: CHF 30,000 - 100,000</li>
<li>Furniture: CHF 20,000 - 80,000</li>
<li>Initial stock: CHF 10,000 - 30,000</li>
<li>Launch marketing: CHF 5,000 - 20,000</li>
<li>Working capital: CHF 30,000 - 50,000</li>
</ul>

<h2>Tips for Success</h2>
<ol>
<li><strong>Authenticity</strong> - Don't try to please everyone, stay true to Italian cuisine</li>
<li><strong>Consistent quality</strong> - Better a smaller but excellent menu</li>
<li><strong>Reliable suppliers</strong> - Ingredient quality is fundamental</li>
<li><strong>Trained staff</strong> - Invest in team training</li>
<li><strong>Local marketing</strong> - Google My Business, social media, word of mouth</li>
</ol>

<h2>Conclusion</h2>
<p>Opening an Italian restaurant in Switzerland is a challenge, but with the right preparation and the right partners, it can become a success. LAPA is here to support you with quality products and dedicated service.</p>

<p><a href="/contactus">Contact us</a> to find out how we can help you realize your dream.</p>
`,
      website_meta_title: 'Open Italian Restaurant Switzerland | Complete Guide | LAPA',
      website_meta_description: 'Want to open an Italian restaurant in Switzerland? Complete guide with requirements, permits, suppliers and practical advice. Discover how to start with LAPA.'
    }
  },

  // Article 77, 78, 79 content would be added here - let me continue in the next section
  // For now, let me create a simpler version that can be extended
};

async function restoreArticle(articleId: number) {
  console.log(`\n📝 Restoring Article ${articleId}...`);

  const content = ARTICLES_CONTENT[articleId as keyof typeof ARTICLES_CONTENT];
  if (!content) {
    console.log(`❌ No content found for article ${articleId}`);
    return false;
  }

  const languages = [
    { code: 'it_IT', name: 'Italian' },
    { code: 'de_DE', name: 'German' },
    { code: 'fr_FR', name: 'French' },
    { code: 'en_EN', name: 'English' }
  ];

  let success = 0;
  let failed = 0;

  for (const lang of languages) {
    const langContent = content[lang.code as keyof typeof content];
    if (!langContent) {
      console.log(`   ⚠️  No ${lang.name} content found`);
      failed++;
      continue;
    }

    console.log(`   🌐 Writing ${lang.name}...`);

    const result = await write(
      'blog.post',
      [articleId],
      {
        name: langContent.name,
        subtitle: langContent.subtitle,
        content: langContent.content,
        website_meta_title: langContent.website_meta_title,
        website_meta_description: langContent.website_meta_description
      },
      { lang: lang.code }
    );

    if (result) {
      console.log(`   ✅ ${lang.name} restored`);
      success++;
    } else {
      console.log(`   ❌ ${lang.name} failed`);
      failed++;
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`   📊 Article ${articleId}: ${success} languages restored, ${failed} failed`);
  return failed === 0;
}

async function main() {
  console.log('🚨 URGENT RESTORE: Articles 76-80');
  console.log('='.repeat(60));

  await authenticate();

  const articlesToRestore = [76]; // Start with 76 which has full content

  console.log(`\n📋 Restoring ${articlesToRestore.length} article(s)...`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const articleId of articlesToRestore) {
    const result = await restoreArticle(articleId);
    if (result) {
      totalSuccess++;
    } else {
      totalFailed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESTORATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Articles fully restored: ${totalSuccess}`);
  console.log(`❌ Articles with issues: ${totalFailed}`);
  console.log('\n⚠️  NOTE: This script currently includes full content for Article 76');
  console.log('   Articles 77-80 content needs to be extracted from the source files');
  console.log('   and added to the ARTICLES_CONTENT object in this script.');
}

main();
