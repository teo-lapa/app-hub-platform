/**
 * SEO-GEO Optimizer
 * Sistema RAG locale per ottimizzazione SEO + GEO
 *
 * Moduli esportati:
 * - Agents: seoAnalyzer, geoAnalyzer, contentOptimizer
 * - RAG: embeddingService, contentProcessor
 * - Connectors: odoo
 * - Config: config, SEO_RULES, GEO_RULES
 */

// Agents
export { seoAnalyzer, SEOAnalyzerAgent } from './agents/seo-analyzer.js';
export { geoAnalyzer, GEOAnalyzerAgent } from './agents/geo-analyzer.js';
export { contentOptimizer, ContentOptimizerAgent } from './agents/content-optimizer.js';
export { BaseAgent } from './agents/base-agent.js';

// RAG
export { embeddingService, EmbeddingService } from './rag/embedding-service.js';
export { contentProcessor, ContentProcessor } from './rag/content-processor.js';

// Connectors
export { odoo, OdooConnector } from './connectors/odoo.js';

// Config
export { config } from './utils/config.js';
export { SEO_RULES, SEO_SCORE_THRESHOLDS, CONTENT_TYPES } from '../config/seo-rules.js';
export { GEO_RULES, GEO_SCORE_THRESHOLDS, GEO_CHECKLIST, GEO_CONTENT_TEMPLATES } from '../config/geo-rules.js';

// Main function per uso programmatico
export async function runAudit(options: {
  type?: 'seo' | 'geo' | 'both';
  contentType?: 'articles' | 'products' | 'all';
  limit?: number;
}) {
  const { type = 'both', contentType = 'all', limit = 10 } = options;

  const results: any[] = [];

  // Audit articoli
  if (contentType === 'all' || contentType === 'articles') {
    const articles = await odoo.getBlogPosts({ limit });

    for (const article of articles) {
      const data = {
        id: article.id,
        title: article.name,
        name: article.name,
        content: article.content,
        meta_title: article.website_meta_title,
        meta_description: article.website_meta_description,
        keywords: article.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
        content_type: 'article',
      };

      const result: any = { type: 'article', id: article.id, name: article.name };

      if (type === 'seo' || type === 'both') {
        result.seo = (await seoAnalyzer.execute({ task: 'SEO', data, history: [] })).output;
      }

      if (type === 'geo' || type === 'both') {
        result.geo = (await geoAnalyzer.execute({ task: 'GEO', data, history: [] })).output;
      }

      results.push(result);
    }
  }

  // Audit prodotti
  if (contentType === 'all' || contentType === 'products') {
    const products = await odoo.getProducts({ limit });

    for (const product of products) {
      const data = {
        id: product.id,
        title: product.name,
        name: product.name,
        content: product.website_description || product.description_sale || '',
        meta_title: product.website_meta_title,
        meta_description: product.website_meta_description,
        keywords: product.website_meta_keywords?.split(',').map((k: string) => k.trim()) || [],
        content_type: 'product',
      };

      const result: any = { type: 'product', id: product.id, name: product.name };

      if (type === 'seo' || type === 'both') {
        result.seo = (await seoAnalyzer.execute({ task: 'SEO', data, history: [] })).output;
      }

      if (type === 'geo' || type === 'both') {
        result.geo = (await geoAnalyzer.execute({ task: 'GEO', data, history: [] })).output;
      }

      results.push(result);
    }
  }

  return results;
}

// Export default
export default {
  seoAnalyzer,
  geoAnalyzer,
  contentOptimizer,
  embeddingService,
  contentProcessor,
  odoo,
  config,
  runAudit,
};
