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

const POST_ID = 55;

const TITLE_TRANSLATIONS = {
  it_IT: "🍚 Riso Arborio di LAPA: La Rivoluzione in Cucina! 😱",
  de_CH: "🍚 Arborio-Reis von LAPA: Die Revolution in der Küche! 😱",
  fr_CH: "🍚 Riz Arborio de LAPA : La Révolution en Cuisine ! 😱",
  en_US: "🍚 LAPA's Arborio Rice: The Kitchen Revolution! 😱"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Allora, amici cuochi, pizzaioli, e gestori di locali alla moda, oggi vi parlo di una roba che vi cambierà la vita: il Riso Arborio Astuccio 1KG 12PZ CRT di LAPA. Sì, avete capito bene, sto parlando di riso, ma non di quello scialbo e anonimo che trovate al discount.",
  de_CH: "Also, liebe Köche, Pizzabäcker und Betreiber von trendigen Lokalen, heute erzähle ich euch von etwas, das euer Leben verändern wird: der Arborio-Reis Karton 1KG 12ST von LAPA. Ja, ihr habt richtig gehört, ich spreche von Reis, aber nicht von dem faden und anonymen, den ihr beim Discounter findet.",
  fr_CH: "Alors, amis cuisiniers, pizzaïolos, et gérants de restos branchés, aujourd'hui je vous parle d'un truc qui va changer votre vie : le Riz Arborio Étui 1KG 12PC CRT de LAPA. Oui, vous avez bien compris, je parle de riz, mais pas de celui fade et anonyme que vous trouvez au discount.",
  en_US: "So, chef friends, pizza makers, and trendy venue managers, today I'm talking about something that will change your life: LAPA's Arborio Rice Box 1KG 12PC CRT. Yes, you heard right, I'm talking about rice, but not the bland, anonymous kind you find at the discount store."
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Questo riso è una bomba!')) {
      t[src] = {
        de_CH: 'Dieser Reis ist der Hammer! Perfekt für diese Risottos zum Finger ablecken, die die Kunden verrückt machen. Und wie serviert ihr sie, eh? Perfekte Cremigkeit, Körner al dente... Mamma mia, mir läuft schon das Wasser im Mund zusammen!',
        fr_CH: 'Ce riz est une bombe ! Parfait pour ces risottos à se lécher les babines qui rendent les clients dingues. Et comment vous les servez, hein ? Crémeux à la perfection, grains al dente... Mamma mia, j\'en ai déjà l\'eau à la bouche !',
        en_US: 'This rice is a bomb! Perfect for those finger-licking risottos that drive customers crazy. And how do you serve them, eh? Perfect creaminess, al dente grains... Mamma mia, my mouth is already watering!'
      };
    }
    else if (src.includes('Ma Aspetta, C\'è di Più!')) {
      t[src] = {
        de_CH: 'Aber warte, es gibt noch mehr!',
        fr_CH: 'Mais Attends, Il y a Plus !',
        en_US: 'But Wait, There\'s More!'
      };
    }
    else if (src.includes('Con LAPA non ci sono storie')) {
      t[src] = {
        de_CH: 'Mit LAPA gibt es keine Geschichten. Hast du vergessen, den Reis zu bestellen und der Koch macht ein meterlanges Gesicht? Keine Sorge, Bruder! Mit LAPA bestellst du heute und puff! Morgen ist der Reis in deiner Küche. Superschnelle Lieferungen, 6 Tage die Woche. Und zerbrech dir nicht den Kopf, wann du bestellen sollst, mach wie es dir passt!',
        fr_CH: 'Avec LAPA pas d\'histoires. T\'as oublié de commander le riz et le cuistot te fait une tête longue d\'un mètre ? Tranquille, frangin ! Avec LAPA tu commandes aujourd\'hui, et pouf ! Demain le riz est dans ta cuisine. Livraisons ultra-rapides, 6 jours sur 7. Et te prends pas la tête sur quand commander, fais comme tu veux !',
        en_US: 'With LAPA there\'s no drama. Forgot to order rice and your chef is giving you the stink eye? Relax, brother! With LAPA you order today and poof! Tomorrow the rice is in your kitchen. Super-fast deliveries, 6 days a week. And don\'t stress about when to order, do as you please!'
      };
    }
    else if (src.includes('E poi, parliamo di prezzi')) {
      t[src] = {
        de_CH: 'Und dann, lass uns über Preise reden. Du weißt, wie manche Lieferanten sind, sie geben dir das Gefühl, als würdest du einen Diamanten kaufen. Aber wir bei LAPA? Kein Mindestbestellwert, personalisierte Preise. Wir wollen, dass du entspannt bist, dass du bestellen kannst, was du brauchst, wann du es brauchst, ohne dass das Portemonnaie weint.',
        fr_CH: 'Et puis, parlons des prix. Tu sais comment sont certains fournisseurs, ils te font sentir comme si tu achetais un diamant. Mais nous chez LAPA ? Pas de minimum de commande, prix personnalisés. On veut que tu sois tranquille, que tu puisses commander ce qu\'il te faut, quand il te le faut, sans que le portefeuille pleure.',
        en_US: 'And then, let\'s talk prices. You know how some suppliers are, they make you feel like you\'re buying a diamond. But us at LAPA? No minimum order, customized prices. We want you to be relaxed, to order what you need, when you need it, without your wallet crying.'
      };
    }
    else if (src.includes('E la Tecnologia, Amico Mio!')) {
      t[src] = {
        de_CH: 'Und die Technologie, mein Freund!',
        fr_CH: 'Et la Technologie, Mon Ami !',
        en_US: 'And Technology, My Friend!'
      };
    }
    else if (src.includes('Dimenticati di telefonate e liste della spesa scritte su tovaglioli')) {
      t[src] = {
        de_CH: 'Vergiss Telefonanrufe und Einkaufslisten auf Servietten. Mit unserer App bestellst du, während du auf dem Sofa ein Bier genießt. Alles glatt wie Öl, mit Bestellhistorie und Dokumenten auf einen Klick.',
        fr_CH: 'Oublie les coups de fil et les listes de courses écrites sur des serviettes. Avec notre app, tu commandes pendant que t\'es sur le canapé à savourer une bière. Tout roule comme sur des roulettes, avec historique des commandes et documents à portée de clic.',
        en_US: 'Forget phone calls and shopping lists written on napkins. With our app, you order while you\'re on the couch enjoying a beer. Everything smooth as silk, with order history and documents just a click away.'
      };
    }
    else if (src.includes('Torniamo al Nostro Eroe: Il Riso Arborio')) {
      t[src] = {
        de_CH: 'Zurück zu unserem Helden: Der Arborio-Reis',
        fr_CH: 'Revenons à Notre Héros : Le Riz Arborio',
        en_US: 'Back to Our Hero: Arborio Rice'
      };
    }
    else if (src.includes('Che dire, ragazzi, questo riso è il top')) {
      t[src] = {
        de_CH: 'Was soll ich sagen, Leute, dieser Reis ist der Hammer. Körner, die wie Juwelen aussehen, die den Geschmack aufsaugen wie Schwämme, ohne zu einem Brei zu werden. Und dann bist du frei, dich auszutoben: Risottos, Salate, Desserts... der Himmel ist die Grenze!',
        fr_CH: 'Que dire, les gars, ce riz c\'est le top. Des grains qui ressemblent à des bijoux, qui absorbent la saveur comme des éponges sans devenir de la bouillie. Et puis, tu es libre de te lâcher : risottos, salades, desserts... le ciel est la limite !',
        en_US: 'What can I say, guys, this rice is the best. Grains that look like jewels, that absorb flavor like sponges without becoming mush. And then, you\'re free to go wild: risottos, salads, desserts... the sky\'s the limit!'
      };
    }
    else if (src.includes('E per Qualsiasi Cosa...')) {
      t[src] = {
        de_CH: 'Und für alles andere...',
        fr_CH: 'Et pour N\'importe Quoi...',
        en_US: 'And for Anything...'
      };
    }
    else if (src.includes('Hai un dubbio, un problema, un\'idea matta che vuoi provare?')) {
      t[src] = {
        de_CH: 'Hast du einen Zweifel, ein Problem, eine verrückte Idee, die du ausprobieren willst? Schreib uns, ruf uns an. Wir sind für dich da, immer bereit, dir zu helfen oder einen Rat zu geben.',
        fr_CH: 'Tu as un doute, un problème, une idée folle que tu veux essayer ? Écris-nous, appelle-nous. On est là pour toi, toujours prêts à te donner un coup de main ou un conseil.',
        en_US: 'Got a doubt, a problem, a crazy idea you want to try? Write us, call us. We\'re here for you, always ready to lend a hand or give advice.'
      };
    }
    else if (src.includes('Insomma...')) {
      t[src] = {
        de_CH: 'Also...',
        fr_CH: 'En bref...',
        en_US: 'In short...'
      };
    }
    else if (src.includes('Sei pronto a dare una svolta alla tua cucina')) {
      t[src] = {
        de_CH: 'Bist du bereit, deiner Küche mit unserem Arborio-Reis eine neue Richtung zu geben? Oder ziehst du es vor, mit dem üblichen traurigen Reis weiterzumachen, der nach nichts schmeckt? Komm schon, lass es uns in den Kommentaren wissen! Teile deine Rezepte, deine Ideen, deine kulinarischen Verrücktheiten. Und denk dran, mit LAPA und unserem Arborio-Reis wird die Küche nie mehr dieselbe sein!',
        fr_CH: 'Tu es prêt à donner un tournant à ta cuisine avec notre Riz Arborio ? Ou tu préfères continuer avec le riz tristounet habituel qui n\'a goût de rien ? Allez, fais-nous savoir dans les commentaires ! Partage tes recettes, tes idées, tes folies culinaires. Et rappelle-toi, avec LAPA et notre Riz Arborio, la cuisine ne sera plus jamais la même !',
        en_US: 'Are you ready to shake up your kitchen with our Arborio Rice? Or do you prefer to keep using the same sad rice that tastes like nothing? Come on, let us know in the comments! Share your recipes, your ideas, your culinary craziness. And remember, with LAPA and our Arborio Rice, the kitchen will never be the same!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 55: RISO ARBORIO ===\n');

  console.log('1. Aggiorno titolo e sottotitolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang], subtitle: SUBTITLE_TRANSLATIONS[lang] }],
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

  console.log('\n✅ ARTICOLO 55 COMPLETATO!');
}

main();
