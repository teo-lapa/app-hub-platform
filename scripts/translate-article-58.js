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

const POST_ID = 58;

const TITLE_TRANSLATIONS = {
  it_IT: "🍅 Vuoi veramente sprecare i tuoi fantastici piatti con pomodori scadenti? Scegli i Datterini Pelati Rossi di Sammy! 🍅",
  de_CH: "🍅 Willst du wirklich deine fantastischen Gerichte mit minderwertigen Tomaten verschwenden? Wähle die roten geschälten Datteltomaten von Sammy! 🍅",
  fr_CH: "🍅 Tu veux vraiment gâcher tes plats fantastiques avec des tomates médiocres ? Choisis les Tomates Datterini Pelées Rouges de Sammy ! 🍅",
  en_US: "🍅 Do You Really Want to Waste Your Fantastic Dishes with Poor Tomatoes? Choose Sammy's Red Peeled Datterini! 🍅"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Capita a tutti, tranquillo. È lunedì mattina')) {
      t[src] = {
        de_CH: 'Es passiert jedem, keine Sorge. Es ist Montagmorgen, das Wochenende war die Hölle mit Leuten und jetzt findest du dich dabei wieder, den Boden des Tomatenglases auszukratzen. Und was machst du jetzt? Gehst du zum Discounter um die Ecke, um dieses Zeug zu kaufen, das mehr nach Dose als nach Tomate schmeckt? Komm schon, keine Scherze! Du bist ein Koch, nicht jemand, der sich mit allem zufriedengibt!',
        fr_CH: 'Ça arrive à tout le monde, tranquille. C\'est lundi matin, le weekend a été un enfer de monde et maintenant tu te retrouves à gratter le fond du bocal de tomates. Et maintenant tu fais quoi ? Tu vas au discount du coin acheter ce truc qui a plus le goût de boîte que de tomate ? Allez, on rigole pas ! Tu es un chef, pas quelqu\'un qui se contente de n\'importe quoi !',
        en_US: 'It happens to everyone, don\'t worry. It\'s Monday morning, the weekend was a hellish rush and now you find yourself scraping the bottom of the tomato jar. So what do you do now? Go to the discount store around the corner to buy that stuff that tastes more like tin than tomato? Come on, no joking! You\'re a chef, not someone who settles for anything!'
      };
    }
    else if (src.includes('Ecco dove entra in gioco LAPA. Tu ordini oggi e bam!')) {
      t[src] = {
        de_CH: 'Hier kommt LAPA ins Spiel. Du bestellst heute und bam! Morgen hast du die roten geschälten Datteltomaten Sammy direkt in deiner Küche. Und keine Mindestbestellung: nimm, was du brauchst, wann du es brauchst. Hast du vergessen zu bestellen? Kein Drama, dafür sind wir da. Bestelle noch im Schlafanzug und wir kümmern uns um den Rest.',
        fr_CH: 'C\'est là que LAPA entre en jeu. Tu commandes aujourd\'hui et bam ! Demain tu retrouves les datterini pelés rouges Sammy directement dans ta cuisine. Et pas de minimum de commande : prends ce qu\'il te faut, quand il te le faut. Tu as oublié de commander ? Pas de drame, on est là pour ça. Passe commande en pyjama et on s\'occupe du reste.',
        en_US: 'This is where LAPA comes in. You order today and bam! Tomorrow you have the Sammy red peeled datterini right in your kitchen. And no minimum order: take what you need, when you need it. Forgot to order? No drama, we\'re here for that. Place your order while still in pajamas and we take care of the rest.'
      };
    }
    else if (src.includes('E poi, amico mio, hai mai usato la nostra Web App?')) {
      t[src] = {
        de_CH: 'Und dann, mein Freund, hast du jemals unsere Web App benutzt? Es ist wie die Kontrolle über die Welt an deinen Fingerspitzen zu haben. Bestellungen, Kontrollen, Verlauf - alles da, ganz einfach. Willst du eine Preisliste, die wie auf dich zugeschnitten wirkt? Die machen wir dir, basierend darauf, was und wie viel du am häufigsten bestellst. Und wenn du Hilfe brauchst, ein Anruf und wir holen dich aus der Patsche. Ich stelle mir die Szene schon vor: "Hilfe, LAPA! Ich brauche mehr Tomaten!" Und wir: "Der LKW läuft schon warm!"',
        fr_CH: 'Et puis, mon ami, tu as déjà utilisé notre Web App ? C\'est comme avoir le contrôle du monde au bout des doigts. Commandes, contrôles, historiques - tout est là, facile facile. Tu veux une liste de prix qui semble faite sur mesure pour toi ? On te la fait, basée sur ce que tu commandes le plus souvent et en quelle quantité. Et si tu as besoin d\'un coup de main, un appel et on te sort des ennuis. J\'imagine déjà la scène : "Help, LAPA ! J\'ai besoin de plus de tomates !" Et nous : "On a déjà le camion en marche !"',
        en_US: 'And then, my friend, have you ever used our Web App? It\'s like having control of the world at your fingertips. Orders, checks, history - all there, easy peasy. Want a price list that seems tailor-made for you? We\'ll make it for you, based on what and how much you order most often. And if you need a hand, one call and we pull you out of trouble. I can already imagine the scene: "Help, LAPA! I need more tomatoes!" And us: "We\'ve already got the truck running!"'
      };
    }
    else if (src.includes('Dunque, torniamo ai nostri pomodori datterini pelati')) {
      t[src] = {
        de_CH: 'Also, zurück zu unseren geschälten Datteltomaten. Denn, gib es zu, alles schmeckt besser mit der richtigen Tomate. Ob du eine umwerfende Pizza oder eine Pasta zubereitest, bei der Mama weint, die Sammy-Tomaten machen den Unterschied. Das sind nicht die üblichen Tomaten, das sind die, die dich sagen lassen: "Verdammt, das ist eine Tomate!"',
        fr_CH: 'Donc, revenons à nos tomates datterini pelées. Parce que, avoue-le, tout est meilleur avec la bonne tomate. Que tu prépares une pizza de folie ou des pâtes qui font pleurer mamma, les tomates de Sammy font la différence. Ce ne sont pas les tomates habituelles, ce sont celles qui te font dire : "Bon sang, ça c\'est une tomate !"',
        en_US: 'So, back to our peeled datterini tomatoes. Because, admit it, everything tastes better with the right tomato. Whether you\'re making a killer pizza or pasta that makes mama cry, Sammy\'s tomatoes make the difference. These aren\'t your usual tomatoes, these are the ones that make you say: "Damn, this is a tomato!"'
      };
    }
    else if (src.includes('Allora, che dici, sei pronto a trattare te stesso e i tuoi clienti come dei VIP?')) {
      t[src] = {
        de_CH: 'Also, was sagst du, bist du bereit, dich selbst und deine Kunden wie VIPs zu behandeln? Warum sich mit weniger zufriedengeben, wenn du das Beste haben kannst, direkt von LAPA zu dir geliefert. Und wenn du immer noch nicht überzeugt bist, naja, vielleicht ist es Zeit, über deine kulinarischen Entscheidungen nachzudenken. Lass uns reden, schreib in die Kommentare, erzähl mir alles! 😜',
        fr_CH: 'Alors, qu\'est-ce que tu dis, tu es prêt à te traiter toi-même et tes clients comme des VIP ? Pourquoi se contenter de moins quand tu peux avoir le top, livré directement chez toi par LAPA. Et si tu n\'es toujours pas convaincu, eh bien, peut-être qu\'il est temps de réfléchir à tes choix culinaires. Parlons-en, donne tout dans les commentaires, dis-moi tout ! 😜',
        en_US: 'So, what do you say, are you ready to treat yourself and your customers like VIPs? Why settle for less when you can have the best, delivered directly to you by LAPA. And if you\'re still not convinced, well, maybe it\'s time to reflect on your culinary choices. Let\'s talk, go all in on the comments, tell me everything! 😜'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 58: DATTERINI PELATI ROSSI SAMMY ===\n');

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

  console.log('\n✅ ARTICOLO 58 COMPLETATO!');
}

main();
