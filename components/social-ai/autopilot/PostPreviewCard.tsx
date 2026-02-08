'use client';

import { useState } from 'react';
import {
  Instagram, Facebook, Linkedin, Video,
  CheckCircle2, XCircle, Edit3, Clock,
  TrendingUp, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import type { AutopilotPost, SocialPlatform } from '@/types/social-ai';
import {
  getSentimentEmoji,
  getRecommendationColor,
  getEngagementLevel
} from '@/lib/social-ai/sentiment-helpers';

const platformConfig: Record<SocialPlatform, { icon: any; color: string; bg: string; label: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-400', bg: 'from-pink-500 to-purple-500', label: 'Instagram' },
  facebook: { icon: Facebook, color: 'text-blue-400', bg: 'from-blue-500 to-blue-600', label: 'Facebook' },
  linkedin: { icon: Linkedin, color: 'text-sky-400', bg: 'from-sky-500 to-sky-600', label: 'LinkedIn' },
  tiktok: { icon: Video, color: 'text-emerald-400', bg: 'from-emerald-500 to-teal-500', label: 'TikTok' },
};

const toneLabels: Record<string, { emoji: string; label: string }> = {
  professional: { emoji: '👔', label: 'Professionale' },
  casual: { emoji: '😊', label: 'Casual' },
  fun: { emoji: '🎉', label: 'Divertente' },
  luxury: { emoji: '✨', label: 'Luxury' },
};

interface PostPreviewCardProps {
  post: AutopilotPost;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string) => void;
  isGenerating?: boolean;
  isPublishing?: boolean;
}

export default function PostPreviewCard({
  post,
  onApprove,
  onReject,
  onEdit,
  isGenerating = false,
  isPublishing = false,
}: PostPreviewCardProps) {
  const [expanded, setExpanded] = useState(false);

  const platform = platformConfig[post.platform];
  const tone = toneLabels[post.tone] || { emoji: '🎯', label: post.tone };
  const PlatformIcon = platform.icon;

  const sentiment = post.result?.sentiment;
  const hasResult = !!post.result;
  const isReady = post.status === 'ready';
  const isQueued = post.status === 'queued';

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-purple-500/30 overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
      {/* Platform header bar */}
      <div className={`bg-gradient-to-r ${platform.bg} px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <PlatformIcon className="h-4 w-4 text-white" />
          <span className="text-white text-sm font-semibold">{platform.label}</span>
          <span className="text-white/70 text-xs">
            {tone.emoji} {tone.label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-xs">
          <Clock className="h-3 w-3" />
          {new Date(post.scheduledFor).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Platform mockup */}
      <div className="p-4">
        {/* Product info */}
        <div className="flex gap-3 mb-3">
          {post.product.image && (
            <img
              src={post.product.image}
              alt={post.product.name}
              className="w-16 h-16 object-cover rounded-lg border border-purple-500/30"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{post.product.name}</h3>
            <p className="text-purple-300/70 text-xs">{typeof post.product.category === 'object' ? (post.product.category as any)?.name || 'Food' : post.product.category}</p>
            {post.product.price ? (
              <p className="text-emerald-400 text-xs font-medium">CHF {Number(post.product.price).toFixed(2)}</p>
            ) : null}
          </div>
        </div>

        {/* AI Reasoning */}
        <div className="bg-slate-900/50 rounded-lg p-2.5 mb-3 border border-purple-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-purple-300 text-[10px] font-medium uppercase tracking-wider">AI Reasoning</span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">{post.reasoning}</p>
        </div>

        {/* Generated Content Preview */}
        {hasResult && (
          <>
            {/* Image preview */}
            {post.result?.image?.dataUrl && (
              <div className="mb-3 rounded-lg overflow-hidden border border-purple-500/20">
                <img
                  src={post.result.image.dataUrl}
                  alt="Generated"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Caption preview */}
            {post.result?.copywriting && (
              <div className={`${expanded ? '' : 'max-h-24 overflow-hidden'} relative`}>
                <p className="text-white text-sm leading-relaxed mb-2">
                  {post.result.copywriting.caption}
                </p>
                {post.result.copywriting.hashtags && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {post.result.copywriting.hashtags.slice(0, expanded ? undefined : 4).map((tag, i) => (
                      <span key={i} className="text-purple-400 text-[10px] bg-purple-500/10 px-1.5 py-0.5 rounded">
                        #{tag.replace('#', '')}
                      </span>
                    ))}
                    {!expanded && post.result.copywriting.hashtags.length > 4 && (
                      <span className="text-purple-400/50 text-[10px]">
                        +{post.result.copywriting.hashtags.length - 4}
                      </span>
                    )}
                  </div>
                )}
                {!expanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-800/60 to-transparent" />
                )}
              </div>
            )}

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-purple-400 text-xs hover:text-purple-300 transition-colors mb-3"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Meno' : 'Espandi'}
            </button>

            {/* Sentiment badges */}
            {sentiment && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-slate-900/50 px-2 py-1 rounded-full border border-purple-500/20">
                  {getSentimentEmoji(sentiment.sentiment)} {Math.round(sentiment.qualityScore)}/100
                </span>
                <span className="text-xs bg-slate-900/50 px-2 py-1 rounded-full border border-purple-500/20">
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  {Math.round(sentiment.predictedEngagement)}%
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${getRecommendationColor(sentiment.recommendation)}`}>
                  {sentiment.recommendation === 'ready_to_post' ? 'Pronto' :
                   sentiment.recommendation === 'needs_improvement' ? 'Migliorabile' : 'Rigenera'}
                </span>
              </div>
            )}

            {/* Video status */}
            {post.result?.video && (
              <div className="bg-slate-900/50 rounded-lg p-2 mb-3 border border-purple-500/20">
                <div className="flex items-center gap-2">
                  <Video className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs text-purple-300">
                    {post.result.video.status === 'completed' ? 'Video pronto' : 'Video in generazione...'}
                  </span>
                  {post.result.video.status === 'completed' && post.result.video.dataUrl && (
                    <video
                      src={post.result.video.dataUrl}
                      className="w-full h-32 object-cover rounded mt-2"
                      controls
                      muted
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-purple-300 text-xs">Generazione AI in corso...</span>
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
            post.status === 'ready' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            post.status === 'queued' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            post.status === 'generating' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 animate-pulse' :
            post.status === 'approved' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
            post.status === 'published' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {post.status === 'ready' ? 'Pronto per approvazione' :
             post.status === 'queued' ? 'In coda' :
             post.status === 'generating' ? 'Generazione...' :
             post.status === 'approved' ? 'Approvato' :
             post.status === 'published' ? 'Pubblicato' :
             'Rifiutato'}
          </span>
          <span className="text-slate-500 text-[10px]">
            {post.contentType === 'image' ? 'Foto' : post.contentType === 'video' ? 'Video' : 'Foto+Video'}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {isReady && !isPublishing && (
        <div className="border-t border-purple-500/20 px-4 py-3 flex gap-2">
          <button
            onClick={() => onReject(post.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium transition-all"
          >
            <XCircle className="h-4 w-4" />
            <span>Rifiuta</span>
          </button>
          <button
            onClick={() => onEdit(post.id)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium transition-all"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onApprove(post.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Approva</span>
          </button>
        </div>
      )}

      {isPublishing && (
        <div className="border-t border-purple-500/20 px-4 py-3 flex items-center justify-center">
          <div className="flex items-center gap-2 text-purple-300">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Pubblicazione in corso...</span>
          </div>
        </div>
      )}
    </div>
  );
}
