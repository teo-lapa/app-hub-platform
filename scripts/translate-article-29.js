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

const POST_ID = 29;

const TITLE_TRANSLATIONS = {
  it_IT: "La Crema di Ricotta di Pecora Zuccherata – Il Segreto dei Grandi Pasticceri che Non Vogliono Dirti!",
  de_CH: "Die gezuckerte Schafsmilch-Ricotta-Creme – Das Geheimnis der großen Konditoren, das sie dir nicht verraten wollen!",
  fr_CH: "La Crème de Ricotta de Brebis Sucrée – Le Secret des Grands Pâtissiers qu'ils Ne Veulent Pas te Dire !",
  en_US: "Sweetened Sheep's Milk Ricotta Cream – The Secret of Great Pastry Chefs They Don't Want to Tell You!"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ecco un segreto di pasticceria che a molti non piacerà')) {
      t[src] = {
        de_CH: 'Hier ist ein Konditoreigeheimnis, das vielen nicht gefallen wird, dass du es weißt - die GEZUCKERTE SCHAFSMILCH-RICOTTA-CREME TIEFGEFROREN IM SPRITZBEUTEL. Ja, ihr habt richtig gelesen! Genau diese göttliche Creme, die Cannoli, Sfogliatelle und all diese köstlichen Desserts unwiderstehlich macht.',
        fr_CH: 'Voici un secret de pâtisserie que beaucoup n\'aimeront pas que tu saches - la CRÈME DE RICOTTA DE BREBIS SUCRÉE CONGELÉE EN SAC À POCHE. Oui, vous avez bien lu ! Exactement cette crème divine qui rend irrésistibles les cannoli, les sfogliatelle et tous ces desserts à se lécher les babines.',
        en_US: 'Here\'s a pastry secret that many won\'t like you knowing - SWEETENED SHEEP\'S MILK RICOTTA CREAM FROZEN IN PIPING BAG. Yes, you read that right! That very divine cream that makes cannoli, sfogliatelle and all those mouth-watering desserts irresistible.'
      };
    }
    else if (src.includes('Il tuo fornitore ti ha mai detto di questo prodotto')) {
      t[src] = {
        de_CH: 'Hat dir dein Lieferant jemals von diesem Produkt erzählt? Wahrscheinlich nicht, weil sie dir nicht GENAU das geben können, was du willst. Nicht mit LAPA. Wir geben uns nicht zufrieden. Wir wissen, was du willst und vor allem wissen wir, wie wir es dir geben können!',
        fr_CH: 'Ton fournisseur t\'a-t-il déjà parlé de ce produit ? Probablement pas, parce qu\'ils ne peuvent pas te donner EXACTEMENT ce que tu veux. Pas avec LAPA. Nous ne nous contentons pas de peu. Nous savons ce que tu veux et, surtout, nous savons comment te le faire avoir !',
        en_US: 'Has your supplier ever told you about this product? Probably not, because they can\'t give you EXACTLY what you want. Not with LAPA. We don\'t settle. We know what you want and, most importantly, we know how to get it to you!'
      };
    }
    else if (src.includes('La Crema di Ricotta di Pecora Zuccherata Congelata in Sac a Poche è un prodotto che rivoluzionerà')) {
      t[src] = {
        de_CH: 'Die gezuckerte Schafsmilch-Ricotta-Creme tiefgefroren im Spritzbeutel ist ein Produkt, das deine Konditorei revolutionieren wird. Es ist nicht die übliche Ricotta, die du überall findest. Es ist ein spezielles, hochwertiges Produkt, das direkt aus Italien kommt. Seine weiche und cremige Konsistenz, sein süßer und delikater Geschmack sind das Ergebnis eines langen Verarbeitungsprozesses und einer sorgfältigen Auswahl der besten Schafsmilch-Ricotta.',
        fr_CH: 'La Crème de Ricotta de Brebis Sucrée Congelée en Sac à Poche est un produit qui révolutionnera ta pâtisserie. Ce n\'est pas la ricotta habituelle que tu trouves partout. C\'est un produit spécial, de haute qualité, qui vient directement d\'Italie. Sa consistance moelleuse et crémeuse, son goût sucré et délicat, sont le résultat d\'un long processus de fabrication et d\'une sélection rigoureuse des meilleures ricottas de brebis.',
        en_US: 'The Sweetened Sheep\'s Milk Ricotta Cream Frozen in Piping Bag is a product that will revolutionize your pastry shop. It\'s not the usual ricotta you find around. It\'s a special, high-quality product that comes directly from Italy. Its soft and creamy consistency, its sweet and delicate flavor, are the result of a long processing process and a careful selection of the best sheep\'s milk ricottas.'
      };
    }
    else if (src.includes('Ma la magia di questo prodotto non si ferma qui')) {
      t[src] = {
        de_CH: 'Aber die Magie dieses Produkts hört hier nicht auf. Die gezuckerte Schafsmilch-Ricotta-Creme wird tiefgefroren im Spritzbeutel geliefert, gebrauchsfertig. Das spart dir nicht nur eine Menge Zeit, sondern garantiert auch jedes Mal, wenn du sie verwendest, eine perfekte Konsistenz und einen perfekten Geschmack. Kein Stress mehr bei der Zubereitung der Ricotta-Creme, keine Misserfolge oder inkonsistenten Ergebnisse mehr.',
        fr_CH: 'Mais la magie de ce produit ne s\'arrête pas là. La Crème de Ricotta de Brebis Sucrée est fournie congelée en sac à poche, prête à l\'emploi. Cela ne te fera pas seulement gagner beaucoup de temps, mais assurera également une consistance et une saveur parfaites à chaque fois que tu l\'utilises. Plus de stress pour la préparation de la crème de ricotta, plus d\'échecs ou de résultats incohérents.',
        en_US: 'But the magic of this product doesn\'t stop here. The Sweetened Sheep\'s Milk Ricotta Cream comes frozen in piping bag, ready to use. This will not only save you a lot of time, but will also ensure perfect consistency and flavor every time you use it. No more stress preparing ricotta cream, no more failures or inconsistent results.'
      };
    }
    else if (src.includes('Ora, pensa a tutti i modi in cui puoi utilizzare questa crema')) {
      t[src] = {
        de_CH: 'Jetzt denke an all die Möglichkeiten, wie du diese Creme verwenden kannst. Du kannst sizilianische Cannoli füllen, die mit ihrer Süße unwiderstehlich werden. Du kannst neapolitanische Sfogliatelle füllen, die mit ihrer Cremigkeit ein anderes Niveau erreichen. Aber hör hier nicht auf. Du kannst sie für Tiramisu, Cheesecake oder sogar als Basis für ein Ricotta-Eis verwenden.',
        fr_CH: 'Maintenant, pense à toutes les façons dont tu peux utiliser cette crème. Tu peux farcir des cannoli siciliens, qui deviennent irrésistibles avec sa douceur. Tu peux remplir des sfogliatelle napolitaines, qui avec son onctuosité atteindront un autre niveau. Mais ne t\'arrête pas là. Tu peux l\'utiliser pour préparer des tiramisu, des cheesecakes, ou même comme base pour une glace à la ricotta.',
        en_US: 'Now, think of all the ways you can use this cream. You can fill Sicilian cannoli, which become irresistible with its sweetness. You can fill Neapolitan sfogliatelle, which with its creaminess will reach another level. But don\'t stop there. You can use it to make tiramisu, cheesecake, or even as a base for ricotta ice cream.'
      };
    }
    else if (src.includes('E per i clienti con un palato più avventuroso')) {
      t[src] = {
        de_CH: 'Und für Kunden mit einem abenteuerlicheren Gaumen, warum nicht in Kombination mit salzigen Zutaten probieren? Die Süße der Ricotta-Creme gleicht sich perfekt mit dem Salzigen aus und schafft einen Geschmackskontrast, der sprachlos macht.',
        fr_CH: 'Et pour les clients avec un palais plus aventureux, pourquoi ne pas l\'essayer en combinaison avec des ingrédients salés ? La douceur de la crème de ricotta s\'équilibre parfaitement avec le salé, créant un contraste de saveurs qui laisse sans voix.',
        en_US: 'And for customers with a more adventurous palate, why not try it in combination with savory ingredients? The sweetness of the ricotta cream balances perfectly with the salty, creating a contrast of flavors that leaves you speechless.'
      };
    }
    else if (src.includes('La Crema di Ricotta di Pecora Zuccherata Congelata in Sac a Poche è più di un prodotto')) {
      t[src] = {
        de_CH: 'Die gezuckerte Schafsmilch-Ricotta-Creme tiefgefroren im Spritzbeutel ist mehr als ein Produkt. Es ist ein Werkzeug, das dir erlaubt, deine kulinarischen Grenzen zu überschreiten, neue Gerichte zu kreieren und deine Kunden zu überraschen. Wir können es kaum erwarten zu sehen, wie du sie in deinem Lokal verwendest!',
        fr_CH: 'La Crème de Ricotta de Brebis Sucrée Congelée en Sac à Poche est plus qu\'un produit. C\'est un outil qui te permet de repousser tes limites culinaires, de créer de nouveaux plats et de surprendre tes clients. Nous avons hâte de voir comment tu l\'utiliseras dans ton établissement !',
        en_US: 'The Sweetened Sheep\'s Milk Ricotta Cream Frozen in Piping Bag is more than a product. It\'s a tool that allows you to push your culinary limits, create new dishes and surprise your customers. We can\'t wait to see how you\'ll use it in your venue!'
      };
    }
    else if (src.includes('Ora, parliamo di comodità')) {
      t[src] = {
        de_CH: 'Jetzt sprechen wir über Bequemlichkeit. Du möchtest eine Bestellung aufgeben, aber du machst dir Sorgen, dass es zu spät ist oder dass du den Mindestbestellwert nicht erreichst? Mit LAPA existieren diese Probleme nicht. Keine Sorge, bestelle heute und morgen ist deine Ricotta-Creme vor deiner Tür. Und wir verlangen keinen Mindestbestellwert. Bestelle was du willst, wann du willst. Warum solltest du dich zufrieden geben oder im Discounter einkaufen gehen?',
        fr_CH: 'Maintenant, parlons de commodité. Tu veux passer une commande, mais tu t\'inquiètes que ce soit trop tard ou que tu n\'atteignes pas le minimum de commande ? Avec LAPA, ces problèmes n\'existent pas. Tranquille, commande aujourd\'hui et demain ta crème de ricotta sera à ta porte. Et nous ne te demandons pas de minimum de commande. Commande ce que tu veux, quand tu veux. Pourquoi devrais-tu te contenter ou aller faire tes courses au discount ?',
        en_US: 'Now, let\'s talk about convenience. You want to place an order, but you\'re worried it\'s too late or that you won\'t reach the minimum order? With LAPA, those problems don\'t exist. Don\'t worry, order today and tomorrow your ricotta cream will be at your door. And we don\'t ask for a minimum order. Order what you want, when you want. Why should you settle or go shopping at the discount store?'
      };
    }
    else if (src.includes('Inoltre, con la nostra WEB APP per gli ordini')) {
      t[src] = {
        de_CH: 'Außerdem kannst du mit unserer WEB APP für Bestellungen bequem und schnell bestellen, mit einer Bestellhistorie und Warenübersicht, Dokumenten und vielem mehr griffbereit.',
        fr_CH: 'De plus, avec notre WEB APP pour les commandes, tu peux commander confortablement et rapidement, avec un historique des commandes et de la marchandise, des documents et bien plus à portée de main.',
        en_US: 'Plus, with our WEB APP for orders, you can order comfortably and quickly, with order and goods history, documents and much more at your fingertips.'
      };
    }
    else if (src.includes('E per i ristoratori che vogliono davvero distinguersi')) {
      t[src] = {
        de_CH: 'Und für Gastronomen, die sich wirklich abheben wollen, bieten wir V.I.P.-Services an. Du bist kein gewöhnlicher Kunde, also warum solltest du als solcher behandelt werden?',
        fr_CH: 'Et pour les restaurateurs qui veulent vraiment se distinguer, nous offrons des services V.I.P. Tu n\'es pas un client ordinaire, alors pourquoi devrais-tu être traité comme tel ?',
        en_US: 'And for restaurateurs who really want to stand out, we offer V.I.P. services. You\'re not just any customer, so why should you be treated like one?'
      };
    }
    else if (src.includes('Non dimenticare, consegniamo dal lunedì al sabato')) {
      t[src] = {
        de_CH: 'Vergiss nicht, wir liefern von Montag bis Samstag. Du musst dir keine Sorgen machen, wann du bestellst, denn du kannst es jederzeit tun! Und wenn du auf ein Problem stößt? Keine Sorge. Wir haben ein Beraterteam, das bereit ist, dir zu helfen. Schließlich ist dein Erfolg unser Erfolg.',
        fr_CH: 'N\'oublie pas, nous livrons du lundi au samedi. Tu n\'as pas à te soucier de programmer quand commander parce que tu peux le faire tout le temps ! Et si tu rencontres un problème ? Ne t\'inquiète pas. Nous avons une équipe de conseillers prêts à t\'aider. Après tout, ton succès est notre succès.',
        en_US: 'Don\'t forget, we deliver from Monday to Saturday. You don\'t have to worry about scheduling when to order because you can do it anytime! And if you encounter a problem? Don\'t worry. We have a team of consultants ready to help you. After all, your success is our success.'
      };
    }
    else if (src.includes('E se incontri un problema?')) {
      t[src] = {
        de_CH: 'Und wenn du auf ein Problem stößt? Keine Sorge. Wir haben ein Beraterteam, das bereit ist, dir zu helfen. Schließlich ist dein Erfolg unser Erfolg.',
        fr_CH: 'Et si tu rencontres un problème ? Ne t\'inquiète pas. Nous avons une équipe de conseillers prêts à t\'aider. Après tout, ton succès est notre succès.',
        en_US: 'And if you encounter a problem? Don\'t worry. We have a team of consultants ready to help you. After all, your success is our success.'
      };
    }
    else if (src.includes('Scopri la differenza di lavorare con LAPA')) {
      t[src] = {
        de_CH: 'Entdecke den Unterschied mit LAPA zu arbeiten. Wir bieten nicht nur die gezuckerte Schafsmilch-Ricotta-Creme tiefgefroren im Spritzbeutel für dein Lokal an, sondern geben dir und deinem Geschäft die Aufmerksamkeit und Unterstützung, die ihr verdient.',
        fr_CH: 'Découvre la différence de travailler avec LAPA. Non seulement nous offrons la Crème de Ricotta de Brebis Sucrée Congelée en Sac à Poche pour ton établissement, mais nous te donnons, à toi et à ton activité, l\'attention et l\'assistance que vous méritez.',
        en_US: 'Discover the difference of working with LAPA. Not only do we offer the Sweetened Sheep\'s Milk Ricotta Cream Frozen in Piping Bag for your venue, but we give you and your business the attention and assistance you deserve.'
      };
    }
    else if (src.includes('E ora, vuoi continuare a fare le cose come al solito')) {
      t[src] = {
        de_CH: 'Und jetzt, willst du weiter die Dinge wie immer machen, oder bist du bereit, die Spielregeln zu ändern? Hinterlasse unten einen Kommentar und sag mir, was du denkst.',
        fr_CH: 'Et maintenant, veux-tu continuer à faire les choses comme d\'habitude, ou es-tu prêt à changer les règles du jeu ? Laisse un commentaire ci-dessous et dis-moi ce que tu en penses.',
        en_US: 'And now, do you want to keep doing things as usual, or are you ready to change the rules of the game? Leave a comment below and tell me what you think.'
      };
    }
    else if (src.includes('Nel frattempo, pensa a tutti quei clienti')) {
      t[src] = {
        de_CH: 'In der Zwischenzeit denke an all diese Kunden, die darauf warten, deine Desserts mit unserer gezuckerten Schafsmilch-Ricotta-Creme zu probieren. Du weißt, dass sie es kaum erwarten können!',
        fr_CH: 'En attendant, pense à tous ces clients qui attendent de goûter tes desserts avec notre Crème de Ricotta de Brebis Sucrée. Tu sais qu\'ils ont hâte !',
        en_US: 'In the meantime, think about all those customers who are waiting to try your desserts with our Sweetened Sheep\'s Milk Ricotta Cream. You know they can\'t wait!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 29: CREMA DI RICOTTA DI PECORA ===\n');

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

  console.log('\n✅ ARTICOLO 29 COMPLETATO!');
}

main();
