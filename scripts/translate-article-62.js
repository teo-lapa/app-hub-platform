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

const POST_ID = 62;

const TITLE_TRANSLATIONS = {
  it_IT: "Vuoi Il Successo? Usa Il Pesto Genovese Ristoris! 🍝💚",
  de_CH: "Willst du Erfolg? Verwende das Pesto Genovese Ristoris! 🍝💚",
  fr_CH: "Tu Veux le Succès ? Utilise le Pesto Genovese Ristoris ! 🍝💚",
  en_US: "Want Success? Use Pesto Genovese Ristoris! 🍝💚"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Immagina questo: è sabato sera, il tuo ristorante è pieno di clienti affamati')) {
      t[src] = {
        de_CH: 'Stell dir das vor: Es ist Samstagabend, dein Restaurant ist voller hungriger Gäste und das Tagesgericht ist eine köstliche Pasta mit Pesto. Du hast alles bereit, aber dein üblicher Lieferant hat sich entschieden, das Pesto Genovese, das du immer verwendest, nicht zu haben. Panik? Nicht mit LAPA - Finest Italian Food!',
        fr_CH: 'Imagine ça : c\'est samedi soir, ton restaurant est plein de clients affamés et le plat du jour est une délicieuse pasta au pesto. Tu as tout préparé, mais ton fournisseur habituel a décidé de ne pas avoir le pesto genovese que tu utilises toujours. Panique ? Pas avec LAPA - Finest Italian Food !',
        en_US: 'Imagine this: it\'s Saturday night, your restaurant is full of hungry customers and the dish of the day is a delicious pesto pasta. You have everything ready, but your usual supplier has decided not to have the Genovese pesto you always use. Panic? Not with LAPA - Finest Italian Food!'
      };
    }
    else if (src.includes('Hai mai provato il <strong>Pesto Genovese in latta da 800 g di Ristoris</strong>')) {
      t[src] = {
        de_CH: 'Hast du jemals das <strong>Pesto Genovese in der 800 g Dose von Ristoris</strong> probiert? Es ist nicht nur ein einfaches Pesto, es ist die Essenz der ligurischen Tradition, verpackt in einer perfekten Dose für die Gastronomie. Hergestellt mit frischem Basilikum, Pinienkernen, Parmesan und nativem Olivenöl extra, ist es eine Symphonie authentischer Aromen, die deine Gerichte in echte Kunstwerke verwandelt. Überlegene Qualität? Verdammt ja! Jede Dose enthält nur Zutaten von höchster Qualität, ohne Kompromisse. Bequemlichkeit und Praktikabilität? Die 800 g Dose ist ideal für den professionellen Einsatz, ermöglicht es dir, die Portionen optimal zu verwalten und Verschwendung zu reduzieren. Vielseitigkeit? Nicht nur für Pasta! Verwende es, um Pizzen, Bruschette zu würzen, oder sogar als Basis für Gourmet-Saucen.',
        fr_CH: 'Tu as déjà essayé le <strong>Pesto Genovese en boîte de 800 g de Ristoris</strong> ? Ce n\'est pas qu\'un simple pesto, c\'est l\'essence de la tradition ligure, enfermée dans une boîte parfaite pour la restauration. Fait avec du basilic frais, des pignons, du parmesan et de l\'huile d\'olive extra vierge, c\'est une symphonie de saveurs authentiques qui transformera tes plats en véritables œuvres d\'art. Qualité supérieure ? P***n oui ! Chaque boîte contient uniquement des ingrédients de première qualité, sans compromis. Commodité et praticité ? La boîte de 800 g est idéale pour l\'usage professionnel, te permettant de gérer au mieux les portions et de réduire le gaspillage. Polyvalence ? Pas seulement pour les pâtes ! Utilise-le pour assaisonner des pizzas, bruschette, ou même comme base pour des sauces gourmet.',
        en_US: 'Have you ever tried the <strong>Pesto Genovese in 800 g can from Ristoris</strong>? It\'s not just a simple pesto, it\'s the essence of Ligurian tradition, enclosed in a can perfect for food service. Made with fresh basil, pine nuts, parmesan and extra virgin olive oil, it\'s a symphony of authentic flavors that will transform your dishes into true works of art. Superior quality? Hell yes! Each can contains only the finest quality ingredients, without compromise. Convenience and practicality? The 800 g can is ideal for professional use, allowing you to manage portions optimally and reduce waste. Versatility? Not just for pasta! Use it to flavor pizzas, bruschette, or even as a base for gourmet sauces.'
      };
    }
    else if (src.includes('E con LAPA - Finest Italian Food, hai anche consegne 6 su 7')) {
      t[src] = {
        de_CH: 'Und mit LAPA - Finest Italian Food hast du auch Lieferungen 6 von 7 Tagen. Du musst dir keine Sorgen um die Planung deiner Lieferungen machen. Du kannst bestellen, wann du willst, von Montag bis Samstag. Du riskierst nie, ohne dein Lieblingspesto dazustehen! Und wenn du denkst, das war\'s, warte kurz: hast du schon von der personalisierten Preisliste gehört? Jedes Lokal ist einzigartig, und bei uns sind auch deine Preise einzigartig. Wir personalisieren die Preisliste basierend auf der Häufigkeit und dem Volumen deiner Bestellungen.',
        fr_CH: 'Et avec LAPA - Finest Italian Food, tu as aussi des livraisons 6 jours sur 7. Tu n\'as pas à te soucier de programmer tes approvisionnements. Tu peux commander quand tu veux, du lundi au samedi. Tu ne risques jamais de te retrouver sans ton pesto préféré ! Et si tu penses que c\'est fini, attends une seconde : tu as déjà entendu parler du tarif personnalisé ? Chaque établissement est unique, et avec nous, tes prix le sont aussi. On personnalise le tarif en fonction de la fréquence et du volume de tes commandes.',
        en_US: 'And with LAPA - Finest Italian Food, you also have deliveries 6 out of 7 days. You don\'t have to worry about scheduling your supplies. You can order whenever you want, from Monday to Saturday. You never risk running out of your favorite pesto! And if you think that\'s it, wait a moment: have you heard about the personalized price list? Every venue is unique, and with us, your prices are too. We personalize the price list based on the frequency and volume of your orders.'
      };
    }
    else if (src.includes('Hai dimenticato il pesto per domani? Non c\'è problema!')) {
      t[src] = {
        de_CH: 'Hast du das Pesto für morgen vergessen? Kein Problem! Bestelle heute und erhalte morgen alles Notwendige. Nie mehr Notfälle in der Küche! Und das Beste kommt noch: kein Mindestbestellwert. Ja, du hast richtig gelesen. Du kannst auch nur eine Dose Pesto bestellen, ohne einen Mindestbetrag erreichen zu müssen. Sag Tschüss zu unnötigen Vorräten! Hast du ein Problem? Kein Problem! Unser Support-Team ist immer bereit, dir zu helfen, per Chat oder Telefon. Mit LAPA bist du nie allein.',
        fr_CH: 'Tu as oublié le pesto pour demain ? Pas de problème ! Commande aujourd\'hui et reçois tout le nécessaire demain. Plus jamais d\'urgences en cuisine ! Et le meilleur reste à venir : pas de minimum de commande. Oui, tu as bien lu. Tu peux commander même juste une boîte de pesto sans devoir atteindre un minimum d\'achat. Dis adieu aux stocks inutiles ! Tu as un problème ? Pas de problème ! Notre équipe d\'assistance est toujours prête à t\'aider, par chat ou téléphone. Tu n\'es jamais seul avec LAPA.',
        en_US: 'Forgot the pesto for tomorrow? No problem! Order today and receive everything you need tomorrow. No more kitchen emergencies! And the best is yet to come: no minimum order. Yes, you read that right. You can order even just one can of pesto without having to reach a minimum spend. Say goodbye to unnecessary stocks! Have a problem? No problem! Our support team is always ready to help you, via chat or phone. You\'re never alone with LAPA.'
      };
    }
    else if (src.includes('Ora, dicci: sei pronto a rivoluzionare il tuo menu con il Pesto Genovese Ristoris')) {
      t[src] = {
        de_CH: 'Jetzt sag uns: bist du bereit, dein Menü mit dem Pesto Genovese Ristoris und den Premium-Services von LAPA zu revolutionieren? Erzähle uns in den Kommentaren, wie du dieses außergewöhnliche Pesto verwenden würdest! 💬👨‍🍳',
        fr_CH: 'Maintenant, dis-nous : tu es prêt à révolutionner ton menu avec le Pesto Genovese Ristoris et les services premium de LAPA ? Raconte-nous dans les commentaires comment tu utiliserais ce pesto extraordinaire ! 💬👨‍🍳',
        en_US: 'Now, tell us: are you ready to revolutionize your menu with Pesto Genovese Ristoris and LAPA\'s premium services? Tell us in the comments how you would use this extraordinary pesto! 💬👨‍🍳'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 62: PESTO GENOVESE RISTORIS ===\n');

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

  console.log('\n✅ ARTICOLO 62 COMPLETATO!');
}

main();
