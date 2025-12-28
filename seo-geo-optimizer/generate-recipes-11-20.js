const fs = require('fs');
const path = require('path');

const articles = [
  {
    id: 11,
    article_id: "carbonara-romana",
    topic: "Carbonara Romana: Ricetta Autentica con Guanciale e Pecorino",
    it_name: "Carbonara Romana: La Ricetta Autentica con Guanciale Amatriciano IGP e Pecorino Romano DOP",
    it_subtitle: "Guida completa alla vera carbonara romana: ingredienti, tecnica e segreti dei migliori ristoranti di Roma",
    primary_keywords: ["carbonara romana", "ricetta carbonara autentica", "guanciale carbonara"]
  },
  {
    id: 12,
    article_id: "amatriciana-tradizionale",
    topic: "Amatriciana Tradizionale: Ricetta Originale con Guanciale IGP",
    it_name: "Amatriciana Tradizionale: La Ricetta Originale di Amatrice con Guanciale IGP e Pecorino",
    it_subtitle: "Guida completa all'amatriciana autentica: storia, ingredienti DOP/IGP e tecnica professionale",
    primary_keywords: ["amatriciana tradizionale", "ricetta amatriciana originale", "guanciale amatriciano igp"]
  },
  {
    id: 13,
    article_id: "gricia-romana",
    topic: "Gricia Romana: La Madre della Carbonara e dell'Amatriciana",
    it_name: "Gricia Romana: La Ricetta Tradizionale con Guanciale e Pecorino Romano DOP",
    it_subtitle: "Scopri la gricia, il piatto più antico della cucina romana e progenitore di carbonara e amatriciana",
    primary_keywords: ["gricia romana", "ricetta gricia", "pasta alla gricia"]
  },
  {
    id: 14,
    article_id: "cacio-e-pepe-perfetta",
    topic: "Cacio e Pepe Perfetta: Tecnica e Segreti della Mantecatura",
    it_name: "Cacio e Pepe Perfetta: La Ricetta Romana con Pecorino DOP e la Tecnica della Mantecatura",
    it_subtitle: "Guida professionale alla cacio e pepe: ingredienti, tecnica di mantecatura e errori da evitare",
    primary_keywords: ["cacio e pepe", "ricetta cacio e pepe perfetta", "mantecatura cacio e pepe"]
  },
  {
    id: 15,
    article_id: "pizza-margherita-stg",
    topic: "Pizza Margherita STG: Ricetta Napoletana Autentica",
    it_name: "Pizza Margherita STG: La Ricetta Napoletana Autentica con Fiordilatte e Pomodoro San Marzano",
    it_subtitle: "Guida completa alla pizza Margherita STG: ingredienti certificati, tecnica napoletana e cottura perfetta",
    primary_keywords: ["pizza margherita stg", "ricetta pizza napoletana", "fiordilatte pizza"]
  },
  {
    id: 16,
    article_id: "pizza-burrata-gourmet",
    topic: "Pizza con Burrata: Ricetta Gourmet e Abbinamenti Creativi",
    it_name: "Pizza con Burrata Gourmet: Ricetta, Tecnica e Abbinamenti con Burrata Andria DOP",
    it_subtitle: "Scopri come creare pizze gourmet con Burrata DOP: ricette, tecnica e consigli per ristoranti",
    primary_keywords: ["pizza con burrata", "pizza burrata gourmet", "burrata andria dop pizza"]
  },
  {
    id: 17,
    article_id: "antipasto-italiano",
    topic: "Antipasto Italiano: Composizione Perfetta per Ristoranti",
    it_name: "Antipasto Italiano Perfetto: Guida Professionale a Salumi, Formaggi e Presentazione",
    it_subtitle: "Crea taglieri e antipasti italiani d'impatto: selezione prodotti DOP, composizione e impiattamento",
    primary_keywords: ["antipasto italiano", "tagliere salumi formaggi", "antipasto ristorante"]
  },
  {
    id: 18,
    article_id: "scegliere-fiordilatte-pizza",
    topic: "Come Scegliere il Fiordilatte Perfetto per la Pizza Napoletana",
    it_name: "Fiordilatte per Pizza: Come Scegliere la Mozzarella Perfetta per Pizza Napoletana STG",
    it_subtitle: "Guida professionale alla scelta del fiordilatte: caratteristiche, conservazione e fornitori premium",
    primary_keywords: ["fiordilatte pizza", "scegliere mozzarella pizza", "fiordilatte napoletano"]
  },
  {
    id: 19,
    article_id: "burrata-conservazione-servizio",
    topic: "Burrata: Conservazione, Servizio e Temperatura Perfetta",
    it_name: "Burrata: Guida Completa a Conservazione, Temperatura di Servizio e Presentazione",
    it_subtitle: "Tutto sulla burrata per ristoranti: conservazione ottimale, temperatura ideale e tecniche di servizio",
    primary_keywords: ["burrata conservazione", "temperatura burrata", "come servire burrata"]
  },
  {
    id: 20,
    article_id: "guanciale-vs-pancetta-bacon",
    topic: "Guanciale vs Pancetta vs Bacon: Differenze e Usi in Cucina",
    it_name: "Guanciale vs Pancetta vs Bacon: Differenze, Caratteristiche e Quando Usarli",
    it_subtitle: "Guida completa alle differenze tra guanciale, pancetta e bacon: tagli, sapore e ricette tradizionali",
    primary_keywords: ["guanciale vs pancetta", "differenza guanciale bacon", "guanciale amatriciano igp"]
  }
];

console.log(`Creating ${articles.length} article structures (11-20)...\n`);

const baseDir = '/home/paul/app-hub-platform/seo-geo-optimizer/data/new-articles-2025';

articles.forEach(article => {
  const articleData = {
    article_id: article.article_id,
    topic: article.topic,
    target_keywords: {
      primary: article.primary_keywords,
      secondary: [],
      long_tail: []
    },
    translations: {
      it_IT: {
        name: article.it_name,
        subtitle: article.it_subtitle,
        meta: {
          title: article.it_name.substring(0, 60) + "...",
          description: article.it_subtitle,
          keywords: article.primary_keywords.join(", ")
        },
        content_html: `<section class="s_text_block"><div class="container"><h1>${article.it_name}</h1><p>[CONTENT PLACEHOLDER - 1200-1500 words required]</p></div></section>`
      },
      de_DE: {
        name: article.it_name + " (DE)",
        subtitle: article.it_subtitle + " (DE)",
        meta: {
          title: article.it_name.substring(0, 60),
          description: article.it_subtitle,
          keywords: article.primary_keywords.join(", ")
        },
        content_html: "<section class=\"s_text_block\"><div class=\"container\"><h1>Title DE</h1><p>[CONTENT PLACEHOLDER - 1200-1500 words required]</p></div></section>"
      },
      fr_FR: {
        name: article.it_name + " (FR)",
        subtitle: article.it_subtitle + " (FR)",
        meta: {
          title: article.it_name.substring(0, 60),
          description: article.it_subtitle,
          keywords: article.primary_keywords.join(", ")
        },
        content_html: "<section class=\"s_text_block\"><div class=\"container\"><h1>Title FR</h1><p>[CONTENT PLACEHOLDER - 1200-1500 words required]</p></div></section>"
      },
      en_US: {
        name: article.it_name + " (EN)",
        subtitle: article.it_subtitle + " (EN)",
        meta: {
          title: article.it_name.substring(0, 60),
          description: article.it_subtitle,
          keywords: article.primary_keywords.join(", ")
        },
        content_html: "<section class=\"s_text_block\"><div class=\"container\"><h1>Title EN</h1><p>[CONTENT PLACEHOLDER - 1200-1500 words required]</p></div></section>"
      }
    },
    seo_analysis: {
      keyword_density: "2-3%",
      word_count: 1400,
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
      brand_mentions: "12-15",
      statistics: true,
      faq_format: true
    }
  };
  
  const filename = `article-${article.id}-${article.article_id}.json`;
  const filepath = path.join(baseDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(articleData, null, 2), 'utf8');
  console.log(`✓ Created: ${filename}`);
});

console.log('\n✅ All 10 article structures created successfully!');
console.log('\n⚠️  NOTE: These are STRUCTURE ONLY with placeholders.');
console.log('Full 1200-1500 word content in ALL 4 languages must be generated separately.');
console.log('Recommend using Claude API or similar to generate complete content.');
