/**
 * Review Manager - TypeScript Types
 */

// ============================================
// Business (Cliente/Ristorante)
// ============================================
export interface Business {
  id: number;
  name: string;
  slug: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
  country: string;
  logoUrl?: string;

  // Impostazioni AI
  responseMode: 'auto' | 'manual';
  responseTone: 'friendly' | 'elegant' | 'professional' | 'casual';
  responseLanguages: string[];

  // Stato
  isActive: boolean;
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';

  // Timestamp
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBusinessInput {
  name: string;
  slug?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  responseMode?: 'auto' | 'manual';
  responseTone?: 'friendly' | 'elegant' | 'professional' | 'casual';
  responseLanguages?: string[];
  subscriptionPlan?: 'basic' | 'pro' | 'enterprise';
}

// ============================================
// Platform Credentials
// ============================================
export type Platform = 'google' | 'instagram' | 'tiktok' | 'facebook' | 'trustpilot';

export interface PlatformCredentials {
  id: number;
  businessId: number;
  platform: Platform;

  platformAccountId?: string;
  platformAccountName?: string;
  platformPageId?: string;
  googlePlaceId?: string;
  googleLocationId?: string;

  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;

  apiKey?: string;
  apiSecret?: string;

  isConnected: boolean;
  lastSyncAt?: Date;
  syncError?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectPlatformInput {
  businessId: number;
  platform: Platform;
  platformAccountId?: string;
  platformAccountName?: string;
  platformPageId?: string;
  googlePlaceId?: string;
  googleLocationId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  apiKey?: string;
  apiSecret?: string;
}

// ============================================
// Reviews
// ============================================
export type ResponseStatus =
  | 'pending'
  | 'ai_generated'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'failed';

export interface Review {
  id: number;
  businessId: number;

  platform: Platform;
  platformReviewId?: string;
  platformUrl?: string;

  reviewerName?: string;
  reviewerProfileUrl?: string;
  reviewerPhotoUrl?: string;
  reviewerIsLocalGuide?: boolean;

  rating?: number;
  title?: string;
  content?: string;
  language: string;

  sentimentScore?: number;
  sentimentLabel?: 'positive' | 'neutral' | 'negative';
  keyTopics?: string[];

  responseStatus: ResponseStatus;
  aiSuggestedResponse?: string;
  finalResponse?: string;
  respondedAt?: Date;
  responseError?: string;

  reviewDate?: Date;
  fetchedAt: Date;

  rawData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewInput {
  businessId: number;
  platform: Platform;
  platformReviewId?: string;
  platformUrl?: string;
  reviewerName?: string;
  reviewerProfileUrl?: string;
  reviewerPhotoUrl?: string;
  reviewerIsLocalGuide?: boolean;
  rating?: number;
  title?: string;
  content?: string;
  language?: string;
  reviewDate?: Date;
  rawData?: Record<string, unknown>;
}

// ============================================
// Response Templates
// ============================================
export type TemplateCategory =
  | 'positive_5star'
  | 'positive_4star'
  | 'neutral_3star'
  | 'negative_2star'
  | 'negative_1star'
  | 'generic';

export interface ResponseTemplate {
  id: number;
  businessId?: number;
  name: string;
  category: TemplateCategory;
  language: string;
  templateText: string;
  isActive: boolean;
  createdAt: Date;
}

// ============================================
// Sync Logs
// ============================================
export interface SyncLog {
  id: number;
  businessId?: number;
  platform?: Platform;
  syncType: 'manual' | 'scheduled' | 'webhook';
  status: 'started' | 'completed' | 'failed';
  reviewsFetched: number;
  reviewsNew: number;
  responsesPublished: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// Business Metrics
// ============================================
export interface BusinessMetrics {
  id: number;
  businessId: number;

  totalReviews: number;
  averageRating?: number;

  googleReviews: number;
  googleRating?: number;
  instagramComments: number;
  tiktokComments: number;
  facebookReviews: number;
  facebookRating?: number;

  rating5Count: number;
  rating4Count: number;
  rating3Count: number;
  rating2Count: number;
  rating1Count: number;

  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  avgSentiment?: number;

  totalResponses: number;
  responseRate?: number;
  avgResponseTimeHours?: number;

  lastReviewDate?: Date;
  lastCalculatedAt: Date;
}

// ============================================
// API Responses
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Dashboard Stats
// ============================================
export interface DashboardStats {
  business: Business;
  metrics: BusinessMetrics;
  recentReviews: Review[];
  pendingCount: number;
  platformStats: {
    platform: Platform;
    count: number;
    avgRating?: number;
    isConnected: boolean;
  }[];
  ratingTrend: {
    date: string;
    avgRating: number;
    count: number;
  }[];
}
