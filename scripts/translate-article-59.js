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

const POST_ID = 59;

const TITLE_TRANSLATIONS = {
  it_IT: "🚫🍖 Basta con il prosciutto cotto da quattro soldi! Scopri come mangiarne uno da leccarsi i baffi 🤤",
  de_CH: "🚫🍖 Schluss mit dem billigen Kochschinken! Entdecke einen, bei dem du dir die Finger leckst 🤤",
  fr_CH: "🚫🍖 Fini le jambon cuit bon marché ! Découvre comment en manger un à s'en lécher les babines 🤤",
  en_US: "🚫🍖 Enough with Cheap Cooked Ham! Discover One That's Finger-Lickin' Good 🤤"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Sei sicuro che il prosciutto cotto che butti nel carrello della spesa meriti')) {
      t[src] = {
        de_CH: 'Bist du sicher, dass der Kochschinken, den du in den Einkaufswagen wirfst, einen Platz in deinem Sandwich verdient? Lass uns Klartext reden: viele dieser Schinken sind mehr Wasser als Fleisch, mehr geschmacklos als würzig. Aber ruhig, es ist nicht alles verloren. Ich habe einen Tipp für dich, der die Art verändern könnte, wie du Kochschinken siehst (und isst).',
        fr_CH: 'Tu es sûr que le jambon cuit que tu balances dans ton caddie mérite une place dans ton sandwich ? Parlons franchement : beaucoup de ces jambons sont plus d\'eau que de viande, plus insipides que savoureux. Mais calme, tout n\'est pas perdu. J\'ai un tuyau pour toi qui pourrait changer ta façon de voir (et de manger) le jambon cuit.',
        en_US: 'Are you sure the cooked ham you throw in your shopping cart deserves a place in your sandwich? Let\'s be clear: many of these hams are more water than meat, more bland than flavorful. But calm down, all is not lost. I have a tip for you that could change the way you see (and eat) cooked ham.'
      };
    }
    else if (src.includes('Parliamo del PROSCIUTTO COTTO SP LEADER KG8 TRIN di LAPA')) {
      t[src] = {
        de_CH: 'Lass uns über den KOCHSCHINKEN SP LEADER KG8 TRIN von LAPA sprechen. Das ist nicht der übliche Aufschnitt, den du zwischen zwei Scheiben altbackenem Brot gequetscht findest. Nein, das ist der LeBron James unter den Kochschinken, die Art von Schinken, die dich "Mamma mia!" rufen lässt, sobald du ihn probierst.',
        fr_CH: 'Parlons du JAMBON CUIT SP LEADER KG8 TRIN de LAPA. Ce n\'est pas la charcuterie habituelle que tu trouves écrasée entre deux tranches de pain rassis. Non, c\'est le LeBron James des jambons cuits, le type de jambon qui te fait dire "Mamma mia!" dès que tu le goûtes.',
        en_US: 'Let\'s talk about the COOKED HAM SP LEADER KG8 TRIN from LAPA. This isn\'t the usual deli meat you find squished between two slices of stale bread. No, this is the LeBron James of cooked hams, the kind of ham that makes you say "Mamma mia!" as soon as you taste it.'
      };
    }
    else if (src.includes('E perché dovresti scegliere proprio LAPA per questo prodotto divino?')) {
      t[src] = {
        de_CH: 'Und warum solltest du genau LAPA für dieses göttliche Produkt wählen? Nun, erstens: sie liefern sechs Tage die Woche. Ja, du hast richtig gehört. Vergessen, den Schinken für den Pizza-Abend morgen zu bestellen? Kein Problem, LAPA hat dir den Rücken frei. Bestelle heute und puff! Morgen ist er an deiner Tür, frisch frisch.',
        fr_CH: 'Et pourquoi devrais-tu choisir LAPA pour ce produit divin ? Eh bien, primo : ils livrent six jours sur sept. Oui, tu as bien compris. Oublié de commander le jambon pour la soirée pizza de demain ? Pas de problème, LAPA te couvre. Commande aujourd\'hui et paf ! Demain il est à ta porte, tout frais.',
        en_US: 'And why should you choose LAPA for this divine product? Well, first: they deliver six days a week. Yes, you heard right. Forgot to order ham for tomorrow\'s pizza night? No problem, LAPA has your back. Order today and poof! Tomorrow it\'s at your door, fresh fresh.'
      };
    }
    else if (src.includes('E sai una cosa? Non ti fanno nemmeno sudare con ordini minimi')) {
      t[src] = {
        de_CH: 'Und weißt du was? Sie lassen dich nicht mal schwitzen mit Mindestbestellungen, die dich zwingen, das Lager zu füllen, als würdest du einen Bunker für die Apokalypse vorbereiten. Bestelle, was du brauchst, wie viel du brauchst. Und was den Service angeht, bei LAPA bist du VIP, auch wenn du keinen Smoking trägst. Top-Support, eine WEB APP, die der Hammer ist zum Bestellen ohne Stress und, hör gut zu, eine personalisierte Preisliste. Ja, warum mehr bezahlen für das, was du für weniger haben kannst?',
        fr_CH: 'Et tu sais quoi ? Ils ne te font même pas transpirer avec des commandes minimum qui t\'obligent à remplir l\'entrepôt comme si tu préparais un bunker pour l\'apocalypse. Commande ce qu\'il te faut, autant qu\'il te faut. Et côté service, avec LAPA tu es VIP même si tu ne portes pas de smoking. Assistance top, une WEB APP qui est une bombe pour commander sans galère et, écoute bien, un tarif personnalisé. Oui, parce que payer plus pour ce que tu peux avoir à moins ?',
        en_US: 'And you know what? They don\'t even make you sweat with minimum orders that force you to fill the warehouse like you\'re preparing a bunker for the apocalypse. Order what you need, as much as you need. And speaking of service, with LAPA you\'re VIP even if you\'re not wearing a tuxedo. Top assistance, a WEB APP that\'s a bomb for ordering hassle-free and, listen up, a personalized price list. Yeah, why pay more for what you can have for less?'
      };
    }
    else if (src.includes('Ritornando al nostro prosciutto eroe, il PROSCIUTTO COTTO SP LEADER non è un semplice taglio di carne')) {
      t[src] = {
        de_CH: 'Zurück zu unserem Helden-Schinken, der KOCHSCHINKEN SP LEADER ist nicht nur ein einfaches Stück Fleisch. Es ist ein Versprechen von Qualität und Zufriedenheit. Der, der dich sagen lässt "Wo warst du die ganze Zeit?" nach dem ersten Bissen. Er ist zart, er ist saftig, und er hat diesen Geschmack, der dich die Augen schließen und an die italienische Landschaft denken lässt.',
        fr_CH: 'En revenant à notre jambon héros, le JAMBON CUIT SP LEADER n\'est pas une simple coupe de viande. C\'est une promesse de qualité et de satisfaction. Celui qui te fait dire "Où étais-tu tout ce temps ?" après la première bouchée. Il est tendre, il est juteux, et il a ce goût qui te fait fermer les yeux et penser à la campagne italienne.',
        en_US: 'Getting back to our hero ham, the COOKED HAM SP LEADER is not just a simple cut of meat. It\'s a promise of quality and satisfaction. The one that makes you say "Where have you been all this time?" after the first bite. It\'s tender, it\'s juicy, and it has that taste that makes you close your eyes and think of the Italian countryside.'
      };
    }
    else if (src.includes('Quindi, caro amico, la prossima volta che pensi al prosciutto cotto')) {
      t[src] = {
        de_CH: 'Also, lieber Freund, wenn du das nächste Mal an Kochschinken denkst, frag dich: will ich den üblichen anonymen Aufschnitt oder will ich den Schinken, bei dem mir schon beim Gedanken das Wasser im Mund zusammenläuft? Wenn du dich für das Zweite entscheidest, weißt du, dass LAPA hat, was du brauchst.',
        fr_CH: 'Donc, cher ami, la prochaine fois que tu penses au jambon cuit, demande-toi : je veux la charcuterie anonyme habituelle ou je veux le jambon qui me fait saliver rien qu\'à y penser ? Si tu optes pour la deuxième, tu sais que LAPA a ce qu\'il te faut.',
        en_US: 'So, dear friend, the next time you think about cooked ham, ask yourself: do I want the usual anonymous deli meat or do I want the ham that makes my mouth water just thinking about it? If you go for the second, you know LAPA has what you need.'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 59: PROSCIUTTO COTTO SP LEADER ===\n');

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

  console.log('\n✅ ARTICOLO 59 COMPLETATO!');
}

main();
