import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/social-ai/analytics/summary
 *
 * Returns analytics summary from Odoo Social Marketing:
 * - Total posts and engagement metrics
 * - Performance by platform (Facebook, Instagram, LinkedIn, Twitter, YouTube)
 * - Top performing posts
 * - Account audience stats
 *
 * Query params:
 * - period?: 'week' | 'month' | 'all' (default: 'month')
 */

// Odoo Social Account IDs mapped to platform names
const PLATFORM_MAPPING: Record<number, string> = {
  2: 'facebook',
  4: 'instagram',
  6: 'linkedin',
  7: 'youtube',
  13: 'twitter'
};

interface OdooSocialPost {
  id: number;
  message: string;
  state: string;
  post_method: string;
  account_ids: number[];
  published_date: string | false;
  create_date: string;
  engagement: number;
}

interface OdooStreamPost {
  id: number;
  message: string;
  media_type: string;
  published_date: string | false;
  account_id: [number, string] | false;
  facebook_likes_count: number;
  facebook_comments_count: number;
  facebook_shares_count: number;
  instagram_likes_count: number;
  instagram_comments_count: number;
  linkedin_likes_count: number;
  linkedin_comments_count: number;
  twitter_likes_count: number;
  twitter_comments_count: number;
  youtube_likes_count: number;
  youtube_comments_count: number;
  youtube_views_count: number;
}

interface OdooSocialAccount {
  id: number;
  name: string;
  media_type: string;
  social_account_handle: string | false;
  audience: number;
  is_media_disconnected: boolean;
}

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
    likes: number;
    comments: number;
    shares: number;
    audience: number;
  }>;
  topPosts: Array<{
    id: number;
    platform: string;
    caption: string;
    engagementRate: number;
    views: number;
    likes: number;
    shares: number;
    comments: number;
    createdAt: string;
  }>;
  accounts: Array<{
    id: number;
    name: string;
    platform: string;
    handle: string;
    audience: number;
    connected: boolean;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    // Get user cookies for Odoo session
    const userCookies = request.headers.get('cookie');
    const { cookies: odooCookies } = await getOdooSession(userCookies || undefined);

    console.log(`📊 [ANALYTICS] Fetching data from Odoo, period: ${period}`);

    // Calculate date filter based on period
    let dateFilter: [string, string, string][] = [];
    const now = new Date();

    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = [['create_date', '>=', weekAgo.toISOString().split('T')[0]]];
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = [['create_date', '>=', monthAgo.toISOString().split('T')[0]]];
    }
    // 'all' = no date filter

    // ==========================================
    // 1. FETCH SOCIAL POSTS FROM ODOO
    // ==========================================
    const postFilter: any[] = [['state', '=', 'posted'], ...dateFilter];

    const posts: OdooSocialPost[] = await callOdoo(
      odooCookies,
      'social.post',
      'search_read',
      [postFilter],
      {
        fields: ['id', 'message', 'state', 'post_method', 'account_ids', 'published_date', 'create_date', 'engagement'],
        order: 'create_date DESC',
        limit: 100
      }
    );

    console.log(`📊 [ANALYTICS] Found ${posts.length} posts`);

    // ==========================================
    // 2. FETCH STREAM POSTS WITH ENGAGEMENT METRICS
    // ==========================================
    let streamPosts: OdooStreamPost[] = [];
    try {
      const streamFilter: any[] = dateFilter.length > 0
        ? [['published_date', '>=', dateFilter[0][2]]]
        : [];

      streamPosts = await callOdoo(
        odooCookies,
        'social.stream.post',
        'search_read',
        [streamFilter],
        {
          fields: [
            'id', 'message', 'media_type', 'published_date', 'account_id',
            'facebook_likes_count', 'facebook_comments_count', 'facebook_shares_count',
            'instagram_likes_count', 'instagram_comments_count',
            'linkedin_likes_count', 'linkedin_comments_count',
            'twitter_likes_count', 'twitter_comments_count',
            'youtube_likes_count', 'youtube_comments_count', 'youtube_views_count'
          ],
          order: 'published_date DESC',
          limit: 200
        }
      );
      console.log(`📊 [ANALYTICS] Found ${streamPosts.length} stream posts with metrics`);
    } catch (e: any) {
      console.warn(`⚠️ [ANALYTICS] Could not fetch stream posts: ${e.message}`);
    }

    // ==========================================
    // 3. FETCH SOCIAL ACCOUNTS WITH AUDIENCE DATA
    // ==========================================
    const accounts: OdooSocialAccount[] = await callOdoo(
      odooCookies,
      'social.account',
      'search_read',
      [[['is_media_disconnected', '=', false]]],
      {
        fields: ['id', 'name', 'media_type', 'social_account_handle', 'audience', 'is_media_disconnected']
      }
    );

    console.log(`📊 [ANALYTICS] Found ${accounts.length} connected accounts`);

    // ==========================================
    // 4. CALCULATE TOTALS FROM STREAM POSTS
    // ==========================================
    let totalViews = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalComments = 0;

    // Aggregate metrics by platform
    const platformMetrics: Record<string, {
      posts: number;
      likes: number;
      comments: number;
      shares: number;
      views: number;
      audience: number;
    }> = {};

    // Initialize platform metrics
    ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].forEach(p => {
      platformMetrics[p] = { posts: 0, likes: 0, comments: 0, shares: 0, views: 0, audience: 0 };
    });

    // Process stream posts for engagement metrics
    for (const sp of streamPosts) {
      const platform = sp.media_type?.toLowerCase() || 'unknown';

      if (platform === 'facebook') {
        const likes = sp.facebook_likes_count || 0;
        const comments = sp.facebook_comments_count || 0;
        const shares = sp.facebook_shares_count || 0;
        totalLikes += likes;
        totalComments += comments;
        totalShares += shares;
        platformMetrics.facebook.likes += likes;
        platformMetrics.facebook.comments += comments;
        platformMetrics.facebook.shares += shares;
        platformMetrics.facebook.posts++;
      } else if (platform === 'instagram') {
        const likes = sp.instagram_likes_count || 0;
        const comments = sp.instagram_comments_count || 0;
        totalLikes += likes;
        totalComments += comments;
        platformMetrics.instagram.likes += likes;
        platformMetrics.instagram.comments += comments;
        platformMetrics.instagram.posts++;
      } else if (platform === 'linkedin') {
        const likes = sp.linkedin_likes_count || 0;
        const comments = sp.linkedin_comments_count || 0;
        totalLikes += likes;
        totalComments += comments;
        platformMetrics.linkedin.likes += likes;
        platformMetrics.linkedin.comments += comments;
        platformMetrics.linkedin.posts++;
      } else if (platform === 'twitter') {
        const likes = sp.twitter_likes_count || 0;
        const comments = sp.twitter_comments_count || 0;
        totalLikes += likes;
        totalComments += comments;
        platformMetrics.twitter.likes += likes;
        platformMetrics.twitter.comments += comments;
        platformMetrics.twitter.posts++;
      } else if (platform === 'youtube') {
        const likes = sp.youtube_likes_count || 0;
        const comments = sp.youtube_comments_count || 0;
        const views = sp.youtube_views_count || 0;
        totalLikes += likes;
        totalComments += comments;
        totalViews += views;
        platformMetrics.youtube.likes += likes;
        platformMetrics.youtube.comments += comments;
        platformMetrics.youtube.views += views;
        platformMetrics.youtube.posts++;
      }
    }

    // Add audience from accounts
    for (const acc of accounts) {
      const platform = acc.media_type?.toLowerCase();
      if (platform && platformMetrics[platform]) {
        platformMetrics[platform].audience = acc.audience || 0;
      }
    }

    // Calculate average engagement
    const totalPosts = posts.length;
    const totalEngagement = totalLikes + totalComments + totalShares;
    const totalAudience = accounts.reduce((sum, acc) => sum + (acc.audience || 0), 0);
    const avgEngagement = totalAudience > 0 ? (totalEngagement / totalAudience) * 100 : 0;

    // ==========================================
    // 5. FORMAT BY PLATFORM DATA
    // ==========================================
    const byPlatform = Object.entries(platformMetrics)
      .filter(([_, data]) => data.posts > 0 || data.audience > 0)
      .map(([platform, data]) => {
        const platformEngagement = data.likes + data.comments + data.shares;
        const platformAvgEngagement = data.audience > 0 ? (platformEngagement / data.audience) * 100 : 0;

        return {
          platform,
          posts: data.posts,
          avgEngagement: Math.round(platformAvgEngagement * 100) / 100,
          totalViews: data.views,
          likes: data.likes,
          comments: data.comments,
          shares: data.shares,
          audience: data.audience
        };
      })
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // ==========================================
    // 6. TOP POSTS (based on stream posts with most engagement)
    // ==========================================
    const topPosts = streamPosts
      .map(sp => {
        const platform = sp.media_type?.toLowerCase() || 'unknown';
        let likes = 0, comments = 0, shares = 0, views = 0;

        if (platform === 'facebook') {
          likes = sp.facebook_likes_count || 0;
          comments = sp.facebook_comments_count || 0;
          shares = sp.facebook_shares_count || 0;
        } else if (platform === 'instagram') {
          likes = sp.instagram_likes_count || 0;
          comments = sp.instagram_comments_count || 0;
        } else if (platform === 'linkedin') {
          likes = sp.linkedin_likes_count || 0;
          comments = sp.linkedin_comments_count || 0;
        } else if (platform === 'twitter') {
          likes = sp.twitter_likes_count || 0;
          comments = sp.twitter_comments_count || 0;
        } else if (platform === 'youtube') {
          likes = sp.youtube_likes_count || 0;
          comments = sp.youtube_comments_count || 0;
          views = sp.youtube_views_count || 0;
        }

        const totalEngagementPost = likes + comments + shares;
        const accountAudience = platformMetrics[platform]?.audience || 1;
        const engagementRate = (totalEngagementPost / accountAudience) * 100;

        return {
          id: sp.id,
          platform,
          caption: sp.message ? sp.message.substring(0, 100) + (sp.message.length > 100 ? '...' : '') : '',
          engagementRate: Math.round(engagementRate * 100) / 100,
          views,
          likes,
          shares,
          comments,
          createdAt: sp.published_date || ''
        };
      })
      .filter(p => p.likes > 0 || p.comments > 0 || p.shares > 0)
      .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
      .slice(0, 10);

    // ==========================================
    // 7. FORMAT ACCOUNTS DATA
    // ==========================================
    const formattedAccounts = accounts
      .filter(acc => acc.media_type !== 'push_notifications')
      .map(acc => ({
        id: acc.id,
        name: acc.name,
        platform: acc.media_type,
        handle: acc.social_account_handle || '',
        audience: acc.audience || 0,
        connected: !acc.is_media_disconnected
      }));

    // ==========================================
    // 8. BUILD RESPONSE
    // ==========================================
    const summary: AnalyticsSummary = {
      totals: {
        posts: totalPosts,
        views: totalViews,
        likes: totalLikes,
        shares: totalShares,
        comments: totalComments,
        avgEngagement: Math.round(avgEngagement * 100) / 100
      },
      byPlatform,
      topPosts,
      accounts: formattedAccounts
    };

    return NextResponse.json({
      success: true,
      data: summary,
      period,
      source: 'odoo'
    });

  } catch (error: any) {
    console.error('[ANALYTICS] Error fetching from Odoo:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics from Odoo',
        details: error.message
      },
      { status: 500 }
    );
  }
}
