import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

/**
 * GET /api/social-ai/analytics/summary
 *
 * Returns analytics summary for Social AI Studio:
 * - Total posts generated
 * - Average engagement rate
 * - Top performing posts
 * - Performance by platform
 * - Performance by canton (if available)
 *
 * Query params:
 * - period?: 'week' | 'month' | 'all' (default: 'month')
 */

interface AnalyticsSummary {
  totals: {
    posts: number;
    views: number;
    likes: number;
    shares: number;
    comments: number;
    avgEngagement: number;
  };
  byPlatform: Array<{
    platform: string;
    posts: number;
    avgEngagement: number;
    totalViews: number;
  }>;
  byCanton: Array<{
    canton: string;
    posts: number;
    avgEngagement: number;
  }>;
  topPosts: Array<{
    id: string;
    productName: string;
    platform: string;
    caption: string;
    engagementRate: number;
    views: number;
    likes: number;
    shares: number;
    createdAt: string;
  }>;
  trends: Array<{
    date: string;
    posts: number;
    avgEngagement: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    // Determine date filter
    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = `AND created_at >= NOW() - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND created_at >= NOW() - INTERVAL '30 days'`;
        break;
      case 'all':
      default:
        dateFilter = '';
    }

    // ==========================================
    // TOTALS
    // ==========================================
    const totalsResult = await sql`
      SELECT
        COUNT(*)::int as total_posts,
        COALESCE(SUM(views), 0)::int as total_views,
        COALESCE(SUM(likes), 0)::int as total_likes,
        COALESCE(SUM(shares), 0)::int as total_shares,
        COALESCE(SUM(comments), 0)::int as total_comments,
        COALESCE(ROUND(AVG(engagement_rate), 2), 0)::numeric as avg_engagement
      FROM social_posts
      WHERE status IN ('draft', 'shared')
        ${dateFilter ? sql.unsafe(dateFilter) : sql``}
    `;

    const totals = {
      posts: totalsResult.rows[0].total_posts || 0,
      views: totalsResult.rows[0].total_views || 0,
      likes: totalsResult.rows[0].total_likes || 0,
      shares: totalsResult.rows[0].total_shares || 0,
      comments: totalsResult.rows[0].total_comments || 0,
      avgEngagement: parseFloat(totalsResult.rows[0].avg_engagement || 0)
    };

    // ==========================================
    // BY PLATFORM
    // ==========================================
    const platformResult = await sql`
      SELECT
        platform,
        COUNT(*)::int as total_posts,
        COALESCE(ROUND(AVG(engagement_rate), 2), 0)::numeric as avg_engagement,
        COALESCE(SUM(views), 0)::int as total_views
      FROM social_posts
      WHERE status IN ('draft', 'shared')
        ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      GROUP BY platform
      ORDER BY avg_engagement DESC
    `;

    const byPlatform = platformResult.rows.map(row => ({
      platform: row.platform,
      posts: row.total_posts,
      avgEngagement: parseFloat(row.avg_engagement),
      totalViews: row.total_views
    }));

    // ==========================================
    // BY CANTON
    // ==========================================
    const cantonResult = await sql`
      SELECT
        target_canton as canton,
        COUNT(*)::int as total_posts,
        COALESCE(ROUND(AVG(engagement_rate), 2), 0)::numeric as avg_engagement
      FROM social_posts
      WHERE status IN ('draft', 'shared')
        AND target_canton IS NOT NULL
        ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      GROUP BY target_canton
      ORDER BY avg_engagement DESC
    `;

    const byCanton = cantonResult.rows.map(row => ({
      canton: row.canton,
      posts: row.total_posts,
      avgEngagement: parseFloat(row.avg_engagement)
    }));

    // ==========================================
    // TOP POSTS
    // ==========================================
    const topPostsResult = await sql`
      SELECT
        id,
        product_name,
        platform,
        caption,
        engagement_rate,
        views,
        likes,
        shares,
        created_at
      FROM social_posts
      WHERE status IN ('draft', 'shared')
        ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      ORDER BY engagement_rate DESC, views DESC
      LIMIT 10
    `;

    const topPosts = topPostsResult.rows.map(row => ({
      id: row.id,
      productName: row.product_name,
      platform: row.platform,
      caption: row.caption?.substring(0, 100) + '...' || '',
      engagementRate: parseFloat(row.engagement_rate || 0),
      views: row.views || 0,
      likes: row.likes || 0,
      shares: row.shares || 0,
      createdAt: row.created_at
    }));

    // ==========================================
    // TRENDS (last 30 days)
    // ==========================================
    const trendsResult = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*)::int as posts,
        COALESCE(ROUND(AVG(engagement_rate), 2), 0)::numeric as avg_engagement
      FROM social_posts
      WHERE status IN ('draft', 'shared')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    const trends = trendsResult.rows.map(row => ({
      date: row.date,
      posts: row.posts,
      avgEngagement: parseFloat(row.avg_engagement)
    }));

    // ==========================================
    // RESPONSE
    // ==========================================
    const summary: AnalyticsSummary = {
      totals,
      byPlatform,
      byCanton,
      topPosts,
      trends
    };

    return NextResponse.json({
      success: true,
      data: summary,
      period
    });

  } catch (error: any) {
    console.error('[ANALYTICS] Error fetching summary:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics summary',
        details: error.message
      },
      { status: 500 }
    );
  }
}
