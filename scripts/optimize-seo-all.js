const ODOO = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  user: 'paul@lapa.ch',
  pass: 'lapa201180'
};

let sid = '';

async function auth() {
  const r = await fetch(ODOO.url + '/web/session/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { db: ODOO.db, login: ODOO.user, password: ODOO.pass }, id: 1 })
  });
  const cookie = r.headers.get('set-cookie');
  if (cookie) {
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) sid = match[1];
  }
  console.log('Auth:', sid ? 'OK' : 'FAILED');
}

async function callOdoo(model, method, args, kwargs = {}) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session_id=' + sid,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  const data = await r.json();
  if (data.error) {
    console.error('ERRORE:', data.error.data?.message || data.error.message);
    return null;
  }
  return data.result;
}

// SEO ottimizzato per ogni articolo
const SEO_DATA = {
  2: {
    meta_title: "Giornata del Gelato Artigianale | Ingredienti per Gelaterie | LAPA Svizzera",
    meta_description: "Celebra la Giornata del Gelato Artigianale con ingredienti italiani premium. LAPA fornitore per gelaterie in Svizzera. Consegna 24-48h.",
    keywords: "gelato artigianale, ingredienti gelateria, fornitore gelaterie svizzera, LAPA grossista"
  },
  3: {
    meta_title: "LAPA Grossista Alimentare | Qualita Eccezionale | Fornitore Ristoranti Svizzera",
    meta_description: "LAPA: disponibilita, rapidita, qualita eccezionale. Grossista prodotti italiani per ristoranti e pizzerie in Svizzera.",
    keywords: "grossista alimentare svizzera, fornitore ristoranti, prodotti italiani qualita, LAPA"
  },
  4: {
    meta_title: "LAPA Fornitore Affidabile | Consegne Puntuali | Grossista Svizzera",
    meta_description: "LAPA: disponibilita, rapidita, puntualita. Il tuo partner affidabile per prodotti italiani in Svizzera. Consegna garantita.",
    keywords: "fornitore affidabile svizzera, consegne puntuali, grossista italiano, LAPA"
  },
  5: {
    meta_title: "Recensioni LAPA | Qualita e Convenienza | Grossista Prodotti Italiani",
    meta_description: "Scopri perche i ristoratori scelgono LAPA: qualita eccellente, prezzi competitivi. Testimonianze clienti soddisfatti.",
    keywords: "recensioni LAPA, grossista conveniente, qualita prezzo, fornitore ristoranti"
  },
  6: {
    meta_title: "Testimonianze Clienti LAPA | 6 Anni di Collaborazione | Grossista Svizzera",
    meta_description: "6 anni di fiducia con LAPA. Scopri le testimonianze dei nostri clienti ristoratori in Svizzera.",
    keywords: "testimonianze LAPA, clienti soddisfatti, grossista affidabile, fornitore ristoranti"
  },
  7: {
    meta_title: "Nuovo Cliente LAPA | Esperienza Positiva | Fornitore Ristoranti",
    meta_description: "Nuovi ristoranti scelgono LAPA per la qualita e il servizio. Inizia anche tu la collaborazione con il miglior grossista.",
    keywords: "nuovo fornitore ristorante, LAPA esperienza, grossista prodotti italiani"
  },
  8: {
    meta_title: "LAPA Garanzia e Soddisfazione | Grossista Prodotti Italiani Svizzera",
    meta_description: "LAPA sinonimo di garanzia e soddisfazione. Il partner ideale per ristoranti italiani in Svizzera.",
    keywords: "garanzia qualita, soddisfazione cliente, LAPA grossista, fornitore italiano"
  },
  10: {
    meta_title: "Vera Italianita | LAPA Prodotti Autentici | Grossista Svizzera",
    meta_description: "Ricerchi la vera italianita? LAPA importa prodotti autentici dall'Italia per il tuo ristorante in Svizzera.",
    keywords: "prodotti italiani autentici, vera italianita, LAPA importatore, grossista svizzera"
  },
  11: {
    meta_title: "Prodotti Eccellenti LAPA | Fornitore Completo | Grossista Ristoranti",
    meta_description: "Prodotti eccellenti per ogni esigenza. LAPA il fornitore completo per ristoranti e pizzerie in Svizzera.",
    keywords: "prodotti eccellenti, fornitore completo, LAPA grossista, ristoranti svizzera"
  },
  12: {
    meta_title: "Selezionare Personale Ristorante | 7 Passi | Guida LAPA",
    meta_description: "7 passi per selezionare il personale giusto per il tuo ristorante. Consigli pratici da LAPA, partner dei ristoratori.",
    keywords: "personale ristorante, selezione staff, gestione ristorante, consigli LAPA"
  },
  13: {
    meta_title: "Calamaro vs Totano | Differenze e Caratteristiche | LAPA Fornitore Pesce",
    meta_description: "Scopri le differenze tra calamaro e totano. LAPA fornitore di pesce fresco per ristoranti in Svizzera.",
    keywords: "calamaro totano differenze, pesce fresco ristoranti, LAPA fornitore pesce"
  },
  14: {
    meta_title: "LAPA Ecosostenibile | Ristorazione Italiana Sostenibile | Svizzera",
    meta_description: "LAPA: l'evoluzione ecosostenibile della ristorazione italiana in Svizzera. Prodotti di qualita nel rispetto dell'ambiente.",
    keywords: "ristorazione sostenibile, ecosostenibile, LAPA green, fornitore responsabile"
  },
  15: {
    meta_title: "Dolci Pasquali Italiani | Colomba Pastiera | LAPA Fornitore Svizzera",
    meta_description: "Pasqua a tavola con dolci tradizionali italiani. Colomba, pastiera e specialita pasquali. LAPA fornitore in Svizzera.",
    keywords: "dolci pasquali, colomba italiana, pastiera, LAPA fornitore dolci"
  },
  16: {
    meta_title: "Amarene Sciroppate Premium | Ingredienti Dolci | LAPA Grossista",
    meta_description: "Amarene sciroppate di alta qualita per pasticceria e ristorazione. LAPA grossista ingredienti dolci in Svizzera.",
    keywords: "amarene sciroppate, ingredienti pasticceria, LAPA grossista dolci"
  },
  17: {
    meta_title: "Arancini Siciliani | Specialita Siciliane | LAPA Fornitore Svizzera",
    meta_description: "Arancini siciliani irresistibili per il tuo menu. LAPA importa specialita siciliane autentiche in Svizzera.",
    keywords: "arancini siciliani, specialita sicilia, LAPA fornitore siciliano"
  },
  18: {
    meta_title: "Baba al Rhum Napoletano | Dolci Napoletani | LAPA Grossista",
    meta_description: "Baba al rhum autentico napoletano per il tuo ristorante. LAPA fornitore dolci napoletani in Svizzera.",
    keywords: "baba rhum, dolci napoletani, LAPA fornitore napoli, pasticceria italiana"
  },
  19: {
    meta_title: "Burrata Fresca Pugliese | Fornitore Burrata Svizzera | LAPA",
    meta_description: "Burrata fresca dalla Puglia. Cremosa, autentica, consegnata fresca. LAPA fornitore burrata per ristoranti in Svizzera.",
    keywords: "burrata fresca, burrata pugliese, fornitore burrata svizzera, LAPA mozzarella"
  },
  20: {
    meta_title: "Carciofi Trifolati | Contorni Italiani | LAPA Grossista Svizzera",
    meta_description: "Carciofi a spicchi trifolati premium. Contorni italiani pronti per ristoranti. LAPA grossista verdure in Svizzera.",
    keywords: "carciofi trifolati, contorni italiani, LAPA verdure, grossista ristoranti"
  },
  21: {
    meta_title: "Carpaccio di Manzo Premium | Antipasti Italiani | LAPA Fornitore",
    meta_description: "Carpaccio di manzo di alta qualita per antipasti raffinati. LAPA fornitore carni premium per ristoranti.",
    keywords: "carpaccio manzo, antipasti italiani, LAPA fornitore carne, ristoranti svizzera"
  },
  22: {
    meta_title: "Cassatine Siciliane | Dolci Siciliani | LAPA Grossista Svizzera",
    meta_description: "Cassatine siciliane monoporzione autentiche. Dolci siciliani per il tuo menu. LAPA fornitore in Svizzera.",
    keywords: "cassatine siciliane, dolci sicilia, LAPA pasticceria, fornitore dolci"
  },
  23: {
    meta_title: "Cialde per Cannoli Siciliani | Ingredienti Pasticceria | LAPA",
    meta_description: "Cialde scure mignon per cannoli siciliani perfetti. LAPA fornitore ingredienti pasticceria in Svizzera.",
    keywords: "cialde cannoli, cannoli siciliani, ingredienti pasticceria, LAPA dolci"
  },
  24: {
    meta_title: "Cime di Rapa e Salsiccia | Ricette Pugliesi | LAPA Fornitore",
    meta_description: "Cime di rapa e salsiccia: il gusto della Puglia. LAPA fornitore ingredienti pugliesi per ristoranti in Svizzera.",
    keywords: "cime di rapa, salsiccia pugliese, ricette puglia, LAPA ingredienti"
  },
  25: {
    meta_title: "Cornetto Italiano Autentico | Colazione Italiana | LAPA Grossista",
    meta_description: "Cornetto italiano autentico stile anni '80. Colazione italiana per bar e hotel. LAPA fornitore in Svizzera.",
    keywords: "cornetto italiano, colazione italiana, LAPA bar, fornitore cornetti"
  },
  26: {
    meta_title: "Cime di Rapa Surgelate Premium | Verdure Italiane | LAPA",
    meta_description: "Cime di rapa surgelate di alta qualita. Verdure italiane per ristoranti. LAPA grossista surgelati in Svizzera.",
    keywords: "cime di rapa surgelate, verdure surgelate, LAPA surgelati, grossista verdure"
  },
  27: {
    meta_title: "Cornetto Stile 1980 | Pasticceria Italiana | LAPA Fornitore",
    meta_description: "Cornetto stile 1980: il sapore autentico di una volta. LAPA fornitore pasticceria per bar in Svizzera.",
    keywords: "cornetto 1980, pasticceria italiana, LAPA fornitore bar, cornetti autentici"
  },
  28: {
    meta_title: "Coulant al Pistacchio | Dolci Gourmet | LAPA Grossista Svizzera",
    meta_description: "Coulant al pistacchio: il dessert che conquista. LAPA fornitore dolci gourmet per ristoranti in Svizzera.",
    keywords: "coulant pistacchio, dolci gourmet, LAPA dessert, fornitore pasticceria"
  },
  29: {
    meta_title: "Crema di Ricotta Siciliana | Ingredienti Cannoli | LAPA Fornitore",
    meta_description: "Crema di ricotta di pecora zuccherata per cannoli perfetti. LAPA fornitore ingredienti siciliani in Svizzera.",
    keywords: "crema ricotta, ricotta siciliana, ingredienti cannoli, LAPA sicilia"
  },
  30: {
    meta_title: "Culatta e Culatello | Salumi Emiliani Premium | LAPA Grossista",
    meta_description: "Culatta stagionata e culatello: eccellenze emiliane. LAPA fornitore salumi premium per ristoranti in Svizzera.",
    keywords: "culatta, culatello, salumi emiliani, LAPA fornitore salumi"
  },
  31: {
    meta_title: "Finocchiona IGP Toscana | Salumi Toscani | LAPA Fornitore",
    meta_description: "Finocchiona IGP toscana autentica. LAPA importa salumi toscani per ristoranti e gastronomie in Svizzera.",
    keywords: "finocchiona IGP, salumi toscani, LAPA toscana, fornitore salumi"
  },
  32: {
    meta_title: "Fiordilatte Taglio Napoli | Mozzarella per Pizza | LAPA Grossista",
    meta_description: "Fiordilatte taglio Napoli per pizza perfetta. LAPA fornitore mozzarella per pizzerie in Svizzera.",
    keywords: "fiordilatte napoli, mozzarella pizza, LAPA pizzeria, fornitore mozzarella"
  },
  33: {
    meta_title: "Friarielli Napoletani | Verdure Campane | LAPA Fornitore Svizzera",
    meta_description: "Friarielli napoletani autentici per pizza e contorni. LAPA fornitore verdure campane in Svizzera.",
    keywords: "friarielli, verdure napoletane, LAPA campania, fornitore friarielli"
  },
  34: {
    meta_title: "Fritto Misto Mignon | Antipasti Pronti | LAPA Grossista",
    meta_description: "Fritto misto mignon: l'antipasto che stupisce. LAPA fornitore antipasti pronti per ristoranti in Svizzera.",
    keywords: "fritto misto, antipasti pronti, LAPA antipasti, fornitore ristoranti"
  },
  35: {
    meta_title: "Funghi Porcini Affettati | Funghi Premium | LAPA Fornitore",
    meta_description: "Porcini gia affettati come freschi. LAPA fornitore funghi premium per ristoranti in Svizzera.",
    keywords: "porcini affettati, funghi premium, LAPA funghi, fornitore ristoranti"
  },
  36: {
    meta_title: "Mascarpone Italiano Premium | Formaggi per Tiramisu | LAPA",
    meta_description: "Mascarpone italiano di alta qualita per tiramisu perfetto. LAPA fornitore formaggi per ristoranti in Svizzera.",
    keywords: "mascarpone italiano, formaggi tiramisu, LAPA formaggi, fornitore mascarpone"
  },
  37: {
    meta_title: "Grana Padano DOP | Formaggi Italiani | LAPA Grossista Svizzera",
    meta_description: "Grana Padano DOP autentico. LAPA importa formaggi DOP italiani per ristoranti e pizzerie in Svizzera.",
    keywords: "grana padano DOP, formaggi DOP, LAPA formaggi, grossista italiano"
  },
  38: {
    meta_title: "Pappardelle all'Uovo Artigianali | Pasta Fresca | LAPA Fornitore",
    meta_description: "Pappardelle all'uovo artigianali per ragu perfetto. LAPA fornitore pasta fresca per ristoranti in Svizzera.",
    keywords: "pappardelle uovo, pasta fresca, LAPA pasta, fornitore ristoranti"
  },
  39: {
    meta_title: "Salmone Premium per Ristoranti | Pesce Fresco | LAPA Grossista",
    meta_description: "Salmone premium per piatti raffinati. LAPA fornitore pesce di qualita per ristoranti in Svizzera.",
    keywords: "salmone premium, pesce ristoranti, LAPA pesce, fornitore salmone"
  },
  40: {
    meta_title: "Peperoni Grigliati Premium | Contorni Italiani | LAPA Fornitore",
    meta_description: "Peperoni a filetti grigliati di alta qualita. LAPA fornitore contorni pronti per ristoranti in Svizzera.",
    keywords: "peperoni grigliati, contorni pronti, LAPA verdure, fornitore ristoranti"
  },
  42: {
    meta_title: "Insalata di Mare Premium | Antipasti di Pesce | LAPA Grossista",
    meta_description: "Insalata di mare che lascia senza parole. LAPA fornitore antipasti di pesce per ristoranti in Svizzera.",
    keywords: "insalata mare, antipasti pesce, LAPA frutti mare, fornitore ristoranti"
  },
  43: {
    meta_title: "Sfogliatella Riccia Napoletana | Dolci Napoli | LAPA Fornitore",
    meta_description: "Sfogliatella riccia autentica napoletana. LAPA fornitore dolci napoletani per bar e ristoranti in Svizzera.",
    keywords: "sfogliatella riccia, dolci napoletani, LAPA napoli, fornitore pasticceria"
  },
  44: {
    meta_title: "Frutti del Cappero | Ingredienti Mediterranei | LAPA Grossista",
    meta_description: "Frutti del cappero per ricette mediterranee. LAPA fornitore ingredienti italiani per ristoranti in Svizzera.",
    keywords: "frutti cappero, ingredienti mediterranei, LAPA capperi, fornitore ristoranti"
  },
  45: {
    meta_title: "Pinoli Italiani Premium | Ingredienti per Pesto | LAPA Fornitore",
    meta_description: "Pinoli italiani di alta qualita per pesto perfetto. LAPA fornitore ingredienti premium in Svizzera.",
    keywords: "pinoli italiani, ingredienti pesto, LAPA pinoli, fornitore ristoranti"
  },
  46: {
    meta_title: "Granella di Pistacchi | Ingredienti Pasticceria | LAPA Grossista",
    meta_description: "Granella di pistacchi premium per dolci e decorazioni. LAPA fornitore ingredienti pasticceria in Svizzera.",
    keywords: "granella pistacchi, ingredienti pasticceria, LAPA pistacchi, fornitore dolci"
  },
  47: {
    meta_title: "Porchetta Italiana Autentica | Salumi Premium | LAPA Fornitore",
    meta_description: "Porchetta italiana autentica per il tuo menu. LAPA fornitore salumi premium per ristoranti in Svizzera.",
    keywords: "porchetta italiana, salumi premium, LAPA porchetta, fornitore salumi"
  },
  48: {
    meta_title: "Tartellette Mignon | Antipasti Eleganti | LAPA Grossista Svizzera",
    meta_description: "Tartellette mignon per antipasti eleganti. LAPA fornitore finger food per catering in Svizzera.",
    keywords: "tartellette mignon, antipasti eleganti, LAPA catering, fornitore finger food"
  },
  49: {
    meta_title: "Tartellette per Catering | Finger Food Premium | LAPA Fornitore",
    meta_description: "Tartellette per catering e eventi. LAPA fornitore finger food di qualita in Svizzera.",
    keywords: "tartellette catering, finger food, LAPA eventi, fornitore catering"
  },
  50: {
    meta_title: "Tuorlo d'Uovo Premium | Ingredienti Pasta Fresca | LAPA Grossista",
    meta_description: "Tuorlo d'uovo rosso premium per pasta fresca. LAPA fornitore ingredienti per ristoranti in Svizzera.",
    keywords: "tuorlo uovo, ingredienti pasta, LAPA uova, fornitore ristoranti"
  },
  51: {
    meta_title: "Penne Rigate Premium | Pasta Italiana | LAPA Fornitore Svizzera",
    meta_description: "Penne rigate di alta qualita per il tuo ristorante. LAPA fornitore pasta italiana in Svizzera.",
    keywords: "penne rigate, pasta italiana, LAPA pasta, fornitore ristoranti"
  },
  52: {
    meta_title: "Tonno Yellowfin Premium | Pesce per Ristoranti | LAPA Grossista",
    meta_description: "Tonno yellowfin di alta qualita per piatti gourmet. LAPA fornitore pesce premium in Svizzera.",
    keywords: "tonno yellowfin, pesce gourmet, LAPA tonno, fornitore pesce"
  },
  53: {
    meta_title: "Spinaci Premium | Verdure per Ristoranti | LAPA Fornitore Svizzera",
    meta_description: "Spinaci di qualita superiore per il tuo menu. LAPA fornitore verdure per ristoranti in Svizzera.",
    keywords: "spinaci premium, verdure ristoranti, LAPA spinaci, fornitore verdure"
  },
  54: {
    meta_title: "Prosciutto di Parma DOP | Salumi Italiani | LAPA Grossista",
    meta_description: "Prosciutto di Parma DOP autentico. LAPA importa salumi DOP per ristoranti e gastronomie in Svizzera.",
    keywords: "prosciutto parma DOP, salumi DOP, LAPA prosciutto, fornitore salumi"
  },
  55: {
    meta_title: "Riso Arborio Premium | Riso per Risotto | LAPA Fornitore",
    meta_description: "Riso Arborio di alta qualita per risotto perfetto. LAPA fornitore riso italiano per ristoranti in Svizzera.",
    keywords: "riso arborio, riso risotto, LAPA riso, fornitore ristoranti"
  },
  56: {
    meta_title: "Pale per Pizza Professionali | Attrezzature Pizzeria | LAPA",
    meta_description: "Pale per pizza professionali per pizzaioli. LAPA fornitore attrezzature per pizzerie in Svizzera.",
    keywords: "pale pizza, attrezzature pizzeria, LAPA pizzeria, fornitore pizzaioli"
  },
  57: {
    meta_title: "Salsa di Pecorino | Condimenti Italiani | LAPA Grossista Svizzera",
    meta_description: "Salsa di pecorino per pasta e risotti. LAPA fornitore condimenti italiani per ristoranti in Svizzera.",
    keywords: "salsa pecorino, condimenti italiani, LAPA salse, fornitore ristoranti"
  },
  58: {
    meta_title: "Pomodori San Marzano DOP | Pomodori per Pizza | LAPA Fornitore",
    meta_description: "Pomodori San Marzano DOP per pizza napoletana perfetta. LAPA fornitore pomodori per pizzerie in Svizzera.",
    keywords: "san marzano DOP, pomodori pizza, LAPA pomodori, fornitore pizzerie"
  },
  59: {
    meta_title: "Prosciutto Cotto Premium | Salumi Italiani | LAPA Grossista",
    meta_description: "Prosciutto cotto di alta qualita per il tuo menu. LAPA fornitore salumi premium in Svizzera.",
    keywords: "prosciutto cotto, salumi italiani, LAPA prosciutto, fornitore salumi"
  },
  60: {
    meta_title: "Purea di Pera | Ingredienti Pasticceria | LAPA Fornitore Svizzera",
    meta_description: "Purea di pera zuccherata per dolci e dessert. LAPA fornitore ingredienti pasticceria in Svizzera.",
    keywords: "purea pera, ingredienti dolci, LAPA pasticceria, fornitore ingredienti"
  },
  61: {
    meta_title: "Speck Alto Adige IGP | Salumi Tirolesi | LAPA Grossista",
    meta_description: "Speck Alto Adige IGP autentico. LAPA importa salumi tirolesi per ristoranti in Svizzera.",
    keywords: "speck alto adige, salumi tirolesi, LAPA speck, fornitore salumi"
  },
  62: {
    meta_title: "Pesto Genovese Autentico | Condimenti Liguri | LAPA Fornitore",
    meta_description: "Pesto genovese autentico per pasta perfetta. LAPA fornitore condimenti liguri in Svizzera.",
    keywords: "pesto genovese, condimenti liguri, LAPA pesto, fornitore ristoranti"
  },
  63: {
    meta_title: "Carciofi Grigliati Premium | Antipasti Italiani | LAPA Grossista",
    meta_description: "Carciofi con gambo grigliati per antipasti. LAPA fornitore verdure premium per ristoranti in Svizzera.",
    keywords: "carciofi grigliati, antipasti italiani, LAPA carciofi, fornitore verdure"
  },
  64: {
    meta_title: "Prodotti Gourmet Italiani | Ingredienti Premium | LAPA Fornitore",
    meta_description: "Prodotti gourmet italiani per chef esigenti. LAPA fornitore ingredienti premium in Svizzera.",
    keywords: "prodotti gourmet, ingredienti premium, LAPA gourmet, fornitore chef"
  },
  65: {
    meta_title: "Pappardelle al Ragu di Cinghiale | Ricette Toscane | LAPA",
    meta_description: "Pappardelle al ragu di cinghiale toscano. LAPA fornitore ingredienti toscani per ristoranti in Svizzera.",
    keywords: "pappardelle cinghiale, ragu toscano, LAPA toscana, fornitore ristoranti"
  },
  69: {
    meta_title: "Spaghetti al Nero di Seppia | Pasta di Mare | LAPA Fornitore",
    meta_description: "Spaghetti alla chitarra al nero di seppia. LAPA fornitore pasta e pesce per ristoranti in Svizzera.",
    keywords: "spaghetti nero seppia, pasta mare, LAPA pasta, fornitore ristoranti"
  },
  73: {
    meta_title: "Spaghetti alla Carbonara Autentica | Ricetta Romana | LAPA",
    meta_description: "Spaghetti alla carbonara autentica romana. LAPA fornitore ingredienti per carbonara perfetta in Svizzera.",
    keywords: "carbonara autentica, ricetta romana, LAPA guanciale, fornitore ristoranti"
  },
  74: {
    meta_title: "Burrata Pugliese | Storia e Tradizione | LAPA Fornitore Svizzera",
    meta_description: "La burrata: un cuore cremoso dalla tradizione pugliese. LAPA fornitore burrata fresca in Svizzera.",
    keywords: "burrata pugliese, tradizione puglia, LAPA burrata, fornitore formaggi"
  }
};

async function main() {
  await auth();

  console.log('\n=== OTTIMIZZAZIONE SEO ARTICOLI BLOG ===\n');

  let count = 0;
  for (const [id, seo] of Object.entries(SEO_DATA)) {
    const postId = parseInt(id);

    // Aggiorno i meta tag SEO
    const result = await callOdoo('blog.post', 'write',
      [[postId], {
        website_meta_title: seo.meta_title,
        website_meta_description: seo.meta_description,
        website_meta_keywords: seo.keywords
      }]
    );

    if (result) {
      count++;
      console.log(`✓ ID ${postId}: ${seo.meta_title.substring(0, 50)}...`);
    } else {
      console.log(`✗ ID ${postId}: ERRORE`);
    }
  }

  console.log(`\n=== COMPLETATO: ${count} articoli ottimizzati SEO ===`);
}

main();
