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

const POST_ID = 61;

const TITLE_TRANSLATIONS = {
  it_IT: "Il segreto che nessun ristorante vuole svelare: SPECK DE BAITA PZ 2KG SOSIO 😋🔪",
  de_CH: "Das Geheimnis, das kein Restaurant verraten will: SPECK DE BAITA ST 2KG SOSIO 😋🔪",
  fr_CH: "Le secret qu'aucun restaurant ne veut révéler : SPECK DE BAITA PC 2KG SOSIO 😋🔪",
  en_US: "The Secret No Restaurant Wants to Reveal: SPECK DE BAITA PC 2KG SOSIO 😋🔪"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Hai mai assaggiato qualcosa che ti ha fatto pensare')) {
      t[src] = {
        de_CH: 'Hast du jemals etwas probiert, das dich denken ließ "Verdammt, warum habe ich das nicht früher entdeckt?" Gut, heute verrate ich dir ein Geheimnis, das dich genau so rufen lassen könnte: unseren SPECK DE BAITA ST 2KG SOSIO. Aber Vorsicht, er könnte dir alle anderen Specks für immer verderben.',
        fr_CH: 'Tu as déjà goûté quelque chose qui t\'a fait penser "Merde, pourquoi je ne l\'ai pas découvert avant ?" Eh bien, aujourd\'hui je te révèle un secret qui pourrait te faire t\'exclamer exactement ça : notre SPECK DE BAITA PC 2KG SOSIO. Attention cependant, il pourrait te gâcher tous les autres specks pour toujours.',
        en_US: 'Have you ever tasted something that made you think "Damn, why didn\'t I discover this before?" Well, today I\'m revealing a secret that could make you exclaim just that: our SPECK DE BAITA PC 2KG SOSIO. Be careful though, it might ruin all other speck for you forever.'
      };
    }
    else if (src.includes('Parliamo di speck, ma non di uno qualsiasi')) {
      t[src] = {
        de_CH: 'Wir sprechen von Speck, aber nicht von irgendeinem. Dieser SPECK DE BAITA ST 2KG SOSIO ist ernsthaftes Zeug. Es handelt sich um ein Meisterwerk der italienischen Gastronomie, hergestellt mit traditionellen Methoden und Schweinefleisch von höchster Qualität. Langsam mit Buchenholz geräuchert, entwickelt er einen intensiven und unverwechselbaren Geschmack. Und die Reifung? Nun, sie findet im Hochgebirge statt, wo die reine und frische Luft ihm einen Geschmack verleiht, bei dem du dir die Finger lecken wirst. Perfekte Balance zwischen Rauchigkeit, natürlicher Süße und einem Hauch von Gewürzen, der ihn... einfach unwiderstehlich macht.',
        fr_CH: 'On parle de speck, mais pas de n\'importe lequel. Ce SPECK DE BAITA PC 2KG SOSIO c\'est du sérieux. Il s\'agit d\'un chef-d\'œuvre de la gastronomie italienne, produit avec des méthodes traditionnelles et de la viande de porc de très haute qualité. Fumé lentement au bois de hêtre, il développe un goût intense et inimitable. Et l\'affinage ? Eh bien, il a lieu en haute montagne, où l\'air pur et frais lui offre une saveur qui te fera te lécher les babines. Équilibre parfait entre fumé, douceur naturelle et une touche d\'épices qui le rend... tout simplement irrésistible.',
        en_US: 'We\'re talking about speck, but not just any. This SPECK DE BAITA PC 2KG SOSIO is serious stuff. It\'s a masterpiece of Italian gastronomy, produced with traditional methods and pork of the highest quality. Slowly smoked with beechwood, it develops an intense and unmistakable taste. And the curing? Well, it happens in the high mountains, where the pure and crisp air gives it a flavor that will make you lick your lips. Perfect balance between smokiness, natural sweetness and a touch of spices that makes it... simply irresistible.'
      };
    }
    else if (src.includes('Ora ti chiederai: "Perché diavolo il mio ristorante non offre già questo speck?"')) {
      t[src] = {
        de_CH: 'Jetzt fragst du dich: "Warum zum Teufel bietet mein Restaurant diesen Speck nicht schon an?" Vielleicht weil sie keinen Lieferanten wie LAPA - Finest Italian Food haben. Wir begnügen uns nicht damit, nur das zu liefern, was leicht verfügbar ist; wir bemühen uns, GENAU das zu finden, zu importieren und zu liefern, was du brauchst. Keine Kompromisse. Und wenn das nicht genug wäre, kannst du mit unserer <strong>Bestell-APP</strong> bestellen, wann du willst, die Bestellhistorie einsehen und viele andere coole Sachen. Und weißt du das Beste? Kein Mindestbestellwert und Lieferungen 6 Tage die Woche. Bestelle heute und morgen hast du alles, was du brauchst.',
        fr_CH: 'Maintenant tu te demandes : "Pourquoi diable mon restaurant n\'offre pas déjà ce speck ?" Peut-être parce qu\'ils n\'ont pas un fournisseur comme LAPA - Finest Italian Food. On ne se contente pas de fournir ce qui est facilement disponible ; on s\'engage à trouver, importer et livrer EXACTEMENT ce qu\'il te faut. Pas de compromis. Et si ce n\'était pas assez, avec notre <strong>APP pour commandes</strong> tu peux commander quand tu veux, voir l\'historique des commandes et plein d\'autres trucs cools. Et tu sais le meilleur ? Pas de minimum de commande et livraisons 6 jours sur 7. Tu commandes aujourd\'hui et demain tu as tout ce qu\'il te faut.',
        en_US: 'Now you\'re wondering: "Why the hell doesn\'t my restaurant already offer this speck?" Maybe because they don\'t have a supplier like LAPA - Finest Italian Food. We don\'t settle for just providing what\'s easily available; we commit to finding, importing and delivering EXACTLY what you need. No compromises. And if that wasn\'t enough, with our <strong>ordering APP</strong> you can order whenever you want, see order history and a bunch of other cool stuff. And you know the best part? No minimum order and deliveries 6 days a week. Order today and tomorrow you have everything you need.'
      };
    }
    else if (src.includes('Immagina: niente più viaggi al discount perché il tuo fornitore non ha quello che desideri')) {
      t[src] = {
        de_CH: 'Stell dir vor: keine Fahrten mehr zum Discounter, weil dein Lieferant nicht hat, was du dir wünschst. Mit LAPA wird all das Realität. Biete deinen Kunden das Beste, ohne Kompromisse. Vergiss die Lieferanten, die dich zu Kompromissen zwingen. Wir bei LAPA finden und liefern alles, was du brauchst, Punkt.',
        fr_CH: 'Imagine : plus de trajets au discount parce que ton fournisseur n\'a pas ce que tu désires. Avec LAPA, tout ça devient réalité. Offre à tes clients le meilleur, sans compromis. Oublie les fournisseurs qui t\'obligent à faire des compromis. Nous chez LAPA on trouve et on livre tout ce qu\'il te faut, point final.',
        en_US: 'Imagine: no more trips to the discount store because your supplier doesn\'t have what you want. With LAPA, all this becomes reality. Offer your customers the best, without compromise. Forget suppliers who force you to compromise. We at LAPA find and deliver everything you need, period.'
      };
    }
    else if (src.includes('Se pensi che stia solo facendo il figo, perché non metterci alla prova?')) {
      t[src] = {
        de_CH: 'Wenn du denkst, ich tue nur so cool, warum stellst du uns nicht auf die Probe? Bestelle noch heute unseren SPECK DE BAITA ST 2KG SOSIO und entdecke, wie wir dein Angebot verbessern können. Und wenn du weitere Infos brauchst, wir sind hier, immer bereit zu helfen. Denn bei LAPA bist du kein einfacher Kunde: du bist VIP.',
        fr_CH: 'Si tu penses que je fais juste le malin, pourquoi ne pas nous mettre à l\'épreuve ? Commande notre SPECK DE BAITA PC 2KG SOSIO aujourd\'hui même et découvre comment on peut améliorer ton offre. Et si tu as besoin de plus d\'infos, on est là, toujours prêts à aider. Parce que chez LAPA, tu n\'es pas un simple client : tu es VIP.',
        en_US: 'If you think I\'m just showing off, why not put us to the test? Order our SPECK DE BAITA PC 2KG SOSIO today and discover how we can improve your offering. And if you need more info, we\'re here, always ready to help. Because at LAPA, you\'re not just a customer: you\'re VIP.'
      };
    }
    else if (src.includes('Lascia un commento qui sotto: hai mai provato un prodotto che ti ha fatto cambiare idea')) {
      t[src] = {
        de_CH: 'Hinterlasse einen Kommentar hier unten: hast du jemals ein Produkt probiert, das deine Meinung über Qualität geändert hat? Oder vielleicht hast du eine lustige Geschichte über schlechte Lieferanten? Wir sind ganz Ohr! 🧏👂',
        fr_CH: 'Laisse un commentaire ci-dessous : tu as déjà essayé un produit qui t\'a fait changer d\'avis sur la qualité ? Ou peut-être tu as une histoire drôle sur les mauvais fournisseurs ? On est tout ouïe ! 🧏👂',
        en_US: 'Leave a comment below: have you ever tried a product that made you change your mind about quality? Or maybe you have a funny story about bad suppliers? We\'re all ears! 🧏👂'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 61: SPECK DE BAITA ===\n');

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

  console.log('\n✅ ARTICOLO 61 COMPLETATO!');
}

main();
