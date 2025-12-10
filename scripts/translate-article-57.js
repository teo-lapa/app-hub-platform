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

const POST_ID = 57;

const TITLE_TRANSLATIONS = {
  it_IT: "Il tuo Ristorante Affonda Senza la Nostra Salsa di Pecorino Romano",
  de_CH: "Dein Restaurant geht unter ohne unsere Pecorino Romano Sauce",
  fr_CH: "Ton Restaurant Coule Sans Notre Sauce au Pecorino Romano",
  en_US: "Your Restaurant is Sinking Without Our Pecorino Romano Sauce"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ecco la verità nuda e cruda: se il tuo ristorante non sta usando')) {
      t[src] = {
        de_CH: 'Hier ist die nackte Wahrheit: wenn dein Restaurant nicht die Pecorino Romano Sauce im Glas von LAPA verwendet, wirfst du praktisch dein Geld weg. Ja, du hast richtig verstanden. Ich bin nicht hier, um dir den nächsten Marketing-Quatsch zu verkaufen, sondern um dir zu sagen, wie die Dinge wirklich stehen.',
        fr_CH: 'Voilà la vérité toute nue : si ton restaurant n\'utilise pas la Sauce au Pecorino Romano en Pot de LAPA, tu jettes pratiquement ton argent par les fenêtres. Oui, tu as bien compris. Je ne suis pas là pour te vendre la énième arnaque marketing, mais pour te dire comment les choses se passent vraiment.',
        en_US: 'Here\'s the naked truth: if your restaurant isn\'t using LAPA\'s Pecorino Romano Sauce in a Jar, you\'re practically throwing your money away. Yes, you understood correctly. I\'m not here to sell you another marketing gimmick, but to tell you how things really are.'
      };
    }
    else if (src.includes('Prima di tutto, lasciami dirti che questa salsa non è roba da poco')) {
      t[src] = {
        de_CH: 'Zuallererst, lass mich dir sagen, dass diese Sauce keine Kleinigkeit ist. Wir sprechen von einer authentischen Köstlichkeit, die jedes Gericht von "meh" zu "MAMMA MIA!" in einem Bissen verwandelt. Und nein, das ist nicht das übliche Gewürz, das du überall findest, das schmeckt, als wäre es im Labor statt in der Küche gemacht worden. Das ist ernsthaftes Zeug, Freund.',
        fr_CH: 'D\'abord, laisse-moi te dire que cette sauce n\'est pas de la petite bière. On parle d\'un délice authentique qui transformera n\'importe quel plat de "bof" à "MAMMA MIA!" en une bouchée. Et non, ce n\'est pas le condiment habituel que tu trouves partout, celui qui a l\'air d\'avoir été fait en laboratoire plutôt qu\'en cuisine. C\'est du sérieux, mon ami.',
        en_US: 'First of all, let me tell you that this sauce is no small thing. We\'re talking about an authentic delight that will transform any dish from "meh" to "MAMMA MIA!" in one bite. And no, this isn\'t the usual condiment you find everywhere, the kind that tastes like it was made in a lab rather than a kitchen. This is serious stuff, friend.'
      };
    }
    else if (src.includes('E poi, parliamo del servizio che ti offre LAPA: consegne 6 su 7 giorni')) {
      t[src] = {
        de_CH: 'Und dann, lass uns über den Service sprechen, den LAPA dir bietet: Lieferungen 6 von 7 Tagen. Verstanden? Fast jeden verdammten Tag der Woche sind diese Jungs bereit, dir zu liefern, was du brauchst. Hast du vergessen zu bestellen und brauchst es für morgen? Kein Problem. Das sind deine neuen besten Freunde, die dein Leben (und das Abendessen) in letzter Sekunde retten.',
        fr_CH: 'Et puis, parlons du service que LAPA t\'offre : livraisons 6 jours sur 7. Compris ? Presque chaque fichu jour de la semaine, ces gars sont prêts à te faire arriver ce qu\'il te faut. Tu as oublié de commander et tu en as besoin pour demain ? Pas de problème. Ce sont tes nouveaux meilleurs amis qui te sauvent la vie (et le dîner) à la dernière seconde.',
        en_US: 'And then, let\'s talk about the service LAPA offers you: deliveries 6 out of 7 days. Got it? Almost every damn day of the week, these guys are ready to deliver what you need. Forgot to order and need it for tomorrow? No problem. These are your new best friends who save your life (and dinner) at the last second.'
      };
    }
    else if (src.includes('Ma aspetta, c\'è di più. Quante volte ti sei trovato a rimuginare su ordini minimi')) {
      t[src] = {
        de_CH: 'Aber warte, es gibt noch mehr. Wie oft hast du über Mindestbestellungen gegrübelt, die dich zwingen, Vorräte anzulegen, als würdest du dich auf die Apokalypse vorbereiten? Nun, mit LAPA kannst du das vergessen. Bestelle, was du brauchst, wann du es brauchst. Ob ein Karton oder ein LKW, sie sind für dich da. Und ohne Geschichten.',
        fr_CH: 'Mais attends, il y a plus. Combien de fois tu t\'es retrouvé à ruminer sur les commandes minimum qui t\'obligent à faire des stocks comme si tu devais te préparer à l\'apocalypse ? Eh bien, avec LAPA tu peux l\'oublier. Commande ce qu\'il te faut, quand il te le faut. Que ce soit un carton ou un camion, ils sont là pour toi. Et sans histoires.',
        en_US: 'But wait, there\'s more. How many times have you found yourself stewing over minimum orders that force you to stock up like you\'re preparing for the apocalypse? Well, with LAPA you can forget about that. Order what you need, when you need it. Whether it\'s a box or a truck, they\'re there for you. And no hassles.'
      };
    }
    else if (src.includes('E non dimentichiamoci dell\'APP per gli ordini')) {
      t[src] = {
        de_CH: 'Und vergessen wir nicht die APP für Bestellungen. Ja, du hast richtig gelesen. Eine WEB APP, die dir Telefonanrufe und endlose E-Mails erspart und dir ermöglicht, alles im Blick zu behalten, was du bestellt hast, mit einem Klick. Praktisch, oder?',
        fr_CH: 'Et n\'oublions pas l\'APP pour les commandes. Oui, tu as bien lu. Une WEB APP qui t\'évite les coups de fil, les emails sans fin et te permet de garder une trace de tout ce que tu as commandé, en un clic. Pratique, non ?',
        en_US: 'And let\'s not forget the APP for orders. Yes, you read that right. A WEB APP that saves you phone calls, endless emails and lets you keep track of everything you\'ve ordered, with one click. Handy, right?'
      };
    }
    else if (src.includes('Ora, torniamo al pezzo forte: la Salsa di Pecorino Romano')) {
      t[src] = {
        de_CH: 'Jetzt, zurück zum Highlight: die Pecorino Romano Sauce. Das ist nicht das übliche Zeug, das du erwartest. Es ist wie das alte Familienrezept, das nur die Oma machen konnte, aber mal zehn. Cremig, intensiv und mit diesem unverwechselbaren Geschmack, der sagt "Ich bin hier, und ich bin hier, um zu bleiben".',
        fr_CH: 'Maintenant, revenons à la pièce maîtresse : la Sauce au Pecorino Romano. Ce n\'est pas le truc habituel que tu attends. C\'est comme cette vieille recette de famille que seule grand-mère savait faire, mais multipliée par dix. Crémeuse, intense et avec ce goût inimitable qui dit "Je suis là, et je suis là pour rester".',
        en_US: 'Now, back to the highlight: the Pecorino Romano Sauce. This isn\'t the usual stuff you expect. It\'s like that old family recipe that only grandma knew how to make, but multiplied by ten. Creamy, intense and with that unmistakable flavor that says "I\'m here, and I\'m here to stay".'
      };
    }
    else if (src.includes('Quindi, caro amico, se il tuo ristorante sta navigando in acque tranquille')) {
      t[src] = {
        de_CH: 'Also, lieber Freund, wenn dein Restaurant in ruhigen Gewässern ohne diese Sauce segelt, ist es Zeit für einen Ruck. Probiere es aus, und du wirst sehen, dass deine Kunden wiederkommen und nach mehr verlangen, garantiert. Und wenn du Lust auf ein Gespräch über italienische Küche, Restaurants oder einfach nur Tratsch hast, bin ich hier.',
        fr_CH: 'Donc, cher ami, si ton restaurant navigue en eaux calmes sans cette sauce, il est temps de secouer les choses. Essaie, et tu verras tes clients revenir en demander plus, garanti. Et si tu as envie de discuter de cuisine italienne, de restaurants ou juste de papoter, je suis là.',
        en_US: 'So, dear friend, if your restaurant is sailing in calm waters without this sauce, it\'s time to shake things up. Try it, and you\'ll see your customers come back asking for more, guaranteed. And if you feel like chatting about Italian cuisine, restaurants or just shooting the breeze, I\'m here.'
      };
    }
    else if (src.includes('Allora, sei pronto a fare il salto di qualità o preferisci restare sulla riva')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, den Qualitätssprung zu machen, oder bleibst du lieber am Ufer und schaust den anderen beim Segeln in Richtung Erfolg zu? Die Wahl liegt bei dir. Aber denk dran, in der Küche wie im Leben: wer nicht wagt, der nicht gewinnt. Schau dir die Sauce an, probiere sie, und dann reden wir. 🧀🚀',
        fr_CH: 'Alors, tu es prêt à faire le saut de qualité ou tu préfères rester sur le rivage à regarder les autres naviguer vers le succès ? Le choix est à toi. Mais rappelle-toi, en cuisine comme dans la vie, qui ne risque rien n\'a rien. Regarde la sauce, essaie-la, et ensuite on en parle. 🧀🚀',
        en_US: 'So, are you ready to take the quality leap or would you rather stay on the shore watching others sail towards success? The choice is yours. But remember, in the kitchen as in life, nothing ventured, nothing gained. Check out the sauce, try it, and then we\'ll talk. 🧀🚀'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 57: SALSA DI PECORINO ROMANO ===\n');

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

  console.log('\n✅ ARTICOLO 57 COMPLETATO!');
}

main();
