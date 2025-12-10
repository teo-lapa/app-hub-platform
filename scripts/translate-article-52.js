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

const POST_ID = 52;

const TITLE_TRANSLATIONS = {
  it_IT: "Tonno Yellowfin: Non Solo un Pesce, è la Bomba Gastronomica Che Stavi Aspettando! 🔥🐟",
  de_CH: "Gelbflossen-Thunfisch: Nicht nur ein Fisch, er ist die gastronomische Bombe, auf die du gewartet hast! 🔥🐟",
  fr_CH: "Thon Yellowfin : Pas Seulement un Poisson, c'est la Bombe Gastronomique que tu Attendais ! 🔥🐟",
  en_US: "Yellowfin Tuna: Not Just a Fish, It's the Gastronomic Bomb You've Been Waiting For! 🔥🐟"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Allora, ascoltami bene. Oggi ti parlo del tonno Yellowfin, ma non il solito tonno da quattro soldi che trovi al supermercato. Sto parlando di una vera e propria rivoluzione nel piatto! Il tonno Yellowfin che arriva dalla LAPA - Finest Italian Food è un'altra storia. È il Mike Tyson dei tonni, una leggenda!",
  de_CH: "Also, hör mir gut zu. Heute spreche ich über den Gelbflossen-Thunfisch, aber nicht den üblichen Billig-Thunfisch, den du im Supermarkt findest. Ich spreche von einer echten Revolution auf dem Teller! Der Gelbflossen-Thunfisch von LAPA - Finest Italian Food ist eine andere Geschichte. Er ist der Mike Tyson unter den Thunfischen, eine Legende!",
  fr_CH: "Alors, écoute-moi bien. Aujourd'hui je te parle du thon Yellowfin, mais pas le thon de quatre sous habituel que tu trouves au supermarché. Je parle d'une véritable révolution dans l'assiette ! Le thon Yellowfin qui vient de LAPA - Finest Italian Food, c'est une autre histoire. C'est le Mike Tyson des thons, une légende !",
  en_US: "So, listen up. Today I'm talking about Yellowfin tuna, but not the usual cheap tuna you find at the supermarket. I'm talking about a real revolution on the plate! The Yellowfin tuna that comes from LAPA - Finest Italian Food is a different story. It's the Mike Tyson of tunas, a legend!"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Primo, la qualità. Amico, quando assaggi questo tonno')) {
      t[src] = {
        de_CH: 'Erstens, die Qualität. Freund, wenn du diesen Thunfisch probierst, verstehst du, dass alle anderen nur eine Vorspeise waren. Er ist zart, schmackhaft, scheint fast im Mund zu schmelzen. Und du kannst alles damit machen: grillen, ein fantastisches Sushi machen oder einen Salat, der verrückt macht. Die Vielseitigkeit? Wir sind auf dem Niveau eines Schweizer Taschenmessers!',
        fr_CH: 'Premièrement, la qualité. Mon ami, quand tu goûtes ce thon, tu comprends que tous les autres n\'étaient qu\'une entrée. Il est tendre, savoureux, il semble presque fondre en bouche. Et tu peux tout faire avec : le griller, faire un sushi d\'enfer, ou une salade qui rend fou. La polyvalence ? On est au niveau d\'un couteau suisse !',
        en_US: 'First, the quality. Friend, when you taste this tuna, you understand that all the others were just an appetizer. It\'s tender, tasty, it almost seems to melt in your mouth. And you can do anything with it: grill it, make an amazing sushi, or a salad that drives people crazy. The versatility? We\'re at Swiss army knife level!'
      };
    }
    else if (src.includes('E non dimenticare: con LAPA non devi aspettare la fine del mondo')) {
      t[src] = {
        de_CH: 'Und vergiss nicht: mit LAPA musst du nicht bis zum Ende der Welt auf deine Bestellung warten. Wir liefern 6 Tage die Woche, du kannst uns also auch in letzter Minute anrufen. Und dann gibt es keine Mindestbestellungen. Willst du nur ein Filet? Kein Problem, wir bringen es dir mit einem Lächeln.',
        fr_CH: 'Et n\'oublie pas : avec LAPA tu n\'as pas à attendre la fin du monde pour recevoir ta commande. On livre 6 jours sur 7, donc tu peux nous appeler même à la dernière minute. Et puis, il n\'y a pas de commande minimum. Tu veux seulement un filet ? Pas de problème, on te l\'apporte avec le sourire.',
        en_US: 'And don\'t forget: with LAPA you don\'t have to wait till the end of the world to receive your order. We deliver 6 days a week, so you can call us even at the last minute. And then, there are no minimum orders. Want just one fillet? No problem, we\'ll bring it to you with a smile.'
      };
    }
    else if (src.includes('E per i più esigenti, ci sono i servizi V.I.P.')) {
      t[src] = {
        de_CH: 'Und für die Anspruchsvollsten gibt es V.I.P.-Services. Denn du, mit diesem Thunfisch in der Küche, bist der V.I.P. Du verdienst das Beste, und wir sind hier, um es dir zu geben.',
        fr_CH: 'Et pour les plus exigeants, il y a les services V.I.P. Parce que toi, avec ce thon en cuisine, tu es le V.I.P. Tu mérites le meilleur, et on est là pour te le donner.',
        en_US: 'And for the most demanding, there are V.I.P. services. Because you, with that tuna in the kitchen, are the V.I.P. You deserve the best, and we\'re here to give it to you.'
      };
    }
    else if (src.includes('Ora, una cosa è chiara: questo tonno non è per i deboli di cuore')) {
      t[src] = {
        de_CH: 'Jetzt ist eines klar: dieser Thunfisch ist nichts für schwache Nerven. Er ist für diejenigen, die durchstarten wollen, für diejenigen, die das Beste suchen. Wenn du den Mut hast, in der Küche zu wagen, ist der Gelbflossen-Thunfisch dein perfekter Verbündeter. Mit unserer APP ist das Bestellen ein Kinderspiel. Ein paar Klicks und puff, da ist dein Thunfisch, bereit alle zu beeindrucken.',
        fr_CH: 'Maintenant, une chose est claire : ce thon n\'est pas pour les faibles de cœur. C\'est pour ceux qui veulent tout déchirer, pour ceux qui cherchent le top. Si tu as le courage d\'oser en cuisine, le thon Yellowfin est ton allié parfait. Avec notre APP, puis, le commander est un jeu d\'enfant. Quelques clics et pouf, voilà ton thon prêt à épater tout le monde.',
        en_US: 'Now, one thing is clear: this tuna is not for the faint of heart. It\'s for those who want to crush it, for those who seek the best. If you have the courage to dare in the kitchen, Yellowfin tuna is your perfect ally. With our APP, ordering it is child\'s play. A few clicks and poof, there\'s your tuna ready to amaze everyone.'
      };
    }
    else if (src.includes('Siamo sinceri, il mondo della ristorazione è una giungla')) {
      t[src] = {
        de_CH: 'Seien wir ehrlich, die Welt der Gastronomie ist ein Dschungel, und um zu überleben, musst du der Löwe sein. Der Gelbflossen-Thunfisch ist dein Brüllen. Es ist deine Absichtserklärung. Es ist die Art zu sagen: "Hey, hier bestimme ich und ich weiß, was ich will."',
        fr_CH: 'Soyons honnêtes, le monde de la restauration est une jungle, et pour survivre tu dois être le lion. Le thon Yellowfin est ton rugissement. C\'est ta déclaration d\'intentions. C\'est la façon de dire : "Hé, ici c\'est moi qui commande et je sais ce que je veux."',
        en_US: 'Let\'s be honest, the restaurant world is a jungle, and to survive you have to be the lion. Yellowfin tuna is your roar. It\'s your statement of intent. It\'s the way to say: "Hey, I\'m in charge here and I know what I want."'
      };
    }
    else if (src.includes('Allora, sei pronto a salire sul ring con il tonno Yellowfin')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, mit dem Gelbflossen-Thunfisch und LAPA in den Ring zu steigen? Glaub mir, einmal probiert, gibt es kein Zurück mehr. Schreib uns, ruf uns an, pfeif einmal, wie auch immer du willst, aber nimm Kontakt mit uns auf. Entdecke, wie dieser Thunfisch dein Menü transformieren und deine Kunden sprachlos machen kann.',
        fr_CH: 'Alors, tu es prêt à monter sur le ring avec le thon Yellowfin et LAPA ? Crois-moi, une fois essayé, tu ne reviendras plus en arrière. Écris-nous, appelle-nous, fais un signe, comme tu veux, mais entre en contact avec nous. Découvre comment ce thon peut transformer ton menu et laisser tes clients bouche bée.',
        en_US: 'So, are you ready to step into the ring with Yellowfin tuna and LAPA? Trust me, once you try it, there\'s no going back. Write to us, call us, whistle, however you want, but get in touch with us. Discover how this tuna can transform your menu and leave your customers speechless.'
      };
    }
    else if (src.includes('Aspettiamo il tuo ordine. E ricorda: in cucina, chi osa vince')) {
      t[src] = {
        de_CH: 'Wir warten auf deine Bestellung. Und denk dran: in der Küche gewinnt, wer wagt. Und mit dem Gelbflossen-Thunfisch gewinnst du groß! 🥊🍣',
        fr_CH: 'On attend ta commande. Et rappelle-toi : en cuisine, qui ose gagne. Et avec le thon Yellowfin, tu gagnes en grand ! 🥊🍣',
        en_US: 'We\'re waiting for your order. And remember: in the kitchen, those who dare win. And with Yellowfin tuna, you win big! 🥊🍣'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 52: TONNO YELLOWFIN ===\n');

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

  console.log('\n✅ ARTICOLO 52 COMPLETATO!');
}

main();
