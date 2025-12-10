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

const POST_ID = 39;

const TITLE_TRANSLATIONS = {
  it_IT: "Il Salmone da VIP? Te lo Serviamo su un Piattino d'Argento! 🐟🍴🚀",
  de_CH: "VIP-Lachs? Wir servieren ihn dir auf einem Silbertablett! 🐟🍴🚀",
  fr_CH: "Le Saumon VIP ? On te le Sert sur un Plateau d'Argent ! 🐟🍴🚀",
  en_US: "VIP Salmon? We'll Serve It to You on a Silver Platter! 🐟🍴🚀"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Senti, amico gastronomo, se credi di aver già assaporato')) {
      t[src] = {
        de_CH: 'Hör zu, Gastronomie-Freund, wenn du glaubst, du hättest schon den besten Lachs deines Lebens probiert... nun, du bist auf dem falschen Weg. Erlaube mir, dir unseren PORTIONIERTEN LACHS vorzustellen. Wir reden hier nicht von diesem alten, langweiligen Zeug, das du überall findest, sondern von einer wahren göttlichen Delikatesse. 😇',
        fr_CH: 'Écoute, ami gastronome, si tu crois avoir déjà savouré le meilleur saumon de ta vie... eh bien, tu fais fausse route. Permets-moi de te présenter notre SAUMON PORTIONNÉ. On ne parle pas de ce truc vieux et banal que tu trouves partout, mais d\'un véritable délice divin. 😇',
        en_US: 'Listen, gastronome friend, if you think you\'ve already tasted the best salmon of your life... well, you\'re on the wrong track. Allow me to introduce you to our PORTIONED SALMON. We\'re not talking about that old, boring stuff you find everywhere, but a true divine delight. 😇'
      };
    }
    else if (src.includes('Ecco perché:')) {
      t[src] = {
        de_CH: 'Hier ist warum:',
        fr_CH: 'Voici pourquoi :',
        en_US: 'Here\'s why:'
      };
    }
    else if (src.includes('Porzionato alla Perfezione')) {
      t[src] = {
        de_CH: '- **Perfekt Portioniert**: 200g-Schnitte, so präzise, dass du schwören könntest, wir hätten sie mit einem Messschieber gemessen! Perfekt für das Gourmet-Gericht, das du schon immer zubereiten wolltest, ohne in der Küche Mathematiker spielen zu müssen.',
        fr_CH: '- **Portionné à la Perfection** : Des tranches de 200g si précises que tu pourrais jurer qu\'on les a mesurées au calibre ! Parfaites pour ce petit plat gourmet dont tu as toujours rêvé, sans devoir faire le mathématicien en cuisine.',
        en_US: '- **Portioned to Perfection**: 200g cuts so precise you could swear we measured them with a caliper! Perfect for that gourmet dish you\'ve always dreamed of preparing, without having to be a mathematician in the kitchen.'
      };
    }
    else if (src.includes('Sempre Fresco, Mai Stantio')) {
      t[src] = {
        de_CH: '- **Immer Frisch, Nie Altbacken**: Bestelle heute, morgen ist er bei dir. Vergessen zu bestellen? Scheiß drauf, wen interessiert\'s! 😜 Wir lassen dich nie im Stich.',
        fr_CH: '- **Toujours Frais, Jamais Rassis** : Commande aujourd\'hui, demain c\'est chez toi. Oublié de commander ? Putain, on s\'en fout ! 😜 On ne te laissera jamais tomber.',
        en_US: '- **Always Fresh, Never Stale**: Order today, tomorrow it\'s at your place. Forgot to order? Damn, who cares! 😜 We\'ll never leave you high and dry.'
      };
    }
    else if (src.includes('Nessuna Cazzata di Minimo d\'Ordine')) {
      t[src] = {
        de_CH: '- **Kein Mindestbestellwert-Quatsch**: Wer hat gesagt, dass du bestellen musst, als würdest du ein Bankett für eine Armee vorbereiten? Willst du ein Stück? Du bekommst es. Willst du mehr? Das auch.',
        fr_CH: '- **Pas de Conneries de Minimum de Commande** : Qui a dit que tu devais commander comme si tu préparais un banquet pour une armée ? Tu veux un morceau ? Tu l\'as. Tu en veux plus ? Ça aussi.',
        en_US: '- **No Minimum Order Bullshit**: Who said you have to order like you\'re preparing a banquet for an army? Want one piece? You got it. Want more? That too.'
      };
    }
    else if (src.includes('Ma C\'è di Più!')) {
      t[src] = {
        de_CH: '- **Aber Es Gibt Mehr!**: Findest du das verdammte Produkt nicht, das du schon immer gesucht hast? Herausforderung angenommen! 🚀 Wir beschaffen es und bringen es dir frisch.',
        fr_CH: '- **Mais Il Y a Plus !** : Tu ne trouves pas ce putain de produit que tu as toujours cherché ? Défi accepté ! 🚀 On se le procure et on te l\'apporte tout frais.',
        en_US: '- **But There\'s More!**: Can\'t find that damn product you\'ve always been looking for? Challenge accepted! 🚀 We\'ll get it and bring it to you fresh.'
      };
    }
    else if (src.includes('Un Problemino?')) {
      t[src] = {
        de_CH: '- **Ein Problemchen?**: Keine Angst! Wir haben ein Team von Super-Beratern, die bereit sind, dir den Arsch zu retten. Ob du Ratschläge brauchst, wie du den Lachs zubereiten sollst oder wie du deine geheime Flamme gestehen kannst, wir sind für dich da.',
        fr_CH: '- **Un Petit Problème ?** : N\'aie pas peur ! On a une équipe de super conseillers prêts à te sauver les fesses. Que tu aies besoin de conseils sur comment cuisiner ce saumon ou sur comment déclarer ta flamme secrète, on est là pour toi.',
        en_US: '- **A Little Problem?**: Don\'t worry! We have a team of super consultants ready to save your ass. Whether you need advice on how to cook that salmon or how to declare your secret crush, we\'re here for you.'
      };
    }
    else if (src.includes('Allora, capo, sei ancora lì seduto a pensare')) {
      t[src] = {
        de_CH: 'Also, Chef, sitzt du immer noch da und denkst nach? Oder bist du bereit, die Mittelmäßigkeit hinter dir zu lassen und die wahre Magie des Lachses zu erleben? Und denk daran, das Leben ist zu kurz für schlechtes Essen und billigen Service. 😉',
        fr_CH: 'Alors, chef, tu es encore assis là à réfléchir ? Ou tu es prêt à laisser la médiocrité derrière toi et à expérimenter la vraie magie du saumon ? Et rappelle-toi, la vie est trop courte pour de la nourriture médiocre et un service de pacotille. 😉',
        en_US: 'So, boss, are you still sitting there thinking? Or are you ready to leave mediocrity behind and experience the real magic of salmon? And remember, life is too short for lousy food and cheap service. 😉'
      };
    }
    else if (src.includes('Dai, fatti avanti e raccontaci la tua')) {
      t[src] = {
        de_CH: 'Komm schon, mach den ersten Schritt und erzähl uns deine Geschichte. Bereit, ein VIP in deiner Küche zu werden? Hinterlasse einen Kommentar und lass es uns wissen! Und verdammt, genieß jeden einzelnen Bissen! 🐟🥂🎉',
        fr_CH: 'Allez, lance-toi et raconte-nous ton histoire. Prêt à devenir un VIP dans ta cuisine ? Laisse un commentaire et fais-nous savoir ! Et putain, profite de chaque bouchée ! 🐟🥂🎉',
        en_US: 'Come on, step forward and tell us your story. Ready to become a VIP in your kitchen? Leave a comment and let us know! And damn it, enjoy every single bite! 🐟🥂🎉'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 39: SALMONE PORZIONATO ===\n');

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

  console.log('\n✅ ARTICOLO 39 COMPLETATO!');
}

main();
