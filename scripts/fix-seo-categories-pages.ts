/**
 * Script per aggiornare Meta Tag SEO di Categorie e Pagine
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Auth failed');
  if (!data.result?.uid) throw new Error('Auth failed: Invalid credentials');

  console.log(`✅ Connesso a Odoo come ${ODOO_CONFIG.username} (UID: ${data.result.uid})`);
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: limit || 500 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore query ${model}: ${data.error.data?.message || data.error.message}`);
    return [];
  }
  return data.result || [];
}

async function write(model: string, ids: number[], values: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'write',
        args: [ids, values],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore write ${model}: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// ==================== CATEGORIE ====================

async function fixCategories() {
  console.log('\n📂 AGGIORNAMENTO SEO CATEGORIE');
  console.log('='.repeat(60));

  const categories = await searchRead('product.public.category',
    ['|', ['website_meta_title', '=', false], ['website_meta_description', '=', false]],
    ['id', 'name', 'parent_id']
  );

  console.log(`📊 Trovate ${categories.length} categorie da aggiornare`);

  let updated = 0;
  for (const cat of categories) {
    const name = cat.name;

    // Genera meta tag per categoria
    const metaTitle = `${name} | Prodotti Italiani | LAPA Grossista Svizzera`;
    const metaDescription = `Scopri la nostra selezione di ${name.toLowerCase()} italiani. LAPA: grossista di prodotti alimentari italiani in Svizzera. Qualità, freschezza e consegna rapida per ristoranti.`;

    const success = await write('product.public.category', [cat.id], {
      website_meta_title: metaTitle.substring(0, 60),
      website_meta_description: metaDescription.substring(0, 160),
      website_meta_keywords: `${name.toLowerCase()}, italiano, grossista, svizzera, lapa, ristoranti`
    });

    if (success) {
      updated++;
      console.log(`✅ ${name}`);
    }
  }

  console.log(`\n📊 Categorie aggiornate: ${updated}/${categories.length}`);
}

// ==================== PAGINE ====================

// Meta tag predefiniti per le pagine principali
const PAGE_SEO: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'LAPA - Grossista Prodotti Italiani in Svizzera | Zero Pensieri',
    description: 'LAPA: il tuo grossista di prodotti alimentari italiani in Svizzera. Oltre 3000 prodotti, consegna rapida, qualità garantita. Fornitura per ristoranti e gastronomie.'
  },
  '/shop': {
    title: 'Shop Online | Prodotti Italiani per Ristoranti | LAPA',
    description: 'Acquista online prodotti italiani per il tuo ristorante. Pasta, formaggi, salumi, conserve e molto altro. Consegna in tutta la Svizzera. LAPA Grossista.'
  },
  '/prodotti-e-cataloghi': {
    title: 'Catalogo Prodotti Italiani | LAPA Grossista Svizzera',
    description: 'Sfoglia il nostro catalogo di prodotti alimentari italiani: pasta, formaggi, salumi, olio, conserve. Oltre 3000 referenze per ristoranti in Svizzera.'
  },
  '/contactus': {
    title: 'Contattaci | LAPA Grossista Prodotti Italiani',
    description: 'Contatta LAPA per informazioni sui nostri prodotti italiani. Siamo a Embrach, Zurigo. Assistenza dedicata per ristoranti e gastronomie in Svizzera.'
  },
  '/appointment': {
    title: 'Prenota Appuntamento | LAPA Grossista Italiano',
    description: 'Prenota un appuntamento con LAPA per scoprire i nostri prodotti italiani. Visita il nostro showroom a Embrach o richiedi una visita del nostro agente.'
  },
  '/our-service': {
    title: 'I Nostri Servizi | Consegna Rapida | LAPA Grossista',
    description: 'Scopri i servizi LAPA: consegna giornaliera, nessun minimo d\'ordine, assistenza personalizzata. Il grossista italiano che semplifica la tua attività.'
  },
  '/clienti-felici': {
    title: 'Recensioni Clienti | LAPA Grossista Italiano Svizzera',
    description: 'Leggi le recensioni dei nostri clienti soddisfatti. Ristoranti e pizzerie in Svizzera scelgono LAPA per qualità e servizio. Scopri le loro esperienze.'
  },
  '/jobs': {
    title: 'Lavora con Noi | Carriere | LAPA Grossista',
    description: 'Unisciti al team LAPA! Cerchiamo persone appassionate di cibo italiano. Scopri le posizioni aperte e invia la tua candidatura.'
  },
  '/paccone': {
    title: 'Regalo Informativo Gratuito | LAPA Grossista Italiano',
    description: 'Richiedi il tuo pacco informativo gratuito da LAPA. Scopri i nostri prodotti italiani di qualità e i vantaggi di lavorare con noi.'
  },
  '/guanciale-co': {
    title: 'Guanciale Italiano | Il Segreto della Carbonara | LAPA',
    description: 'Scopri il guanciale italiano autentico per la vera carbonara. LAPA importa direttamente dall\'Italia i migliori guanciali per ristoranti in Svizzera.'
  },
  '/prodotti-e-cataloghi/salumi': {
    title: 'Salumi Italiani | Prosciutto, Guanciale, Pancetta | LAPA',
    description: 'I migliori salumi italiani per il tuo ristorante: prosciutto di Parma, guanciale, pancetta, bresaola. LAPA grossista in Svizzera. Consegna rapida.'
  },
  '/prodotti-e-cataloghi/formaggi': {
    title: 'Formaggi Italiani | Parmigiano, Mozzarella, Burrata | LAPA',
    description: 'Formaggi italiani DOP per ristoranti: Parmigiano Reggiano, mozzarella di bufala, burrata, pecorino. LAPA grossista in Svizzera.'
  },
  '/prodotti-e-cataloghi/pasticceria': {
    title: 'Pasticceria Italiana | Dolci e Dessert | LAPA Grossista',
    description: 'Prodotti di pasticceria italiana per ristoranti: cannoli, sfogliatelle, tiramisù, gelati. LAPA importa direttamente dall\'Italia.'
  },
  '/blog': {
    title: 'Blog | Ricette e Novità | LAPA Grossista Italiano',
    description: 'Scopri ricette italiane, novità sui prodotti e consigli per il tuo ristorante. Il blog di LAPA, grossista di prodotti italiani in Svizzera.'
  }
};

async function fixPages() {
  console.log('\n📄 AGGIORNAMENTO SEO PAGINE');
  console.log('='.repeat(60));

  const pages = await searchRead('website.page',
    [['is_published', '=', true]],
    ['id', 'name', 'url', 'website_meta_title', 'website_meta_description']
  );

  console.log(`📊 Trovate ${pages.length} pagine pubblicate`);

  let updated = 0;
  let skipped = 0;

  for (const page of pages) {
    const url = page.url;

    // Cerca meta tag predefiniti o genera automaticamente
    let seo = PAGE_SEO[url];

    if (!seo) {
      // Genera automaticamente basandosi sul nome pagina
      const pageName = page.name || url.replace(/\//g, ' ').trim();
      seo = {
        title: `${pageName} | LAPA Grossista Italiano Svizzera`,
        description: `${pageName} - LAPA, il grossista di prodotti alimentari italiani in Svizzera. Qualità italiana per ristoranti e gastronomie.`
      };
    }

    // Aggiorna solo se mancano i meta tag
    if (!page.website_meta_title || !page.website_meta_description) {
      const success = await write('website.page', [page.id], {
        website_meta_title: seo.title.substring(0, 60),
        website_meta_description: seo.description.substring(0, 160)
      });

      if (success) {
        updated++;
        console.log(`✅ ${page.name} (${url})`);
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n📊 Pagine aggiornate: ${updated}`);
  console.log(`📊 Pagine già OK: ${skipped}`);
}

// ==================== MAIN ====================

async function main() {
  console.log('🔧 FIX SEO - CATEGORIE E PAGINE');
  console.log('='.repeat(60));
  console.log(`📅 Data: ${new Date().toLocaleString('it-IT')}`);
  console.log('='.repeat(60));

  try {
    await authenticate();

    // 1. Aggiorna categorie
    await fixCategories();

    // 2. Aggiorna pagine
    await fixPages();

    console.log('\n');
    console.log('='.repeat(60));
    console.log('✅ COMPLETATO!');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('💥 Errore:', error.message);
  }
}

main();
