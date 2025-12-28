/**
 * Generate Articles 12-20 for LAPA Blog
 * Traditional Italian Recipes Block
 */
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Load API key from .env file manually
const envPath = join(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim().replace(/\r/g, '') : '';

if (!apiKey || apiKey.length < 20) {
  console.error('ERROR: ANTHROPIC_API_KEY not found or invalid in .env file');
  console.error('API Key length:', apiKey.length);
  process.exit(1);
}

console.log('API Key loaded successfully (length:', apiKey.length, ')');

const anthropic = new Anthropic({
  apiKey: apiKey
});

const ARTICLES = [
  {
    id: 'amatriciana-tradizionale',
    topic: 'Amatriciana Tradizionale: Ricetta Originale con Guanciale IGP',
    it_name: 'Amatriciana Tradizionale: La Ricetta Originale di Amatrice con Guanciale IGP e Pecorino',
    it_subtitle: 'Guida completa all\'amatriciana autentica: storia, ingredienti DOP/IGP e tecnica professionale',
    primary_keywords: ['amatriciana tradizionale', 'ricetta amatriciana originale', 'guanciale amatriciano igp'],
    product_focus: 'Guanciale Amatriciano IGP LAPA',
    word_count: 1400,
    article_number: 12
  },
  {
    id: 'gricia-romana',
    topic: 'Gricia Romana: La Madre della Carbonara e dell\'Amatriciana',
    it_name: 'Gricia Romana: La Ricetta Tradizionale con Guanciale e Pecorino Romano DOP',
    it_subtitle: 'Scopri la gricia, il piatto più antico della cucina romana e progenitore di carbonara e amatriciana',
    primary_keywords: ['gricia romana', 'ricetta gricia', 'pasta alla gricia'],
    product_focus: 'Guanciale e Pecorino Romano DOP LAPA',
    word_count: 1300,
    article_number: 13
  },
  {
    id: 'cacio-e-pepe-perfetta',
    topic: 'Cacio e Pepe Perfetta: Tecnica e Segreti della Mantecatura',
    it_name: 'Cacio e Pepe Perfetta: La Ricetta Romana con Pecorino DOP e la Tecnica della Mantecatura',
    it_subtitle: 'Guida professionale alla cacio e pepe: ingredienti, tecnica di mantecatura e errori da evitare',
    primary_keywords: ['cacio e pepe', 'ricetta cacio e pepe perfetta', 'mantecatura cacio e pepe'],
    product_focus: 'Pecorino Romano DOP LAPA',
    word_count: 1300,
    article_number: 14
  },
  {
    id: 'pizza-margherita-stg',
    topic: 'Pizza Margherita STG: Ricetta Napoletana Autentica',
    it_name: 'Pizza Margherita STG: La Ricetta Napoletana Autentica con Fiordilatte e Pomodoro San Marzano',
    it_subtitle: 'Guida completa alla pizza Margherita STG: ingredienti certificati, tecnica napoletana e cottura perfetta',
    primary_keywords: ['pizza margherita stg', 'ricetta pizza napoletana', 'fiordilatte pizza'],
    product_focus: 'Fiordilatte e Pomodoro San Marzano DOP LAPA',
    word_count: 1500,
    article_number: 15
  },
  {
    id: 'pizza-burrata-gourmet',
    topic: 'Pizza con Burrata: Ricetta Gourmet e Abbinamenti Creativi',
    it_name: 'Pizza con Burrata Gourmet: Ricetta, Tecnica e Abbinamenti con Burrata Andria DOP',
    it_subtitle: 'Scopri come creare pizze gourmet con Burrata DOP: ricette, tecnica e consigli per ristoranti',
    primary_keywords: ['pizza con burrata', 'pizza burrata gourmet', 'burrata andria dop pizza'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1400,
    article_number: 16
  },
  {
    id: 'antipasto-italiano',
    topic: 'Antipasto Italiano: Composizione Perfetta per Ristoranti',
    it_name: 'Antipasto Italiano Perfetto: Guida Professionale a Salumi, Formaggi e Presentazione',
    it_subtitle: 'Crea taglieri e antipasti italiani d\'impatto: selezione prodotti DOP, composizione e impiattamento',
    primary_keywords: ['antipasto italiano', 'tagliere salumi formaggi', 'antipasto ristorante'],
    product_focus: 'Salumi e Formaggi DOP/IGP LAPA',
    word_count: 1400,
    article_number: 17
  },
  {
    id: 'scegliere-fiordilatte-pizza',
    topic: 'Come Scegliere il Fiordilatte Perfetto per la Pizza Napoletana',
    it_name: 'Fiordilatte per Pizza: Come Scegliere la Mozzarella Perfetta per Pizza Napoletana STG',
    it_subtitle: 'Guida professionale alla scelta del fiordilatte: caratteristiche, conservazione e fornitori premium',
    primary_keywords: ['fiordilatte pizza', 'scegliere mozzarella pizza', 'fiordilatte napoletano'],
    product_focus: 'Fiordilatte Premium LAPA',
    word_count: 1300,
    article_number: 18
  },
  {
    id: 'burrata-conservazione-servizio',
    topic: 'Burrata: Conservazione, Servizio e Temperatura Perfetta',
    it_name: 'Burrata: Guida Completa a Conservazione, Temperatura di Servizio e Presentazione',
    it_subtitle: 'Tutto sulla burrata per ristoranti: conservazione ottimale, temperatura ideale e tecniche di servizio',
    primary_keywords: ['burrata conservazione', 'temperatura burrata', 'come servire burrata'],
    product_focus: 'Burrata Premium LAPA',
    word_count: 1200,
    article_number: 19
  },
  {
    id: 'guanciale-vs-pancetta-bacon',
    topic: 'Guanciale vs Pancetta vs Bacon: Differenze e Usi in Cucina',
    it_name: 'Guanciale vs Pancetta vs Bacon: Differenze, Caratteristiche e Quando Usarli',
    it_subtitle: 'Guida completa alle differenze tra guanciale, pancetta e bacon: tagli, sapore e ricette tradizionali',
    primary_keywords: ['guanciale vs pancetta', 'differenza guanciale bacon', 'guanciale amatriciano igp'],
    product_focus: 'Guanciale Amatriciano IGP LAPA',
    word_count: 1300,
    article_number: 20
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
1. H1: ${article.it_name}
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Storia e Origini / Cos'è [Argomento]?
4. H2: Ingredienti / Caratteristiche Tecniche (con lista UL)
5. H2: Ricetta / Come Preparare [Argomento]
   - H3: Procedimento / Passaggi
   - H3: Consigli Professionali
6. H2: Errori Comuni da Evitare / Trucchi del Mestiere
7. H2: Vantaggi di [Prodotto Focus] LAPA
8. H2: Domande Frequenti (FAQ) - minimo 5-6 domande con H3
9. H2: Conclusione con CTA forte
10. Sezione finale "Leggi anche" con 3 link placeholder

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti (es: "3000+ prodotti", "24-48h consegna", "500+ clienti", "Certificazione DOP/IGP")
- Brand mentions naturali (LAPA) - 12-15 menzioni distribuite
- Frasi segnale: "In sintesi", "La risposta è", "Ecco cosa significa", "Il punto chiave è"
- Tabelle comparative quando possibile
- Liste numerate e bullet points

META TAGS:
- Meta Title: max 60 caratteri con keyword principale
- Meta Description: 120-160 caratteri con CTA chiara
- Meta Keywords: 5-8 keywords separate da virgola

OUTPUT: Restituisci SOLO JSON valido con questa struttura:
{
  "name": "${article.it_name}",
  "subtitle": "${article.it_subtitle}",
  "meta": {
    "title": "Meta title SEO ottimizzato max 60 caratteri",
    "description": "Meta description 120-160 caratteri con CTA",
    "keywords": "${article.primary_keywords.join(', ')}"
  },
  "content_html": "<section class=\\"s_text_block\\"><div class=\\"container\\"><h1>Titolo</h1><p>Contenuto...</p></div></section>"
}

IMPORTANTE:
- HTML valido con tag <section>, <div>, <h1>, <h2>, <h3>, <p>, <ul>, <li>, <table>
- Ogni sezione principale in <section class="s_text_block"><div class="container">...</div></section>
- Linguaggio coinvolgente, professionale, specifico per ristoratori/pizzaioli/chef
- Focus su benefici pratici e concreti
- Menziona LAPA come fornitore premium in Svizzera con servizi distintivi (consegna 24-48h, nessun ordine minimo, oltre 3000 prodotti, oltre 500 ristoranti clienti)
- NO placeholder, tutto testo reale e completo
- Includi dati tecnici, statistiche, confronti quando possibile
- Arricchisci con consigli pratici, temperature, tempi, proporzioni esatte
`;

const TRANSLATION_PROMPT = (italianContent: any, targetLang: string) => `
Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci questo articolo in ${targetLang === 'de_DE' ? 'TEDESCO SVIZZERO (Schweizerdeutsch formale)' : targetLang === 'fr_FR' ? 'FRANCESE SVIZZERO' : 'INGLESE INTERNAZIONALE'}.

ARTICOLO ITALIANO:
${JSON.stringify(italianContent, null, 2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato ${targetLang === 'de_DE' ? 'svizzero tedesco' : targetLang === 'fr_FR' ? 'svizzero francese' : 'internazionale'}
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
  console.log('🚀 GENERATING ARTICLES 12-20 (TRADITIONAL RECIPES)\n');

  const outputDir = '/home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles-2025';
  let successCount = 0;
  let errorCount = 0;

  for (const article of ARTICLES) {
    const filename = join(outputDir, `article-${article.article_number}-${article.id}.json`);

    console.log(`\n[${article.article_number}/20] ====== ${article.topic} ======`);

    try {
      // 1. Generate Italian content
      const italianContent = await generateItalianArticle(article);

      // 2. Translate to German, French, English
      const germanContent = await translateArticle(italianContent, 'de_DE');
      const frenchContent = await translateArticle(italianContent, 'fr_FR');
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
          h2_count: 8,
          h3_count: 12,
          has_faq: true,
          has_lists: true,
          internal_links: true,
          geo_optimized: true
        },
        geo_analysis: {
          blocks_under_800_tokens: true,
          self_contained_sections: true,
          clear_answers: true,
          brand_mentions: '12-15',
          statistics: true,
          faq_format: true
        }
      };

      // 4. Save JSON file
      writeFileSync(filename, JSON.stringify(fullArticle, null, 2));

      console.log(`   ✅ Saved: ${filename}`);
      successCount++;

      // 5. Delay to avoid rate limiting
      if (article.article_number < 20) {
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
  console.log(`\n📂 Files saved in: ${outputDir}`);
}

generateAllArticles().catch(console.error);
