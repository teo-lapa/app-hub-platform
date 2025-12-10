/**
 * FIXED VERSION: Restore articles 76-80 correctly
 *
 * The issue: Writing without context writes to the DEFAULT language (en_US in this Odoo instance)
 * The fix: Write Italian WITH context it_IT, then other languages with their contexts
 *
 * Since the base language appears to be English, we need to:
 * 1. Write EN content WITHOUT context (sets base)
 * 2. Write IT content WITH context it_IT (sets Italian translation)
 * 3. Write DE content WITH context de_CH (sets German translation)
 * 4. Write FR content WITH context fr_CH (sets French translation)
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

// Article 76: Aprire un Ristorante Italiano in Svizzera
const ARTICLE_76 = {
  id: 76,
  it: {
    name: 'Guida Completa: Aprire un Ristorante Italiano in Svizzera',
    subtitle: 'Tutto quello che devi sapere: requisiti, fornitori e consigli pratici',
    website_meta_title: 'Aprire Ristorante Italiano Svizzera | Guida Completa | LAPA',
    website_meta_description: 'Vuoi aprire un ristorante italiano in Svizzera? Guida completa con requisiti, permessi, fornitori e consigli pratici. Scopri come iniziare con LAPA.',
    website_meta_keywords: 'aprire ristorante italiano svizzera, ristorante italiano zurigo, aprire pizzeria svizzera',
    content: `<h2>Il Sogno di Aprire un Ristorante Italiano in Svizzera</h2>
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

<p><a href="/contactus">Contattaci</a> per scoprire come possiamo aiutarti a realizzare il tuo sogno.</p>`
  },
  de: {
    name: 'Kompletter Leitfaden: Ein Italienisches Restaurant in der Schweiz Eröffnen',
    subtitle: 'Alles was Sie wissen müssen: Anforderungen, Lieferanten und praktische Tipps',
    website_meta_title: 'Italienisches Restaurant Schweiz Eröffnen | Leitfaden | LAPA',
    website_meta_description: 'Möchten Sie ein italienisches Restaurant in der Schweiz eröffnen? Kompletter Leitfaden mit Anforderungen, Genehmigungen, Lieferanten und praktischen Tipps.',
    website_meta_keywords: 'italienisches restaurant schweiz eröffnen, restaurant zürich eröffnen, pizzeria schweiz eröffnen',
    content: `<h2>Der Traum, ein Italienisches Restaurant in der Schweiz zu Eröffnen</h2>
<p>Die italienische Küche gehört zu den beliebtesten der Welt, und die Schweiz ist keine Ausnahme. Mit einer starken italienischen Gemeinschaft und einer weit verbreiteten Leidenschaft für Pizza, Pasta und mediterrane Produkte kann die Eröffnung eines italienischen Restaurants eine hervorragende Geschäftsmöglichkeit sein.</p>

<p><a href="/contactus">Kontaktieren Sie uns</a> um zu erfahren, wie wir Ihnen helfen können, Ihren Traum zu verwirklichen.</p>`
  },
  fr: {
    name: 'Guide Complet: Ouvrir un Restaurant Italien en Suisse',
    subtitle: 'Tout ce que vous devez savoir: exigences, fournisseurs et conseils pratiques',
    website_meta_title: 'Ouvrir Restaurant Italien Suisse | Guide Complet | LAPA',
    website_meta_description: 'Vous voulez ouvrir un restaurant italien en Suisse? Guide complet avec exigences, permis, fournisseurs et conseils pratiques.',
    website_meta_keywords: 'ouvrir restaurant italien suisse, restaurant italien zurich, ouvrir pizzeria suisse',
    content: `<h2>Le Rêve d'Ouvrir un Restaurant Italien en Suisse</h2>
<p>La cuisine italienne est parmi les plus aimées au monde, et la Suisse ne fait pas exception. Avec une forte communauté italienne et une passion répandue pour la pizza, les pâtes et les produits méditerranéens, ouvrir un restaurant italien peut être une excellente opportunité commerciale.</p>

<p><a href="/contactus">Contactez-nous</a> pour découvrir comment nous pouvons vous aider à réaliser votre rêve.</p>`
  },
  en: {
    name: 'Complete Guide: Opening an Italian Restaurant in Switzerland',
    subtitle: 'Everything you need to know: requirements, suppliers and practical advice',
    website_meta_title: 'Open Italian Restaurant Switzerland | Complete Guide | LAPA',
    website_meta_description: 'Want to open an Italian restaurant in Switzerland? Complete guide with requirements, permits, suppliers and practical advice.',
    website_meta_keywords: 'open italian restaurant switzerland, italian restaurant zurich, open pizzeria switzerland',
    content: `<h2>The Dream of Opening an Italian Restaurant in Switzerland</h2>
<p>Italian cuisine is among the most loved in the world, and Switzerland is no exception. With a strong Italian community and widespread passion for pizza, pasta and Mediterranean products, opening an Italian restaurant can be an excellent business opportunity.</p>

<p><a href="/contactus">Contact us</a> to discover how we can help you achieve your dream.</p>`
  }
};

// Article 77: Mozzarella di Bufala vs Fior di Latte
const ARTICLE_77 = {
  id: 77,
  it: {
    name: 'Mozzarella di Bufala vs Fior di Latte: Quale Scegliere per la Pizza?',
    subtitle: 'Guida completa per pizzaioli: differenze, utilizzi e consigli',
    website_meta_title: 'Mozzarella Bufala vs Fior di Latte | Guida Pizza | LAPA',
    website_meta_description: 'Mozzarella di bufala o fior di latte per la pizza? Scopri le differenze, quando usare ciascuna e come scegliere la migliore per il tuo ristorante.',
    website_meta_keywords: 'mozzarella bufala pizza, fior di latte pizza, mozzarella pizzeria, differenza mozzarella',
    content: `<h2>La Scelta della Mozzarella: Bufala o Fior di Latte?</h2>
<p>Per un pizzaiolo, la scelta della mozzarella è cruciale. <strong>Bufala o fior di latte?</strong> Non è solo una questione di gusto, ma di tecnica, tradizione e risultato finale.</p>

<h2>Mozzarella di Bufala</h2>
<p>La mozzarella di bufala è prodotta con <strong>latte di bufala</strong>. La DOP viene dalla Campania.</p>

<h3>Caratteristiche</h3>
<ul>
<li>Sapore più intenso e caratteristico</li>
<li>Texture più morbida e cremosa</li>
<li>Maggiore contenuto di grassi (24-28%)</li>
<li>Più liquido di governo</li>
<li>Prezzo più alto</li>
</ul>

<h3>Quando Usarla</h3>
<ul>
<li>Pizza margherita gourmet</li>
<li>Pizze bianche con ingredienti delicati</li>
<li>Antipasti (caprese)</li>
<li>Pizze dove la mozzarella è protagonista</li>
</ul>

<h3>Attenzione!</h3>
<p>La bufala rilascia molto liquido in cottura. Per evitare una pizza bagnata:</p>
<ul>
<li>Strizzala bene prima dell'uso</li>
<li>Aggiungila a metà cottura (non prima)</li>
<li>Usa meno quantità rispetto al fior di latte</li>
</ul>

<h2>Fior di Latte</h2>
<p>Il fior di latte è prodotto con <strong>latte vaccino</strong>. È la mozzarella tradizionale per la pizza napoletana.</p>

<h3>Caratteristiche</h3>
<ul>
<li>Sapore più neutro, latteo</li>
<li>Texture più elastica</li>
<li>Meno grasso (16-20%)</li>
<li>Tiene meglio la cottura</li>
<li>Prezzo più accessibile</li>
</ul>

<h3>Quando Usarla</h3>
<ul>
<li>Pizza napoletana classica</li>
<li>Pizze con molti ingredienti</li>
<li>Pizza margherita tradizionale</li>
<li>Produzione ad alto volume</li>
</ul>

<h2>Il Verdetto per Pizzerie</h2>
<p>La maggior parte delle pizzerie usa <strong>fior di latte come standard</strong> e offre la bufala come upgrade premium. Questo approccio:</p>
<ul>
<li>Mantiene i costi sotto controllo</li>
<li>Offre un'opzione gourmet</li>
<li>Garantisce risultati consistenti</li>
</ul>

<h2>Dove Acquistare Mozzarella di Qualità</h2>
<p>LAPA importa sia mozzarella di bufala DOP che fior di latte artigianale direttamente dall'Italia. <a href="/shop">Scopri la nostra selezione</a>.</p>`
  },
  de: {
    name: 'Büffelmozzarella vs Fior di Latte: Welche für Pizza Wählen?',
    subtitle: 'Kompletter Leitfaden für Pizzabäcker: Unterschiede, Verwendung und Tipps',
    website_meta_title: 'Büffelmozzarella vs Fior di Latte | Pizza Guide | LAPA',
    website_meta_description: 'Büffelmozzarella oder Fior di Latte für Pizza? Entdecken Sie die Unterschiede, wann welche zu verwenden ist und wie Sie die beste für Ihr Restaurant wählen.',
    website_meta_keywords: 'büffelmozzarella pizza, fior di latte pizza, mozzarella pizzeria, mozzarella unterschied',
    content: `<h2>Die Wahl der Mozzarella: Büffel oder Fior di Latte?</h2>
<p>Für einen Pizzabäcker ist die Wahl der Mozzarella entscheidend. <strong>Büffel oder Fior di Latte?</strong> Es ist nicht nur eine Frage des Geschmacks, sondern der Technik, Tradition und des Endergebnisses.</p>

<p>LAPA importiert sowohl Büffelmozzarella DOP als auch handwerkliches Fior di Latte direkt aus Italien. <a href="/shop">Entdecken Sie unsere Auswahl</a>.</p>`
  },
  fr: {
    name: 'Mozzarella de Bufflonne vs Fior di Latte: Laquelle Choisir pour la Pizza?',
    subtitle: 'Guide complet pour pizzaïolos: différences, utilisations et conseils',
    website_meta_title: 'Mozzarella Bufflonne vs Fior di Latte | Guide Pizza | LAPA',
    website_meta_description: 'Mozzarella de bufflonne ou fior di latte pour la pizza? Découvrez les différences, quand utiliser chacune et comment choisir la meilleure pour votre restaurant.',
    website_meta_keywords: 'mozzarella bufflonne pizza, fior di latte pizza, mozzarella pizzeria, différence mozzarella',
    content: `<h2>Le Choix de la Mozzarella: Bufflonne ou Fior di Latte?</h2>
<p>Pour un pizzaïolo, le choix de la mozzarella est crucial. <strong>Bufflonne ou fior di latte?</strong> Ce n'est pas seulement une question de goût, mais de technique, tradition et résultat final.</p>

<p>LAPA importe à la fois de la mozzarella de bufflonne DOP et du fior di latte artisanal directement d'Italie. <a href="/shop">Découvrez notre sélection</a>.</p>`
  },
  en: {
    name: 'Buffalo Mozzarella vs Fior di Latte: Which to Choose for Pizza?',
    subtitle: 'Complete guide for pizza makers: differences, uses and advice',
    website_meta_title: 'Buffalo Mozzarella vs Fior di Latte | Pizza Guide | LAPA',
    website_meta_description: 'Buffalo mozzarella or fior di latte for pizza? Discover the differences, when to use each and how to choose the best for your restaurant.',
    website_meta_keywords: 'buffalo mozzarella pizza, fior di latte pizza, mozzarella pizzeria, mozzarella difference',
    content: `<h2>The Choice of Mozzarella: Buffalo or Fior di Latte?</h2>
<p>For a pizza maker, the choice of mozzarella is crucial. <strong>Buffalo or fior di latte?</strong> It's not just a matter of taste, but of technique, tradition and final result.</p>

<p>LAPA imports both buffalo mozzarella DOP and artisanal fior di latte directly from Italy. <a href="/shop">Discover our selection</a>.</p>`
  }
};

// Article 78: 10 Prodotti Essenziali per Pizzeria
const ARTICLE_78 = {
  id: 78,
  it: {
    name: 'I 10 Prodotti Essenziali che Ogni Pizzeria Deve Avere',
    subtitle: 'La checklist completa per pizzaioli professionisti',
    website_meta_title: '10 Prodotti Essenziali Pizzeria | Checklist | LAPA',
    website_meta_description: 'Quali prodotti non possono mancare in una pizzeria? Ecco la lista completa dei 10 ingredienti essenziali per pizze autentiche e di qualità.',
    website_meta_keywords: 'prodotti pizzeria, ingredienti pizza, farina pizza, mozzarella pizzeria',
    content: `<h2>Gli Ingredienti Fondamentali per una Pizzeria di Successo</h2>
<p>Una pizzeria è fatta di pochi ingredienti, ma di <strong>altissima qualità</strong>. Ecco i 10 prodotti che non possono mai mancare.</p>

<h2>1. Farina Tipo 00 per Pizza</h2>
<p>La base di tutto. Cerca farine con:</p>
<ul>
<li>W 260-320 (forza della farina)</li>
<li>Macinazione fine</li>
<li>Adatta a lunghe lievitazioni</li>
</ul>
<p>Marche consigliate: Caputo, Molino Dallagiovanna, Molino Grassi.</p>

<h2>2. Pomodori San Marzano DOP</h2>
<p>Il pomodoro pelato più famoso al mondo. Caratteristiche:</p>
<ul>
<li>Forma allungata</li>
<li>Polpa densa, pochi semi</li>
<li>Dolcezza naturale</li>
<li>Bollino DOP certificato</li>
</ul>

<h2>3. Mozzarella Fior di Latte</h2>
<p>La mozzarella classica per pizza napoletana:</p>
<ul>
<li>Latte vaccino</li>
<li>Texture elastica</li>
<li>Tiene bene la cottura</li>
<li>Non rilascia troppo liquido</li>
</ul>

<h2>4. Olio Extravergine d'Oliva</h2>
<p>Per condire l'impasto e finire le pizze:</p>
<ul>
<li>Extravergine italiano</li>
<li>Fruttato medio</li>
<li>Buon rapporto qualità-prezzo per l'impasto</li>
<li>DOP per il servizio</li>
</ul>

<h2>5. Sale Marino</h2>
<p>Sale marino fino per l'impasto, grosso per pizze focaccia.</p>

<h2>6. Basilico Fresco</h2>
<p>Basilico italiano, possibilmente di Genova DOP. Essenziale per la margherita.</p>

<h2>7. Salumi di Qualità</h2>
<ul>
<li>Prosciutto crudo (Parma o San Daniele)</li>
<li>Salame tipo Milano o Napoli</li>
<li>Speck Alto Adige</li>
<li>'Nduja calabrese (per pizze piccanti)</li>
</ul>

<h2>8. Formaggi Stagionati</h2>
<ul>
<li>Parmigiano Reggiano DOP (24 mesi)</li>
<li>Pecorino Romano DOP</li>
<li>Gorgonzola DOP</li>
</ul>

<h2>9. Verdure di Qualità</h2>
<ul>
<li>Funghi (freschi o sottolio)</li>
<li>Carciofi (freschi o sottolio)</li>
<li>Peperoni grigliati</li>
<li>Melanzane grigliate</li>
<li>Rucola fresca</li>
</ul>

<h2>10. Lievito di Birra Fresco</h2>
<p>Lievito fresco compresso, per impasti con lievitazione naturale e controllata.</p>

<h2>Dove Trovare Tutti Questi Prodotti</h2>
<p>LAPA offre tutti i prodotti essenziali per pizzerie in un unico ordine. <a href="/shop">Esplora il catalogo</a> o <a href="/contactus">contattaci</a> per una consulenza.</p>`
  },
  de: {
    name: 'Die 10 Essentiellen Produkte die Jede Pizzeria Haben Muss',
    subtitle: 'Die komplette Checkliste für professionelle Pizzabäcker',
    website_meta_title: '10 Essentielle Pizzeria Produkte | Checkliste | LAPA',
    website_meta_description: 'Welche Produkte dürfen in einer Pizzeria nicht fehlen? Hier ist die vollständige Liste der 10 essentiellen Zutaten für authentische und qualitativ hochwertige Pizzen.',
    website_meta_keywords: 'pizzeria produkte, pizza zutaten, pizza mehl, mozzarella pizzeria',
    content: `<h2>Die Grundzutaten für eine Erfolgreiche Pizzeria</h2>
<p>Eine Pizzeria besteht aus wenigen Zutaten, aber von <strong>höchster Qualität</strong>. Hier sind die 10 Produkte, die niemals fehlen dürfen.</p>

<p>LAPA bietet alle essentiellen Produkte für Pizzerien in einer einzigen Bestellung. <a href="/shop">Erkunden Sie den Katalog</a> oder <a href="/contactus">kontaktieren Sie uns</a> für eine Beratung.</p>`
  },
  fr: {
    name: 'Les 10 Produits Essentiels que Chaque Pizzeria Doit Avoir',
    subtitle: 'La checklist complète pour pizzaïolos professionnels',
    website_meta_title: '10 Produits Essentiels Pizzeria | Checklist | LAPA',
    website_meta_description: 'Quels produits ne peuvent pas manquer dans une pizzeria? Voici la liste complète des 10 ingrédients essentiels pour des pizzas authentiques et de qualité.',
    website_meta_keywords: 'produits pizzeria, ingrédients pizza, farine pizza, mozzarella pizzeria',
    content: `<h2>Les Ingrédients Fondamentaux pour une Pizzeria à Succès</h2>
<p>Une pizzeria est faite de peu d'ingrédients, mais de <strong>très haute qualité</strong>. Voici les 10 produits qui ne peuvent jamais manquer.</p>

<p>LAPA offre tous les produits essentiels pour pizzerias en une seule commande. <a href="/shop">Explorez le catalogue</a> ou <a href="/contactus">contactez-nous</a> pour une consultation.</p>`
  },
  en: {
    name: 'The 10 Essential Products Every Pizzeria Must Have',
    subtitle: 'The complete checklist for professional pizza makers',
    website_meta_title: '10 Essential Pizzeria Products | Checklist | LAPA',
    website_meta_description: 'Which products cannot be missing in a pizzeria? Here is the complete list of 10 essential ingredients for authentic and quality pizzas.',
    website_meta_keywords: 'pizzeria products, pizza ingredients, pizza flour, mozzarella pizzeria',
    content: `<h2>The Fundamental Ingredients for a Successful Pizzeria</h2>
<p>A pizzeria is made of few ingredients, but of <strong>very high quality</strong>. Here are the 10 products that can never be missing.</p>

<p>LAPA offers all essential products for pizzerias in a single order. <a href="/shop">Explore the catalog</a> or <a href="/contactus">contact us</a> for a consultation.</p>`
  }
};

// Article 79: Grossista Prodotti Italiani
const ARTICLE_79 = {
  id: 79,
  it: {
    name: 'Come Scegliere un Grossista di Prodotti Italiani in Svizzera',
    subtitle: 'Guida per ristoratori: criteri, prezzi e affidabilità',
    website_meta_title: 'Grossista Prodotti Italiani Svizzera | Guida | LAPA',
    website_meta_description: 'Come scegliere il miglior grossista di prodotti italiani in Svizzera? Guida completa su qualità, prezzi, consegne e servizio.',
    website_meta_keywords: 'grossista prodotti italiani svizzera, importatore italiano svizzera, fornitore ristoranti',
    content: `<h2>Perché un Grossista Specializzato Fa la Differenza</h2>
<p>Per un ristorante italiano, avere un <strong>grossista affidabile</strong> di prodotti italiani è fondamentale. Non basta un fornitore generico: servono competenza, autenticità e servizio dedicato.</p>

<h2>I Criteri per Scegliere il Grossista Giusto</h2>

<h3>1. Autenticità dei Prodotti</h3>
<p>Verifica che il grossista:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Abbia rapporti diretti con i produttori</li>
<li>Garantisca tracciabilità completa</li>
</ul>

<h3>2. Gamma di Prodotti</h3>
<p>Un buon grossista italiano deve coprire tutte le categorie:</p>
<ul>
<li>Latticini freschi (mozzarella, burrata, ricotta)</li>
<li>Formaggi stagionati (Parmigiano, Pecorino, Gorgonzola)</li>
<li>Salumi (prosciutto, salame, guanciale)</li>
<li>Pasta fresca e secca</li>
<li>Conserve (pomodori, sottolio, sottaceti)</li>
<li>Olio e aceto</li>
<li>Prodotti da forno</li>
</ul>

<h3>3. Logistica e Consegne</h3>
<p>La catena del freddo è cruciale per i prodotti freschi:</p>
<ul>
<li>Furgoni refrigerati</li>
<li>Consegne regolari (almeno 2-3 volte/settimana)</li>
<li>Copertura in tutta la Svizzera</li>
<li>Ordini urgenti disponibili</li>
<li>Nessun minimo d'ordine (o minimo ragionevole)</li>
</ul>

<h3>4. Prezzo e Condizioni</h3>
<p>Valuta:</p>
<ul>
<li>Rapporto qualità-prezzo complessivo</li>
<li>Sconti per volumi</li>
<li>Termini di pagamento flessibili</li>
<li>Trasparenza sui prezzi</li>
</ul>

<h3>5. Servizio e Supporto</h3>
<p>Un partner, non solo un fornitore:</p>
<ul>
<li>Consulenza sui prodotti</li>
<li>Suggerimenti per il menu</li>
<li>Gestione proattiva dei problemi</li>
<li>Referente dedicato</li>
</ul>

<h2>LAPA: Il Tuo Grossista di Fiducia</h2>
<p>LAPA è il più grande importatore e distributore di prodotti italiani in Svizzera. Offriamo:</p>
<ul>
<li>✅ Oltre 3.000 prodotti italiani autentici</li>
<li>✅ Import diretto dai migliori produttori italiani</li>
<li>✅ Consegna in tutta la Svizzera in 24-48 ore</li>
<li>✅ Nessun minimo d'ordine</li>
<li>✅ Catena del freddo certificata</li>
<li>✅ Team italiano esperto</li>
</ul>

<h2>Conclusione</h2>
<p>Scegliere il grossista giusto è un investimento strategico. Con LAPA hai un partner che comprende le tue esigenze e ti supporta nel successo del tuo ristorante.</p>

<p><a href="/shop">Scopri il nostro catalogo</a> o <a href="/contactus">contattaci</a> per iniziare.</p>`
  },
  de: {
    name: 'Wie Man Einen Grosshändler für Italienische Produkte in der Schweiz Wählt',
    subtitle: 'Leitfaden für Gastronomen: Kriterien, Preise und Zuverlässigkeit',
    website_meta_title: 'Grosshändler Italienische Produkte Schweiz | Leitfaden | LAPA',
    website_meta_description: 'Wie wählt man den besten Grosshändler für italienische Produkte in der Schweiz? Kompletter Leitfaden zu Qualität, Preisen, Lieferungen und Service.',
    website_meta_keywords: 'grosshändler italienische produkte schweiz, importeur italien schweiz, restaurant lieferant',
    content: `<h2>Warum Ein Spezialisierter Grosshändler Den Unterschied Macht</h2>
<p>Für ein italienisches Restaurant ist ein <strong>zuverlässiger Grosshändler</strong> für italienische Produkte unerlässlich. Ein generischer Lieferant reicht nicht aus: Es braucht Kompetenz, Authentizität und dedizierten Service.</p>

<p>LAPA ist der grösste Importeur und Distributor italienischer Produkte in der Schweiz. <a href="/shop">Entdecken Sie unseren Katalog</a> oder <a href="/contactus">kontaktieren Sie uns</a> um zu beginnen.</p>`
  },
  fr: {
    name: 'Comment Choisir un Grossiste de Produits Italiens en Suisse',
    subtitle: 'Guide pour restaurateurs: critères, prix et fiabilité',
    website_meta_title: 'Grossiste Produits Italiens Suisse | Guide | LAPA',
    website_meta_description: 'Comment choisir le meilleur grossiste de produits italiens en Suisse? Guide complet sur la qualité, les prix, les livraisons et le service.',
    website_meta_keywords: 'grossiste produits italiens suisse, importateur italien suisse, fournisseur restaurants',
    content: `<h2>Pourquoi Un Grossiste Spécialisé Fait La Différence</h2>
<p>Pour un restaurant italien, avoir un <strong>grossiste fiable</strong> de produits italiens est fondamental. Un fournisseur générique ne suffit pas: il faut de la compétence, de l'authenticité et un service dédié.</p>

<p>LAPA est le plus grand importateur et distributeur de produits italiens en Suisse. <a href="/shop">Découvrez notre catalogue</a> ou <a href="/contactus">contactez-nous</a> pour commencer.</p>`
  },
  en: {
    name: 'How to Choose a Wholesaler of Italian Products in Switzerland',
    subtitle: 'Guide for restaurateurs: criteria, prices and reliability',
    website_meta_title: 'Italian Products Wholesaler Switzerland | Guide | LAPA',
    website_meta_description: 'How to choose the best wholesaler of Italian products in Switzerland? Complete guide on quality, prices, deliveries and service.',
    website_meta_keywords: 'italian products wholesaler switzerland, italian importer switzerland, restaurant supplier',
    content: `<h2>Why A Specialized Wholesaler Makes The Difference</h2>
<p>For an Italian restaurant, having a <strong>reliable wholesaler</strong> of Italian products is fundamental. A generic supplier is not enough: you need expertise, authenticity and dedicated service.</p>

<p>LAPA is the largest importer and distributor of Italian products in Switzerland. <a href="/shop">Discover our catalog</a> or <a href="/contactus">contact us</a> to get started.</p>`
  }
};

// Article 80: Guanciale vs Pancetta (from part2 file)
const ARTICLE_80 = {
  id: 80,
  it: {
    name: 'Guanciale vs Pancetta: Qual è la Differenza e Quando Usarli',
    subtitle: 'La guida definitiva per ristoratori italiani',
    website_meta_title: 'Guanciale vs Pancetta | Differenze e Usi | LAPA',
    website_meta_description: 'Guanciale o pancetta? Scopri le differenze, quando usare ciascuno e perché il guanciale è essenziale per carbonara e amatriciana autentiche.',
    website_meta_keywords: 'guanciale pancetta differenza, guanciale carbonara, pancetta italiana, salumi ristorante',
    content: `<h2>Il Grande Dibattito: Guanciale vs Pancetta</h2>
<p>Per chi cucina italiano, la scelta tra guanciale e pancetta non è solo una questione di gusto: è una questione di <strong>autenticità</strong>. Vediamo le differenze e quando usare ciascuno.</p>

<h2>Cos'è il Guanciale</h2>
<p>Il guanciale è un salume ottenuto dalla <strong>guancia del maiale</strong>. Le sue caratteristiche:</p>
<ul>
<li><strong>Taglio:</strong> Guancia e parte della gola del suino</li>
<li><strong>Stagionatura:</strong> Minimo 3 settimane</li>
<li><strong>Sapore:</strong> Intenso, con note speziate (pepe nero)</li>
<li><strong>Grasso:</strong> Alto contenuto, si scioglie in modo cremoso</li>
<li><strong>Origine:</strong> Tradizione laziale (Roma, Amatrice)</li>
</ul>

<h2>Cos'è la Pancetta</h2>
<p>La pancetta è ricavata dalla <strong>pancia del maiale</strong>. Le sue caratteristiche:</p>
<ul>
<li><strong>Taglio:</strong> Ventresca/pancia</li>
<li><strong>Varietà:</strong> Tesa, arrotolata, affumicata</li>
<li><strong>Sapore:</strong> Più delicato, meno speziato</li>
<li><strong>Grasso:</strong> Bilanciato tra magro e grasso</li>
<li><strong>Origine:</strong> Diverse regioni italiane</li>
</ul>

<h2>Quando Usare il Guanciale (Obbligatorio!)</h2>
<ul>
<li><strong>Carbonara</strong> - MAI con pancetta o bacon!</li>
<li><strong>Amatriciana</strong> - Ricetta tradizionale di Amatrice</li>
<li><strong>Gricia</strong> - La "madre" della carbonara</li>
</ul>
<p>Il guanciale dona a questi piatti la cremosità e il sapore intenso che li rendono unici.</p>

<h2>Quando Usare la Pancetta</h2>
<ul>
<li>Sughi e ragù</li>
<li>Torte salate e quiche</li>
<li>Insalate e contorni</li>
<li>Bruschette e antipasti</li>
</ul>

<h2>Errori da Evitare</h2>
<p><strong>Mai usare bacon al posto del guanciale!</strong> Il bacon è affumicato e ha un sapore completamente diverso che rovina i piatti tradizionali romani.</p>

<h2>Dove Trovare Guanciale Autentico in Svizzera</h2>
<p>LAPA importa guanciale romano autentico direttamente dall'Italia. <a href="/shop">Scopri la nostra selezione di salumi</a>.</p>`
  },
  de: {
    name: 'Guanciale vs Pancetta: Was ist der Unterschied und Wann Verwendet Man Welche',
    subtitle: 'Der ultimative Leitfaden für italienische Gastronomen',
    website_meta_title: 'Guanciale vs Pancetta | Unterschiede und Verwendung | LAPA',
    website_meta_description: 'Guanciale oder Pancetta? Entdecken Sie die Unterschiede, wann welche verwendet wird und warum Guanciale für authentische Carbonara und Amatriciana unerlässlich ist.',
    website_meta_keywords: 'guanciale pancetta unterschied, guanciale carbonara, pancetta italienisch, wurstwaren restaurant',
    content: `<h2>Die Grosse Debatte: Guanciale vs Pancetta</h2>
<p>Für diejenigen, die italienisch kochen, ist die Wahl zwischen Guanciale und Pancetta nicht nur eine Frage des Geschmacks: Es ist eine Frage der <strong>Authentizität</strong>.</p>

<p>LAPA importiert authentisches römisches Guanciale direkt aus Italien. <a href="/shop">Entdecken Sie unsere Wurstwaren-Auswahl</a>.</p>`
  },
  fr: {
    name: 'Guanciale vs Pancetta: Quelle est la Différence et Quand Les Utiliser',
    subtitle: 'Le guide ultime pour restaurateurs italiens',
    website_meta_title: 'Guanciale vs Pancetta | Différences et Utilisations | LAPA',
    website_meta_description: 'Guanciale ou pancetta? Découvrez les différences, quand utiliser chacun et pourquoi le guanciale est essentiel pour une carbonara et amatriciana authentiques.',
    website_meta_keywords: 'guanciale pancetta différence, guanciale carbonara, pancetta italienne, charcuterie restaurant',
    content: `<h2>Le Grand Débat: Guanciale vs Pancetta</h2>
<p>Pour ceux qui cuisinent italien, le choix entre guanciale et pancetta n'est pas seulement une question de goût: c'est une question d'<strong>authenticité</strong>.</p>

<p>LAPA importe du guanciale romain authentique directement d'Italie. <a href="/shop">Découvrez notre sélection de charcuterie</a>.</p>`
  },
  en: {
    name: 'Guanciale vs Pancetta: What is the Difference and When to Use Them',
    subtitle: 'The ultimate guide for Italian restaurateurs',
    website_meta_title: 'Guanciale vs Pancetta | Differences and Uses | LAPA',
    website_meta_description: 'Guanciale or pancetta? Discover the differences, when to use each and why guanciale is essential for authentic carbonara and amatriciana.',
    website_meta_keywords: 'guanciale pancetta difference, guanciale carbonara, italian pancetta, cured meats restaurant',
    content: `<h2>The Great Debate: Guanciale vs Pancetta</h2>
<p>For those who cook Italian, the choice between guanciale and pancetta is not just a matter of taste: it's a matter of <strong>authenticity</strong>.</p>

<p>LAPA imports authentic Roman guanciale directly from Italy. <a href="/shop">Discover our cured meats selection</a>.</p>`
  }
};

const ARTICLES = [ARTICLE_76, ARTICLE_77, ARTICLE_78, ARTICLE_79, ARTICLE_80];

async function restoreArticle(article: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 RESTORING ARTICLE ${article.id}`);
  console.log(`${'='.repeat(60)}`);

  // STEP 1: Write Italian content WITH context it_IT (translation)
  console.log(`\n1️⃣  Writing Italian content (WITH context: it_IT)...`);
  const itSuccess = await write('blog.post', [article.id], {
    name: article.it.name,
    subtitle: article.it.subtitle,
    content: article.it.content,
    website_meta_title: article.it.website_meta_title,
    website_meta_description: article.it.website_meta_description,
    website_meta_keywords: article.it.website_meta_keywords
  }, { lang: 'it_IT' });

  if (!itSuccess) {
    console.log(`   ❌ FAILED to write Italian content!`);
  } else {
    console.log(`   ✅ Italian content saved`);
  }
  await new Promise(r => setTimeout(r, 500));

  // STEP 2: Write German translation WITH context
  console.log(`\n2️⃣  Writing German translation (WITH context: de_CH)...`);
  const deSuccess = await write('blog.post', [article.id], {
    name: article.de.name,
    subtitle: article.de.subtitle,
    content: article.de.content,
    website_meta_title: article.de.website_meta_title,
    website_meta_description: article.de.website_meta_description,
    website_meta_keywords: article.de.website_meta_keywords
  }, { lang: 'de_CH' });

  if (!deSuccess) {
    console.log(`   ⚠️  WARNING: German translation failed`);
  } else {
    console.log(`   ✅ German translation saved`);
  }
  await new Promise(r => setTimeout(r, 500));

  // STEP 3: Write French translation WITH context
  console.log(`\n3️⃣  Writing French translation (WITH context: fr_CH)...`);
  const frSuccess = await write('blog.post', [article.id], {
    name: article.fr.name,
    subtitle: article.fr.subtitle,
    content: article.fr.content,
    website_meta_title: article.fr.website_meta_title,
    website_meta_description: article.fr.website_meta_description,
    website_meta_keywords: article.fr.website_meta_keywords
  }, { lang: 'fr_CH' });

  if (!frSuccess) {
    console.log(`   ⚠️  WARNING: French translation failed`);
  } else {
    console.log(`   ✅ French translation saved`);
  }
  await new Promise(r => setTimeout(r, 500));

  // STEP 4: Write English base content WITHOUT context (this is the base)
  console.log(`\n4️⃣  Writing English BASE content (NO context - this is the default language)...`);
  const enSuccess = await write('blog.post', [article.id], {
    name: article.en.name,
    subtitle: article.en.subtitle,
    content: article.en.content,
    website_meta_title: article.en.website_meta_title,
    website_meta_description: article.en.website_meta_description,
    website_meta_keywords: article.en.website_meta_keywords
  });

  if (!enSuccess) {
    console.log(`   ⚠️  WARNING: English base content failed`);
  } else {
    console.log(`   ✅ English base content saved`);
  }

  console.log(`\n✅ Article ${article.id} restoration complete!`);
  return true;
}

async function main() {
  console.log('\n🚨 URGENT: RESTORING BLOG ARTICLES 76-80 (FIXED VERSION) 🚨');
  console.log('='.repeat(60));
  console.log('CORRECTED APPROACH:');
  console.log('1. Write IT/DE/FR WITH context (translations)');
  console.log('2. Write EN WITHOUT context (base - default lang is en_US)');
  console.log('='.repeat(60));

  await authenticate();

  let restored = 0;
  let failed = 0;

  for (const article of ARTICLES) {
    const success = await restoreArticle(article);
    if (success) {
      restored++;
    } else {
      failed++;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 RESTORATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`✅ Articles restored: ${restored}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('\nArticles 76-80 should now have:');
  console.log('- English content as BASE (default language)');
  console.log('- Italian, German, French as TRANSLATIONS');
}

main().catch(console.error);
