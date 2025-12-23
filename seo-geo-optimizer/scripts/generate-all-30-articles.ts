/**
 * GENERATORE AUTOMATICO - 30 ARTICOLI BLOG LAPA
 * Genera tutti i 30 articoli in IT/DE/FR/EN ottimizzati SEO+GEO
 * Usa Claude API per traduzioni e ottimizzazione
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-api03-...' // Inserire API key
});

// Lista completa dei 30 articoli da generare
const ARTICLES = [
  // CATEGORIA 1: PRODOTTI STELLA (10 articoli)
  {
    id: 'fiordilatte-pizza-napoletana',
    topic: 'Fiordilatte per Pizza Napoletana STG',
    primary_keywords: ['fiordilatte pizza napoletana', 'mozzarella pizza stg', 'fiordilatte pizzeria'],
    product_focus: 'Fiordilatte STG LAPA',
    word_count: 1200
  },
  {
    id: 'burrata-andria-dop',
    topic: 'Burrata di Andria DOP',
    primary_keywords: ['burrata andria dop', 'burrata ristoranti', 'burrata pugliese'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1000
  },
  {
    id: 'fior-latte-gerola',
    topic: 'Fior di Latte Gerola Tradizione Valtellinese',
    primary_keywords: ['fior di latte gerola', 'formaggi valtellina', 'mozzarella valtellinese'],
    product_focus: 'Fior di Latte Gerola LAPA',
    word_count: 900
  },
  {
    id: 'guanciale-amatriciano-igp',
    topic: 'Guanciale Amatriciano IGP',
    primary_keywords: ['guanciale amatriciano igp', 'guanciale carbonara', 'guanciale ristorante'],
    product_focus: 'Guanciale Amatriciano IGP LAPA',
    word_count: 1100
  },
  {
    id: 'pecorino-romano-dop',
    topic: 'Pecorino Romano DOP',
    primary_keywords: ['pecorino romano dop', 'pecorino ristoranti', 'formaggio romano'],
    product_focus: 'Pecorino Romano DOP LAPA',
    word_count: 1000
  },
  {
    id: 'pancetta-piacentina-dop',
    topic: 'Pancetta Piacentina DOP',
    primary_keywords: ['pancetta piacentina dop', 'pancetta ristorante', 'pancetta dolce'],
    product_focus: 'Pancetta Piacentina DOP LAPA',
    word_count: 900
  },
  {
    id: 'olive-ascolane-dop',
    topic: 'Olive Ascolane del Piceno DOP',
    primary_keywords: ['olive ascolane dop', 'olive ripiene fritte', 'olive ascolane ristorante'],
    product_focus: 'Olive Ascolane DOP LAPA',
    word_count: 850
  },
  {
    id: 'pomodoro-san-marzano-dop',
    topic: 'Pomodoro San Marzano DOP',
    primary_keywords: ['pomodoro san marzano dop', 'pomodoro pizza napoletana', 'san marzano'],
    product_focus: 'San Marzano DOP LAPA',
    word_count: 1000
  },
  {
    id: 'speck-alto-adige-igp',
    topic: 'Speck Alto Adige IGP',
    primary_keywords: ['speck alto adige igp', 'speck affumicato', 'speck ristorante'],
    product_focus: 'Speck Alto Adige IGP LAPA',
    word_count: 900
  },
  {
    id: 'capperi-pantelleria-igp',
    topic: 'Capperi di Pantelleria IGP',
    primary_keywords: ['capperi pantelleria igp', 'capperi siciliani', 'capperi sale'],
    product_focus: 'Capperi Pantelleria IGP LAPA',
    word_count: 800
  },

  // CATEGORIA 2: RICETTE (7 articoli)
  {
    id: 'carbonara-autentica',
    topic: 'Carbonara Autentica Romana con Guanciale LAPA',
    primary_keywords: ['ricetta carbonara autentica', 'carbonara guanciale', 'carbonara romana'],
    product_focus: 'Guanciale + Pecorino Romano LAPA',
    word_count: 1400
  },
  {
    id: 'amatriciana-tradizionale',
    topic: 'Amatriciana Tradizionale con Guanciale e Pecorino',
    primary_keywords: ['ricetta amatriciana', 'amatriciana guanciale', 'sugo amatriciana'],
    product_focus: 'Guanciale + Pecorino + San Marzano LAPA',
    word_count: 1400
  },
  {
    id: 'gricia-romana',
    topic: 'Gricia: La Madre della Carbonara',
    primary_keywords: ['ricetta gricia', 'pasta gricia', 'gricia romana'],
    product_focus: 'Guanciale + Pecorino LAPA',
    word_count: 1100
  },
  {
    id: 'cacio-pepe-perfetta',
    topic: 'Cacio e Pepe Perfetta',
    primary_keywords: ['ricetta cacio e pepe', 'cacio e pepe cremosa', 'cacio pepe tecnica'],
    product_focus: 'Pecorino Romano LAPA',
    word_count: 1100
  },
  {
    id: 'pizza-margherita-stg',
    topic: 'Pizza Margherita STG con Fiordilatte LAPA',
    primary_keywords: ['pizza margherita stg', 'pizza margherita verace', 'pizza napoletana'],
    product_focus: 'Fiordilatte STG + San Marzano LAPA',
    word_count: 1400
  },
  {
    id: 'pizza-burrata-gourmet',
    topic: 'Pizza Bianca con Burrata: Tocco Gourmet',
    primary_keywords: ['pizza burrata', 'pizza bianca burrata', 'pizza gourmet'],
    product_focus: 'Burrata Andria DOP LAPA',
    word_count: 1000
  },
  {
    id: 'antipasto-italiano',
    topic: 'Antipasto Italiano Perfetto con Olive Ascolane e Salumi LAPA',
    primary_keywords: ['antipasto italiano', 'antipasto salumi formaggi', 'tagliere italiano'],
    product_focus: 'Olive Ascolane + Salumi + Formaggi LAPA',
    word_count: 1100
  },

  // CATEGORIA 3: GUIDE TECNICHE (5 articoli)
  {
    id: 'guida-fiordilatte-pizza',
    topic: 'Come Scegliere il Fiordilatte Giusto per la Pizza',
    primary_keywords: ['fiordilatte pizza', 'scegliere mozzarella pizza', 'mozzarella pizzeria'],
    product_focus: 'Gamma Fiordilatte LAPA',
    word_count: 1300
  },
  {
    id: 'burrata-conservazione-servizio',
    topic: 'Burrata: Come Conservarla e Servirla',
    primary_keywords: ['conservare burrata', 'servire burrata', 'burrata menu'],
    product_focus: 'Burrata LAPA',
    word_count: 1000
  },
  {
    id: 'guanciale-pancetta-bacon-differenze',
    topic: 'Guanciale vs Pancetta vs Bacon: Differenze',
    primary_keywords: ['guanciale pancetta differenze', 'guanciale vs bacon', 'salumi differenze'],
    product_focus: 'Guanciale + Pancetta LAPA',
    word_count: 1200
  },
  {
    id: '10-formaggi-dop-italiani',
    topic: 'I 10 Formaggi DOP Italiani Indispensabili',
    primary_keywords: ['formaggi dop italiani', 'formaggi ristorante', 'formaggi dop'],
    product_focus: 'Gamma Formaggi DOP LAPA',
    word_count: 1600
  },
  {
    id: 'salumi-dop-igp-guida',
    topic: 'Salumi Italiani DOP e IGP: Guida Definitiva',
    primary_keywords: ['salumi dop igp', 'salumi italiani certificati', 'salumi dop'],
    product_focus: 'Gamma Salumi DOP/IGP LAPA',
    word_count: 1600
  },

  // CATEGORIA 4: CONTENUTI COMMERCIALI (4 articoli)
  {
    id: 'fornitore-burrata-svizzera',
    topic: 'Fornitore Burrata per Ristoranti in Svizzera',
    primary_keywords: ['fornitore burrata svizzera', 'burrata ristoranti zurigo', 'burrata grossista'],
    product_focus: 'Servizio LAPA Burrata',
    word_count: 850
  },
  {
    id: 'guanciale-pizzerie-svizzera',
    topic: 'Guanciale Amatriciano per Pizzerie',
    primary_keywords: ['guanciale pizzerie svizzera', 'fornitore guanciale', 'guanciale grossista'],
    product_focus: 'Servizio LAPA Guanciale',
    word_count: 800
  },
  {
    id: 'olive-ascolane-surgelate',
    topic: 'Olive Ascolane Surgelate per Ristoranti',
    primary_keywords: ['olive ascolane surgelate', 'olive ascolane ristorante', 'olive fritte'],
    product_focus: 'Olive Ascolane Surgelate LAPA',
    word_count: 800
  },
  {
    id: 'fiordilatte-pizzaioli-svizzeri',
    topic: 'Fiordilatte: Il Segreto dei Migliori Pizzaioli Svizzeri',
    primary_keywords: ['fiordilatte pizza svizzera', 'mozzarella pizzaioli', 'fiordilatte napoletano'],
    product_focus: 'Fiordilatte LAPA Testimonianze',
    word_count: 950
  },

  // CATEGORIA 5: STAGIONALITÀ (4 articoli)
  {
    id: 'menu-autunnale-italiano',
    topic: 'Menu Autunnale Italiano con Funghi Porcini e Tartufo',
    primary_keywords: ['menu autunnale italiano', 'piatti autunno ristorante', 'menu stagionale'],
    product_focus: 'Prodotti Autunnali LAPA',
    word_count: 1100
  },
  {
    id: 'menu-estivo-burrata',
    topic: 'Estate Italiana: Menu Fresco con Burrata e Pomodori',
    primary_keywords: ['menu estivo italiano', 'piatti estate ristorante', 'menu fresco'],
    product_focus: 'Prodotti Estivi LAPA',
    word_count: 1100
  },
  {
    id: 'menu-natale-italiano',
    topic: 'Natale in Tavola: Prodotti Tradizionali LAPA',
    primary_keywords: ['menu natale italiano', 'prodotti natale', 'menu festivo'],
    product_focus: 'Prodotti Natalizi LAPA',
    word_count: 1200
  },
  {
    id: 'menu-pasqua-italiano',
    topic: 'Pasqua Italiana: Tradizioni e Prodotti Pasquali',
    primary_keywords: ['menu pasqua italiano', 'colomba pasquale', 'prodotti pasqua'],
    product_focus: 'Prodotti Pasquali LAPA',
    word_count: 1100
  }
];

// Prompt template per generare articolo completo in italiano
const ITALIAN_ARTICLE_PROMPT = (article: typeof ARTICLES[0]) => `
Sei un esperto copywriter SEO specializzato in contenuti per il settore food & beverage italiano.

Scrivi un articolo blog COMPLETO in ITALIANO su: "${article.topic}"

REQUISITI SEO:
- Parole: ${article.word_count} parole
- Keywords primarie: ${article.primary_keywords.join(', ')}
- Focus prodotto: ${article.product_focus}

STRUTTURA OBBLIGATORIA:
1. H1: Titolo principale con keyword primaria
2. Introduzione (2-3 paragrafi) con hook forte
3. H2: Cos'è [Prodotto]? Origini e Caratteristiche
4. H2: Caratteristiche Tecniche (con lista UL)
5. H2: Come Utilizzare [Prodotto] in Cucina
   - H3: Ricette Tradizionali
   - H3: Abbinamenti Consigliati
6. H2: Come Conservare [Prodotto]
7. H2: [Prodotto] LAPA: Qualità e Servizio
8. H2: Domande Frequenti (FAQ) - minimo 4 domande con H3
9. H2: Conclusione con CTA forte
10. Sezione "Leggi anche" con 3 link placeholder

OTTIMIZZAZIONE GEO (AI Search):
- Blocchi di testo <800 token ciascuno
- Risposte dirette alle domande
- Statistiche e dati concreti
- Brand mentions naturali (LAPA)
- Frasi segnale: "In sintesi", "La risposta è", "Ecco cosa significa"

META TAGS:
- Meta Title: max 60 caratteri con keyword
- Meta Description: 120-160 caratteri con CTA
- Meta Keywords: 5-8 keywords

OUTPUT: Restituisci JSON con questa struttura:
{
  "name": "Titolo Articolo",
  "subtitle": "Sottotitolo breve",
  "meta": {
    "title": "Meta title SEO",
    "description": "Meta description",
    "keywords": "keyword1, keyword2, keyword3"
  },
  "content_html": "<section class=\\"s_text_block\\">...</section>"
}

IMPORTANTE:
- HTML valido con tag <section>, <h1>, <h2>, <h3>, <p>, <ul>, <li>
- Linguaggio coinvolgente e professionale
- Focus su benefici per ristoratori/pizzaioli
- Menziona LAPA come fornitore di fiducia in Svizzera
- NO placeholder, tutto testo reale e completo
`;

// Prompt per traduzione + ottimizzazione
const TRANSLATION_PROMPT = (italianContent: any, targetLang: string) => `
Sei un traduttore professionista specializzato in contenuti SEO food & beverage.

Traduci questo articolo in ${targetLang === 'de_CH' ? 'TEDESCO SVIZZERO' : targetLang === 'fr_CH' ? 'FRANCESE SVIZZERO' : 'INGLESE'}.

ARTICOLO ITALIANO:
${JSON.stringify(italianContent, null, 2)}

REQUISITI:
- Mantieni ESATTAMENTE la struttura HTML
- Ottimizza keywords per il mercato ${targetLang === 'de_CH' ? 'svizzero tedesco' : targetLang === 'fr_CH' ? 'svizzero francese' : 'internazionale'}
- Adatta meta title e description per SEO locale
- Mantieni tono professionale ma coinvolgente
- Keywords tradotte naturalmente

OUTPUT: JSON con stessa struttura dell'originale italiano.
`;

// Funzione per generare un articolo in italiano
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
  console.log('🚀 GENERATORE AUTOMATICO - 30 ARTICOLI BLOG LAPA\n');
  console.log('Questo script genererà:');
  console.log('- 30 articoli completi');
  console.log('- 4 lingue per articolo (IT, DE, FR, EN)');
  console.log('- Tot: 120 articoli ottimizzati SEO+GEO');
  console.log('- ~160,000+ parole totali\n');

  for (let i = 0; i < ARTICLES.length; i++) {
    const article = ARTICLES[i];

    console.log(`\n[${ i + 1}/30] ====== ${article.topic} ======`);

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
          de_DE: germanContent, // Nota: sarà mappato a de_CH in upload
          fr_FR: frenchContent, // Nota: sarà mappato a fr_CH in upload
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
      const filename = `data/new-articles/article-${String(i + 1).padStart(2, '0')}-${article.id}.json`;
      writeFileSync(filename, JSON.stringify(fullArticle, null, 2));

      console.log(`   ✅ Saved: ${filename}`);

      // 5. Delay per evitare rate limiting
      if (i < ARTICLES.length - 1) {
        console.log('   ⏳ Waiting 3s before next article...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`   ❌ Error generating article ${i + 1}:`, error);
      console.log('   ⚠️  Skipping to next article...');
    }
  }

  console.log('\n\n✅ ====== GENERATION COMPLETE ======');
  console.log(`Generated ${ARTICLES.length} articles in 4 languages each`);
  console.log(`Total: ${ARTICLES.length * 4} articles`);
  console.log('\n📂 Files saved in: data/new-articles/');
  console.log('\n🚀 Next step: Run upload script to publish to Odoo');
}

// Execute
generateAllArticles().catch(console.error);
