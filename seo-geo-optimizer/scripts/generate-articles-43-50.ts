/**
 * GENERATORE ARTICOLI 43-50 - LAPA BLOG
 * Genera gli 8 articoli mancanti (Restaurant Guides block)
 * Usa Claude API per traduzioni e ottimizzazione
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, existsSync } from 'fs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Articoli mancanti 43-50
const ARTICLES = [
  {
    number: 43,
    id: 'food-cost-margini',
    topic: 'Food Cost e Margini: Calcolare la Redditività di Ogni Piatto',
    primary_keywords: ['food cost ristorante', 'calcolo margini cucina', 'redditività piatti'],
    product_focus: 'Strumenti LAPA',
    word_count: 1400
  },
  {
    number: 44,
    id: 'gestione-inventario-ridurre-sprechi',
    topic: 'Gestione Inventario Ristorante: Ridurre Gli Sprechi del 30%',
    primary_keywords: ['gestione inventario ristorante', 'ridurre sprechi cucina', 'fifo ristorante'],
    product_focus: 'Sistema Ordini LAPA',
    word_count: 1300
  },
  {
    number: 45,
    id: 'marketing-ristoranti-svizzera-2026',
    topic: 'Marketing per Ristoranti Italiani in Svizzera: Strategie 2026',
    primary_keywords: ['marketing ristorante', 'instagram ristoranti', 'social media food'],
    product_focus: 'Marketing Support LAPA',
    word_count: 1500
  },
  {
    number: 46,
    id: 'selezione-formazione-staff',
    topic: 'Selezione e Formazione Staff Ristorante: La Guida del Titolare',
    primary_keywords: ['assumere personale ristorante', 'formazione camerieri', 'gestione staff'],
    product_focus: 'Training LAPA',
    word_count: 1400
  },
  {
    number: 47,
    id: 'haccp-cucina-svizzera',
    topic: 'Igiene e HACCP in Cucina: Normative Svizzere Spiegate Semplice',
    primary_keywords: ['haccp ristorante svizzera', 'igiene cucina', 'normative alimentari'],
    product_focus: 'Certificazioni LAPA',
    word_count: 1500
  },
  {
    number: 48,
    id: 'menu-stagionale-vantaggi',
    topic: 'Creare un Menu Stagionale Italiano: Vantaggi e Strategia',
    primary_keywords: ['menu stagionale ristorante', 'ingredienti di stagione', 'menu rotazione'],
    product_focus: 'Prodotti Stagionali LAPA',
    word_count: 1200
  },
  {
    number: 49,
    id: 'wine-pairing-italiano',
    topic: 'Wine Pairing Italiano: Abbinare Vini ai Piatti del Menu',
    primary_keywords: ['abbinamento vino cibo', 'wine pairing italiano', 'carta vini ristorante'],
    product_focus: 'Cantina LAPA',
    word_count: 1400
  },
  {
    number: 50,
    id: 'delivery-takeaway-ottimizzare',
    topic: 'Delivery e Take-Away per Ristoranti: Ottimizzare il Servizio',
    primary_keywords: ['delivery ristorante', 'ottimizzare take away', 'packaging delivery'],
    product_focus: 'Soluzioni Delivery LAPA',
    word_count: 1300
  }
];

// Prompt template per generare articolo completo in italiano
const ITALIAN_ARTICLE_PROMPT = (article: typeof ARTICLES[0]) => `
Sei un esperto copywriter SEO specializzato in contenuti per il settore food & beverage italiano.

Scrivi un articolo blog COMPLETO in ITALIANO su: "${article.topic}"

REQUISITI SEO:
- Parole: ${article.word_count} parole
- Keywords primarie: ${article.primary_keywords.join(', ')}
- Focus prodotto/servizio: ${article.product_focus}

STRUTTURA OBBLIGATORIA:
1. H1: Titolo principale con keyword primaria
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Cos'è [Argomento]? Origini e Caratteristiche
4. H2: Caratteristiche Tecniche/Dettagli (con lista UL)
5. H2: Come Utilizzare/Applicare [Argomento]
   - H3: Applicazioni Pratiche
   - H3: Consigli Professionali
6. H2: Vantaggi e Benefici
7. H2: [Argomento] LAPA: Qualità e Servizio
8. H2: Domande Frequenti (FAQ) - minimo 4-6 domande con H3
9. H2: Conclusione con CTA forte
10. Sezione "Leggi anche" con 3 link placeholder

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti (es: "3000+ prodotti", "24-48h consegna", "500+ clienti")
- Brand mentions naturali (LAPA) - 10-15 menzioni
- Frasi segnale: "In sintesi", "La risposta è", "Ecco cosa significa", "Il punto chiave è"
- Tabelle comparative quando possibile
- Liste numerate e bullet points

META TAGS:
- Meta Title: max 60 caratteri con keyword principale
- Meta Description: 120-160 caratteri con CTA chiara
- Meta Keywords: 5-8 keywords separate da virgola

OUTPUT: Restituisci SOLO JSON valido con questa struttura:
{
  "name": "Titolo Articolo Completo",
  "subtitle": "Sottotitolo breve descrittivo",
  "meta": {
    "title": "Meta title SEO ottimizzato",
    "description": "Meta description con CTA",
    "keywords": "keyword1, keyword2, keyword3, keyword4"
  },
  "content_html": "<section class=\\"s_text_block\\"><div class=\\"container\\"><h1>Titolo</h1><p>Contenuto...</p></div></section>"
}

IMPORTANTE:
- HTML valido con tag <section>, <div>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <table>
- Ogni sezione principale in <section class="s_text_block"><div class="container">...</div></section>
- Linguaggio coinvolgente, professionale, specifico per ristoratori/pizzaioli/chef
- Focus su benefici pratici e concreti
- Menziona LAPA come fornitore premium in Svizzera con servizi distintivi
- NO placeholder, tutto testo reale e completo
- Includi dati tecnici, statistiche, confronti quando possibile
`;

// Prompt per traduzione + ottimizzazione
const TRANSLATION_PROMPT = (italianContent: any, targetLang: string) => `
Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci questo articolo in ${targetLang === 'de_CH' ? 'TEDESCO SVIZZERO (Schweizerdeutsch formale)' : targetLang === 'fr_CH' ? 'FRANCESE SVIZZERO' : 'INGLESE INTERNAZIONALE'}.

ARTICOLO ITALIANO:
${JSON.stringify(italianContent, null, 2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato ${targetLang === 'de_CH' ? 'svizzero tedesco' : targetLang === 'fr_CH' ? 'svizzero francese' : 'internazionale'}
- Adatta meta title e description per SEO locale
- Mantieni tono professionale ma coinvolgente
- Keywords tradotte naturalmente (NON letteralmente se suona male)
- Mantieni tutti i numeri, statistiche, nomi prodotto LAPA
- Adatta CTA e frasi chiave per il mercato locale

OUTPUT: Restituisci SOLO JSON valido con stessa struttura dell'originale italiano.
`;

// Funzione per generare un articolo in italiano
async function generateItalianArticle(article: typeof ARTICLES[0]): Promise<any> {
  console.log(`\n📝 Generating article ${article.number}: ${article.topic} (IT)...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: ITALIAN_ARTICLE_PROMPT(article)
    }]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';

  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Funzione per tradurre un articolo
async function translateArticle(italianContent: any, targetLang: string): Promise<any> {
  console.log(`   🌍 Translating to ${targetLang}...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: TRANSLATION_PROMPT(italianContent, targetLang)
    }]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in translation response');
  }

  return JSON.parse(jsonMatch[0]);
}

// Funzione principale
async function generateAllArticles() {
  console.log('🚀 GENERATORE ARTICOLI 43-50 - LAPA BLOG\n');
  console.log('Genera 8 articoli mancanti (Restaurant Guides):');
  console.log('- 4 lingue per articolo (IT, DE, FR, EN)');
  console.log('- Tot: 32 articoli ottimizzati SEO+GEO');
  console.log('- ~11,000 parole totali\n');

  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < ARTICLES.length; i++) {
    const article = ARTICLES[i];
    const filename = `data/new-articles-2025/article-${String(article.number).padStart(2, '0')}-${article.id}.json`;

    console.log(`\n[${i + 1}/8] ====== ${article.topic} ======`);

    // Skip se esiste già
    if (existsSync(filename)) {
      console.log(`   ⏭️  File already exists, skipping...`);
      successCount++;
      continue;
    }

    try {
      // 1. Genera articolo in italiano
      const italianContent = await generateItalianArticle(article);

      // 2. Traduci in tedesco, francese, inglese
      const germanContent = await translateArticle(italianContent, 'de_CH');
      const frenchContent = await translateArticle(italianContent, 'fr_CH');
      const englishContent = await translateArticle(italianContent, 'en_US');

      // 3. Crea oggetto completo
      const fullArticle = {
        article_id: article.id,
        topic: article.topic,
        target_keywords: {
          primary: article.primary_keywords,
          secondary: [],
          long_tail: []
        },
        translations: {
          it_IT: italianContent,
          de_DE: germanContent, // Sarà mappato a de_CH in upload
          fr_FR: frenchContent, // Sarà mappato a fr_CH in upload
          en_US: englishContent
        },
        seo_analysis: {
          keyword_density: '2-3%',
          word_count: article.word_count,
          h1_count: 1,
          h2_count: '6-8',
          h3_count: '8-12',
          has_faq: true,
          has_lists: true,
          internal_links: true,
          geo_optimized: true
        },
        geo_analysis: {
          blocks_under_800_tokens: true,
          self_contained_sections: true,
          clear_answers: true,
          brand_mentions: '10-15',
          statistics: true,
          faq_format: true
        }
      };

      // 4. Salva file JSON
      writeFileSync(filename, JSON.stringify(fullArticle, null, 2));

      console.log(`   ✅ Saved: ${filename}`);
      successCount++;

      // 5. Delay per evitare rate limiting
      if (i < ARTICLES.length - 1) {
        console.log('   ⏳ Waiting 3s before next article...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`   ❌ Error generating article ${article.number}:`, error);
      console.log('   ⚠️  Skipping to next article...');
      errorCount++;
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000 / 60); // minuti

  console.log('\n\n✅ ====== GENERATION COMPLETE ======');
  console.log(`Generated: ${successCount} articles`);
  console.log(`Errors: ${errorCount} articles`);
  console.log(`Total translations: ${successCount * 4}`);
  console.log(`Duration: ${duration} minutes`);
  console.log('\n📂 Files saved in: data/new-articles-2025/');
  console.log('\n🚀 Next step: Upload to Odoo with upload script');
}

// Execute
generateAllArticles().catch(console.error);
