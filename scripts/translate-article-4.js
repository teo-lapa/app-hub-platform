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

const POST_ID = 4;

// Traduzioni titolo
const TITLE_TRANSLATIONS = {
  it_IT: "LAPA è Disponibilità, Rapidità, Puntualità.",
  de_CH: "LAPA bedeutet Verfügbarkeit, Schnelligkeit, Pünktlichkeit.",
  fr_CH: "LAPA c'est Disponibilité, Rapidité, Ponctualité.",
  en_US: "LAPA means Availability, Speed, Punctuality."
};

// Traduzioni dei segmenti
const TRANSLATIONS = {
  "«Da un anno e mezzo lavoro con la Luigia di Ginevra, gestisco quello che sono assunzioni, planning e acquisti»": {
    de_CH: "«Seit anderthalb Jahren arbeite ich bei der Luigia in Genf, ich kümmere mich um Einstellungen, Planung und Einkäufe»",
    fr_CH: "«Depuis un an et demi je travaille avec la Luigia de Genève, je gère les embauches, la planification et les achats»",
    en_US: "«For a year and a half I've been working with Luigia in Geneva, I manage hiring, planning and purchasing»"
  },

  "«Lavoro con Lapa da quando ho preso la gestione della Luigia di Ginevra e penso che ci sia una grande collaborazione e penso che comunque …anzi non è che penso è un dato di fatto che Lapa cerchi di fare sempre il massimo per soddisfare i miei bisogni e le mie richieste.»": {
    de_CH: "«Ich arbeite mit Lapa zusammen, seit ich die Leitung der Luigia in Genf übernommen habe, und ich denke, dass es eine großartige Zusammenarbeit gibt, und ich denke, dass... eigentlich denke ich nicht nur, es ist eine Tatsache, dass Lapa immer versucht, das Maximum zu tun, um meine Bedürfnisse und Anfragen zu erfüllen.»",
    fr_CH: "«Je travaille avec Lapa depuis que j'ai pris la gestion de la Luigia de Genève et je pense qu'il y a une grande collaboration et je pense que de toute façon... en fait ce n'est pas que je pense, c'est un fait que Lapa essaie toujours de faire le maximum pour satisfaire mes besoins et mes demandes.»",
    en_US: "«I've been working with Lapa since I took over the management of Luigia in Geneva and I think there's great collaboration and I think that anyway... actually it's not that I think, it's a fact that Lapa always tries to do their best to satisfy my needs and requests.»"
  },

  "«Io ho sempre fatto presente all'azienda (Luigia) ,come responsabile di questo ristorante, che la collaborazione che ho io con Lapa, penso che ad oggi nel package di tutti i fornitori ha la Luigia, Lapa spicca ai primi posti per puntualità, servizi, chiarezza, disponibilità e richieste particolari. Io non ho mai avuto nessun problema e mel momento in cui c'è stato un problema da parte di Lapa c'è sempre stato impegno nel cercare una soluzione nel minor tempo possibile.»": {
    de_CH: "«Als Verantwortlicher dieses Restaurants habe ich dem Unternehmen (Luigia) immer mitgeteilt, dass unter allen Lieferanten, die Luigia hat, Lapa an erster Stelle steht für Pünktlichkeit, Service, Klarheit, Verfügbarkeit und besondere Anfragen. Ich hatte nie Probleme, und wenn es ein Problem von Seiten Lapas gab, gab es immer das Engagement, eine Lösung in kürzester Zeit zu finden.»",
    fr_CH: "«En tant que responsable de ce restaurant, j'ai toujours fait savoir à l'entreprise (Luigia) que parmi tous les fournisseurs qu'a Luigia, Lapa se distingue aux premières places pour la ponctualité, les services, la clarté, la disponibilité et les demandes particulières. Je n'ai jamais eu de problème et quand il y a eu un problème de la part de Lapa, il y a toujours eu l'engagement de trouver une solution dans les plus brefs délais.»",
    en_US: "«As the manager of this restaurant, I've always made it clear to the company (Luigia) that among all the suppliers Luigia has, Lapa stands out at the top for punctuality, services, clarity, availability and special requests. I've never had any problems and when there was a problem from Lapa's side, there was always commitment to finding a solution in the shortest time possible.»"
  },

  "«Avendo un punto di riferimento costante, riesco con un semplice sms o chiamata a recuperare, ciò che sono le derrate alimentari che l'azienda mi chiede di recuperare. Se mi avete semplificato la vita? Beh assolutamente SI.»": {
    de_CH: "«Da ich einen konstanten Ansprechpartner habe, kann ich mit einer einfachen SMS oder einem Anruf das besorgen, was das Unternehmen von mir verlangt. Ob ihr mir das Leben vereinfacht habt? Absolut JA.»",
    fr_CH: "«Ayant un point de référence constant, je réussis avec un simple SMS ou appel à récupérer les denrées alimentaires que l'entreprise me demande de récupérer. Si vous m'avez simplifié la vie ? Eh bien absolument OUI.»",
    en_US: "«Having a constant point of reference, I can get what the company asks me to get with a simple text or call. Have you simplified my life? Well absolutely YES.»"
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 4: TESTIMONIANZA KEOMA BIGON ===\n');

  // 1. Aggiorno titolo per ogni lingua
  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  // 2. Leggo i segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Applico traduzioni per ogni lingua
  console.log('3. Applico traduzioni contenuto...');
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
    console.log(`   ${lang}: ${count} segmenti tradotti`);
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 50);
    console.log(`[${lang}] ${title}`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 4 COMPLETATO!');
}

main();
