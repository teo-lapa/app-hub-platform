/**
 * Review Manager - Database Service
 * Gestisce tutte le operazioni CRUD per il sistema recensioni
 */

import { sql } from '@vercel/postgres';
import {
  Business,
  CreateBusinessInput,
  PlatformCredentials,
  ConnectPlatformInput,
  Review,
  CreateReviewInput,
  ResponseTemplate,
  SyncLog,
  BusinessMetrics,
  Platform,
  ResponseStatus
} from './types';
import { encrypt, decrypt } from './crypto';

// ============================================
// BUSINESSES
// ============================================

/**
 * Crea un nuovo business (cliente)
 */
export async function createBusiness(input: CreateBusinessInput): Promise<Business> {
  const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const result = await sql`
    INSERT INTO rm_businesses (
      name, slug, owner_name, owner_email, owner_phone,
      address, city, country, logo_url,
      response_mode, response_tone, response_languages,
      subscription_plan
    ) VALUES (
      ${input.name},
      ${slug},
      ${input.ownerName || null},
      ${input.ownerEmail || null},
      ${input.ownerPhone || null},
      ${input.address || null},
      ${input.city || null},
      ${input.country || 'IT'},
      ${input.logoUrl || null},
      ${input.responseMode || 'manual'},
      ${input.responseTone || 'friendly'},
      ${JSON.stringify(input.responseLanguages || ['IT'])},
      ${input.subscriptionPlan || 'basic'}
    )
    RETURNING *
  `;

  return mapBusinessRow(result.rows[0]);
}

/**
 * Ottieni tutti i business
 */
export async function getAllBusinesses(): Promise<Business[]> {
  const result = await sql`
    SELECT * FROM rm_businesses
    WHERE is_active = true
    ORDER BY name ASC
  `;
  return result.rows.map(mapBusinessRow);
}

/**
 * Ottieni un business per ID
 */
export async function getBusinessById(id: number): Promise<Business | null> {
  const result = await sql`
    SELECT * FROM rm_businesses WHERE id = ${id}
  `;
  return result.rows[0] ? mapBusinessRow(result.rows[0]) : null;
}

/**
 * Ottieni un business per slug
 */
export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  const result = await sql`
    SELECT * FROM rm_businesses WHERE slug = ${slug}
  `;
  return result.rows[0] ? mapBusinessRow(result.rows[0]) : null;
}

/**
 * Aggiorna un business
 */
export async function updateBusiness(id: number, updates: Partial<CreateBusinessInput>): Promise<Business | null> {
  const business = await getBusinessById(id);
  if (!business) return null;

  const result = await sql`
    UPDATE rm_businesses SET
      name = COALESCE(${updates.name || null}, name),
      owner_name = COALESCE(${updates.ownerName || null}, owner_name),
      owner_email = COALESCE(${updates.ownerEmail || null}, owner_email),
      owner_phone = COALESCE(${updates.ownerPhone || null}, owner_phone),
      address = COALESCE(${updates.address || null}, address),
      city = COALESCE(${updates.city || null}, city),
      logo_url = COALESCE(${updates.logoUrl || null}, logo_url),
      response_mode = COALESCE(${updates.responseMode || null}, response_mode),
      response_tone = COALESCE(${updates.responseTone || null}, response_tone),
      response_languages = COALESCE(${updates.responseLanguages ? JSON.stringify(updates.responseLanguages) : null}, response_languages),
      subscription_plan = COALESCE(${updates.subscriptionPlan || null}, subscription_plan),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return result.rows[0] ? mapBusinessRow(result.rows[0]) : null;
}

/**
 * Elimina un business (soft delete)
 */
export async function deleteBusiness(id: number): Promise<boolean> {
  const result = await sql`
    UPDATE rm_businesses SET is_active = false WHERE id = ${id}
  `;
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// PLATFORM CREDENTIALS
// ============================================

/**
 * Connetti una piattaforma a un business
 */
export async function connectPlatform(input: ConnectPlatformInput): Promise<PlatformCredentials> {
  // Cifra le credenziali sensibili prima di salvare
  const encryptedAccessToken = encrypt(input.accessToken);
  const encryptedRefreshToken = encrypt(input.refreshToken);
  const encryptedApiKey = encrypt(input.apiKey);
  const encryptedApiSecret = encrypt(input.apiSecret);

  const result = await sql`
    INSERT INTO rm_platform_credentials (
      business_id, platform,
      platform_account_id, platform_account_name, platform_page_id,
      google_place_id, google_location_id,
      access_token, refresh_token, token_expires_at,
      api_key, api_secret,
      is_connected
    ) VALUES (
      ${input.businessId},
      ${input.platform},
      ${input.platformAccountId || null},
      ${input.platformAccountName || null},
      ${input.platformPageId || null},
      ${input.googlePlaceId || null},
      ${input.googleLocationId || null},
      ${encryptedAccessToken},
      ${encryptedRefreshToken},
      ${input.tokenExpiresAt ? input.tokenExpiresAt.toISOString() : null},
      ${encryptedApiKey},
      ${encryptedApiSecret},
      true
    )
    ON CONFLICT (business_id, platform) DO UPDATE SET
      platform_account_id = EXCLUDED.platform_account_id,
      platform_account_name = EXCLUDED.platform_account_name,
      platform_page_id = EXCLUDED.platform_page_id,
      google_place_id = EXCLUDED.google_place_id,
      google_location_id = EXCLUDED.google_location_id,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      api_key = EXCLUDED.api_key,
      api_secret = EXCLUDED.api_secret,
      is_connected = true,
      sync_error = NULL,
      updated_at = NOW()
    RETURNING *
  `;

  return mapCredentialsRow(result.rows[0]);
}

/**
 * Ottieni le credenziali di una piattaforma per un business
 */
export async function getPlatformCredentials(businessId: number, platform: Platform): Promise<PlatformCredentials | null> {
  const result = await sql`
    SELECT * FROM rm_platform_credentials
    WHERE business_id = ${businessId} AND platform = ${platform}
  `;
  return result.rows[0] ? mapCredentialsRow(result.rows[0]) : null;
}

/**
 * Ottieni tutte le piattaforme connesse per un business
 */
export async function getBusinessPlatforms(businessId: number): Promise<PlatformCredentials[]> {
  const result = await sql`
    SELECT * FROM rm_platform_credentials
    WHERE business_id = ${businessId}
    ORDER BY platform
  `;
  return result.rows.map(mapCredentialsRow);
}

/**
 * Disconnetti una piattaforma
 */
export async function disconnectPlatform(businessId: number, platform: Platform): Promise<boolean> {
  const result = await sql`
    UPDATE rm_platform_credentials
    SET is_connected = false, access_token = NULL, refresh_token = NULL
    WHERE business_id = ${businessId} AND platform = ${platform}
  `;
  return (result.rowCount ?? 0) > 0;
}

/**
 * Aggiorna ultimo sync e eventuale errore
 */
export async function updatePlatformSyncStatus(
  businessId: number,
  platform: Platform,
  error?: string
): Promise<void> {
  await sql`
    UPDATE rm_platform_credentials
    SET last_sync_at = NOW(), sync_error = ${error || null}
    WHERE business_id = ${businessId} AND platform = ${platform}
  `;
}

// ============================================
// REVIEWS
// ============================================

/**
 * Crea o aggiorna una recensione
 */
export async function upsertReview(input: CreateReviewInput): Promise<Review> {
  const result = await sql`
    INSERT INTO rm_reviews (
      business_id, platform, platform_review_id, platform_url,
      reviewer_name, reviewer_profile_url, reviewer_photo_url, reviewer_is_local_guide,
      rating, title, content, language,
      review_date, raw_data
    ) VALUES (
      ${input.businessId},
      ${input.platform},
      ${input.platformReviewId || null},
      ${input.platformUrl || null},
      ${input.reviewerName || null},
      ${input.reviewerProfileUrl || null},
      ${input.reviewerPhotoUrl || null},
      ${input.reviewerIsLocalGuide || false},
      ${input.rating || null},
      ${input.title || null},
      ${input.content || null},
      ${input.language || 'it'},
      ${input.reviewDate ? input.reviewDate.toISOString() : null},
      ${JSON.stringify(input.rawData || {})}
    )
    ON CONFLICT (business_id, platform, platform_review_id) DO UPDATE SET
      reviewer_name = EXCLUDED.reviewer_name,
      reviewer_photo_url = EXCLUDED.reviewer_photo_url,
      content = EXCLUDED.content,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
    RETURNING *
  `;

  return mapReviewRow(result.rows[0]);
}

/**
 * Ottieni recensioni per business con filtri e paginazione
 */
export async function getReviews(
  businessId: number,
  options: {
    platform?: Platform;
    status?: ResponseStatus;
    minRating?: number;
    maxRating?: number;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{ reviews: Review[]; total: number }> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  // Query base
  let whereClause = `WHERE business_id = ${businessId}`;
  if (options.platform) whereClause += ` AND platform = '${options.platform}'`;
  if (options.status) whereClause += ` AND response_status = '${options.status}'`;
  if (options.minRating) whereClause += ` AND rating >= ${options.minRating}`;
  if (options.maxRating) whereClause += ` AND rating <= ${options.maxRating}`;

  // Count
  const countResult = await sql.query(`
    SELECT COUNT(*) as total FROM rm_reviews ${whereClause}
  `);
  const total = parseInt(countResult.rows[0].total);

  // Data
  const result = await sql.query(`
    SELECT * FROM rm_reviews
    ${whereClause}
    ORDER BY review_date DESC NULLS LAST, created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  return {
    reviews: result.rows.map(mapReviewRow),
    total
  };
}

/**
 * Ottieni recensioni pending per tutti i business
 */
export async function getPendingReviews(limit: number = 50): Promise<Review[]> {
  const result = await sql`
    SELECT r.*, b.name as business_name
    FROM rm_reviews r
    JOIN rm_businesses b ON b.id = r.business_id
    WHERE r.response_status = 'pending'
    ORDER BY r.review_date DESC NULLS LAST
    LIMIT ${limit}
  `;
  return result.rows.map(mapReviewRow);
}

/**
 * Aggiorna risposta AI suggerita
 */
export async function updateAiResponse(
  reviewId: number,
  aiResponse: string,
  sentiment?: { score: number; label: string; topics: string[] }
): Promise<Review | null> {
  const result = await sql`
    UPDATE rm_reviews SET
      ai_suggested_response = ${aiResponse},
      response_status = 'ai_generated',
      sentiment_score = ${sentiment?.score || null},
      sentiment_label = ${sentiment?.label || null},
      key_topics = ${sentiment?.topics ? JSON.stringify(sentiment.topics) : null},
      updated_at = NOW()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return result.rows[0] ? mapReviewRow(result.rows[0]) : null;
}

/**
 * Approva risposta per pubblicazione
 */
export async function approveResponse(reviewId: number, finalResponse?: string): Promise<Review | null> {
  const result = await sql`
    UPDATE rm_reviews SET
      response_status = 'approved',
      final_response = COALESCE(${finalResponse || null}, ai_suggested_response),
      updated_at = NOW()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return result.rows[0] ? mapReviewRow(result.rows[0]) : null;
}

/**
 * Segna risposta come pubblicata
 */
export async function markAsPublished(reviewId: number): Promise<Review | null> {
  const result = await sql`
    UPDATE rm_reviews SET
      response_status = 'published',
      responded_at = NOW(),
      updated_at = NOW()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return result.rows[0] ? mapReviewRow(result.rows[0]) : null;
}

/**
 * Segna risposta come fallita
 */
export async function markAsFailed(reviewId: number, error: string): Promise<Review | null> {
  const result = await sql`
    UPDATE rm_reviews SET
      response_status = 'failed',
      response_error = ${error},
      updated_at = NOW()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return result.rows[0] ? mapReviewRow(result.rows[0]) : null;
}

/**
 * Rifiuta recensione (non rispondere)
 */
export async function rejectReview(reviewId: number): Promise<Review | null> {
  const result = await sql`
    UPDATE rm_reviews SET
      response_status = 'rejected',
      updated_at = NOW()
    WHERE id = ${reviewId}
    RETURNING *
  `;
  return result.rows[0] ? mapReviewRow(result.rows[0]) : null;
}

// ============================================
// SYNC LOGS
// ============================================

/**
 * Inizia un nuovo sync log
 */
export async function startSyncLog(
  businessId: number,
  platform: Platform,
  syncType: 'manual' | 'scheduled' | 'webhook'
): Promise<number> {
  const result = await sql`
    INSERT INTO rm_sync_logs (business_id, platform, sync_type, status)
    VALUES (${businessId}, ${platform}, ${syncType}, 'started')
    RETURNING id
  `;
  return result.rows[0].id;
}

/**
 * Completa un sync log
 */
export async function completeSyncLog(
  logId: number,
  stats: { fetched: number; new: number; published: number }
): Promise<void> {
  await sql`
    UPDATE rm_sync_logs SET
      status = 'completed',
      reviews_fetched = ${stats.fetched},
      reviews_new = ${stats.new},
      responses_published = ${stats.published},
      completed_at = NOW()
    WHERE id = ${logId}
  `;
}

/**
 * Fallisce un sync log
 */
export async function failSyncLog(logId: number, error: string): Promise<void> {
  await sql`
    UPDATE rm_sync_logs SET
      status = 'failed',
      error_message = ${error},
      completed_at = NOW()
    WHERE id = ${logId}
  `;
}

// ============================================
// METRICS
// ============================================

/**
 * Ricalcola le metriche per un business
 */
export async function recalculateMetrics(businessId: number): Promise<BusinessMetrics> {
  const result = await sql`
    INSERT INTO rm_business_metrics (
      business_id,
      total_reviews, average_rating,
      google_reviews, google_rating,
      instagram_comments, tiktok_comments,
      facebook_reviews, facebook_rating,
      rating_5_count, rating_4_count, rating_3_count, rating_2_count, rating_1_count,
      positive_count, neutral_count, negative_count, avg_sentiment,
      total_responses, response_rate,
      last_review_date, last_calculated_at
    )
    SELECT
      ${businessId},
      COUNT(*)::int,
      ROUND(AVG(rating)::numeric, 2),
      COUNT(*) FILTER (WHERE platform = 'google')::int,
      ROUND(AVG(rating) FILTER (WHERE platform = 'google')::numeric, 2),
      COUNT(*) FILTER (WHERE platform = 'instagram')::int,
      COUNT(*) FILTER (WHERE platform = 'tiktok')::int,
      COUNT(*) FILTER (WHERE platform = 'facebook')::int,
      ROUND(AVG(rating) FILTER (WHERE platform = 'facebook')::numeric, 2),
      COUNT(*) FILTER (WHERE rating = 5)::int,
      COUNT(*) FILTER (WHERE rating = 4)::int,
      COUNT(*) FILTER (WHERE rating = 3)::int,
      COUNT(*) FILTER (WHERE rating = 2)::int,
      COUNT(*) FILTER (WHERE rating = 1)::int,
      COUNT(*) FILTER (WHERE sentiment_label = 'positive')::int,
      COUNT(*) FILTER (WHERE sentiment_label = 'neutral')::int,
      COUNT(*) FILTER (WHERE sentiment_label = 'negative')::int,
      ROUND(AVG(sentiment_score)::numeric, 2),
      COUNT(*) FILTER (WHERE response_status = 'published')::int,
      ROUND((COUNT(*) FILTER (WHERE response_status = 'published')::numeric / NULLIF(COUNT(*), 0) * 100), 2),
      MAX(review_date),
      NOW()
    FROM rm_reviews
    WHERE business_id = ${businessId}
    ON CONFLICT (business_id) DO UPDATE SET
      total_reviews = EXCLUDED.total_reviews,
      average_rating = EXCLUDED.average_rating,
      google_reviews = EXCLUDED.google_reviews,
      google_rating = EXCLUDED.google_rating,
      instagram_comments = EXCLUDED.instagram_comments,
      tiktok_comments = EXCLUDED.tiktok_comments,
      facebook_reviews = EXCLUDED.facebook_reviews,
      facebook_rating = EXCLUDED.facebook_rating,
      rating_5_count = EXCLUDED.rating_5_count,
      rating_4_count = EXCLUDED.rating_4_count,
      rating_3_count = EXCLUDED.rating_3_count,
      rating_2_count = EXCLUDED.rating_2_count,
      rating_1_count = EXCLUDED.rating_1_count,
      positive_count = EXCLUDED.positive_count,
      neutral_count = EXCLUDED.neutral_count,
      negative_count = EXCLUDED.negative_count,
      avg_sentiment = EXCLUDED.avg_sentiment,
      total_responses = EXCLUDED.total_responses,
      response_rate = EXCLUDED.response_rate,
      last_review_date = EXCLUDED.last_review_date,
      last_calculated_at = NOW()
    RETURNING *
  `;

  return mapMetricsRow(result.rows[0]);
}

/**
 * Ottieni metriche per un business
 */
export async function getBusinessMetrics(businessId: number): Promise<BusinessMetrics | null> {
  const result = await sql`
    SELECT * FROM rm_business_metrics WHERE business_id = ${businessId}
  `;
  return result.rows[0] ? mapMetricsRow(result.rows[0]) : null;
}

// ============================================
// MAPPERS
// ============================================

function mapBusinessRow(row: Record<string, unknown>): Business {
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    ownerName: row.owner_name as string | undefined,
    ownerEmail: row.owner_email as string | undefined,
    ownerPhone: row.owner_phone as string | undefined,
    address: row.address as string | undefined,
    city: row.city as string | undefined,
    country: row.country as string,
    logoUrl: row.logo_url as string | undefined,
    responseMode: row.response_mode as 'auto' | 'manual',
    responseTone: row.response_tone as 'friendly' | 'elegant' | 'professional' | 'casual',
    responseLanguages: row.response_languages as string[],
    isActive: row.is_active as boolean,
    subscriptionPlan: row.subscription_plan as 'basic' | 'pro' | 'enterprise',
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  };
}

function mapCredentialsRow(row: Record<string, unknown>): PlatformCredentials {
  // Decifra le credenziali sensibili recuperate dal database
  const accessToken = decrypt(row.access_token as string | undefined) || undefined;
  const refreshToken = decrypt(row.refresh_token as string | undefined) || undefined;
  const apiKey = decrypt(row.api_key as string | undefined) || undefined;
  const apiSecret = decrypt(row.api_secret as string | undefined) || undefined;

  return {
    id: row.id as number,
    businessId: row.business_id as number,
    platform: row.platform as Platform,
    platformAccountId: row.platform_account_id as string | undefined,
    platformAccountName: row.platform_account_name as string | undefined,
    platformPageId: row.platform_page_id as string | undefined,
    googlePlaceId: row.google_place_id as string | undefined,
    googleLocationId: row.google_location_id as string | undefined,
    accessToken,
    refreshToken,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at as string) : undefined,
    apiKey,
    apiSecret,
    isConnected: row.is_connected as boolean,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at as string) : undefined,
    syncError: row.sync_error as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  };
}

function mapReviewRow(row: Record<string, unknown>): Review {
  return {
    id: row.id as number,
    businessId: row.business_id as number,
    platform: row.platform as Platform,
    platformReviewId: row.platform_review_id as string | undefined,
    platformUrl: row.platform_url as string | undefined,
    reviewerName: row.reviewer_name as string | undefined,
    reviewerProfileUrl: row.reviewer_profile_url as string | undefined,
    reviewerPhotoUrl: row.reviewer_photo_url as string | undefined,
    reviewerIsLocalGuide: row.reviewer_is_local_guide as boolean | undefined,
    rating: row.rating as number | undefined,
    title: row.title as string | undefined,
    content: row.content as string | undefined,
    language: row.language as string,
    sentimentScore: row.sentiment_score as number | undefined,
    sentimentLabel: row.sentiment_label as 'positive' | 'neutral' | 'negative' | undefined,
    keyTopics: row.key_topics as string[] | undefined,
    responseStatus: row.response_status as ResponseStatus,
    aiSuggestedResponse: row.ai_suggested_response as string | undefined,
    finalResponse: row.final_response as string | undefined,
    respondedAt: row.responded_at ? new Date(row.responded_at as string) : undefined,
    responseError: row.response_error as string | undefined,
    reviewDate: row.review_date ? new Date(row.review_date as string) : undefined,
    fetchedAt: new Date(row.fetched_at as string),
    rawData: row.raw_data as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string)
  };
}

function mapMetricsRow(row: Record<string, unknown>): BusinessMetrics {
  return {
    id: row.id as number,
    businessId: row.business_id as number,
    totalReviews: row.total_reviews as number,
    averageRating: row.average_rating as number | undefined,
    googleReviews: row.google_reviews as number,
    googleRating: row.google_rating as number | undefined,
    instagramComments: row.instagram_comments as number,
    tiktokComments: row.tiktok_comments as number,
    facebookReviews: row.facebook_reviews as number,
    facebookRating: row.facebook_rating as number | undefined,
    rating5Count: row.rating_5_count as number,
    rating4Count: row.rating_4_count as number,
    rating3Count: row.rating_3_count as number,
    rating2Count: row.rating_2_count as number,
    rating1Count: row.rating_1_count as number,
    positiveCount: row.positive_count as number,
    neutralCount: row.neutral_count as number,
    negativeCount: row.negative_count as number,
    avgSentiment: row.avg_sentiment as number | undefined,
    totalResponses: row.total_responses as number,
    responseRate: row.response_rate as number | undefined,
    avgResponseTimeHours: row.avg_response_time_hours as number | undefined,
    lastReviewDate: row.last_review_date ? new Date(row.last_review_date as string) : undefined,
    lastCalculatedAt: new Date(row.last_calculated_at as string)
  };
}
