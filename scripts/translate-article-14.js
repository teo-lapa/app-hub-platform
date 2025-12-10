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

const POST_ID = 14;

const TITLE_TRANSLATIONS = {
  it_IT: "LAPA - L'evoluzione ecosostenibile della ristorazione italiana 😋🌿",
  de_CH: "LAPA - Die nachhaltige Entwicklung der italienischen Gastronomie 😋🌿",
  fr_CH: "LAPA - L'évolution écoresponsable de la restauration italienne 😋🌿",
  en_US: "LAPA - The sustainable evolution of Italian dining 😋🌿"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao! Oggi ti voglio parlare')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Hallo! Heute möchte ich dir erzählen, wie LAPA - Finest Italian Food, das Schweizer Unternehmen, die Gastronomiebranche auf nachhaltige Weise revolutioniert. 🌍</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Salut ! Aujourd\'hui je veux te parler de comment LAPA - Finest Italian Food, l\'entreprise suisse qui révolutionne le secteur de la restauration de manière écoresponsable. 🌍</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Hi! Today I want to tell you about how LAPA - Finest Italian Food, the Swiss company that is revolutionizing the restaurant industry in a sustainable way. 🌍</span>'
      };
    }
    else if (src.includes('La sede di LAPA, situata a Zurigo')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Der Sitz von LAPA, in Zürich und im französischen Teil der Schweiz gelegen, ist ein konkretes Beispiel für unser Engagement für Nachhaltigkeit: Das Dach ist vollständig mit Solarpanelen bedeckt.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Le siège de LAPA, situé à Zurich et dans la zone francophone de la Suisse, est un exemple concret de notre engagement pour l\'écoresponsabilité : le toit est entièrement recouvert de panneaux solaires.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">LAPA\'s headquarters, located in Zurich and in the French-speaking area of Switzerland, is a concrete example of our commitment to sustainability: the roof is completely covered with solar panels.</span>'
      };
    }
    else if (src.includes('Consegne 6 su 7')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Lieferungen 6 von 7: Mit Lieferungen von Montag bis Samstag stellt LAPA sicher, dass deine Produkte frisch und pünktlich ankommen, wobei der Energieverbrauch und die CO2-Emissionen durch optimierte Routen reduziert werden.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Livraisons 6 sur 7 : en effectuant des livraisons du lundi au samedi, LAPA garantit que tes produits arrivent frais et à temps, en réduisant l\'utilisation des ressources énergétiques et les émissions de CO2 grâce à des itinéraires optimisés.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Deliveries 6 out of 7: by making deliveries from Monday to Saturday, LAPA ensures that your products arrive fresh and on time, reducing energy resource use and CO2 emissions through optimized routes.</span>'
      };
    }
    else if (src.includes('Listino personalizzato')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Personalisierte Preisliste: Maßgeschneiderte Preise für die Produkte, die du willst, basierend auf Häufigkeit und Volumen, ermöglichen es, das Angebot an deine spezifischen Bedürfnisse anzupassen und einen nachhaltigeren Ansatz zu fördern.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Liste de prix personnalisée : des prix sur mesure pour les produits que tu veux, basés sur la fréquence et le volume, permettent d\'adapter l\'offre à tes besoins spécifiques, en promouvant une approche plus durable.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Customized price list: tailored prices for the products you want, based on frequency and volume, allow you to adapt the offer to your specific needs, promoting a more sustainable approach.</span>'
      };
    }
    else if (src.includes('APP per ordini')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">APP für Bestellungen: Die WEB APP von LAPA eliminiert die Notwendigkeit, Papier und Tinte für Bestellungen zu verwenden, und trägt dazu bei, den ökologischen Fußabdruck deines Lokals zu reduzieren und die Digitalisierung zu fördern.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">APP pour commandes : la WEB APP de LAPA élimine le besoin d\'utiliser du papier et de l\'encre pour les commandes, contribuant à réduire l\'empreinte écologique de ton établissement et à promouvoir la digitalisation.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">APP for orders: LAPA\'s WEB APP eliminates the need to use paper and ink for orders, helping to reduce the ecological footprint of your establishment and promoting digitalization.</span>'
      };
    }
    else if (src.includes('Servizi V.I.P.')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">V.I.P. Services: Mit personalisierten Dienstleistungen für anspruchsvolle Kunden verpflichtet sich LAPA, innovative und nachhaltige Lösungen ohne Qualitätseinbußen anzubieten. Denn wie ein König behandelt zu werden, ist unbezahlbar.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Services V.I.P. : avec des services personnalisés pour les clients exigeants, LAPA s\'engage à offrir des solutions innovantes et écoresponsables, sans compromettre la qualité. Parce qu\'être traité comme un roi n\'a pas de prix.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">V.I.P. Services: with personalized services for demanding customers, LAPA is committed to offering innovative and sustainable solutions, without compromising quality. Because being treated like royalty is priceless.</span>'
      };
    }
    else if (src.includes('Ordini oggi per domani')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Bestellung heute für morgen: Etwas vergessen? Bestelle heute und es kommt morgen an, was eine kontinuierliche und rechtzeitige Produktversorgung gewährleistet und die Notwendigkeit vermeidet, überschüssige Lagerbestände anzulegen.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Commandes aujourd\'hui pour demain : tu as oublié quelque chose ? Commande aujourd\'hui et ça arrive demain, garantissant un approvisionnement continu et ponctuel des produits, évitant la nécessité de stocker des excès.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Orders today for tomorrow: forgot something? Order today and it arrives tomorrow, guaranteeing continuous and timely product supply, avoiding the need to stock excess inventory.</span>'
      };
    }
    else if (src.includes('Nessun minimo d\'ordine')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Kein Mindestbestellwert: Mit LAPA kannst du nur das kaufen, was du wirklich brauchst, was einen ausgewogeneren und nachhaltigeren Konsumansatz fördert, im Einklang mit modernen Praktiken.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Pas de minimum de commande : avec LAPA, tu peux acheter seulement ce dont tu as vraiment besoin, promouvant une approche de consommation plus équilibrée et durable, en ligne avec les pratiques modernes.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">No minimum order: with LAPA, you can buy only what you really need, promoting a more balanced and sustainable consumption approach, in line with modern practices.</span>'
      };
    }
    else if (src.includes('I prodotti che tu vuoi')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Die Produkte, die du willst: LAPA wählt aus, importiert und liefert dir alles, was du brauchst, wobei wenn möglich auf saisonale Produkte gesetzt wird, und arbeitet mit Lieferanten zusammen, die dieselbe Nachhaltigkeitsvision teilen.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Les produits que tu veux : LAPA sélectionne, importe et te livre tout ce dont tu as besoin, en privilégiant les produits de saison quand c\'est possible, et en travaillant avec des fournisseurs qui partagent la même vision de durabilité.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">The products you want: LAPA selects, imports and delivers everything you need, focusing on seasonal products when possible, and working with suppliers who share the same sustainability vision.</span>'
      };
    }
    else if (src.includes('Assistenza dedicata')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Dedizierte Unterstützung: Wenn du Fragen oder Zweifel zur Nachhaltigkeit der Produkte oder zu den besten Umweltpraktiken hast, stehen dir die LAPA-Experten zur Verfügung, um Beratung und Unterstützung anzubieten.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Assistance dédiée : si tu as des questions ou des doutes sur l\'écoresponsabilité des produits ou sur les meilleures pratiques environnementales, les experts LAPA sont à ta disposition pour offrir conseil et soutien.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Dedicated assistance: if you have questions or doubts about the sustainability of products or best environmental practices, LAPA experts are at your disposal to offer advice and support.</span>'
      };
    }
    else if (src.includes('LAPA - Finest Italian Food è la risposta ideale')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">LAPA - Finest Italian Food ist die ideale Antwort für alle, die einen zuverlässigen, umweltbewussten Partner suchen, der in der Lage ist, hochwertige Produkte und Dienstleistungen anzubieten. Wenn auch du dich dieser nachhaltigen Revolution anschließen möchtest...</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">LAPA - Finest Italian Food est la réponse idéale pour ceux qui cherchent un partenaire fiable, attentif à l\'environnement et capable d\'offrir des produits et services de haute qualité. Si toi aussi tu veux rejoindre cette révolution durable...</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">LAPA - Finest Italian Food is the ideal answer for those looking for a reliable partner, environmentally conscious and able to offer high-quality products and services. If you too want to join this sustainable revolution...</span>'
      };
    }
    else if (src.includes('Scegliendo LAPA come fornitore, non solo avrai accesso')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Wenn du LAPA als Lieferanten wählst, hast du nicht nur Zugang zu hochwertigen Produkten und einwandfreien Dienstleistungen, sondern trägst auch aktiv zum Umweltschutz bei. Die Zusammenarbeit mit LAPA ermöglicht es dir, Teil einer nachhaltigen Bewegung zu sein.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">En choisissant LAPA comme fournisseur, tu n\'auras pas seulement accès à des produits de haute qualité et des services impeccables, mais tu contribueras aussi activement à la protection de l\'environnement. La collaboration avec LAPA te permet de faire partie d\'un mouvement durable.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">By choosing LAPA as your supplier, you will not only have access to high-quality products and impeccable services, but you will also actively contribute to environmental protection. Collaboration with LAPA allows you to be part of a sustainable movement.</span>'
      };
    }
    else if (src.includes('Ricorda, ogni scelta che fai come imprenditore')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Denke daran, dass jede Entscheidung, die du als Unternehmer im Bereich der Gastronomie triffst, einen Unterschied für unseren Planeten machen kann. Indem du dich LAPA anschließt, wählst du eine grünere Zukunft für dein Lokal, deine Mitarbeiter und deine Kunden.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Rappelle-toi, chaque choix que tu fais en tant qu\'entrepreneur dans le domaine de la restauration peut faire la différence pour notre planète. En rejoignant LAPA, tu choisis un avenir plus vert pour ton établissement, tes collaborateurs et tes clients.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Remember, every choice you make as an entrepreneur in the restaurant industry can make a difference for our planet. By joining LAPA, you choose a greener future for your establishment, your staff and your customers.</span>'
      };
    }
    else if (src.includes('Ti invitiamo a seguirc')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Wenn du LAPA als Lieferanten wählst, hast du nicht nur Zugang zu hochwertigen Produkten und einwandfreien Dienstleistungen, sondern trägst auch aktiv zum Umweltschutz bei. Wir laden dich ein, uns in den sozialen Medien zu folgen.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">En choisissant LAPA comme fournisseur, tu n\'auras pas seulement accès à des produits de haute qualité et des services impeccables, mais tu contribueras aussi activement à la protection de l\'environnement. Nous t\'invitons à nous suivre sur les réseaux sociaux.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">By choosing LAPA as your supplier, you will not only have access to high-quality products and impeccable services, but you will also actively contribute to environmental protection. We invite you to follow us on social media.</span>'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 14: LAPA ECOSOSTENIBILE ===\n');

  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  const TRANSLATIONS = getTranslations(sourceTexts);

  console.log('3. Applico traduzioni...');
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let count = 0;
    for (const src of sourceTexts) {
      if (TRANSLATIONS[src] && TRANSLATIONS[src][lang]) {
        langTranslations[src] = TRANSLATIONS[src][lang];
        count++;
      }
    }
    if (Object.keys(langTranslations).length > 0) {
      await callOdoo('blog.post', 'update_field_translations',
        [[POST_ID], 'content', { [lang]: langTranslations }]
      );
    }
    console.log(`   ${lang}: ${count} segmenti`);
  }

  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 60);
    console.log(`[${lang}] ${title.substring(0, 50)}...`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 14 COMPLETATO!');
}

main();
