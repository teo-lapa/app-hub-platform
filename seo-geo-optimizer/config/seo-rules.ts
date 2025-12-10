/**
 * SEO Rules Configuration
 * Regole e best practices per ottimizzazione SEO tradizionale
 */

export const SEO_RULES = {
  // Meta Title
  title: {
    minLength: 30,
    maxLength: 60,
    mustInclude: ['brand', 'keyword'],
    format: '{keyword} | {brand}',
    score: 15,
  },

  // Meta Description
  description: {
    minLength: 120,
    maxLength: 160,
    mustInclude: ['keyword', 'cta'],
    score: 10,
  },

  // Content
  content: {
    minWordCount: 300,
    optimalWordCount: 1500,
    maxWordCount: 3000,
    headingStructure: {
      requireH1: true,
      maxH1: 1,
      requireH2: true,
      minH2: 2,
    },
    keywordDensity: {
      min: 0.5,
      max: 2.5,
      optimal: 1.5,
    },
    score: 25,
  },

  // Technical SEO
  technical: {
    requireCanonical: true,
    requireHreflang: true,
    requireSitemap: true,
    requireRobots: true,
    requireSSL: true,
    score: 20,
  },

  // Structured Data (Schema.org)
  structuredData: {
    required: ['Organization', 'WebSite'],
    productPages: ['Product', 'BreadcrumbList', 'Offer'],
    blogPages: ['Article', 'BreadcrumbList', 'Person'],
    categoryPages: ['ItemList', 'BreadcrumbList'],
    score: 15,
  },

  // Open Graph
  openGraph: {
    required: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'],
    imageSize: { width: 1200, height: 630 },
    score: 10,
  },

  // Twitter Cards
  twitter: {
    required: ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'],
    cardType: 'summary_large_image',
    score: 5,
  },
} as const;

export const SEO_SCORE_THRESHOLDS = {
  excellent: 90,
  good: 75,
  average: 50,
  poor: 25,
};

export const CONTENT_TYPES = {
  product: {
    name: 'Pagina Prodotto',
    requiredSchema: ['Product', 'Offer', 'BreadcrumbList'],
    requiredMeta: ['title', 'description', 'og:image'],
    optimalWordCount: 500,
  },
  article: {
    name: 'Articolo Blog',
    requiredSchema: ['Article', 'Person', 'BreadcrumbList'],
    requiredMeta: ['title', 'description', 'og:image', 'article:published_time'],
    optimalWordCount: 1500,
  },
  category: {
    name: 'Pagina Categoria',
    requiredSchema: ['ItemList', 'BreadcrumbList'],
    requiredMeta: ['title', 'description'],
    optimalWordCount: 300,
  },
  homepage: {
    name: 'Homepage',
    requiredSchema: ['Organization', 'WebSite', 'SearchAction'],
    requiredMeta: ['title', 'description', 'og:image'],
    optimalWordCount: 500,
  },
} as const;
