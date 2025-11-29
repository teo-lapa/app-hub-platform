'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Eye, Heart, Share2, MessageCircle, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface AnalyticsData {
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
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/social-ai/analytics/summary?period=${period}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getPlatformEmoji = (platform: string): string => {
    const emojis: Record<string, string> = {
      instagram: '📸',
      facebook: '👥',
      tiktok: '🎵',
      linkedin: '💼'
    };
    return emojis[platform.toLowerCase()] || '📱';
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      instagram: 'from-pink-500 to-purple-500',
      facebook: 'from-blue-500 to-blue-600',
      tiktok: 'from-black to-pink-500',
      linkedin: 'from-blue-600 to-blue-700'
    };
    return colors[platform.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Failed to load analytics data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/social-ai-studio"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Studio</span>
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                📊 Social AI Analytics
              </h1>
              <p className="text-white/70 text-lg">
                Track performance of your AI-generated social content
              </p>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 bg-white/10 backdrop-blur-sm p-1 rounded-lg">
              {(['week', 'month', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-md font-medium transition-all ${
                    period === p
                      ? 'bg-white text-purple-900'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p === 'week' ? 'Last Week' : p === 'month' ? 'Last Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Posts"
            value={data.totals.posts}
            icon={<BarChart3 className="w-6 h-6" />}
            gradient="from-blue-500 to-cyan-500"
          />
          <KPICard
            title="Avg Engagement"
            value={`${data.totals.avgEngagement.toFixed(2)}%`}
            icon={<TrendingUp className="w-6 h-6" />}
            gradient="from-green-500 to-emerald-500"
          />
          <KPICard
            title="Total Views"
            value={formatNumber(data.totals.views)}
            icon={<Eye className="w-6 h-6" />}
            gradient="from-purple-500 to-pink-500"
          />
          <KPICard
            title="Total Likes"
            value={formatNumber(data.totals.likes)}
            icon={<Heart className="w-6 h-6" />}
            gradient="from-red-500 to-rose-500"
          />
        </div>

        {/* Platform Performance */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="text-3xl">📱</span>
            Performance by Platform
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.byPlatform.map((platform) => (
              <div
                key={platform.platform}
                className={`bg-gradient-to-br ${getPlatformColor(platform.platform)} p-6 rounded-xl text-white`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{getPlatformEmoji(platform.platform)}</span>
                  <span className="text-sm font-medium uppercase opacity-80">
                    {platform.platform}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-white/70 text-sm">Posts</p>
                    <p className="text-2xl font-bold">{platform.posts}</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Avg Engagement</p>
                    <p className="text-xl font-semibold">{platform.avgEngagement.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-white/70 text-sm">Total Views</p>
                    <p className="text-lg font-medium">{formatNumber(platform.totalViews)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canton Performance (if available) */}
        {data.byCanton && data.byCanton.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-3xl">🇨🇭</span>
              Performance by Canton
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.byCanton.map((canton) => (
                <div
                  key={canton.canton}
                  className="bg-white/5 hover:bg-white/10 transition-colors p-4 rounded-xl border border-white/10"
                >
                  <p className="text-white text-lg font-semibold mb-2">{canton.canton}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/70">{canton.posts} posts</span>
                    <span className="text-green-400 font-bold">{canton.avgEngagement.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Performing Posts */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            Top Performing Posts
          </h2>

          <div className="space-y-4">
            {data.topPosts.map((post, index) => (
              <div
                key={post.id}
                className="bg-white/5 hover:bg-white/10 transition-all p-5 rounded-xl border border-white/10 group"
              >
                <div className="flex items-start gap-4">
                  {/* Rank Badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    index === 0 ? 'bg-yellow-500 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-800' :
                    index === 2 ? 'bg-orange-400 text-orange-900' :
                    'bg-white/20 text-white'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Product Name + Platform */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-semibold text-lg">
                        {post.productName}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getPlatformColor(post.platform)} text-white`}>
                        {getPlatformEmoji(post.platform)} {post.platform}
                      </span>
                    </div>

                    {/* Caption Preview */}
                    <p className="text-white/70 text-sm mb-3 line-clamp-2">
                      {post.caption}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-green-400">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold">{post.engagementRate.toFixed(2)}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60">
                        <Eye className="w-4 h-4" />
                        <span>{formatNumber(post.views)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60">
                        <Heart className="w-4 h-4" />
                        <span>{formatNumber(post.likes)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/60">
                        <Share2 className="w-4 h-4" />
                        <span>{formatNumber(post.shares)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.topPosts.length === 0 && (
            <div className="text-center py-12 text-white/60">
              <p className="text-lg">No posts yet. Start generating content in the Studio!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// KPI Card Component
interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

function KPICard({ title, value, icon, gradient }: KPICardProps) {
  return (
    <div className={`bg-gradient-to-br ${gradient} p-6 rounded-xl text-white shadow-xl`}>
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
          {icon}
        </div>
      </div>
      <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
