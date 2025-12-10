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

const POST_ID = 34;

const TITLE_TRANSLATIONS = {
  it_IT: "Fritto Misto Mignon: L'Antipasto che Stupirà i tuoi Clienti! 🍴✨",
  de_CH: "Fritto Misto Mignon: Die Vorspeise, die deine Kunden begeistern wird! 🍴✨",
  fr_CH: "Fritto Misto Mignon : L'Entrée qui Épatera tes Clients ! 🍴✨",
  en_US: "Fritto Misto Mignon: The Appetizer That Will Amaze Your Customers! 🍴✨"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Senti l\'urgenza di rinfrescare il tuo menu')) {
      t[src] = {
        de_CH: 'Spürst du die Dringlichkeit, dein Menü aufzufrischen? 🔄 Strebst du danach, Vorspeisen zu servieren, die Ausrufe der Bewunderung hervorrufen? 🤩 Lass mich dir das Fritto Misto Mignon vorstellen, einen kulinarischen Schatz 🍽, der die Gaumen deiner Kunden verwöhnen wird.',
        fr_CH: 'Tu ressens l\'urgence de rafraîchir ton menu ? 🔄 Tu aspires à servir des entrées qui suscitent des exclamations de merveille ? 🤩 Laisse-moi te présenter le Fritto Misto Mignon, un trésor culinaire 🍽 qui titillera les palais de tes clients.',
        en_US: 'Feeling the urgency to refresh your menu? 🔄 Aspiring to serve appetizers that elicit exclamations of wonder? 🤩 Let me introduce you to Fritto Misto Mignon, a culinary treasure 🍽 that will tantalize your customers\' palates.'
      };
    }
    else if (src.includes('Immagina di servire olive ascolane croccanti')) {
      t[src] = {
        de_CH: 'Stell dir vor, knusprige Ascolana-Oliven, Mini-Kartoffelkroketten und Mignon-Arancini zu servieren 🍢. Diese kleinen Köstlichkeiten, golden und knusprig, werden nicht nur dein Menü 📜 revolutionieren, sondern auch das kulinarische Erlebnis deiner Kunden. Und der beste Teil? Du musst nicht den ganzen Tag in der Küche verbringen 🕓. Bringe das Öl einfach auf 180°C und frittiere sie goldbraun 😋. Im Handumdrehen hast du eine Palette unwiderstehlicher Vorspeisen, servierfertig 🍽.',
        fr_CH: 'Imagine servir des olives ascolane croustillantes, des mini croquettes de pommes de terre et des arancini mignon 🍢. Ces petits délices, dorés et croustillants, révolutionneront non seulement ton menu 📜, mais aussi l\'expérience culinaire de tes clients. Et le meilleur ? Tu n\'as pas besoin de passer toute la journée en cuisine 🕓. Il suffit de porter l\'huile à 180°C et de les frire jusqu\'à ce qu\'ils soient dorés 😋. En un rien de temps, tu auras une gamme d\'entrées irrésistibles prêtes à être servies 🍽.',
        en_US: 'Imagine serving crispy Ascolana olives, mini potato croquettes and mignon arancini 🍢. These little delights, golden and crispy, will not only revolutionize your menu 📜, but also your customers\' culinary experience. And the best part? You don\'t need to spend all day in the kitchen 🕓. Just bring the oil to 180°C and fry them until golden 😋. In no time, you\'ll have a range of irresistible appetizers ready to be served 🍽.'
      };
    }
    else if (src.includes('E se stai pensando che ordinare questi prodotti possa essere un problema')) {
      t[src] = {
        de_CH: 'Und wenn du denkst, dass das Bestellen dieser Produkte ein Problem sein könnte, denk nochmal nach! Mit LAPA musst du dir keine Sorgen um Mindestbestellmengen machen 📦. Bestelle was du willst, wann du willst 🗓. Und falls du vergisst, deine Bestellung aufzugeben, keine Sorge. Bestelle heute und erhalte morgen, dank unseres Lieferservices 6 von 7 Tagen 🚚.',
        fr_CH: 'Et si tu penses que commander ces produits pourrait être un problème, détrompe-toi ! Avec LAPA, tu n\'as pas à te soucier des minimums de commande 📦. Commande ce que tu veux, quand tu veux 🗓. Et si par hasard tu oublies de passer ta commande, ne t\'inquiète pas. Commande aujourd\'hui et reçois demain, grâce à notre service de livraison 6 jours sur 7 🚚.',
        en_US: 'And if you\'re thinking that ordering these products might be a problem, think again! With LAPA, you don\'t have to worry about minimum orders 📦. Order what you want, when you want 🗓. And if by chance you forget to place your order, don\'t worry. Order today and receive tomorrow, thanks to our delivery service 6 out of 7 days 🚚.'
      };
    }
    else if (src.includes('Ma non finisce qui 🚀. Come cliente LAPA')) {
      t[src] = {
        de_CH: 'Aber das ist noch nicht alles 🚀. Als LAPA-Kunde hast du Zugang zu einer personalisierten Preisliste, mit Preisen, die nach Häufigkeit und Volumen gestaffelt sind 💰. Du kannst deine Bestellungen bequem über unsere praktische WEB APP aufgeben 📲, mit der Möglichkeit, die Bestellhistorie und vieles mehr einzusehen. Und wenn du Hilfe brauchst, steht dir immer ein Berater zur Seite 🙋‍♂️.',
        fr_CH: 'Mais ce n\'est pas fini 🚀. En tant que client LAPA, tu auras accès à un tarif personnalisé, avec des prix modulés selon la fréquence et le volume 💰. Tu pourras passer tes commandes confortablement via notre pratique WEB APP 📲, avec la possibilité de visualiser l\'historique des commandes et bien plus. Et si tu as besoin d\'assistance, un conseiller est toujours prêt à t\'aider 🙋‍♂️.',
        en_US: 'But it doesn\'t end there 🚀. As a LAPA customer, you\'ll have access to a personalized price list, with prices adjusted based on frequency and volume 💰. You can place your orders conveniently through our handy WEB APP 📲, with the ability to view order history and much more. And if you need assistance, a consultant is always ready to help you 🙋‍♂️.'
      };
    }
    else if (src.includes('Allora, cosa aspetti? Lasciati stupire dal Fritto Misto Mignon')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Lass dich vom Fritto Misto Mignon begeistern und begeistere deine Kunden 😍. Wir sind bereit, dein Geschäft auf das nächste Level zu heben 🚀. Denk daran, die kulinarische Revolution beginnt auf dem Teller! 🍽',
        fr_CH: 'Alors, qu\'attends-tu ? Laisse-toi surprendre par le Fritto Misto Mignon et surprends tes clients 😍. Nous sommes prêts à porter ton activité au niveau supérieur 🚀. Rappelle-toi, la révolution culinaire commence dans l\'assiette ! 🍽',
        en_US: 'So, what are you waiting for? Let yourself be amazed by Fritto Misto Mignon and amaze your customers 😍. We\'re ready to take your business to the next level 🚀. Remember, the culinary revolution starts on the plate! 🍽'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 34: FRITTO MISTO MIGNON ===\n');

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

  console.log('\n✅ ARTICOLO 34 COMPLETATO!');
}

main();
