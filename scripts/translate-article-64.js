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

const POST_ID = 64;

const TITLE_TRANSLATIONS = {
  it_IT: "Perché diavolo ti accontenti del \"normale\"? 🤔",
  de_CH: "Warum zum Teufel gibst du dich mit \"normal\" zufrieden? 🤔",
  fr_CH: "Pourquoi diable tu te contentes du \"normal\" ? 🤔",
  en_US: "Why the Heck Do You Settle for \"Normal\"? 🤔"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ehi, ristoratore o pizzaiolo, parlo proprio a te!')) {
      t[src] = {
        de_CH: 'Hey, Gastronom oder Pizzabäcker, ich spreche genau mit dir! Seien wir ehrlich, deine Küche ist wie eine Bühne und du bist der Künstler, oder? Also, <strong>warum zum Teufel solltest du dich mit dem üblichen Mist zufriedengeben?</strong> Heute verrate ich dir ein Geheimnis, das deine Kreationen auf ein anderes Level katapultieren wird: <strong>die Ricotta-Creme im Spritzbeutel 1 kg</strong>. 🎨🍰',
        fr_CH: 'Hé, restaurateur ou pizzaïolo, je te parle à toi ! Soyons honnêtes, ta cuisine est comme une scène et tu es l\'artiste, non ? Alors, <strong>pourquoi diable devrais-tu te contenter de la merde habituelle ?</strong> Aujourd\'hui je te révèle un secret qui fera décoller tes créations à un autre niveau : <strong>la Crème de Ricotta en sac à poche de 1 kg</strong>. 🎨🍰',
        en_US: 'Hey, restaurateur or pizza maker, I\'m talking to you! Let\'s be honest, your kitchen is like a stage and you\'re the artist, right? So, <strong>why the hell should you settle for the usual crap?</strong> Today I\'m revealing a secret that will skyrocket your creations to another level: <strong>the Ricotta Cream in a 1 kg piping bag</strong>. 🎨🍰'
      };
    }
    else if (src.includes('Pensa a questo: hai in mano una crema di ricotta talmente liscia e gustosa')) {
      t[src] = {
        de_CH: 'Denk mal darüber nach: du hast eine Ricotta-Creme in der Hand, die so glatt und lecker ist, dass sie von den Göttern gemacht zu sein scheint. Willst du dir in zwei Sekunden ein Cannolo reinziehen? Erledigt. Eine süße Pizza füllen, ohne auch nur zu schwitzen? Kein Problem. <strong>Wir reden nicht vom üblichen Brei,</strong> dieses Zeug ist weißes Gold für deine Küche. 🌟',
        fr_CH: 'Pense à ça : tu as en main une crème de ricotta tellement lisse et goûteuse qu\'elle semble faite par les dieux. Tu veux te faire un cannolo en deux secondes ? Fait. Garnir une pizza sucrée sans même transpirer ? Pas de problème. <strong>On ne parle pas de la bouillie habituelle,</strong> ce truc c\'est de l\'or blanc pour ta cuisine. 🌟',
        en_US: 'Think about this: you have a ricotta cream in your hands that\'s so smooth and tasty it seems made by the gods. Want to whip up a cannolo in two seconds? Done. Fill a sweet pizza without even breaking a sweat? No problem. <strong>We\'re not talking about the usual mush,</strong> this stuff is white gold for your kitchen. 🌟'
      };
    }
    else if (src.includes('E ora la chicca: <strong>con LAPA non devi sbatterti per fare ordini enormi')) {
      t[src] = {
        de_CH: 'Und jetzt das Highlight: <strong>mit LAPA musst du dich nicht für riesige Bestellungen abmühen.</strong> Es gibt keine Mindestbestellungen, also kannst du bestellen, was du willst, wann es dir passt. Hast du vergessen, Vorräte anzulegen? Keine Sorge, bestelle heute und morgen klingeln wir an deiner Tür. <strong>Ist das nicht fantastisch?</strong> 🚚💨',
        fr_CH: 'Et maintenant la pépite : <strong>avec LAPA tu n\'as pas à te casser la tête pour faire des commandes énormes.</strong> Il n\'y a pas de minimum de commande, donc tu peux commander ce que tu veux, quand ça te chante. Tu as oublié de faire des réserves ? Tranquille, tu commandes aujourd\'hui et demain on sonne à ta porte. <strong>C\'est pas génial ?</strong> 🚚💨',
        en_US: 'And now the gem: <strong>with LAPA you don\'t have to struggle to make huge orders.</strong> There are no minimum orders, so you can order whatever you want, whenever you feel like it. Forgot to stock up? Relax, order today and tomorrow we\'ll ring your doorbell. <strong>Isn\'t that fantastic?</strong> 🚚💨'
      };
    }
    else if (src.includes('Ah, e c\'è anche il listino personalizzato')) {
      t[src] = {
        de_CH: 'Ah, und es gibt auch die personalisierte Preisliste, damit wir dich nicht mit absurden Preisen für Zeug abzocken, das du nicht brauchst. <strong>Du zahlst nur für das, was dir passt, Punkt.</strong>',
        fr_CH: 'Ah, et il y a aussi le tarif personnalisé, comme ça on ne te plume pas avec des prix absurdes sur des trucs qui ne te servent pas. <strong>Tu paies seulement pour ce qui t\'arrange, point final.</strong>',
        en_US: 'Ah, and there\'s also the personalized price list, so we don\'t rip you off with absurd prices on stuff you don\'t need. <strong>You pay only for what suits you, period.</strong>'
      };
    }
    else if (src.includes('Quindi, la vera domanda è: <strong>perché accontentarti del')) {
      t[src] = {
        de_CH: 'Also, die eigentliche Frage ist: <strong>warum dich mit "normal" zufriedengeben, wenn du mit der 1 kg Ricotta-Creme und unseren Hammer-Services voll durchstarten kannst?</strong> 💥',
        fr_CH: 'Donc, la vraie question est : <strong>pourquoi te contenter du "normal" quand tu peux tout casser avec la crème de ricotta de 1 kg et nos services de folie ?</strong> 💥',
        en_US: 'So, the real question is: <strong>why settle for "normal" when you can make a splash with the 1 kg ricotta cream and our killer services?</strong> 💥'
      };
    }
    else if (src.includes('Voglio sentire la tua opinione: <strong>come la useresti')) {
      t[src] = {
        de_CH: 'Ich will deine Meinung hören: <strong>wie würdest du diese Creme in deiner Küche verwenden?</strong> Schreib es hier unten und lass uns plaudern! 🗨️😎',
        fr_CH: 'Je veux entendre ton avis : <strong>comment tu l\'utiliserais cette crème dans ta cuisine ?</strong> Écris-le ci-dessous et faisons une belle discussion ! 🗨️😎',
        en_US: 'I want to hear your opinion: <strong>how would you use this cream in your kitchen?</strong> Write it below and let\'s have a nice chat! 🗨️😎'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 64: CREMA DI RICOTTA ===\n');

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

  console.log('\n✅ ARTICOLO 64 COMPLETATO!');
}

main();
