// Type definitions for blog articles from content-export.json

export interface BlogArticleMeta {
  title: string;
  description: string;
  keywords: string;
}

export interface BlogArticleDates {
  created: string;
  updated: string;
}

export interface BlogArticleAnalysis {
  wordCount: number;
  hasH1: boolean;
  h1Count: number;
  hasH2: boolean;
  h2Count: number;
  hasList: boolean;
  hasImages: number;
  imagesWithAlt: number;
  titleLength: number;
  descriptionLength: number;
  hasMeta: boolean;
}

export interface BlogArticle {
  id: number;
  name: string;
  subtitle: string;
  content_text: string;
  content_html: string;
  coverImage?: string | null; // URL of cover image from Odoo
  meta: BlogArticleMeta;
  is_published: boolean;
  dates: BlogArticleDates;
  analysis: BlogArticleAnalysis;
}

export interface BlogArticleWithImage extends BlogArticle {
  generatedImageUrl?: string;
  generatedImageBase64?: string;
}

export interface ArticleFilters {
  publishedOnly: boolean;
  withoutImages: boolean;
  searchQuery: string;
}

export interface ContentExport {
  fetchedAt: string;
  summary: {
    totalArticles: number;
    publishedArticles: number;
    articlesWithMeta: number;
    totalProducts: number;
    productsWithMeta: number;
  };
  articles: BlogArticle[];
}
