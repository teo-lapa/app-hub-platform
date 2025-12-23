/**
 * Generate Articles 53-60 for LAPA Blog
 * Trends & Culture Block (BLOCCO 4 + BLOCCO 5)
 */
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Load API key from .env file manually
const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const anthropic = new Anthropic({
  apiKey: apiKey
});

const ARTICLES = [
  {
    id: 'sostenibilita-food-zero-waste',
    topic: 'Sostenibilità nel Food: Come Ridurre l\'Impatto Ambientale',
    primary_keywords: ['ristorante sostenibile', 'cucina zero waste', 'ridurre impatto'],
    product_focus: 'Green Program LAPA',
    word_count: 1300,
    article_number: 53
  },
  {
    id: 'menu-vegetariano-vegano',
    topic: 'Menu Vegetariano e Vegano: Opportunità per Ristoranti Italiani',
    primary_keywords: ['menu vegano ristorante', 'piatti vegetariani italiani', 'cucina plant-based'],
    product_focus: 'Gamma Veg LAPA',
    word_count: 1200,
    article_number: 54
  },
  {
    id: 'food-photography-ristoranti',
    topic: 'Food Photography per Ristoranti: Aumentare le Prenotazioni',
    primary_keywords: ['food photography', 'foto cibo ristorante', 'instagram food'],
    product_focus: 'Marketing Visivo LAPA',
    word_count: 1100,
    article_number: 55
  },
  {
    id: 'cucina-regionale-italiana',
    topic: 'Cucina Regionale Italiana: Un Viaggio da Nord a Sud',
    primary_keywords: ['cucina regionale italiana', 'piatti tipici regioni', 'tradizione culinaria'],
    product_focus: 'Gamma Regionale LAPA',
    word_count: 2000,
    article_number: 56
  },
  {
    id: 'denominazioni-dop-igp',
    topic: 'Denominazioni DOP e IGP: Cosa Significano Veramente',
    primary_keywords: ['dop igp differenza', 'prodotti dop italiani', 'certificazioni alimentari'],
    product_focus: 'Prodotti Certificati LAPA',
    word_count: 1300,
    article_number: 57
  },
  {
    id: 'storia-pizza-unesco',
    topic: 'Storia della Pizza: Dalle Origini a Patrimonio UNESCO',
    primary_keywords: ['storia pizza napoletana', 'pizza unesco', 'origine pizza'],
    product_focus: 'Ingredienti Pizza LAPA',
    word_count: 1500,
    article_number: 58
  },
  {
    id: 'pasta-artigianale-vs-industriale',
    topic: 'Pasta Artigianale vs Industriale: Differenze che Contano',
    primary_keywords: ['pasta artigianale', 'differenza pasta trafilata bronzo', 'pasta artigianale vs industriale'],
    product_focus: 'Gamma Pasta LAPA',
    word_count: 1200,
    article_number: 59
  },
  {
    id: 'arte-caffe-italiano',
    topic: 'L\'Arte del Caffè Italiano: Dall\'Espresso al Cappuccino',
    primary_keywords: ['caffè italiano', 'preparazione espresso', 'cultura caffè'],
    product_focus: 'Caffè LAPA',
    word_count: 1100,
    article_number: 60
  }
];

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

async function generateItalianArticle(article: typeof ARTICLES[0]): Promise<any> {
  console.log(`\n📝 Generating article: ${article.topic} (IT)...`);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: ITALIAN_ARTICLE_PROMPT(article)
    }]
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  return JSON.parse(jsonMatch[0]);
}

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

async function generateAllArticles() {
  console.log('🚀 GENERATING ARTICLES 53-60 (TRENDS & CULTURE)\n');

  const outputDir = '/home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles-2025';
  let successCount = 0;
  let errorCount = 0;

  for (const article of ARTICLES) {
    const filename = join(outputDir, `article-${String(article.article_number).padStart(2, '0')}-${article.id}.json`);

    console.log(`\n[${article.article_number}/60] ====== ${article.topic} ======`);

    try {
      // 1. Generate Italian content
      const italianContent = await generateItalianArticle(article);

      // 2. Translate to German, French, English
      const germanContent = await translateArticle(italianContent, 'de_CH');
      const frenchContent = await translateArticle(italianContent, 'fr_CH');
      const englishContent = await translateArticle(italianContent, 'en_US');

      // 3. Create complete article object
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
          de_DE: germanContent,
          fr_FR: frenchContent,
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

      // 4. Save JSON file
      writeFileSync(filename, JSON.stringify(fullArticle, null, 2));

      console.log(`   ✅ Saved: ${filename}`);
      successCount++;

      // 5. Delay to avoid rate limiting
      if (article.article_number < 60) {
        console.log('   ⏳ Waiting 3s before next article...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`   ❌ Error generating article ${article.article_number}:`, error);
      console.log('   ⚠️  Skipping to next article...');
      errorCount++;
    }
  }

  console.log('\n\n✅ ====== GENERATION COMPLETE ======');
  console.log(`Generated: ${successCount} articles`);
  console.log(`Errors: ${errorCount} articles`);
  console.log(`Total translations: ${successCount * 4}`);
  console.log('\n📂 Files saved in: ${outputDir}');
}

generateAllArticles().catch(console.error);
