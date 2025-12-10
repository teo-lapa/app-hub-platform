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

const POST_ID = 47;

const TITLE_TRANSLATIONS = {
  it_IT: "Sei pronto a dire addio alla porchetta da quattro soldi? 🚀",
  de_CH: "Bist du bereit, dich von der Billig-Porchetta zu verabschieden? 🚀",
  fr_CH: "Tu es prêt à dire adieu à la porchetta de quatre sous ? 🚀",
  en_US: "Ready to Say Goodbye to Cheap Porchetta? 🚀"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Ehi, tu! Sì, proprio tu, che ti vanti di sapere tutto sulla porchetta e pensi che quella che servi sia il non plus ultra. Scommetto che non hai ancora assaggiato la nostra Porchetta di Ariccia SV ca 5kg FERR. Preparati a rimanere a bocca aperta! 😲",
  de_CH: "Hey, du! Ja, genau du, der sich rühmt, alles über Porchetta zu wissen und denkt, die, die du servierst, sei das Nonplusultra. Ich wette, du hast unsere Porchetta di Ariccia SV ca 5kg FERR noch nicht probiert. Mach dich bereit, staunend dazustehen! 😲",
  fr_CH: "Hé, toi ! Oui, toi, qui te vantes de tout savoir sur la porchetta et qui penses que celle que tu sers est le nec plus ultra. Je parie que tu n'as pas encore goûté notre Porchetta di Ariccia SV env. 5kg FERR. Prépare-toi à rester bouche bée ! 😲",
  en_US: "Hey, you! Yes, you, who brags about knowing everything about porchetta and thinks the one you serve is the ultimate. I bet you haven't tasted our Porchetta di Ariccia SV approx. 5kg FERR yet. Get ready to be amazed! 😲"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Parliamo di una porchetta che ti fa dimenticare tutte quelle volte')) {
      t[src] = {
        de_CH: 'Wir sprechen von einer Porchetta, die dich all die Male vergessen lässt, als du dich mit einem Schwein zufrieden geben musstest, das gummiger war als ein alter Reifen. Unsere ist außen knusprig, innen zart, mit diesem Geschmack, der dich bei jedem Bissen "Mamma mia!" sagen lässt.',
        fr_CH: 'On parle d\'une porchetta qui te fait oublier toutes ces fois où tu as dû te contenter d\'un porc plus caoutchouteux qu\'un vieux pneu. La nôtre est croustillante dehors, moelleuse dedans, avec ce goût qui te fait dire "Mamma mia !" à chaque bouchée.',
        en_US: 'We\'re talking about a porchetta that makes you forget all those times you had to settle for a pork more rubbery than an old tire. Ours is crispy outside, tender inside, with that taste that makes you say "Mamma mia!" with every bite.'
      };
    }
    else if (src.includes('Ora, smettila di pianificare gli ordini come se stessi preparando un\'invasione')) {
      t[src] = {
        de_CH: 'Jetzt hör auf, Bestellungen zu planen, als würdest du eine Invasion vorbereiten. Bei uns kannst du bestellen, wann du willst, denn wir liefern sechs Tage die Woche. Montag, Dienstag, Mittwoch – jeden verdammten Tag außer Sonntag, aus Respekt vor der Ruhe (und auch weil wir unsere Porchetta essen müssen, oder?). 😜',
        fr_CH: 'Maintenant, arrête de planifier les commandes comme si tu préparais une invasion. Avec nous tu peux commander quand tu veux, parce qu\'on livre six jours sur sept. Lundi, mardi, mercredi – chaque foutu jour sauf le dimanche, par respect du repos (et aussi parce qu\'on doit manger notre porchetta, non ?). 😜',
        en_US: 'Now, stop planning orders like you\'re preparing an invasion. With us you can order whenever you want, because we deliver six days a week. Monday, Tuesday, Wednesday – every damn day except Sunday, out of respect for rest (and also because we have to eat our porchetta, right?). 😜'
      };
    }
    else if (src.includes('E non ti rompiamo le scatole con prezzi fissi come menù di un autogrill')) {
      t[src] = {
        de_CH: 'Und wir nerven dich nicht mit festen Preisen wie auf einer Autobahnraststätte. Nein, nein, nein. Hier ist das Zauberwort "personalisiert". Sag mir, wie viel du isst, sag mir, wie oft, und ich mache dir einen Preis, der dein Lächeln verbreitert.',
        fr_CH: 'Et on ne te casse pas les pieds avec des prix fixes comme un menu d\'aire d\'autoroute. Non, non, non. Ici le mot magique c\'est "personnalisé". Dis-moi combien tu en manges, dis-moi combien de fois, et je te fais un prix qui t\'élargira le sourire.',
        en_US: 'And we don\'t bug you with fixed prices like a highway rest stop menu. No, no, no. Here the magic word is "customized". Tell me how much you eat, tell me how often, and I\'ll give you a price that\'ll widen your smile.'
      };
    }
    else if (src.includes('Ma aspetta, il bello deve ancora venire. 🥁 Taaac! La nostra WEB APP')) {
      t[src] = {
        de_CH: 'Aber warte, das Beste kommt noch. 🥁 Taaac! Unsere WEB APP. Die ist so einfach und schnell, dass sogar mein Opa sie benutzt hat, während er seinen hundertsten Espresso des Tages machte. Du bestellst mit einem Tap und findest die Bestellhistorie, die Dokumente und sogar die Seele deiner Küche, wenn du willst.',
        fr_CH: 'Mais attends, le meilleur reste à venir. 🥁 Taaac ! Notre WEB APP. Elle est tellement facile et rapide que même mon grand-père l\'a utilisée en faisant son centième expresso de la journée. Tu commandes en un tap et tu retrouves l\'historique des commandes, les documents, et même l\'âme de ta cuisine, si tu la veux.',
        en_US: 'But wait, the best is yet to come. 🥁 Taaac! Our WEB APP. It\'s so easy and fast that even my grandpa used it while making his hundredth espresso of the day. You order with a tap and find your order history, documents, and even the soul of your kitchen, if you want it.'
      };
    }
    else if (src.includes('"Ah, ma io ho dimenticato di ordinare la porchetta per il weekend!"')) {
      t[src] = {
        de_CH: '"Ah, aber ich habe vergessen, die Porchetta fürs Wochenende zu bestellen!" Keine Sorge, Schönheit. Bestelle heute, und morgen bringen wir sie dir, frisch wie am ersten Tag. Und vergiss diese Distributoren, die dich zwingen, eine Tonne Zeug zu bestellen. Bestelle so viel du willst, ob ein Hekto oder ein Zentner. 😉',
        fr_CH: '"Ah, mais j\'ai oublié de commander la porchetta pour le weekend !" Tranquille, beau gosse. Passe ta commande aujourd\'hui, et demain on te la livre, fraîche fraîche. Et oublie ces distributeurs qui t\'obligent à commander une tonne de trucs. Commande ce que tu veux, que ce soit cent grammes ou un quintal. 😉',
        en_US: '"Ah, but I forgot to order the porchetta for the weekend!" Relax, gorgeous. Place the order today, and tomorrow we\'ll bring it to you, fresh as can be. And forget those distributors who force you to order a ton of stuff. Order as much as you want, whether it\'s 100 grams or 100 kilos. 😉'
      };
    }
    else if (src.includes('Diventare un VIP? Da noi è facile come rubare le caramelle a un bambino')) {
      t[src] = {
        de_CH: 'Ein VIP werden? Bei uns ist es so einfach wie einem Kind Bonbons zu stehlen. Star-Behandlung, Diva-Services, alles weil du weißt, dass du es verdienst. Und außerdem, welches Chaos dir auch passiert, ein Porchetta-Guru von uns ist bereit, dir einen Rettungsring zuzuwerfen. 🆘',
        fr_CH: 'Devenir un VIP ? Chez nous c\'est facile comme voler des bonbons à un enfant. Traitements de star, services de diva, tout parce que tu sais que tu le mérites. Et en plus, quel que soit le bordel qui t\'arrive, un de nos gourous de la porchetta est prêt à te lancer la bouée de sauvetage. 🆘',
        en_US: 'Becoming a VIP? With us it\'s as easy as stealing candy from a baby. Star treatments, diva services, all because you know you deserve it. And besides, whatever mess happens to you, one of our porchetta gurus is ready to throw you a life preserver. 🆘'
      };
    }
    else if (src.includes('Quindi, cosa aspetti? Scendi dall\'altalena e vieni a giocare con i grandi')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Steig von der Schaukel und komm mit den Großen spielen. Schreib unten, erzähl uns deine Erfahrung mit der "so lala" Porchetta und mach dich bereit für den großen Sprung. Unsere Porchetta di Ariccia wartet auf dich, und glaub mir, du wirst nicht zurückwollen.',
        fr_CH: 'Alors, qu\'est-ce que tu attends ? Descends de la balançoire et viens jouer avec les grands. Écris ci-dessous, raconte-nous ton expérience avec la porchetta "bof bof" et prépare-toi au grand saut. Notre Porchetta di Ariccia t\'attend, et fais-moi confiance, tu ne voudras plus revenir en arrière.',
        en_US: 'So, what are you waiting for? Get off the swing and come play with the big kids. Write below, tell us your experience with "so-so" porchetta and get ready for the big leap. Our Porchetta di Ariccia is waiting for you, and trust me, you won\'t want to go back.'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 47: PORCHETTA DI ARICCIA ===\n');

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

  console.log('\n✅ ARTICOLO 47 COMPLETATO!');
}

main();
