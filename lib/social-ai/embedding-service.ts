/**
 * Embedding Service for Social AI Studio
 *
 * Generates embeddings for social posts using OpenAI API
 * and stores them in pgvector for RAG similarity search
 */

import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_SOCIAL_AI
});

/**
 * Generate embedding for a social post
 * Combines caption + hashtags + CTA into a single text
 */
export async function generatePostEmbedding(postContent: {
  caption: string;
  hashtags: string[];
  cta: string;
  productName?: string;
}): Promise<number[]> {
  try {
    // Combine all text elements
    const textToEmbed = [
      postContent.productName || '',
      postContent.caption,
      postContent.hashtags.join(' '),
      postContent.cta
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Generate embedding using OpenAI text-embedding-3-small (1536 dimensions)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textToEmbed,
      encoding_format: 'float'
    });

    return response.data[0].embedding;

  } catch (error: any) {
    console.error('[EMBEDDING] Failed to generate embedding:', error.message);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Save embedding to database
 */
export async function savePostEmbedding(params: {
  postId: string;
  embedding: number[];
  engagementRate: number;
  platform: string;
  productCategory?: string;
  targetCanton?: string;
}): Promise<void> {
  try {
    // Convert embedding array to pgvector format string
    const embeddingVector = `[${params.embedding.join(',')}]`;

    await sql`
      INSERT INTO post_embeddings (
        post_id,
        embedding,
        performance_score,
        platform,
        product_category,
        target_canton,
        created_at
      ) VALUES (
        ${params.postId},
        ${embeddingVector}::vector,
        ${params.engagementRate},
        ${params.platform},
        ${params.productCategory || null},
        ${params.targetCanton || null},
        NOW()
      )
      ON CONFLICT (post_id)
      DO UPDATE SET
        embedding = ${embeddingVector}::vector,
        performance_score = ${params.engagementRate}
    `;

    console.log(`[EMBEDDING] ✓ Saved embedding for post ${params.postId}`);

  } catch (error: any) {
    console.error('[EMBEDDING] Failed to save embedding:', error.message);
    throw new Error(`Failed to save embedding: ${error.message}`);
  }
}

/**
 * Generate and save embedding for a post (convenience function)
 */
export async function embedPost(params: {
  postId: string;
  caption: string;
  hashtags: string[];
  cta: string;
  productName?: string;
  engagementRate: number;
  platform: string;
  productCategory?: string;
  targetCanton?: string;
}): Promise<void> {
  try {
    // Generate embedding
    const embedding = await generatePostEmbedding({
      caption: params.caption,
      hashtags: params.hashtags,
      cta: params.cta,
      productName: params.productName
    });

    // Save to database
    await savePostEmbedding({
      postId: params.postId,
      embedding,
      engagementRate: params.engagementRate,
      platform: params.platform,
      productCategory: params.productCategory,
      targetCanton: params.targetCanton
    });

  } catch (error: any) {
    console.error('[EMBEDDING] Failed to embed post:', error.message);
    throw error;
  }
}

/**
 * Find similar high-performing posts using pgvector similarity search
 */
export async function findSimilarHighPerformingPosts(params: {
  productName: string;
  platform?: string;
  productCategory?: string;
  targetCanton?: string;
  minEngagement?: number;
  limit?: number;
}): Promise<Array<{
  postId: string;
  similarity: number;
  engagementRate: number;
  caption: string;
  hashtags: string[];
  cta: string;
  platform: string;
}>> {
  try {
    // Generate embedding for the query (product name)
    const queryEmbedding = await generatePostEmbedding({
      caption: params.productName,
      hashtags: [],
      cta: '',
      productName: params.productName
    });

    const embeddingVector = `[${queryEmbedding.join(',')}]`;
    const minEngagement = params.minEngagement || 3.0;
    const limit = params.limit || 5;

    // Use the match_high_performing_posts function defined in schema
    const result = await sql`
      SELECT
        pe.post_id,
        1 - (pe.embedding <=> ${embeddingVector}::vector) as similarity,
        sp.engagement_rate,
        sp.caption,
        sp.hashtags,
        sp.cta,
        sp.platform
      FROM post_embeddings pe
      JOIN social_posts sp ON pe.post_id = sp.id
      WHERE
        sp.status = 'shared'
        AND sp.engagement_rate >= ${minEngagement}
        AND (${!params.platform} OR pe.platform = ${params.platform || ''})
        AND (${!params.productCategory} OR pe.product_category = ${params.productCategory || ''})
        AND (${!params.targetCanton} OR pe.target_canton = ${params.targetCanton || ''})
        AND 1 - (pe.embedding <=> ${embeddingVector}::vector) > 0.78
      ORDER BY
        pe.performance_score DESC,
        similarity DESC
      LIMIT ${limit}
    `;

    return result.rows.map(row => ({
      postId: row.post_id,
      similarity: parseFloat(row.similarity),
      engagementRate: parseFloat(row.engagement_rate),
      caption: row.caption,
      hashtags: row.hashtags || [],
      cta: row.cta,
      platform: row.platform
    }));

  } catch (error: any) {
    console.error('[RAG] Failed to find similar posts:', error.message);

    // Return empty array instead of throwing - allows graceful fallback
    return [];
  }
}

/**
 * Extract insights from similar high-performing posts
 * Returns patterns and recommendations for the copywriting agent
 */
export interface RAGInsights {
  topHashtags: string[];
  successfulCTAs: string[];
  avgEngagement: number;
  tonePatterns: string[];
  recommendations: string;
}

export async function extractRAGInsights(
  similarPosts: Array<{
    caption: string;
    hashtags: string[];
    cta: string;
    engagementRate: number;
  }>
): Promise<RAGInsights> {
  if (similarPosts.length === 0) {
    return {
      topHashtags: [],
      successfulCTAs: [],
      avgEngagement: 0,
      tonePatterns: [],
      recommendations: ''
    };
  }

  // Extract top hashtags (frequency count)
  const hashtagFrequency: Record<string, number> = {};
  similarPosts.forEach(post => {
    post.hashtags.forEach(tag => {
      hashtagFrequency[tag] = (hashtagFrequency[tag] || 0) + 1;
    });
  });

  const topHashtags = Object.entries(hashtagFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  // Extract successful CTAs
  const successfulCTAs = similarPosts
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, 3)
    .map(post => post.cta);

  // Calculate average engagement
  const avgEngagement = similarPosts.reduce((sum, post) => sum + post.engagementRate, 0) / similarPosts.length;

  // Detect tone patterns (simple keyword analysis)
  const toneKeywords: Record<string, string[]> = {
    'Professional': ['qualità', 'professionale', 'eccellenza', 'premium', 'esperienza'],
    'Casual': ['scopri', 'prova', 'assaggia', 'gustoso', 'buonissimo'],
    'Fun': ['wow', '😍', '🔥', 'fantastico', 'incredibile'],
    'Luxury': ['esclusivo', 'raffinato', 'elegante', 'lusso', 'pregiato']
  };

  const toneScores: Record<string, number> = {};
  similarPosts.forEach(post => {
    const textLower = post.caption.toLowerCase();
    Object.entries(toneKeywords).forEach(([tone, keywords]) => {
      const matches = keywords.filter(kw => textLower.includes(kw)).length;
      toneScores[tone] = (toneScores[tone] || 0) + matches;
    });
  });

  const tonePatterns = Object.entries(toneScores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tone]) => tone);

  // Build recommendations
  const recommendations = `Based on ${similarPosts.length} similar high-performing posts (avg engagement: ${avgEngagement.toFixed(2)}%):
- Use these proven hashtags: ${topHashtags.slice(0, 5).join(', ')}
- Successful CTAs include: ${successfulCTAs[0] || 'N/A'}
- Effective tone: ${tonePatterns[0] || 'Professional'}`;

  return {
    topHashtags,
    successfulCTAs,
    avgEngagement,
    tonePatterns,
    recommendations
  };
}
