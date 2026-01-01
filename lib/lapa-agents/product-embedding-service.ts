/**
 * Product Embedding Service for LAPA AI
 *
 * RAG system for semantic product search:
 * - Generates embeddings for Odoo products using OpenAI
 * - Stores them in pgvector for similarity search
 * - Finds products semantically (e.g., "coda di astice" finds "ASTICE HUMMERSCHWAENZE")
 */

import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// In-memory cache for embeddings (fallback if DB not available)
const embeddingsCache = new Map<number, { name: string; embedding: number[] }>();
let cacheInitialized = false;

export interface ProductForEmbedding {
  id: number;
  name: string;
  default_code?: string;
  categ_id?: [number, string];
  description_sale?: string;
}

export interface SimilarProduct {
  productId: number;
  productName: string;
  similarity: number;
}

/**
 * Generate embedding for a product
 */
export async function generateProductEmbedding(product: ProductForEmbedding): Promise<number[]> {
  if (!openai) {
    throw new Error('OpenAI client not initialized - API key missing');
  }

  try {
    // Combine product info for better semantic matching
    const textParts = [
      product.name,
      product.default_code || '',
      product.categ_id?.[1] || '',
      (product.description_sale || '').substring(0, 500)
    ].filter(Boolean);

    const textToEmbed = textParts.join(' ').trim();

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('[PRODUCT-EMBEDDING] Failed to generate embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Initialize product embeddings table if not exists
 */
export async function initProductEmbeddingsTable(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS product_embeddings (
        product_id INTEGER PRIMARY KEY,
        product_name TEXT NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create index for fast similarity search
    await sql`
      CREATE INDEX IF NOT EXISTS product_embeddings_embedding_idx
      ON product_embeddings
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `;

    console.log('[PRODUCT-EMBEDDING] Table initialized');
  } catch (error: any) {
    // Table might already exist or pgvector not installed
    console.warn('[PRODUCT-EMBEDDING] Table init warning:', error.message);
  }
}

/**
 * Save product embedding to database
 */
export async function saveProductEmbedding(
  productId: number,
  productName: string,
  embedding: number[]
): Promise<void> {
  try {
    const embeddingVector = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO product_embeddings (product_id, product_name, embedding, updated_at)
      VALUES (${productId}, ${productName}, ${embeddingVector}::vector, NOW())
      ON CONFLICT (product_id)
      DO UPDATE SET
        product_name = ${productName},
        embedding = ${embeddingVector}::vector,
        updated_at = NOW()
    `;

    // Also update cache
    embeddingsCache.set(productId, { name: productName, embedding });
  } catch (error: any) {
    console.error('[PRODUCT-EMBEDDING] Failed to save:', error.message);
    // Fallback: save to cache only
    embeddingsCache.set(productId, { name: productName, embedding });
  }
}

/**
 * Find semantically similar products using vector search
 */
export async function findSimilarProducts(params: {
  query: string;
  matchThreshold?: number;
  matchCount?: number;
}): Promise<SimilarProduct[]> {
  if (!openai) {
    console.warn('[PRODUCT-EMBEDDING] OpenAI not available, using cache fallback');
    return findSimilarProductsFromCache(params);
  }

  try {
    // Generate embedding for the search query
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: params.query,
      encoding_format: 'float'
    });

    const queryEmbedding = response.data[0].embedding;
    const embeddingVector = `[${queryEmbedding.join(',')}]`;
    const matchThreshold = params.matchThreshold || 0.3; // Lower threshold for products
    const matchCount = params.matchCount || 20;

    // Try database search first
    try {
      const result = await sql`
        SELECT
          product_id,
          product_name,
          1 - (embedding <=> ${embeddingVector}::vector) as similarity
        FROM product_embeddings
        WHERE 1 - (embedding <=> ${embeddingVector}::vector) > ${matchThreshold}
        ORDER BY similarity DESC
        LIMIT ${matchCount}
      `;

      if (result.rows.length > 0) {
        console.log(`[PRODUCT-EMBEDDING] Found ${result.rows.length} similar products in DB`);
        return result.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          similarity: parseFloat(row.similarity)
        }));
      }

      // ========================================
      // FALLBACK: Ricerca SQL LIKE per nome prodotto
      // Se la ricerca semantica non trova nulla, prova con LIKE
      // Questo risolve il problema della "porchetta" dove l'embedding
      // della query non è abbastanza simile all'embedding del prodotto
      // ========================================
      console.log(`[PRODUCT-EMBEDDING] Semantic search found 0 results, trying SQL LIKE fallback for: ${params.query}`);
      const likeResult = await sql`
        SELECT
          product_id,
          product_name,
          0.75 as similarity
        FROM product_embeddings
        WHERE LOWER(product_name) LIKE ${`%${params.query.toLowerCase()}%`}
        ORDER BY product_name
        LIMIT ${matchCount}
      `;

      if (likeResult.rows.length > 0) {
        console.log(`[PRODUCT-EMBEDDING] SQL LIKE fallback found ${likeResult.rows.length} products`);
        return likeResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          similarity: parseFloat(row.similarity)
        }));
      }
    } catch (dbError: any) {
      console.warn('[PRODUCT-EMBEDDING] DB search failed, using cache:', dbError.message);
    }

    // Fallback to cache search
    return findSimilarProductsFromCache({ ...params, queryEmbedding });
  } catch (error: any) {
    console.error('[PRODUCT-EMBEDDING] Semantic search failed:', error.message);
    return [];
  }
}

/**
 * Find similar products from in-memory cache (fallback)
 */
function findSimilarProductsFromCache(params: {
  query: string;
  queryEmbedding?: number[];
  matchThreshold?: number;
  matchCount?: number;
}): SimilarProduct[] {
  if (embeddingsCache.size === 0) {
    console.warn('[PRODUCT-EMBEDDING] Cache empty, no fallback available');
    return [];
  }

  const queryEmbedding = params.queryEmbedding;
  if (!queryEmbedding) {
    // Without embedding, do simple text matching
    const queryLower = params.query.toLowerCase();
    const results: SimilarProduct[] = [];

    const entries = Array.from(embeddingsCache.entries());
    for (let i = 0; i < entries.length; i++) {
      const [productId, data] = entries[i];
      if (data.name.toLowerCase().includes(queryLower)) {
        results.push({
          productId,
          productName: data.name,
          similarity: 0.8
        });
      }
    }

    return results.slice(0, params.matchCount || 20);
  }

  // Calculate cosine similarity for all cached products
  const results: SimilarProduct[] = [];
  const threshold = params.matchThreshold || 0.3;

  const entries = Array.from(embeddingsCache.entries());
  for (let i = 0; i < entries.length; i++) {
    const [productId, data] = entries[i];
    const similarity = cosineSimilarity(queryEmbedding, data.embedding);
    if (similarity >= threshold) {
      results.push({
        productId,
        productName: data.name,
        similarity
      });
    }
  }

  // Sort by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, params.matchCount || 20);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Sync products from Odoo to embeddings store
 * Call this periodically or on product updates
 */
export async function syncProductEmbeddings(
  products: ProductForEmbedding[],
  batchSize: number = 50
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  console.log(`[PRODUCT-EMBEDDING] Starting sync for ${products.length} products...`);

  // Process in batches to avoid rate limits
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async product => {
        try {
          const embedding = await generateProductEmbedding(product);
          await saveProductEmbedding(product.id, product.name, embedding);
          synced++;
        } catch (error) {
          failed++;
          console.error(`[PRODUCT-EMBEDDING] Failed to sync product ${product.id}:`, error);
        }
      })
    );

    // Small delay between batches to respect rate limits
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  cacheInitialized = true;
  console.log(`[PRODUCT-EMBEDDING] Sync complete: ${synced} synced, ${failed} failed`);

  return { synced, failed };
}

/**
 * Load existing embeddings from database into cache
 */
export async function loadEmbeddingsToCache(): Promise<number> {
  try {
    const result = await sql`
      SELECT product_id, product_name, embedding
      FROM product_embeddings
      LIMIT 10000
    `;

    for (const row of result.rows) {
      // Parse vector string to array
      const embeddingStr = row.embedding as string;
      const embedding = embeddingStr
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .map(Number);

      embeddingsCache.set(row.product_id, {
        name: row.product_name,
        embedding
      });
    }

    cacheInitialized = true;
    console.log(`[PRODUCT-EMBEDDING] Loaded ${result.rows.length} embeddings to cache`);
    return result.rows.length;
  } catch (error: any) {
    console.warn('[PRODUCT-EMBEDDING] Failed to load cache:', error.message);
    return 0;
  }
}

/**
 * Check if embeddings are initialized
 */
export function isEmbeddingsReady(): boolean {
  return cacheInitialized || embeddingsCache.size > 0;
}

/**
 * Get cache stats
 */
export function getEmbeddingsStats(): { cacheSize: number; initialized: boolean } {
  return {
    cacheSize: embeddingsCache.size,
    initialized: cacheInitialized
  };
}
