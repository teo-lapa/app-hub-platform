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

const POST_ID = 42;

const TITLE_TRANSLATIONS = {
  it_IT: "L'Insalata di Mare che ti lascia senza parole!",
  de_CH: "Der Meeresfrüchtesalat, der dich sprachlos macht!",
  fr_CH: "La Salade de Fruits de Mer qui te laisse sans voix !",
  en_US: "The Seafood Salad That Leaves You Speechless!"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Ti trovi in cucina, immerso tra pentole e fornelli, cercando di soddisfare i clienti più esigenti e difficili? Abbiamo qualcosa per te, qualcosa che ti sorprenderà: \"Ma perché non l'ho scoperto prima?\" 🤯",
  de_CH: "Du stehst in der Küche, zwischen Töpfen und Herden, und versuchst, die anspruchsvollsten Kunden zufrieden zu stellen? Wir haben etwas für dich, etwas das dich überraschen wird: \"Warum habe ich das nicht früher entdeckt?\" 🤯",
  fr_CH: "Tu es en cuisine, plongé entre casseroles et fourneaux, essayant de satisfaire les clients les plus exigeants ? On a quelque chose pour toi, quelque chose qui va te surprendre : \"Mais pourquoi je ne l'ai pas découvert avant ?\" 🤯",
  en_US: "You're in the kitchen, immersed among pots and stoves, trying to satisfy the most demanding customers? We have something for you, something that will surprise you: \"Why didn't I discover this before?\" 🤯"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Parliamo dell\'insalata di mare. Ma non una qualsiasi insalata')) {
      t[src] = {
        de_CH: 'Sprechen wir über Meeresfrüchtesalat. Aber nicht irgendeinen Salat, wir sprechen vom Vorgekochten Meeresfrüchtesalat von LAPA, ein kulinarischer Triumph, der dir erlaubt zu glänzen ohne Stress oder übermäßige Arbeit in der Küche!',
        fr_CH: 'Parlons de la salade de fruits de mer. Mais pas n\'importe quelle salade, nous parlons de la Salade de Fruits de Mer Précuite de LAPA, un triomphe culinaire qui te permet de briller sans stress ni travail excessif en cuisine !',
        en_US: 'Let\'s talk about seafood salad. But not just any salad, we\'re talking about LAPA\'s Pre-cooked Seafood Salad, a culinary triumph that lets you shine without stress or excessive work in the kitchen!'
      };
    }
    else if (src.includes('Prima di tutto, respira: LAPA ti consegna questa meraviglia 6 giorni su 7')) {
      t[src] = {
        de_CH: 'Erstens, atme durch: LAPA liefert dir dieses Wunder 6 Tage die Woche. Also, wenn du in letzter Minute merkst, dass du vergessen hast zu bestellen, keine Angst, wir sind für dich da. Bestelle heute, und morgen hast du alles bereit und frisch zum Servieren! 🚚💨',
        fr_CH: 'D\'abord, respire : LAPA te livre cette merveille 6 jours sur 7. Donc, si tu te rends compte à la dernière minute que tu as oublié de commander, pas de panique, on est là pour toi. Commande aujourd\'hui, et demain tu auras tout prêt et frais à servir ! 🚚💨',
        en_US: 'First of all, breathe: LAPA delivers this wonder 6 days a week. So, if you realize at the last minute you forgot to order, no fear, we\'re here for you. Order today, and tomorrow you\'ll have everything ready and fresh to serve! 🚚💨'
      };
    }
    else if (src.includes('E niente più stress con liste infinite di prodotti')) {
      t[src] = {
        de_CH: 'Und kein Stress mehr mit endlosen Produktlisten: bei LAPA bestellst du, was du willst, in der Menge, die du möchtest. Kein Mindestbestellwert, der dich zwingt, unnötige Produkte hinzuzufügen, nur um einen bestimmten Betrag zu erreichen. Bestelle genau das, was du brauchst! 🤑',
        fr_CH: 'Et fini le stress avec des listes infinies de produits : avec LAPA, tu commandes ce que tu veux, dans la quantité que tu désires. Pas de minimum de commande qui t\'oblige à ajouter des produits inutiles juste pour atteindre un certain montant. Commande exactement ce dont tu as besoin ! 🤑',
        en_US: 'And no more stress with endless product lists: with LAPA, you order what you want, in the quantity you desire. No minimum order forcing you to add unnecessary products just to reach a certain amount. Order exactly what you need! 🤑'
      };
    }
    else if (src.includes('E ora, la parte entusiasmante: l\'APP di LAPA')) {
      t[src] = {
        de_CH: 'Und jetzt der spannende Teil: die LAPA APP! Ein so praktisches Tool, dass du dich fragen wirst, wie du bis jetzt ohne es ausgekommen bist. Du kannst im Handumdrehen bestellen, ohne Komplikationen, alles organisiert halten, von Bestellungen bis zu Dokumenten, immer griffbereit. 📱🚀',
        fr_CH: 'Et maintenant, la partie excitante : l\'APP de LAPA ! Un outil si pratique que tu te demanderas comment tu as fait sans jusqu\'à maintenant. Tu peux commander en un clin d\'œil, sans complications, tout garder organisé, des commandes aux documents, toujours à portée de main. 📱🚀',
        en_US: 'And now, the exciting part: the LAPA APP! A tool so practical you\'ll wonder how you managed without it until now. You can order in the blink of an eye, without complications, keeping everything organized, from orders to documents, always at your fingertips. 📱🚀'
      };
    }
    else if (src.includes('E parliamo del servizio? Sei la nostra priorità')) {
      t[src] = {
        de_CH: 'Und was ist mit dem Service? Du bist unsere Priorität. Hast du ein Problem, eine Frage, einen Zweifel? Wir sind hier, bereit dir zu helfen, Lösungen zu finden, dir die Dinge einfacher zu machen. Weil du wichtig bist und einen exzellenten Service verdienst. 🌟👑',
        fr_CH: 'Et parlons du service ? Tu es notre priorité. Tu as un problème, une question, un doute ? On est là, prêts à t\'assister, à trouver des solutions, à te rendre les choses plus simples. Parce que tu es important et tu mérites un service excellent. 🌟👑',
        en_US: 'And let\'s talk about the service? You are our priority. Got a problem, a question, a doubt? We\'re here, ready to assist you, find solutions, make things easier for you. Because you matter and deserve excellent service. 🌟👑'
      };
    }
    else if (src.includes('Allora, cosa aspetti? Prova questa incredibile insalata di mare')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Probiere diesen unglaublichen Meeresfrüchtesalat und bringe deine Küche auf ein neues Level! Und wenn du etwas zu teilen hast, kommentiere gerne hier unten. Wir sind hier, um zuzuhören und Gedanken und Lächeln zu teilen! 🗣️💬',
        fr_CH: 'Alors, qu\'est-ce que tu attends ? Essaie cette incroyable salade de fruits de mer et porte ta cuisine à un nouveau niveau ! Et si tu as quelque chose à partager, n\'hésite pas à commenter ci-dessous. On est là pour écouter et partager pensées et sourires ! 🗣️💬',
        en_US: 'So, what are you waiting for? Try this incredible seafood salad and take your kitchen to a new level! And if you have something to share, feel free to comment below. We\'re here to listen and share thoughts and smiles! 🗣️💬'
      };
    }
    else if (src.includes('Preparati a una rivoluzione culinaria che ti lascerà stupito')) {
      t[src] = {
        de_CH: 'Bereite dich auf eine kulinarische Revolution vor, die dich staunen lässt. Willkommen in der Welt von LAPA, wo das Gewöhnliche außergewöhnlich wird! 🍤🔥',
        fr_CH: 'Prépare-toi à une révolution culinaire qui te laissera stupéfait. Bienvenue dans le monde LAPA, où l\'ordinaire devient extraordinaire ! 🍤🔥',
        en_US: 'Get ready for a culinary revolution that will leave you amazed. Welcome to the world of LAPA, where ordinary becomes extraordinary! 🍤🔥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 42: INSALATA DI MARE ===\n');

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

  console.log('\n✅ ARTICOLO 42 COMPLETATO!');
}

main();
