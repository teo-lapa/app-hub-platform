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

const POST_ID = 35;

const TITLE_TRANSLATIONS = {
  it_IT: "Porcini interi come freschi con un profumo di bosco? 🍄🤘",
  de_CH: "Ganze Steinpilze wie frisch mit Waldduft? 🍄🤘",
  fr_CH: "Cèpes entiers comme frais avec un parfum de forêt ? 🍄🤘",
  en_US: "Whole Porcini Mushrooms Fresh as Can Be with Forest Aroma? 🍄🤘"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Sei stanco di mettere in tavola funghi porcini')) {
      t[src] = {
        de_CH: 'Bist du es leid, Steinpilze auf den Tisch zu bringen, die mehr zum Lachen als zum Genießen sind? Solche, bei denen du beim Anschauen sagst "Was ist das denn?" und nicht im guten Sinne? 🤨',
        fr_CH: 'Tu en as marre de mettre sur la table des cèpes qui font plus rire qu\'ils ne font gourmet ? De ceux qui, en les regardant, te font dire "C\'est quoi ça ?" et pas dans le bon sens ? 🤨',
        en_US: 'Are you tired of putting porcini mushrooms on the table that look more laughable than gourmet? The kind that, looking at them, make you say "What the heck is that?" and not in a good way? 🤨'
      };
    }
    else if (src.includes('Ascolta, so che la vita in cucina può essere dura')) {
      t[src] = {
        de_CH: 'Hör zu, ich weiß, dass das Leben in der Küche hart sein kann. Du suchst immer das Beste, und stattdessen musst du dich mit Lieferanten herumschlagen, die dir jeden Mist als Gold verkaufen wollen. Aber hier gibt es Neuigkeiten für dich. Eine davon, die das Spiel verändert. 🔄',
        fr_CH: 'Écoute, je sais que la vie en cuisine peut être dure. Tu cherches toujours le meilleur, et à la place tu te retrouves à faire affaire avec des fournisseurs qui te refilent n\'importe quoi en le faisant passer pour de l\'or. Mais il y a une nouveauté pour toi. Une de celles qui changent la donne. 🔄',
        en_US: 'Listen, I know life in the kitchen can be tough. You\'re always looking for the best, and instead you\'re stuck dealing with suppliers who pass off every sort of "junk" as gold. But here\'s some news for you. One of those that changes the game. 🔄'
      };
    }
    else if (src.includes('Ti presento (rullo di tamburi, per favore)')) {
      t[src] = {
        de_CH: 'Ich präsentiere dir (Trommelwirbel bitte) unsere ganzen tiefgekühlten Steinpilze. Das sind keine gewöhnlichen Pilze, Freund. Das sind die Ferrari unter den Steinpilzen. Groß, fest, mit dieser Textur und diesem Geschmack, der dich ausrufen lässt: "Verdammt, wo waren die die ganze Zeit versteckt?"',
        fr_CH: 'Je te présente (roulement de tambour, s\'il te plaît) nos Champignons cèpes entiers surgelés. Ce ne sont pas de simples champignons, mon ami. Ce sont la Ferrari des cèpes. Gros, fermes, avec cette texture et ce goût qui te fait t\'exclamer : "Bon sang, où étaient-ils cachés jusqu\'ici ?"',
        en_US: 'Let me introduce you to (drumroll, please) our whole frozen Porcini Mushrooms. These aren\'t just any mushrooms, friend. They\'re the Ferrari of porcini. Big, firm, with that texture and flavor that makes you exclaim: "Holy cow, where have these been hiding all this time?"'
      };
    }
    else if (src.includes('Il fungo porcino congelato se raccolto nel momento perfetto')) {
      t[src] = {
        de_CH: 'Der tiefgekühlte Steinpilz, wenn er im perfekten Moment geerntet und schnell mit neuester Technologie eingefroren wird, behält alle Eigenschaften vom Duft bis zum Geschmack.',
        fr_CH: 'Le cèpe congelé, s\'il est récolté au moment parfait et congelé rapidement avec les dernières technologies, conserve intactes toutes ses propriétés, du parfum au goût.',
        en_US: 'The frozen porcini mushroom, when harvested at the perfect moment and quickly frozen with the latest technologies, maintains all its properties intact, from aroma to taste.'
      };
    }
    else if (src.includes('Ora, so che potresti avere delle perplessità')) {
      t[src] = {
        de_CH: 'Ich weiß, du könntest Bedenken haben. "Bestelle ich heute, kommt es 2030 an?" Nein, Freund! Bestelle heute, iss morgen! Und wenn dein Gedächtnis versagt und du vergisst zu bestellen? Nun, wir arbeiten sechs Tage die Woche, von Montag bis Samstag. Also, atme durch und keine Panik! 🚚📅',
        fr_CH: 'Maintenant, je sais que tu pourrais avoir des doutes. "Je commande aujourd\'hui, ça arrivera en 2030 ?" Non mon ami ! Commande aujourd\'hui, mange demain ! Et si ta mémoire te fait défaut et que tu oublies de commander ? Eh bien, nous travaillons six jours par semaine, du lundi au samedi. Alors, respire et ne stresse pas ! 🚚📅',
        en_US: 'Now, I know you might have some doubts. "Order today, will it arrive in 2030?" No friend! Order today, eat tomorrow! And if your memory fails and you forget to order? Well, we work six days a week, from Monday to Saturday. So, breathe and don\'t sweat it! 🚚📅'
      };
    }
    else if (src.includes('"E se voglio solo un paio di buste, non un\'intera')) {
      t[src] = {
        de_CH: '"Und wenn ich nur ein paar Tüten will, nicht eine ganze Produktion?" Easy, Champion! Bei uns kein Mindestbestellwert. Und wenn du dich wie bei \'Mission Impossible\' fühlst und alles im Blick behalten willst, stürz dich auf unsere WEB APP. Bestellungen, Kontrolle, totale Herrschaft. 📲💥',
        fr_CH: '"Et si je veux seulement quelques sachets, pas une production entière ?" Easy, champion ! Avec nous, pas de commande minimum. Et si tu te sens un peu \'Mission Impossible\' et que tu veux tout contrôler, fonce sur notre WEB APP. Commandes, contrôle, domination totale. 📲💥',
        en_US: '"And if I just want a couple of bags, not a whole production?" Easy, champ! With us, no minimum order. And if you\'re feeling a bit \'Mission Impossible\' and want to track everything, jump on our WEB APP. Orders, control, total domination. 📲💥'
      };
    }
    else if (src.includes('Ah, un attimo. Ti sei mai sentito trascurato')) {
      t[src] = {
        de_CH: 'Ah, einen Moment. Hast du dich jemals von deinem Lieferanten vernachlässigt gefühlt? Nun, wir bei LAPA verwöhnen dich wie einen Rockstar. Warum? Weil du es verdammt nochmal verdienst! Du hast ein Problem, eine Frage, eine Idee? Wir sind hier, bereit dir zu dienen und dich zu unterstützen, als wärst du Mick Jagger persönlich.',
        fr_CH: 'Ah, un instant. Tu t\'es déjà senti négligé par ton fournisseur ? Eh bien, nous chez LAPA on te chouchoute comme une star du rock. Pourquoi ? Parce que bon sang, tu le mérites ! Tu as un souci, un doute, une idée ? Nous sommes là, prêts à te servir et t\'assister comme si tu étais Mick Jagger en personne.',
        en_US: 'Ah, hold on a sec. Have you ever felt neglected by your supplier? Well, at LAPA we pamper you like a rock star. Why? Because damn it, you deserve it! Got a problem, a doubt, an idea? We\'re here, ready to serve and assist you as if you were Mick Jagger himself.'
      };
    }
    else if (src.includes('Dunque, la prossima volta che pensi ai funghi porcini')) {
      t[src] = {
        de_CH: 'Also, das nächste Mal, wenn du an Steinpilze denkst und willst, dass deine Kunden sich die Finger lecken und wiederkommen, weißt du, wohin du gehen musst.',
        fr_CH: 'Donc, la prochaine fois que tu penses aux cèpes, et que tu veux que ta clientèle se lèche les babines et revienne pour plus, sache où aller.',
        en_US: 'So, the next time you think about porcini mushrooms, and you want your customers to lick their lips and come back for more, you know where to go.'
      };
    }
    else if (src.includes('E ora, parla! Commenta qui sotto')) {
      t[src] = {
        de_CH: 'Und jetzt, rede! Kommentiere hier unten. Kritisiere, lobe, erzähl einen Witz. Aber interagiere, verdammt! Ich will wissen, was du denkst. 🗣️👂',
        fr_CH: 'Et maintenant, parle ! Commente ci-dessous. Critique, félicite, raconte une blague. Mais interagis, bon sang ! Je veux savoir ce que tu en penses. 🗣️👂',
        en_US: 'And now, speak up! Comment below. Criticize, praise, tell a joke. But interact, for crying out loud! I want to hear what you think. 🗣️👂'
      };
    }
    else if (src.includes('#LAPA #FungoRockstar #PorciniDaUrlo')) {
      t[src] = {
        de_CH: '#LAPA #PilzRockstar #SteinpilzeZumSchreien',
        fr_CH: '#LAPA #ChampignonRockstar #CèpesDeOuf',
        en_US: '#LAPA #MushroomRockstar #PorciniToScreamFor'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 35: FUNGHI PORCINI ===\n');

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

  console.log('\n✅ ARTICOLO 35 COMPLETATO!');
}

main();
