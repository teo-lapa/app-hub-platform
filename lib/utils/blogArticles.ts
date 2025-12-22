import { BlogArticle, ArticleFilters, ContentExport } from '@/types/blog';
import contentExport from '@/seo-geo-optimizer/data/content-export.json';

/**
 * Load all blog articles from the content-export.json file
 */
export function loadBlogArticles(): BlogArticle[] {
  const data = contentExport as ContentExport;
  return data.articles || [];
}

/**
 * Filter articles based on filter criteria
 */
export function filterArticles(
  articles: BlogArticle[],
  filters: ArticleFilters
): BlogArticle[] {
  let filtered = [...articles];

  // Filter by published status
  if (filters.publishedOnly) {
    filtered = filtered.filter(article => article.is_published);
  }

  // Filter by images
  if (filters.withoutImages) {
    filtered = filtered.filter(article => article.analysis.hasImages === 0);
  }

  // Filter by search query
  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(article => {
      const titleMatch = article.name.toLowerCase().includes(query);
      const subtitleMatch = article.subtitle?.toLowerCase().includes(query);
      const keywordsMatch = article.meta?.keywords?.toLowerCase().includes(query);
      const descriptionMatch = article.meta?.description?.toLowerCase().includes(query);

      return titleMatch || subtitleMatch || keywordsMatch || descriptionMatch;
    });
  }

  return filtered;
}

/**
 * Search articles by query across multiple fields
 */
export function searchArticles(articles: BlogArticle[], query: string): BlogArticle[] {
  if (!query.trim()) {
    return articles;
  }

  const searchTerm = query.toLowerCase();

  return articles.filter(article => {
    const searchableText = [
      article.name,
      article.subtitle,
      article.meta?.title,
      article.meta?.description,
      article.meta?.keywords
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchTerm);
  });
}

/**
 * Get a single article by ID
 */
export function getArticleById(articles: BlogArticle[], id: number): BlogArticle | undefined {
  return articles.find(article => article.id === id);
}

/**
 * Get article statistics
 */
export function getArticleStats(articles: BlogArticle[]) {
  return {
    total: articles.length,
    published: articles.filter(a => a.is_published).length,
    withImages: articles.filter(a => a.analysis.hasImages > 0).length,
    withoutImages: articles.filter(a => a.analysis.hasImages === 0).length,
    avgWordCount: Math.round(
      articles.reduce((sum, a) => sum + a.analysis.wordCount, 0) / articles.length
    )
  };
}

/**
 * Extract keywords array from meta keywords string
 */
export function getKeywordsArray(article: BlogArticle): string[] {
  if (!article.meta?.keywords) return [];
  return article.meta.keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

/**
 * Generate a default prompt for blog image generation
 */
export function generateDefaultPrompt(article: BlogArticle): string {
  const keywords = getKeywordsArray(article).slice(0, 3).join(', ');

  return `Create a professional blog header image in 16:9 format for an article titled "${article.name}". ${keywords ? `Topics: ${keywords}.` : ''} High quality, modern design, suitable for web publishing.`;
}
