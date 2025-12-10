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

const POST_ID = 30;

const TITLE_TRANSLATIONS = {
  it_IT: "🍖 Culatta Stagionata o Culatello con Cotenna: Un Tesoro Esclusivo dell'Emilia Occidentale per il Tuo Menù! 🇮🇹",
  de_CH: "🍖 Gereifte Culatta oder Culatello mit Schwarte: Ein exklusiver Schatz aus der westlichen Emilia für Ihr Menü! 🇮🇹",
  fr_CH: "🍖 Culatta Affinée ou Culatello avec Couenne : Un Trésor Exclusif de l'Émilie Occidentale pour Votre Menu ! 🇮🇹",
  en_US: "🍖 Aged Culatta or Culatello with Rind: An Exclusive Treasure from Western Emilia for Your Menu! 🇮🇹"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Chiunque può servire del prosciutto')) {
      t[src] = {
        de_CH: 'Jeder kann Schinken servieren. Aber wie viele können ein Stück italienischer Kulinarikgeschichte wie den Culatello mit Schwarte auf ihrer Speisekarte vorweisen? 🤔 Wenn du deine Küche auf ein höheres Niveau bringen möchtest, dann ist dieser Beitrag für dich. 🚀',
        fr_CH: 'N\'importe qui peut servir du jambon. Mais combien peuvent se vanter d\'avoir sur leur menu un morceau d\'histoire culinaire italienne comme le Culatello avec Couenne ? 🤔 Si tu cherches à porter ta cuisine à un niveau supérieur, alors ce post est pour toi. 🚀',
        en_US: 'Anyone can serve prosciutto. But how many can boast on their menu a piece of Italian culinary history like Culatello with Rind? 🤔 If you\'re looking to take your cuisine to the next level, then this post is for you. 🚀'
      };
    }
    else if (src.includes('Il Culatello con Cotenna, noto anche come Culatta')) {
      t[src] = {
        de_CH: 'Der Culatello mit Schwarte, auch bekannt als Culatta oder Culaccia, ist eine exklusive Wurst aus den Provinzen Parma und Piacenza in der Emilia-Romagna. 🌍 Vergiss den gewöhnlichen Schinken, das ist etwas völlig anderes. Der Culatello mit Schwarte wird nicht in einen Darm gestopft, sondern wie Schinken mit Schmalz überzogen: eine Seite ist mit der Schwarte bedeckt, während auf der anderen Seite Schmalz aufgetragen wird.',
        fr_CH: 'Le Culatello avec Couenne, connu aussi comme Culatta ou Culaccia, est une charcuterie exclusive des provinces de Parme et Plaisance, en Émilie-Romagne. 🌍 Oublie le jambon ordinaire, c\'est quelque chose de complètement différent. Le Culatello avec Couenne n\'est pas embossé, mais enduit de saindoux comme le jambon : un côté est couvert par la couenne, tandis que sur l\'autre on ajoute le saindoux.',
        en_US: 'Culatello with Rind, also known as Culatta or Culaccia, is an exclusive cured meat from the provinces of Parma and Piacenza in Emilia-Romagna. 🌍 Forget ordinary prosciutto, this is something completely different. Culatello with Rind is not stuffed in casing, but larded like prosciutto: one side is covered by the rind, while on the other side lard is added.'
      };
    }
    else if (src.includes('Si tratta di un prodotto ottenuto dalla coscia posteriore del suino')) {
      t[src] = {
        de_CH: 'Es handelt sich um ein Produkt, das aus der Hinterkeule des Schweins 🐖 gewonnen wird, ähnlich dem Culatello di Zibello, aber mit einem einzigartigen und unverwechselbaren Geschmack. 12-18 Monate in natürlichen Kellern gereift, bietet der Culatello mit Schwarte einen raffinierten und köstlichen Geschmack 🤤, der am besten dünn geschnitten genossen wird, begleitet von Brot 🍞 und frischer Butter oder in Kombination mit Torta Fritta.',
        fr_CH: 'Il s\'agit d\'un produit obtenu à partir de la cuisse postérieure du porc 🐖, similaire au Culatello di Zibello, mais avec un goût unique et inimitable. Affiné pendant 12-18 mois dans des caves naturelles, le Culatello avec Couenne offre un goût sophistiqué et délicieux 🤤 qui s\'apprécie mieux tranché fin, accompagné de pain 🍞 et de beurre frais ou en association avec la torta fritta.',
        en_US: 'It\'s a product made from the rear leg of the pig 🐖, similar to Culatello di Zibello, but with a unique and unmistakable taste. Aged for 12-18 months in natural cellars, Culatello with Rind offers a sophisticated and delicious taste 🤤 that is best appreciated thinly sliced, accompanied by bread 🍞 and fresh butter or paired with torta fritta.'
      };
    }
    else if (src.includes('Però, attenzione! ⚠️ Non tutti i fornitori hanno il Culatello')) {
      t[src] = {
        de_CH: 'Aber Achtung! ⚠️ Nicht alle Lieferanten haben den Culatello mit Schwarte. Aber LAPA schon. Wir haben ihn nicht nur, wir liefern ihn dir persönlich, auch wenn dein Restaurant in Zürich liegt. Von Montag bis Samstag kommt deine Lieferung an. 🚚 Und mit LAPA gibt es keinen Mindestbestellwert. Du willst nur einen Culatello mit Schwarte? Kein Problem, du bekommst ihn.',
        fr_CH: 'Mais attention ! ⚠️ Tous les fournisseurs n\'ont pas le Culatello avec Couenne. Mais LAPA oui. Non seulement nous l\'avons, mais nous te le livrons personnellement, même si ton restaurant se trouve à Zurich. Du lundi au samedi, ta livraison arrive. 🚚 Et avec LAPA, il n\'existe pas de minimum de commande. Tu veux seulement un Culatello avec Couenne ? Pas de problème, tu l\'auras.',
        en_US: 'But beware! ⚠️ Not all suppliers have Culatello with Rind. But LAPA does. Not only do we have it, but we deliver it to you personally, even if your restaurant is in Zurich. From Monday to Saturday, your delivery arrives. 🚚 And with LAPA, there\'s no minimum order. You want just one Culatello with Rind? No problem, you\'ll have it.'
      };
    }
    else if (src.includes('Grazie alla nostra comoda WEB APP')) {
      t[src] = {
        de_CH: 'Dank unserer praktischen WEB APP 📱 kannst du deine personalisierte Produktliste erstellen und deine Bestellungen einfach verwalten. Und bei Zweifeln oder Problemen keine Sorge. Du hast immer unseren dedizierten Support-Service zur Verfügung, bereit, jeden Zweifel oder jedes Problem zu lösen. 🙌',
        fr_CH: 'Grâce à notre pratique WEB APP 📱, tu peux créer ta liste de produits personnalisée et gérer facilement tes commandes. Et en cas de doutes ou de problèmes, ne t\'inquiète pas. Tu as toujours à ta disposition notre service d\'assistance dédiée, prêt à résoudre tout doute ou problème. 🙌',
        en_US: 'Thanks to our convenient WEB APP 📱, you can create your personalized product list and easily manage your orders. And in case of doubts or problems, don\'t worry. You always have our dedicated support service available, ready to solve any doubt or problem. 🙌'
      };
    }
    else if (src.includes('Quindi, sei pronto a sperimentare qualcosa di veramente unico')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, etwas wirklich Einzigartiges auf deiner Speisekarte zu erleben? Bist du bereit, deine Kunden mit dem unverwechselbaren Geschmack des Culatello mit Schwarte zu begeistern? Bestelle heute 📅 und morgen hast du ihn in deiner Küche. 👩‍🍳👨‍🍳',
        fr_CH: 'Alors, es-tu prêt à expérimenter quelque chose de vraiment unique sur ton menu ? Es-tu prêt à épater tes clients avec la saveur inimitable du Culatello avec Couenne ? Commande aujourd\'hui 📅 et demain tu l\'auras dans ta cuisine. 👩‍🍳👨‍🍳',
        en_US: 'So, are you ready to experience something truly unique on your menu? Are you ready to amaze your customers with the unmistakable flavor of Culatello with Rind? Order today 📅 and tomorrow you\'ll have it in your kitchen. 👩‍🍳👨‍🍳'
      };
    }
    else if (src.includes('P.S. Sei un cliente LAPA? Hai già provato il Culatello')) {
      t[src] = {
        de_CH: 'P.S. Bist du ein LAPA-Kunde? Hast du den Culatello mit Schwarte schon in deinem Lokal probiert? Erzähl uns in den Kommentaren 👇 wie du dieses außergewöhnliche Produkt auf deiner Speisekarte verwendet hast. Wir können es kaum erwarten, deine Geschichte zu hören! 💬🎉',
        fr_CH: 'P.S. Es-tu un client LAPA ? As-tu déjà essayé le Culatello avec Couenne dans ton établissement ? Raconte-nous dans les commentaires 👇 comment tu as utilisé cet extraordinaire produit dans ton menu. Nous avons hâte d\'entendre ton histoire ! 💬🎉',
        en_US: 'P.S. Are you a LAPA customer? Have you already tried Culatello with Rind in your venue? Tell us in the comments 👇 how you\'ve used this extraordinary product on your menu. We can\'t wait to hear your story! 💬🎉'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 30: CULATELLO CON COTENNA ===\n');

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

  console.log('\n✅ ARTICOLO 30 COMPLETATO!');
}

main();
