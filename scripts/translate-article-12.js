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

const POST_ID = 12;

const TITLE_TRANSLATIONS = {
  it_IT: "7 passi per selezionare il personale giusto per il tuo ristorante",
  de_CH: "7 Schritte zur Auswahl des richtigen Personals für Ihr Restaurant",
  fr_CH: "7 étapes pour sélectionner le bon personnel pour votre restaurant",
  en_US: "7 steps to select the right staff for your restaurant"
};

// Funzione per creare traduzioni basate sui source esatti
function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Caro imprenditore')) {
      t[src] = {
        de_CH: '<strong><span style="font-size: 24px;">Lieber Unternehmer, Verantwortlicher........ </span></strong>',
        fr_CH: '<strong><span style="font-size: 24px;">Cher entrepreneur, responsable........ </span></strong>',
        en_US: '<strong><span style="font-size: 24px;">Dear entrepreneur, manager........ </span></strong>'
      };
    }
    else if (src.includes('Siamo consapevoli che trovare il personale')) {
      t[src] = {
        de_CH: 'Wir sind uns bewusst, dass es eine Herausforderung sein kann, das richtige Personal für Ihr Restaurant zu finden. Wir möchten jedoch die Bedeutung der Personalauswahl für den Erfolg Ihres Unternehmens betonen.',
        fr_CH: 'Nous sommes conscients que trouver le bon personnel pour votre restaurant peut être un défi. Cependant, nous voulons souligner l\'importance de la sélection du personnel pour le succès de votre entreprise.',
        en_US: 'We are aware that finding the right staff for your restaurant can be a challenge. However, we want to emphasize the importance of staff selection for the success of your business.'
      };
    }
    else if (src.includes('Il personale del ristorante è il volto')) {
      t[src] = {
        de_CH: 'Das Personal des Restaurants ist das Gesicht des Unternehmens und repräsentiert das kulinarische Erlebnis, das Sie anbieten. Eine gute Personalauswahl kann den Unterschied zwischen einem zufriedenen und einem unzufriedenen Kunden ausmachen. Darüber hinaus sind die Mitarbeiter das Herz der Organisation und tragen zur Schaffung einer positiven Arbeitsatmosphäre bei.',
        fr_CH: 'Le personnel du restaurant est le visage de l\'entreprise et représente l\'expérience culinaire que vous offrez. Une bonne sélection du personnel peut faire la différence entre un client satisfait et un client insatisfait. De plus, les employés sont le cœur de l\'organisation et contribuent à la création d\'une atmosphère de travail positive.',
        en_US: 'The restaurant staff is the face of the company and represents the culinary experience you offer. Good staff selection can make the difference between a satisfied customer and an unsatisfied customer. Furthermore, employees are the heart of the organization and contribute to creating a positive work atmosphere.'
      };
    }
    else if (src.includes('Inoltre, un altro aspetto importante')) {
      t[src] = {
        de_CH: '<span style="color: rgb(55, 65, 81);background-color: rgb(247, 247, 248)">Darüber hinaus ist ein weiterer wichtiger Aspekt für entspanntere und weniger gestresste Mitarbeiter die Wahl eines zuverlässigen und umfassenden Lebensmittellieferanten, der tägliche Lieferungen und eine breite Produktpalette garantieren kann.</span>',
        fr_CH: '<span style="color: rgb(55, 65, 81);background-color: rgb(247, 247, 248)">De plus, un autre aspect important à considérer pour avoir des employés plus détendus et moins stressés est le choix d\'un fournisseur alimentaire fiable et complet, capable de garantir des livraisons quotidiennes et une large gamme de produits.</span>',
        en_US: '<span style="color: rgb(55, 65, 81);background-color: rgb(247, 247, 248)">Furthermore, another important aspect to consider for having more relaxed and less stressed employees is the choice of a reliable and complete food supplier, who can guarantee daily deliveries and a wide range of products.</span>'
      };
    }
    else if (src.includes('Per garantire il successo del tuo ristorante')) {
      t[src] = {
        de_CH: 'Um den Erfolg Ihres Restaurants zu gewährleisten, empfehlen wir Ihnen, Zeit in die Auswahl des richtigen Personals zu investieren. Suchen Sie nach Personen mit Erfahrung und Leidenschaft für den Lebensmittelsektor, mit einer positiven Einstellung und Kundenserviceorientierung. Darüber hinaus ist es wichtig, die Fähigkeiten und Qualitäten der Kandidaten zu bewerten.',
        fr_CH: 'Pour garantir le succès de votre restaurant, nous vous conseillons d\'investir du temps dans la sélection du bon personnel. Recherchez des personnes avec de l\'expérience et de la passion pour le secteur alimentaire, avec une attitude positive et une orientation vers le service client. De plus, il est important d\'évaluer les compétences et les qualités des candidats.',
        en_US: 'To ensure the success of your restaurant, we recommend investing time in selecting the right staff. Look for people with experience and passion for the food sector, with a positive attitude and customer service orientation. Furthermore, it is important to evaluate the skills and qualities of candidates.'
      };
    }
    else if (src.includes('Ricorda che una buona selezione del personale')) {
      t[src] = {
        de_CH: 'Denken Sie daran, dass eine gute Personalauswahl nicht nur das Kundenerlebnis verbessert, sondern auch die Produktivität und Zufriedenheit der Mitarbeiter steigert. In die Personalauswahl zu investieren kann den Unterschied zwischen Erfolg und Misserfolg Ihres Restaurants ausmachen.',
        fr_CH: 'N\'oubliez pas qu\'une bonne sélection du personnel non seulement améliore l\'expérience des clients, mais augmente également la productivité et la satisfaction des employés. Investir dans la sélection du personnel peut faire la différence entre le succès et l\'échec de votre restaurant.',
        en_US: 'Remember that good staff selection not only improves the customer experience, but also increases employee productivity and satisfaction. Investing in staff selection can make the difference between success and failure of your restaurant.'
      };
    }
    else if (src === '7 passi') {
      t[src] = {
        de_CH: '7 Schritte',
        fr_CH: '7 étapes',
        en_US: '7 steps'
      };
    }
    else if (src.includes('Analizza il profilo richiesto')) {
      t[src] = {
        de_CH: 'Analysieren Sie das erforderliche Profil für die offene Stelle: Bevor Sie mit dem Personalauswahlprozess beginnen, ist es wichtig, genau zu verstehen, welches professionelle Profil Sie suchen. Wenn Sie zum Beispiel einen Koch suchen, bewerten Sie die für diese Position erforderlichen Kompetenzen und Erfahrungen.',
        fr_CH: 'Analysez le profil requis pour le poste ouvert : Avant de commencer le processus de sélection du personnel, il est important de comprendre exactement quel profil professionnel vous recherchez. Par exemple, si vous recherchez un cuisinier, évaluez les compétences et les expériences nécessaires pour ce poste.',
        en_US: 'Analyze the required profile for the open position: Before starting the staff selection process, it is important to understand exactly what professional profile you are looking for. For example, if you are looking for a cook, evaluate the skills and experience required for that position.'
      };
    }
    else if (src.includes('Pubblica l\'offerta di lavoro')) {
      t[src] = {
        de_CH: 'Veröffentlichen Sie das Stellenangebot: Veröffentlichen Sie das Stellenangebot auf Jobportalen oder in sozialen Medien und geben Sie die erforderlichen Kompetenzen, die Aufgaben und Verantwortlichkeiten der Rolle, das erforderliche Erfahrungsniveau und die Arbeitszeiten an. Vergessen Sie nicht, auch die persönlichen Qualitäten anzugeben, die Sie suchen.',
        fr_CH: 'Publiez l\'offre d\'emploi : Publiez l\'offre d\'emploi sur des sites d\'annonces d\'emploi ou sur les réseaux sociaux, en précisant les compétences requises, les tâches et responsabilités du rôle, le niveau d\'expérience requis et les horaires de travail. N\'oubliez pas de préciser également les qualités personnelles que vous recherchez.',
        en_US: 'Post the job offer: Post the job offer on job listing websites or social media, specifying the required skills, tasks and responsibilities of the role, required experience level, and working hours. Remember to also specify the personal qualities you are looking for.'
      };
    }
    else if (src.includes('Analizza i CV e le candidature')) {
      t[src] = {
        de_CH: 'Analysieren Sie die Lebensläufe und Bewerbungen: Nachdem Sie die Bewerbungen erhalten haben, analysieren Sie die Lebensläufe und Anschreiben, um die am besten geeigneten Kandidaten auszuwählen. Bewerten Sie ihre Berufserfahrungen und Kompetenzen sorgfältig und stellen Sie sicher, dass sie den Anforderungen der Position entsprechen.',
        fr_CH: 'Analysez les CV et les candidatures : Une fois les candidatures reçues, analysez les CV et les lettres de motivation pour sélectionner les candidats les plus appropriés. Évaluez attentivement leurs expériences professionnelles et leurs compétences, en vous assurant qu\'elles correspondent aux exigences du poste.',
        en_US: 'Analyze CVs and applications: After receiving the applications, analyze the CVs and cover letters to select the most suitable candidates. Carefully evaluate their work experiences and skills, making sure they are in line with the position requirements.'
      };
    }
    else if (src.includes('Conduci un\'intervista')) {
      t[src] = {
        de_CH: 'Führen Sie ein Vorstellungsgespräch: Vereinbaren Sie einen Termin für ein Vorstellungsgespräch mit den Kandidaten, die die Auswahlphase bestanden haben. Das Vorstellungsgespräch ermöglicht es Ihnen, die Kompetenzen und Erfahrungen der Kandidaten zu vertiefen, aber auch ihre persönlichen Qualitäten zu bewerten. Versuchen Sie, offene Fragen zu stellen und eine entspannte Atmosphäre zu schaffen.',
        fr_CH: 'Menez un entretien : Fixez un rendez-vous pour un entretien avec les candidats qui ont passé la phase de sélection. L\'entretien vous permettra d\'approfondir les compétences et les expériences des candidats, mais aussi d\'évaluer leurs qualités personnelles. Essayez de poser des questions ouvertes et de créer une atmosphère détendue.',
        en_US: 'Conduct an interview: Schedule an appointment for an interview with the candidates who passed the selection phase. The interview will allow you to deepen the skills and experiences of the candidates, but also to evaluate their personal qualities. Try to ask open questions and create a relaxed atmosphere.'
      };
    }
    else if (src.includes('Fai un test pratico')) {
      t[src] = {
        de_CH: 'Machen Sie einen praktischen Test: Um die Kompetenzen der Kandidaten zu bewerten, können Sie einen praktischen Test organisieren. Für einen Koch könnten Sie zum Beispiel darum bitten, ein Gericht oder ein komplettes Menü zuzubereiten. So können Sie ihre technischen Fähigkeiten und ihre Fähigkeit, Zeit und Stress zu bewältigen, bewerten.',
        fr_CH: 'Faites un test pratique : Pour évaluer les compétences des candidats, vous pouvez organiser un test pratique. Par exemple, pour un cuisinier, vous pourriez lui demander de préparer un plat ou un menu complet. De cette façon, vous pourrez évaluer son habileté technique et sa capacité à gérer le temps et le stress.',
        en_US: 'Do a practical test: To evaluate the skills of candidates, you can organize a practical test. For example, for a cook, you could ask them to prepare a dish or a complete menu. This way, you can evaluate their technical ability and their ability to manage time and stress.'
      };
    }
    else if (src.includes('Controlla i riferimenti')) {
      t[src] = {
        de_CH: 'Überprüfen Sie die Referenzen: Bevor Sie einen neuen Mitarbeiter einstellen, überprüfen Sie immer seine Referenzen, also seine früheren Arbeitgeber. So können Sie die Richtigkeit der vom Kandidaten angegebenen Informationen überprüfen und seine Qualitäten und sein Potenzial besser verstehen.',
        fr_CH: 'Vérifiez les références : Avant d\'embaucher un nouvel employé, vérifiez toujours ses références, c\'est-à-dire ses anciens employeurs. Cela vous permettra de vérifier la véracité des informations fournies par le candidat et de mieux comprendre ses qualités et son potentiel.',
        en_US: 'Check references: Before hiring a new employee, always check their references, i.e. their previous employers. This will allow you to verify the accuracy of the information provided by the candidate and better understand their qualities and potential.'
      };
    }
    else if (src.includes('Scegli il candidato giusto')) {
      t[src] = {
        de_CH: 'Wählen Sie den richtigen Kandidaten: Am Ende des Auswahlprozesses wählen Sie den Kandidaten, der Ihren Anforderungen am besten entspricht und der die erforderlichen Kompetenzen und persönlichen Qualitäten für die Position nachgewiesen hat. Machen Sie ein Stellenangebot und definieren Sie die Vertragsbedingungen.',
        fr_CH: 'Choisissez le bon candidat : À la fin du processus de sélection, choisissez le candidat qui répond le mieux à vos besoins et qui a démontré avoir les compétences et les qualités personnelles nécessaires pour le poste. Faites une offre d\'emploi et définissez les conditions contractuelles.',
        en_US: 'Choose the right candidate: At the end of the selection process, choose the candidate who best meets your needs and who has demonstrated having the skills and personal qualities needed for the position. Make a job offer and define the contractual conditions.'
      };
    }
    else if (src.includes('Ricorda che la selezione del personale è un processo')) {
      t[src] = {
        de_CH: 'Denken Sie daran, dass die Personalauswahl ein grundlegender Prozess für den Erfolg Ihres Restaurants ist, also nehmen Sie sich die nötige Zeit, um jede Bewerbung sorgfältig zu bewerten und den richtigen Kandidaten für die Position auszuwählen.',
        fr_CH: 'N\'oubliez pas que la sélection du personnel est un processus fondamental pour le succès de votre restaurant, alors prenez le temps nécessaire pour évaluer attentivement chaque candidature et choisir le bon candidat pour le poste.',
        en_US: 'Remember that staff selection is a fundamental process for the success of your restaurant, so take the time necessary to carefully evaluate each application and choose the right candidate for the position.'
      };
    }
    else if (src.includes('importante') && src.includes('fornitore di alimentari')) {
      t[src] = {
        de_CH: '<span style="" class="bg-o-color-1 text-black">wichtig<br><b>Sicherlich ist die Personalauswahl grundlegend für den Erfolg Ihres Restaurants. Und wir, als Lebensmittellieferant, möchten die Bedeutung eines flexiblen und zuverlässigen Service betonen, um den Druck und die Verantwortung auf Ihre Mitarbeiter zu reduzieren.</b></span>',
        fr_CH: '<span style="" class="bg-o-color-1 text-black">important<br><b>Certainement, la sélection du personnel est fondamentale pour le succès de votre restaurant. Et nous, en tant que fournisseur alimentaire, voulons souligner l\'importance de fournir un service flexible et fiable pour aider à réduire la pression et la responsabilité sur votre personnel.</b></span>',
        en_US: '<span style="" class="bg-o-color-1 text-black">important<br><b>Certainly, staff selection is fundamental for the success of your restaurant. And we, as a food supplier, want to emphasize the importance of providing a flexible and reliable service to help reduce the pressure and responsibility on your staff.</b></span>'
      };
    }
    else if (src.includes('Il segreto del successo')) {
      t[src] = {
        de_CH: '<font style="color: rgb(255, 0, 0);">Das Geheimnis des Erfolgs Ihres Restaurants</font>\n\n<br>',
        fr_CH: '<font style="color: rgb(255, 0, 0);">Le secret du succès de votre restaurant</font>\n\n<br>',
        en_US: '<font style="color: rgb(255, 0, 0);">The secret to the success of your restaurant</font>\n\n<br>'
      };
    }
    else if (src.includes('Senza un servizio di fornitura alimentare completo')) {
      t[src] = {
        de_CH: 'Ohne einen vollständigen, zuverlässigen und flexiblen Lebensmittellieferservice könnte Ihr Restaurant Schwierigkeiten haben, die Qualität und Vielfalt der angebotenen Produkte aufrechtzuerhalten. Dies könnte Stress und Druck auf Ihr Personal verursachen, das die Suche nach Lieferanten verwalten müsste.',
        fr_CH: 'Sans un service de fourniture alimentaire complet, fiable et flexible, votre restaurant pourrait avoir des difficultés à maintenir la qualité et la variété des produits offerts aux clients. Cela pourrait causer du stress et de la pression sur votre personnel, qui devrait gérer la recherche de fournisseurs.',
        en_US: 'Without a complete, reliable and flexible food supply service, your restaurant could have difficulty maintaining the quality and variety of products offered to customers. This could cause stress and pressure on your staff, who would have to manage the search for suppliers.'
      };
    }
    else if (src.includes('Senza un fornitore di alimentari affidabile')) {
      t[src] = {
        de_CH: 'Ohne einen zuverlässigen und flexiblen Lebensmittellieferanten könnten Sie auch gezwungen sein, Kompromisse einzugehen, wie den Kauf von Produkten minderer Qualität oder begrenzter Auswahl, was die Qualität Ihres Menüs negativ beeinflussen könnte. Darüber hinaus müssten Sie wertvolle Ressourcen wie Zeit und Personal für die Lieferantensuche einsetzen.',
        fr_CH: 'Sans un fournisseur alimentaire fiable et flexible, vous pourriez également être contraint de faire des choix de compromis, comme l\'achat de produits de qualité inférieure ou limités, ce qui pourrait affecter négativement la qualité de votre menu. De plus, vous devriez engager des ressources précieuses, comme du temps et du personnel, pour la recherche de fournisseurs.',
        en_US: 'Without a reliable and flexible food supplier, you might also be forced to make compromise choices, such as purchasing lower quality or limited products, which could negatively affect the quality of your menu. Furthermore, you would have to commit valuable resources, such as time and staff, to searching for suppliers.'
      };
    }
    else if (src.includes('In sintesi, un servizio di fornitura alimentare')) {
      t[src] = {
        de_CH: 'Zusammenfassend ist ein zuverlässiger und flexibler Lebensmittellieferservice grundlegend für den Erfolg Ihres Restaurants, da er Ihnen helfen kann, den Druck und die Verantwortung auf Ihr Personal zu reduzieren, die Qualität der angebotenen Produkte zu gewährleisten und Ihnen ermöglicht, sich auf das Kerngeschäft zu konzentrieren.',
        fr_CH: 'En résumé, un service de fourniture alimentaire fiable et flexible est fondamental pour le succès de votre restaurant, car il peut vous aider à réduire la pression et la responsabilité sur votre personnel, garantir la qualité des produits offerts à vos clients et vous permettre de vous concentrer sur le cœur de votre activité.',
        en_US: 'In summary, a reliable and flexible food supply service is fundamental for the success of your restaurant, as it can help you reduce the pressure and responsibility on your staff, guarantee the quality of products offered to your customers and allow you to focus on the core business.'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 12: 7 PASSI SELEZIONE PERSONALE ===\n');

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

  console.log('\n✅ ARTICOLO 12 COMPLETATO!');
}

main();
