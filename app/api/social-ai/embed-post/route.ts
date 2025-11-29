import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { embedPost } from '@/lib/social-ai/embedding-service';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute for embedding generation

/**
 * POST /api/social-ai/embed-post
 *
 * Generate and save embedding for a social post
 * This enables RAG similarity search for future content generation
 *
 * Body:
 * - postId: string - UUID of the post to embed
 *
 * OR (for immediate embedding of new posts):
 * - caption: string
 * - hashtags: string[]
 * - cta: string
 * - productName?: string
 * - engagementRate?: number
 * - platform: string
 * - productCategory?: string
 * - targetCanton?: string
 */

interface EmbedPostRequest {
  postId?: string;
  // Or provide direct data
  caption?: string;
  hashtags?: string[];
  cta?: string;
  productName?: string;
  engagementRate?: number;
  platform?: string;
  productCategory?: string;
  targetCanton?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: EmbedPostRequest = await request.json();

    // Case 1: Embed existing post by ID
    if (body.postId) {
      // Fetch post data from database
      const result = await sql`
        SELECT
          id,
          product_name,
          caption,
          hashtags,
          cta,
          engagement_rate,
          platform,
          product_category,
          target_canton
        FROM social_posts
        WHERE id = ${body.postId}
      `;

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }

      const post = result.rows[0];

      // Generate and save embedding
      await embedPost({
        postId: post.id,
        caption: post.caption,
        hashtags: post.hashtags || [],
        cta: post.cta,
        productName: post.product_name,
        engagementRate: parseFloat(post.engagement_rate || '0'),
        platform: post.platform,
        productCategory: post.product_category,
        targetCanton: post.target_canton
      });

      return NextResponse.json({
        success: true,
        message: 'Embedding generated and saved successfully',
        postId: post.id
      });
    }

    // Case 2: Embed from direct data (for immediate embedding)
    if (body.caption && body.hashtags && body.cta && body.platform) {
      // For new posts without ID yet, generate a temporary one
      // This is used when we want to embed immediately after generation
      const tempId = crypto.randomUUID();

      await embedPost({
        postId: tempId,
        caption: body.caption,
        hashtags: body.hashtags,
        cta: body.cta,
        productName: body.productName,
        engagementRate: body.engagementRate || 0,
        platform: body.platform,
        productCategory: body.productCategory,
        targetCanton: body.targetCanton
      });

      return NextResponse.json({
        success: true,
        message: 'Embedding generated successfully',
        tempId
      });
    }

    return NextResponse.json(
      { error: 'Either postId or complete post data required' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[EMBED-POST-API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate embedding',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/social-ai/embed-post/batch
 *
 * Batch embed all posts with high engagement (>= threshold)
 * Useful for backfilling embeddings for existing posts
 *
 * Query params:
 * - threshold?: number (default: 3.0) - Minimum engagement rate
 * - limit?: number (default: 100) - Max posts to process
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threshold = parseFloat(searchParams.get('threshold') || '3.0');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Find posts with high engagement that don't have embeddings yet
    const result = await sql`
      SELECT
        sp.id,
        sp.product_name,
        sp.caption,
        sp.hashtags,
        sp.cta,
        sp.engagement_rate,
        sp.platform,
        sp.product_category,
        sp.target_canton
      FROM social_posts sp
      LEFT JOIN post_embeddings pe ON sp.id = pe.post_id
      WHERE sp.status = 'shared'
        AND sp.engagement_rate >= ${threshold}
        AND pe.post_id IS NULL
      ORDER BY sp.engagement_rate DESC
      LIMIT ${limit}
    `;

    const posts = result.rows;

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No posts to embed',
        processed: 0
      });
    }

    // Embed posts in sequence (to avoid rate limits)
    let successCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        await embedPost({
          postId: post.id,
          caption: post.caption,
          hashtags: post.hashtags || [],
          cta: post.cta,
          productName: post.product_name,
          engagementRate: parseFloat(post.engagement_rate || '0'),
          platform: post.platform,
          productCategory: post.product_category,
          targetCanton: post.target_canton
        });

        successCount++;

        // Small delay to avoid rate limits (OpenAI: 3000 RPM)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[BATCH-EMBED] Failed to embed post ${post.id}:`, error);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch embedding completed`,
      processed: successCount,
      failed: errorCount,
      total: posts.length
    });

  } catch (error: any) {
    console.error('[BATCH-EMBED-API] Error:', error);

    return NextResponse.json(
      {
        error: 'Batch embedding failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}
