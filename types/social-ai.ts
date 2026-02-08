// ==========================================
// Social AI Studio - Shared Types
// ==========================================

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
export type ContentType = 'image' | 'video' | 'both';
export type Tone = 'random' | 'professional' | 'casual' | 'fun' | 'luxury';
export type VideoStyle = 'default' | 'zoom' | 'rotate' | 'dynamic' | 'cinematic' | 'explosion' | 'orbital' | 'reassembly';
export type VideoDuration = 4 | 6 | 8;
export type PublishLanguage = 'it' | 'de' | 'fr' | 'en';
export type ArticleObjective = 'blog_seo' | 'inspirational' | 'b2b' | 'storytelling';

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  predictedEngagement: number;
  qualityScore: number;
  strengths: string[];
  improvements: string[];
  recommendation: 'ready_to_post' | 'needs_improvement' | 'regenerate';
}

export interface MarketingResult {
  copywriting: {
    caption: string;
    hashtags: string[];
    cta: string;
  };
  sentiment?: SentimentAnalysis;
  image?: {
    dataUrl: string;
  };
  video?: {
    operationId: string;
    status: 'generating' | 'completed';
    dataUrl?: string;
  };
  metadata: {
    platform: string;
    aspectRatio: string;
  };
}

// ==========================================
// Autopilot Types
// ==========================================

export interface AutopilotProduct {
  id: number;
  name: string;
  code: string;
  image: string;
  category: string;
  price?: number;
}

export interface AutopilotPost {
  id: string;
  product: AutopilotProduct;
  platform: SocialPlatform;
  tone: Tone;
  contentType: ContentType;
  videoStyle?: VideoStyle;
  videoDuration?: VideoDuration;
  scheduledFor: string;
  reasoning: string;
  result?: MarketingResult;
  status: 'queued' | 'generating' | 'ready' | 'approved' | 'published' | 'rejected' | 'failed';
  createdAt: string;
  approvedAt?: string;
  publishedAt?: string;
  error?: string;
}

export interface AutopilotQueue {
  posts: AutopilotPost[];
  stats: {
    total: number;
    queued: number;
    generating: number;
    ready: number;
    approved: number;
    published: number;
    rejected: number;
  };
}

// ==========================================
// Video Refinement Types
// ==========================================

export interface VideoRefinement {
  id: string;
  originalPrompt: string;
  refinementPrompt: string;
  videoStyle: VideoStyle;
  videoDuration: VideoDuration;
  operationId?: string;
  status: 'refining' | 'generating' | 'completed' | 'failed';
  dataUrl?: string;
  createdAt: string;
}

export interface VideoRefinementHistory {
  versions: VideoRefinement[];
  currentIndex: number;
}
