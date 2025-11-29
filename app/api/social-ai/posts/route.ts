import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

/**
 * GET /api/social-ai/posts
 *
 * Returns paginated list of social posts
 *
 * Query params:
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * - platform?: 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
 * - status?: 'draft' | 'shared' | 'scheduled' | 'archived'
 * - sort?: 'recent' | 'engagement' | 'views' (default: 'recent')
 */

interface SocialPost {
  id: string;
  productName: string;
  platform: string;
  contentType: string;
  caption: string;
  hashtags: string[];
  cta: string;
  tone?: string;
  engagementRate: number;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  status: string;
  createdAt: string;
  sharedAt?: string;
  targetCanton?: string;
  targetCity?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'recent';

    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (platform) {
      conditions.push(`platform = $${params.length + 1}`);
      params.push(platform);
    }

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Determine sort order
    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'engagement':
        orderBy = 'engagement_rate DESC, created_at DESC';
        break;
      case 'views':
        orderBy = 'views DESC, created_at DESC';
        break;
      case 'recent':
      default:
        orderBy = 'created_at DESC';
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM social_posts
      ${whereClause}
    `;

    const countResult = await sql.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    // Fetch posts
    const query = `
      SELECT
        id,
        product_name,
        platform,
        content_type,
        caption,
        hashtags,
        cta,
        tone,
        engagement_rate,
        views,
        likes,
        shares,
        comments,
        status,
        created_at,
        shared_at,
        target_canton,
        target_city
      FROM social_posts
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await sql.query(query, params);

    const posts: SocialPost[] = result.rows.map(row => ({
      id: row.id,
      productName: row.product_name,
      platform: row.platform,
      contentType: row.content_type,
      caption: row.caption,
      hashtags: row.hashtags || [],
      cta: row.cta,
      tone: row.tone,
      engagementRate: parseFloat(row.engagement_rate || 0),
      views: row.views || 0,
      likes: row.likes || 0,
      shares: row.shares || 0,
      comments: row.comments || 0,
      status: row.status,
      createdAt: row.created_at,
      sharedAt: row.shared_at,
      targetCanton: row.target_canton,
      targetCity: row.target_city
    }));

    return NextResponse.json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + posts.length < total
        }
      }
    });

  } catch (error: any) {
    console.error('[POSTS-API] Error fetching posts:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: error.message
      },
      { status: 500 }
    );
  }
}
