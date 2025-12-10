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

const POST_ID = 46;

const TITLE_TRANSLATIONS = {
  it_IT: "Scopri la Granella di Pistacchi che Ti Farà Dire 'Mamma Mia'!",
  de_CH: "Entdecke den Pistaziensplitter, der dich 'Mamma Mia' sagen lässt!",
  fr_CH: "Découvre la Granella de Pistaches qui te Fera Dire 'Mamma Mia' !",
  en_US: "Discover the Pistachio Crumble That'll Make You Say 'Mamma Mia'!"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Ascolta qui, amico! Scommetto che hai provato un sacco di \"cosiddette\" granelle di pistacchio, ma lascia che ti dica una cosa... nulla, e dico nulla, si avvicina nemmeno lontanamente alla Granella di Pistacchi 2/4mm di LAPA. Pronto a farti sconvolgere il palato? 🤤",
  de_CH: "Hör mal zu, Freund! Ich wette, du hast jede Menge \"sogenannte\" Pistaziensplitter probiert, aber lass mich dir eins sagen... nichts, und ich meine nichts, kommt auch nur annähernd an den Pistaziensplitter 2/4mm von LAPA heran. Bereit, deinen Gaumen umhauen zu lassen? 🤤",
  fr_CH: "Écoute bien, ami ! Je parie que tu as essayé plein de \"soi-disant\" granellas de pistache, mais laisse-moi te dire une chose... rien, et je dis bien rien, n'arrive même de loin à la Granella de Pistaches 2/4mm de LAPA. Prêt à te faire bouleverser le palais ? 🤤",
  en_US: "Listen up, friend! I bet you've tried lots of \"so-called\" pistachio crumbles, but let me tell you something... nothing, and I mean nothing, comes even close to LAPA's 2/4mm Pistachio Crumble. Ready to have your palate blown away? 🤤"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ora, immagina questa scena: sei lì, in cucina')) {
      t[src] = {
        de_CH: 'Jetzt stell dir diese Szene vor: Du stehst in der Küche und merkst, dass die Splitter alle sind. Panik? Quatsch! Mit LAPA bestellst du heute und puff! - wie durch Magie - morgen bist du wieder im Geschäft. Und keine Ausreden, denn wir liefern sechs Tage die Woche, wie eine treue Ex, die nicht von dir lassen kann. 😉🚚',
        fr_CH: 'Maintenant, imagine cette scène : tu es là, en cuisine, et tu te rends compte que tu n\'as plus de granella. Panique ? Pas du tout ! Avec LAPA, tu commandes aujourd\'hui et pouf ! - comme par magie - demain tu es de nouveau en piste. Et pas d\'excuses qui tiennent, parce qu\'on livre six jours sur sept, comme une ex fidèle qui n\'arrive pas à rester loin. 😉🚚',
        en_US: 'Now, picture this scene: you\'re there in the kitchen, and you realize you\'ve run out of crumble. Panic? No way! With LAPA, you order today and poof! - like magic - tomorrow you\'re back in business. And there are no excuses, because we deliver six days a week, like a faithful ex who can\'t stay away. 😉🚚'
      };
    }
    else if (src.includes('E parliamo del nostro piccolo gioiellino tecnologico, l\'APP')) {
      t[src] = {
        de_CH: 'Und lass uns über unser kleines technologisches Juwel sprechen, die APP. Ob du ein digitaler Guru bist oder das Höchste an Technik für dich die Mikrowelle ist, unsere WEB APP ist so intuitiv, dass eine Bestellung aufzugeben einfacher ist als ein Bier zu zapfen. Du drückst einen Knopf und bam, alles was du brauchst ist auf dem Weg zu dir. Und du kannst diese nervigen Mindestbestellwerte vergessen. Wir wollen dich vom Joch des "du musst mindestens..." befreien, bei uns bestellst du so viel du willst und fertig. Du bist ein Rebell und brauchst nur ein Kilo? Kein Problem, Bruder! 📱💥',
        fr_CH: 'Et parlons de notre petit bijou technologique, l\'APP. Que tu sois un gourou du digital ou que le summum de la technologie pour toi soit le four micro-ondes, notre WEB APP est tellement intuitive que passer une commande sera plus facile que tirer une bière. Tu appuies sur un bouton et bam, tout ce qu\'il te faut est en route vers toi. Et tu peux oublier ces minimums de commande agaçants. On veut te libérer du joug des "tu dois acheter au moins...", ici chez nous tu commandes ce que tu veux et c\'est tout. Tu es un rebelle et il te faut qu\'un kilo ? Pas de problème, frangin ! 📱💥',
        en_US: 'And let\'s talk about our little technological gem, the APP. Whether you\'re a digital guru or the height of technology for you is the microwave, our WEB APP is so intuitive that placing an order will be easier than pulling a beer. You press a button and bam, everything you need is on its way to you. And you can forget those annoying minimum orders. We want to free you from the yoke of "you must buy at least...", here you order as much as you want and that\'s it. You\'re a rebel and only need a kilo? No problem, brother! 📱💥'
      };
    }
    else if (src.includes('Ecco la vera bomba 💣: i prezzi')) {
      t[src] = {
        de_CH: 'Hier kommt die echte Bombe 💣: die Preise. Mein Freund, wir passen sie so maßgeschneidert an, dass du denkst, du hättest den Schneider deiner Träume gefunden. Je nachdem wie viel du bestellst und wie oft, machen wir dir einen Preis, den nicht mal der Wochenmarkt schlagen kann. 💰👌',
        fr_CH: 'Voici la vraie bombe 💣 : les prix. Mon ami, on te les personnalise tellement sur mesure que tu auras l\'impression d\'avoir trouvé le tailleur de tes rêves. En fonction de combien tu en commandes et de la fréquence, on te fait un prix que même le marché du quartier ne peut pas battre. 💰👌',
        en_US: 'Here\'s the real bomb 💣: the prices. My friend, we customize them so tailored that you\'ll think you\'ve found the tailor of your dreams. Depending on how much you order and how often, we\'ll give you a price that not even the local market can beat. 💰👌'
      };
    }
    else if (src.includes('Diventare un VIP con noi non è come entrare in qualche club esclusivo')) {
      t[src] = {
        de_CH: 'Ein VIP bei uns zu werden ist nicht wie in einen exklusiven Snob-Club einzutreten, wo man über Golf redet und um fünf Uhr Tee trinkt. Hier bedeutet VIP sein, diese goldenen Splitter zu genießen, als wären sie extra für dich gesammelt worden, mit Extra-Services, die dich wie einen König fühlen lassen. Wir behandeln dich wie die Berühmtheit, die du in deiner kulinarischen Welt bist. 👑🎉',
        fr_CH: 'Devenir un VIP avec nous ce n\'est pas comme entrer dans un club exclusif pour snobs où on parle de golf et on boit du thé à cinq heures. Ici, être VIP signifie profiter de cette granella dorée comme si elle avait été récoltée exprès pour toi, avec des services extra qui te feront te sentir comme un roi. On te traite comme la célébrité que tu es dans ton monde culinaire. 👑🎉',
        en_US: 'Becoming a VIP with us isn\'t like joining some exclusive club for snobs where they talk about golf and drink tea at five. Here, being VIP means enjoying that golden crumble as if it was picked just for you, with extra services that\'ll make you feel like a king. We treat you like the celebrity you are in your culinary world. 👑🎉'
      };
    }
    else if (src.includes('E non finisce qui! Per qualsiasi problema, per qualsiasi dubbio')) {
      t[src] = {
        de_CH: 'Und es hört hier nicht auf! Bei jedem Problem, bei jedem Zweifel, auch nur um über den köstlichsten Splitter zu plaudern, den du je im Mund hattest, haben wir einen dedizierten Support, der dir wie ein Schatten folgt. Nun ja, ein sympathischer und super nützlicher Schatten, nicht der Typ, der dich durchs Fenster ausspioniert! 😜📞',
        fr_CH: 'Et ça ne s\'arrête pas là ! Pour n\'importe quel problème, n\'importe quel doute, même juste pour papoter de la plus exquise granella que tu aies jamais mise en bouche, on a une assistance dédiée qui te suit comme une ombre. Bon, une ombre sympa et super utile, pas le type qui t\'espionne par la fenêtre ! 😜📞',
        en_US: 'And it doesn\'t end here! For any problem, for any doubt, even just to chat about the most exquisite crumble you\'ve ever put in your mouth, we have dedicated support that follows you like a shadow. Well, a friendly and super helpful shadow, not the type that spies on you through the window! 😜📞'
      };
    }
    else if (src.includes('Quindi ora ti metto alla sfida: prova questa meraviglia di pistacchi')) {
      t[src] = {
        de_CH: 'Also fordere ich dich jetzt heraus: Probiere dieses Pistazien-Wunder und dann versuche mir zu sagen, dass du keine mystische Erfahrung hattest. Wenn du das schaffst, ohne die Finger hinter dem Rücken zu kreuzen, gebe ich eine Pizza aus! 🍕',
        fr_CH: 'Donc maintenant je te lance un défi : essaie cette merveille de pistaches et puis essaie de me dire que tu n\'as pas eu une expérience mystique. Si tu arrives à le faire sans croiser les doigts derrière le dos, j\'offre une pizza ! 🍕',
        en_US: 'So now I challenge you: try this pistachio wonder and then try to tell me you didn\'t have a mystical experience. If you can do that without crossing your fingers behind your back, I\'ll buy a pizza! 🍕'
      };
    }
    else if (src.includes('E allora? Ti ho stuzzicato abbastanza?')) {
      t[src] = {
        de_CH: 'Und jetzt? Habe ich dich genug angestachelt? Ich will dich mit unserem Splitter in Aktion sehen! Hinterlasse einen Kommentar oder teile deine kreativsten Gerichte! 🍽️🔥',
        fr_CH: 'Et alors ? Je t\'ai assez titillé ? Je veux te voir à l\'œuvre avec notre granella ! Laisse un commentaire ou partage tes plats les plus créatifs ! 🍽️🔥',
        en_US: 'So what? Did I tease you enough? I want to see you in action with our crumble! Leave a comment or share your most creative dishes! 🍽️🔥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 46: GRANELLA DI PISTACCHI ===\n');

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

  console.log('\n✅ ARTICOLO 46 COMPLETATO!');
}

main();
