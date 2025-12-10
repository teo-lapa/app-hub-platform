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

const POST_ID = 43;

const TITLE_TRANSLATIONS = {
  it_IT: "Sfogliatella Riccia: Preparati a Sconvolgere il tuo Menù! 🚀",
  de_CH: "Sfogliatella Riccia: Mach dich bereit, dein Menü zu revolutionieren! 🚀",
  fr_CH: "Sfogliatella Riccia : Prépare-toi à Bouleverser ton Menu ! 🚀",
  en_US: "Sfogliatella Riccia: Get Ready to Shake Up Your Menu! 🚀"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Ho una notizia che ti farà saltare dalla sedia e correre in cucina a scatenare una rivoluzione. Preparati, perché stiamo per mandare all'aria tutte le regole e catapultare il tuo menù in un'altra dimensione con la super potente, l'ultra incredibile... Sfogliatella Riccia!",
  de_CH: "Ich habe eine Neuigkeit, die dich vom Stuhl springen lässt und in die Küche rennen, um eine Revolution zu starten. Mach dich bereit, denn wir werden alle Regeln über den Haufen werfen und dein Menü in eine andere Dimension katapultieren mit der super mächtigen, der ultra unglaublichen... Sfogliatella Riccia!",
  fr_CH: "J'ai une nouvelle qui va te faire bondir de ta chaise et courir en cuisine pour déclencher une révolution. Prépare-toi, parce qu'on va chambouler toutes les règles et catapulter ton menu dans une autre dimension avec la super puissante, l'ultra incroyable... Sfogliatella Riccia !",
  en_US: "I have news that will make you jump out of your chair and run to the kitchen to start a revolution. Get ready, because we're about to throw out all the rules and catapult your menu into another dimension with the super powerful, the ultra incredible... Sfogliatella Riccia!"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ma che cavolo è la Sfogliatella Riccia?')) {
      t[src] = {
        de_CH: 'Was zum Teufel ist die Sfogliatella Riccia? Stell dir einen Tornado aus Blätterteig vor, knusprig und golden, der ein explosives Herz aus Ricotta, Zucker und einem magischen Hauch von Zitrone umhüllt. Eine Atombombe der Köstlichkeit, die deinen Gaumen explodieren lässt! 💥',
        fr_CH: 'Mais c\'est quoi ce truc, la Sfogliatella Riccia ? Imagine une tornade de pâte feuilletée, croustillante et dorée, qui enveloppe un cœur explosif de ricotta, de sucre et d\'une touche magique de citron. Une bombe atomique de bonté qui fera exploser ton palais ! 💥',
        en_US: 'What the heck is Sfogliatella Riccia? Imagine a tornado of puff pastry, crispy and golden, wrapping an explosive heart of ricotta, sugar and a magical touch of lemon. An atomic bomb of goodness that will blow your palate! 💥'
      };
    }
    else if (src.includes('Pronto per una manata di vantaggi che ti faranno gridare')) {
      t[src] = {
        de_CH: 'Bereit für eine Handvoll Vorteile, die dich "Verdammt nochmal" schreien lassen? So nimmt LAPA - Finest Italian Food dich an die Hand und katapultiert dich in die Zukunft der Gastronomie. 🚀',
        fr_CH: 'Prêt pour une poignée d\'avantages qui te feront crier "Bon sang" ? Voici comment LAPA - Finest Italian Food te prend par la main et te catapulte dans le futur de la gastronomie. 🚀',
        en_US: 'Ready for a handful of benefits that\'ll make you scream "Holy cow"? Here\'s how LAPA - Finest Italian Food takes you by the hand and catapults you into the future of gastronomy. 🚀'
      };
    }
    else if (src.includes('Prima di tutto, a LAPA si lavora come dei pazzi')) {
      t[src] = {
        de_CH: 'Erstens, bei LAPA arbeitet man wie verrückt: Lieferungen 6 Tage die Woche. Oh ja, diese Verrückten sind ständig mit ihren Transportern unterwegs, bereit, dir alles zu liefern, was du brauchst, wann du es brauchst. Vergessen, die Sfogliatelle zu bestellen? Kein Problem! Bestelle heute, und morgen hast du sie heiß und dampfend vor der Tür. 🚚💨',
        fr_CH: 'D\'abord, chez LAPA on bosse comme des fous : livraisons 6 jours sur 7. Eh oui, ces dingues sont toujours en vadrouille avec leurs camions, prêts à te livrer tout ce qu\'il te faut, quand il te le faut. Oublié de commander les Sfogliatelle ? Pas de problème ! Commande aujourd\'hui, et demain tu les retrouves belles chaudes et fumantes devant ta porte. 🚚💨',
        en_US: 'First of all, at LAPA they work like crazy: deliveries 6 days a week. Oh yes, these madmen are always up and down with their vans, ready to deliver everything you need, when you need it. Forgot to order the Sfogliatelle? No problem! Order today, and tomorrow you\'ll have them hot and steamy at your door. 🚚💨'
      };
    }
    else if (src.includes('Sei stufo di essere trattato come un pacchetto di minestrone')) {
      t[src] = {
        de_CH: 'Hast du es satt, wie eine Dose Gemüsesuppe behandelt zu werden? Gut, dann mach dich bereit, dich wie ein König zu fühlen. Bei LAPA bist du ein VIP, verdammt! Maßgeschneiderte Services, Aufmerksamkeit und eine Hingabe, die nicht mal deine Oma beim Ragù-Kochen hat. 🍝👑',
        fr_CH: 'Tu en as marre d\'être traité comme un paquet de soupe en boîte ? Bien, prépare-toi à te sentir comme un roi. Avec LAPA, tu es un VIP, merde ! Services sur mesure, attention, et un dévouement que même ta grand-mère n\'a pas quand elle prépare le ragù. 🍝👑',
        en_US: 'Tired of being treated like a can of vegetable soup? Good, get ready to feel like a king. With LAPA, you\'re a VIP, damn it! Tailored services, attention, and a dedication that even your grandma doesn\'t have when preparing ragù. 🍝👑'
      };
    }
    else if (src.includes('E la flessibilità? Te la danno, e come!')) {
      t[src] = {
        de_CH: 'Und Flexibilität? Die bekommst du, und wie! Bestelle was du willst, so viel du willst, ohne dir den Kopf mit astronomischen Mindestbestellwerten zu zerbrechen. Und dann haben sie diese phänomenale App, die alles so einfach macht wie ein Glas Wasser trinken. Oder vielleicht, da wir beim Thema sind, ein gutes Glas italienischen Wein! 🍷📲',
        fr_CH: 'Et la flexibilité ? Ils te la donnent, et comment ! Commande ce que tu veux, autant que tu veux, sans te prendre la tête avec des minimums de commande astronomiques. Et puis, ils ont cette app phénoménale qui rend tout facile comme boire un verre d\'eau. Ou peut-être, puisqu\'on est dans le thème, un bon verre de vin italien ! 🍷📲',
        en_US: 'And flexibility? They give it to you, and how! Order what you want, as much as you want, without breaking your head over sky-high minimum orders. And then, they have this phenomenal app that makes everything as easy as drinking a glass of water. Or maybe, since we\'re on the topic, a good glass of Italian wine! 🍷📲'
      };
    }
    else if (src.includes('Quindi, che aspetti? Buttati, sperimenta')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Stürz dich rein, experimentiere, und mach dich bereit, deine Kunden mit der Königin der neapolitanischen Konditorei zu erobern, der Sfogliatella Riccia, serviert auf einem Silbertablett vom fantastischen Team von LAPA. Hals- und Beinbruch!',
        fr_CH: 'Alors, qu\'est-ce que tu attends ? Lance-toi, expérimente, et prépare-toi à conquérir tes clients avec la reine de la pâtisserie napolitaine, la Sfogliatella Riccia, servie sur un plateau d\'argent par la fantastique équipe de LAPA. Bonne chance !',
        en_US: 'So, what are you waiting for? Jump in, experiment, and get ready to conquer your customers with the queen of Neapolitan pastries, the Sfogliatella Riccia, served on a silver platter by the fantastic LAPA team. Good luck!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 43: SFOGLIATELLA RICCIA ===\n');

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

  console.log('\n✅ ARTICOLO 43 COMPLETATO!');
}

main();
