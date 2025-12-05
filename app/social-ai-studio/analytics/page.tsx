'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, Eye, Heart, Share2, MessageCircle, BarChart3, Users, RefreshCw } from 'lucide-react';
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

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/social-ai/analytics/summary?period=${period}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Errore nel caricamento dei dati');
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError('Impossibile connettersi al server');
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
      linkedin: '💼',
      twitter: '🐦',
      youtube: '🎬'
    };
    return emojis[platform.toLowerCase()] || '📱';
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      instagram: 'from-pink-500 to-purple-500',
      facebook: 'from-blue-500 to-blue-600',
      tiktok: 'from-black to-pink-500',
      linkedin: 'from-blue-600 to-blue-700',
      twitter: 'from-sky-400 to-sky-500',
      youtube: 'from-red-500 to-red-600'
    };
    return colors[platform.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <div className="text-white text-xl">Caricamento analytics da Odoo...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={fetchAnalytics}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Nessun dato disponibile</div>
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
            <span>Torna allo Studio</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                📊 Social Analytics
              </h1>
              <p className="text-white/70 text-lg">
                Metriche in tempo reale da Odoo Social Marketing
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
                  {p === 'week' ? 'Settimana' : p === 'month' ? 'Mese' : 'Tutto'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <KPICard
            title="Post Pubblicati"
            value={data.totals.posts}
            icon={<BarChart3 className="w-6 h-6" />}
            gradient="from-blue-500 to-cyan-500"
          />
          <KPICard
            title="Engagement"
            value={`${data.totals.avgEngagement.toFixed(2)}%`}
            icon={<TrendingUp className="w-6 h-6" />}
            gradient="from-green-500 to-emerald-500"
          />
          <KPICard
            title="Like Totali"
            value={formatNumber(data.totals.likes)}
            icon={<Heart className="w-6 h-6" />}
            gradient="from-red-500 to-rose-500"
          />
          <KPICard
            title="Commenti"
            value={formatNumber(data.totals.comments)}
            icon={<MessageCircle className="w-6 h-6" />}
            gradient="from-purple-500 to-pink-500"
          />
          <KPICard
            title="Condivisioni"
            value={formatNumber(data.totals.shares)}
            icon={<Share2 className="w-6 h-6" />}
            gradient="from-orange-500 to-amber-500"
          />
        </div>

        {/* Connected Accounts */}
        {data.accounts && data.accounts.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-3xl">🔗</span>
              Account Collegati
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {data.accounts.map((account) => (
                <div
                  key={account.id}
                  className={`bg-gradient-to-br ${getPlatformColor(account.platform)} p-4 rounded-xl text-white`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{getPlatformEmoji(account.platform)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{account.name}</p>
                      {account.handle && (
                        <p className="text-sm opacity-80 truncate">@{account.handle}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 opacity-70" />
                    <span className="font-bold">{formatNumber(account.audience)}</span>
                    <span className="text-sm opacity-70">follower</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform Performance */}
        {data.byPlatform && data.byPlatform.length > 0 && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 mb-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-3xl">📱</span>
              Performance per Piattaforma
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {data.byPlatform.map((platform) => (
                <div
                  key={platform.platform}
                  className={`bg-gradient-to-br ${getPlatformColor(platform.platform)} p-5 rounded-xl text-white`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{getPlatformEmoji(platform.platform)}</span>
                    <span className="text-sm font-medium uppercase opacity-80">
                      {platform.platform}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Engagement</span>
                      <span className="text-xl font-bold">{platform.avgEngagement.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Like</span>
                      <span className="font-semibold">{formatNumber(platform.likes)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Commenti</span>
                      <span className="font-semibold">{formatNumber(platform.comments)}</span>
                    </div>
                    {platform.shares > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Condivisioni</span>
                        <span className="font-semibold">{formatNumber(platform.shares)}</span>
                      </div>
                    )}
                    {platform.totalViews > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Views</span>
                        <span className="font-semibold">{formatNumber(platform.totalViews)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-sm">Audience</span>
                        <span className="font-semibold">{formatNumber(platform.audience)}</span>
                      </div>
                    </div>
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
            Post con Migliore Performance
          </h2>

          {data.topPosts && data.topPosts.length > 0 ? (
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
                      {/* Platform Badge */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getPlatformColor(post.platform)} text-white`}>
                          {getPlatformEmoji(post.platform)} {post.platform}
                        </span>
                        {post.createdAt && (
                          <span className="text-white/50 text-sm">
                            {new Date(post.createdAt).toLocaleDateString('it-IT')}
                          </span>
                        )}
                      </div>

                      {/* Caption Preview */}
                      <p className="text-white/80 text-sm mb-3 line-clamp-2">
                        {post.caption}
                      </p>

                      {/* Metrics */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          <span className="font-bold">{post.engagementRate.toFixed(2)}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60">
                          <Heart className="w-4 h-4" />
                          <span>{formatNumber(post.likes)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/60">
                          <MessageCircle className="w-4 h-4" />
                          <span>{formatNumber(post.comments)}</span>
                        </div>
                        {post.shares > 0 && (
                          <div className="flex items-center gap-2 text-white/60">
                            <Share2 className="w-4 h-4" />
                            <span>{formatNumber(post.shares)}</span>
                          </div>
                        )}
                        {post.views > 0 && (
                          <div className="flex items-center gap-2 text-white/60">
                            <Eye className="w-4 h-4" />
                            <span>{formatNumber(post.views)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/60">
              <p className="text-lg mb-2">Nessun post con engagement trovato</p>
              <p className="text-sm">I post con like, commenti o condivisioni appariranno qui</p>
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
    <div className={`bg-gradient-to-br ${gradient} p-5 rounded-xl text-white shadow-xl`}>
      <div className="flex items-center justify-between mb-3">
        <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
          {icon}
        </div>
      </div>
      <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
