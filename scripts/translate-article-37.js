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

const POST_ID = 37;

const TITLE_TRANSLATIONS = {
  it_IT: "Il Tuo Grana Padano Fa Schifo Senza LAPA! 🧀❌",
  de_CH: "Dein Grana Padano ist ohne LAPA nichts wert! 🧀❌",
  fr_CH: "Ton Grana Padano est Nul Sans LAPA ! 🧀❌",
  en_US: "Your Grana Padano Sucks Without LAPA! 🧀❌"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ti senti fiero del tuo Grana Padano DOP che sbandieri in menù')) {
      t[src] = {
        de_CH: 'Du bist stolz auf deinen Grana Padano DOP, den du auf der Speisekarte prahlst? Du dachtest, er wäre das Beste vom Besten, oder? Wach auf, Freund! Er könnte der beste Käse der Welt sein, aber ohne LAPA wird er nur ein trauriger Hauch von Luxus auf deinem Teller. Lass mich dir ohne viel Gerede erklären warum!',
        fr_CH: 'Tu te sens fier de ton Grana Padano DOP que tu brandis sur ton menu ? Tu pensais que c\'était la crème de la crème, pas vrai ? Réveille-toi, mon ami ! Ce pourrait être le meilleur fromage du monde, mais sans LAPA ça devient juste une triste touche de luxe dans ton assiette. Laisse-moi t\'expliquer pourquoi sans blabla !',
        en_US: 'Feeling proud of your Grana Padano DOP that you\'re flaunting on your menu? You thought it was the crème de la crème, right? Wake up, friend! It could be the best cheese in the world, but without LAPA it\'s just a sad touch of luxury on your plate. Let me explain why without much chitchat!'
      };
    }
    else if (src.includes('Il Grana Padano DOP: Perché Fa Impazzire')) {
      t[src] = {
        de_CH: 'Grana Padano DOP: Warum er verrückt macht? 🤤',
        fr_CH: 'Le Grana Padano DOP : Pourquoi il Rend Fou ? 🤤',
        en_US: 'Grana Padano DOP: Why It Drives People Crazy? 🤤'
      };
    }
    else if (src.includes('Partiamo dalle basi. Il Grana Padano DOP non è un formaggio qualsiasi')) {
      t[src] = {
        de_CH: 'Fangen wir mit den Grundlagen an. Grana Padano DOP ist kein gewöhnlicher Käse. DOP bedeutet, dass wir hier nicht von Supermarktware reden. Nein, nein! Das ist ein Käse der Spitzenklasse, gemacht mit Liebe, Leidenschaft und Tradition. Und die frischen Flocken? Die sind das kulinarische Äquivalent zum Tragen eines maßgeschneiderten Anzugs statt eines aus dem Discounter!',
        fr_CH: 'Commençons par les bases. Le Grana Padano DOP n\'est pas un fromage ordinaire. DOP signifie qu\'on ne parle pas d\'un truc de supermarché. Non, non ! C\'est un fromage de haute classe, fait avec amour, passion et tradition. Et les copeaux frais ? C\'est l\'équivalent culinaire de porter un costume sur mesure au lieu d\'un pris au discount !',
        en_US: 'Let\'s start with the basics. Grana Padano DOP is not just any cheese. DOP means we\'re not talking about supermarket stuff here. No, no! It\'s a top-class cheese, made with love, passion and tradition. And the fresh flakes? They\'re the culinary equivalent of wearing a tailored suit instead of one from the discount store!'
      };
    }
    else if (src.includes('Ma Ecco la Brutta Notizia')) {
      t[src] = {
        de_CH: 'Aber hier kommt die schlechte Nachricht... 😱',
        fr_CH: 'Mais Voici la Mauvaise Nouvelle... 😱',
        en_US: 'But Here\'s the Bad News... 😱'
      };
    }
    else if (src.includes('Anche se hai il Grana Padano DOP più fresco e delizioso')) {
      t[src] = {
        de_CH: 'Selbst wenn du den frischesten und köstlichsten Grana Padano DOP des Planeten hast, hier ist warum du ohne LAPA, mein Freund, nur so tust als wärst du Gastronom:',
        fr_CH: 'Même si tu as le Grana Padano DOP le plus frais et délicieux de la planète, voici pourquoi sans LAPA, mon ami, tu ne fais que jouer au restaurateur :',
        en_US: 'Even if you have the freshest and most delicious Grana Padano DOP on the planet, here\'s why without LAPA, my friend, you\'re just playing at being a restaurateur:'
      };
    }
    else if (src.includes('Servizio 6 su 7')) {
      t[src] = {
        de_CH: 'Service 6 von 7 Tagen',
        fr_CH: 'Service 6 jours sur 7',
        en_US: 'Service 6 out of 7 days'
      };
    }
    else if (src.includes('Allora, chef improvvisato, hai finito il tuo Grana Padano')) {
      t[src] = {
        de_CH: 'Also, Hobbykoch, ist dir der Grana Padano kurz vor dem Wochenende ausgegangen? Gut für dich, LAPA rettet dir den Hintern und liefert von Montag bis Samstag. Bestelle heute, vielleicht während du einen Aperitif genießt, und morgen hast du deinen Käse. Einfach, oder? 🚚',
        fr_CH: 'Alors, chef improvisé, tu as fini ton Grana Padano juste avant le weekend ? Tant mieux pour toi, LAPA te sauve la mise en te livrant du lundi au samedi. Commande aujourd\'hui, peut-être en dégustant un apéro, et demain tu auras ton fromage. Facile, non ? 🚚',
        en_US: 'So, amateur chef, did you run out of your Grana Padano right before the weekend? Good for you, LAPA saves your behind by delivering from Monday to Saturday. Order today, maybe while enjoying an aperitif, and tomorrow you\'ll have your cheese. Easy, right? 🚚'
      };
    }
    else if (src.includes('Nessun Minimo d\'Ordine')) {
      t[src] = {
        de_CH: 'Kein Mindestbestellwert',
        fr_CH: 'Pas de Minimum de Commande',
        en_US: 'No Minimum Order'
      };
    }
    else if (src.includes('Ti serve solo un chilo? Che diavolo, prendi quanto ti pare')) {
      t[src] = {
        de_CH: 'Brauchst du nur ein Kilo? Zum Teufel, nimm so viel du willst! Ohne Mindestbestellwert, wer sind wir schon zu urteilen? 🤷',
        fr_CH: 'Tu as besoin d\'un seul kilo ? Que diable, prends ce que tu veux ! Sans minimum de commande, qui sommes-nous pour juger ? 🤷',
        en_US: 'You only need a kilo? What the heck, take as much as you want! With no minimum order, who are we to judge? 🤷'
      };
    }
    else if (src.includes('Listino Personalizzato e APP per Ordini')) {
      t[src] = {
        de_CH: 'Personalisierte Preisliste und APP für Bestellungen',
        fr_CH: 'Tarif Personnalisé et APP pour les Commandes',
        en_US: 'Customized Price List and APP for Orders'
      };
    }
    else if (src.includes('Cavolo, la tecnologia! Noi ti diamo un\'app')) {
      t[src] = {
        de_CH: 'Verdammt, die Technologie! Wir geben dir eine App. Ja, eine App! Um deinen Grana Padano zu bestellen, wann immer du willst. Und nicht nur das. Tschüss Papier und Stift, willkommen in der Zukunft! 📲',
        fr_CH: 'Zut, la technologie ! On te donne une app. Oui, une app ! Pour commander ton Grana Padano quand tu veux. Et pas seulement ça. Adieu papier et stylo, bienvenue dans le futur ! 📲',
        en_US: 'Dang, technology! We give you an app. Yes, an app! To order your Grana Padano whenever you want. And not just that. Goodbye paper and pen, welcome to the future! 📲'
      };
    }
    else if (src.includes('Assistenza Dedicata')) {
      t[src] = {
        de_CH: 'Dedizierter Support',
        fr_CH: 'Assistance Dédiée',
        en_US: 'Dedicated Assistance'
      };
    }
    else if (src.includes('Hai combinato un pasticcio? Tranquillo, non sarai il primo')) {
      t[src] = {
        de_CH: 'Hast du Mist gebaut? Keine Sorge, du bist nicht der Erste und nicht der Letzte. Ruf uns an, und jemand wird dir helfen, es zu lösen. Vielleicht mit einem Lächeln! 📞',
        fr_CH: 'Tu as fait une bêtise ? Tranquille, tu ne seras ni le premier ni le dernier. Appelle-nous, et quelqu\'un t\'aidera à résoudre ça. Peut-être avec un sourire ! 📞',
        en_US: 'Made a mess? Don\'t worry, you won\'t be the first or the last. Call us, and someone will help you fix it. Maybe with a smile! 📞'
      };
    }
    else if (src.includes('Insomma...')) {
      t[src] = {
        de_CH: 'Also...',
        fr_CH: 'En bref...',
        en_US: 'In short...'
      };
    }
    else if (src.includes('Sei ancora convinto di essere il re della cucina')) {
      t[src] = {
        de_CH: 'Bist du immer noch überzeugt, der König der Küche mit deinem einsamen Grana Padano zu sein? Fülle diesen Käse mit Charakter, Persönlichkeit und einem Top-Service. Denn mit LAPA schmeckt alles besser.',
        fr_CH: 'Tu es encore convaincu d\'être le roi de la cuisine avec ton Grana Padano solitaire ? Remplis ce fromage de caractère, de personnalité et d\'un service top. Parce qu\'avec LAPA, tout a meilleur goût.',
        en_US: 'Still convinced you\'re the king of the kitchen with your lonely Grana Padano? Fill that cheese with character, personality and top service. Because with LAPA, everything tastes better.'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 37: GRANA PADANO ===\n');

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

  console.log('\n✅ ARTICOLO 37 COMPLETATO!');
}

main();
