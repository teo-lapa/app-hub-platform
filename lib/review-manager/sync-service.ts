/**
 * Review Manager - Sync Service
 * Servizio unificato per sincronizzare recensioni da tutte le piattaforme
 */

import {
  getBusinessById,
  getBusinessPlatforms,
  upsertReview,
  updateAiResponse,
  approveResponse,
  markAsPublished,
  markAsFailed,
  startSyncLog,
  completeSyncLog,
  failSyncLog,
  updatePlatformSyncStatus,
  recalculateMetrics,
  getPlatformCredentials
} from './db-service';
import { generateResponse } from './ai-service';
import { Platform, PlatformCredentials, CreateReviewInput, Review } from './types';

// Platform imports
import { fetchGoogleReviews, publishGoogleReply } from './platforms/google';
import { fetchInstagramComments, replyToInstagramComment } from './platforms/instagram';
import { fetchFacebookReviews } from './platforms/facebook';
import { fetchTikTokComments, replyToTikTokComment } from './platforms/tiktok';

export interface SyncResult {
  platform: Platform;
  success: boolean;
  reviewsFetched: number;
  reviewsNew: number;
  responsesGenerated: number;
  responsesPublished: number;
  error?: string;
}

export interface FullSyncResult {
  businessId: number;
  businessName: string;
  results: SyncResult[];
  totalNew: number;
  totalPublished: number;
  duration: number;
}

/**
 * Sincronizza tutte le piattaforme per un business
 */
export async function syncAllPlatforms(businessId: number): Promise<FullSyncResult> {
  const startTime = Date.now();

  const business = await getBusinessById(businessId);
  if (!business) {
    throw new Error('Business non trovato');
  }

  const platforms = await getBusinessPlatforms(businessId);
  const connectedPlatforms = platforms.filter(p => p.isConnected);

  const results: SyncResult[] = [];

  for (const platform of connectedPlatforms) {
    try {
      const result = await syncPlatform(businessId, platform.platform);
      results.push(result);
    } catch (error) {
      results.push({
        platform: platform.platform,
        success: false,
        reviewsFetched: 0,
        reviewsNew: 0,
        responsesGenerated: 0,
        responsesPublished: 0,
        error: error instanceof Error ? error.message : 'Errore sconosciuto'
      });
    }
  }

  // Ricalcola metriche
  await recalculateMetrics(businessId);

  return {
    businessId,
    businessName: business.name,
    results,
    totalNew: results.reduce((sum, r) => sum + r.reviewsNew, 0),
    totalPublished: results.reduce((sum, r) => sum + r.responsesPublished, 0),
    duration: Date.now() - startTime
  };
}

/**
 * Sincronizza una singola piattaforma
 */
export async function syncPlatform(
  businessId: number,
  platform: Platform
): Promise<SyncResult> {
  const credentials = await getPlatformCredentials(businessId, platform);

  if (!credentials || !credentials.isConnected) {
    return {
      platform,
      success: false,
      reviewsFetched: 0,
      reviewsNew: 0,
      responsesGenerated: 0,
      responsesPublished: 0,
      error: 'Piattaforma non connessa'
    };
  }

  // Inizia log
  const logId = await startSyncLog(businessId, platform, 'manual');

  try {
    // 1. Fetch recensioni dalla piattaforma
    const reviews = await fetchReviewsFromPlatform(credentials);

    // 2. Salva nel database
    let newCount = 0;
    const savedReviews: Review[] = [];

    for (const reviewInput of reviews) {
      const saved = await upsertReview(reviewInput);
      savedReviews.push(saved);

      // Conta come nuova se appena creata (non aveva risposta AI)
      if (!saved.aiSuggestedResponse) {
        newCount++;
      }
    }

    // 3. Genera risposte AI per le nuove
    const business = await getBusinessById(businessId);
    let responsesGenerated = 0;

    if (business) {
      for (const review of savedReviews) {
        if (review.responseStatus === 'pending' && review.content) {
          try {
            const aiResult = await generateResponse(
              {
                reviewerName: review.reviewerName || 'Cliente',
                rating: review.rating || 3,
                content: review.content,
                language: review.language,
                platform: review.platform
              },
              {
                businessName: business.name,
                responseTone: business.responseTone,
                responseLanguages: business.responseLanguages
              }
            );

            await updateAiResponse(review.id, aiResult.response, {
              score: aiResult.sentiment.score,
              label: aiResult.sentiment.label,
              topics: aiResult.sentiment.keyTopics
            });

            responsesGenerated++;

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Errore generazione AI per review ${review.id}:`, error);
          }
        }
      }
    }

    // 4. Se modalità AUTO, pubblica risposte
    let responsesPublished = 0;

    if (business?.responseMode === 'auto') {
      for (const review of savedReviews) {
        if (review.aiSuggestedResponse && review.responseStatus === 'ai_generated') {
          try {
            // Approva automaticamente
            await approveResponse(review.id);

            // Pubblica sulla piattaforma
            const published = await publishResponseToPlatform(
              credentials,
              review,
              review.aiSuggestedResponse
            );

            if (published) {
              await markAsPublished(review.id);
              responsesPublished++;
            }
          } catch (error) {
            console.error(`Errore pubblicazione review ${review.id}:`, error);
            await markAsFailed(review.id, error instanceof Error ? error.message : 'Errore');
          }
        }
      }
    }

    // Aggiorna stato sync
    await updatePlatformSyncStatus(businessId, platform);

    // Completa log
    await completeSyncLog(logId, {
      fetched: reviews.length,
      new: newCount,
      published: responsesPublished
    });

    return {
      platform,
      success: true,
      reviewsFetched: reviews.length,
      reviewsNew: newCount,
      responsesGenerated,
      responsesPublished
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';

    await failSyncLog(logId, errorMessage);
    await updatePlatformSyncStatus(businessId, platform, errorMessage);

    return {
      platform,
      success: false,
      reviewsFetched: 0,
      reviewsNew: 0,
      responsesGenerated: 0,
      responsesPublished: 0,
      error: errorMessage
    };
  }
}

/**
 * Fetch recensioni dalla piattaforma corretta
 */
async function fetchReviewsFromPlatform(
  credentials: PlatformCredentials
): Promise<CreateReviewInput[]> {
  switch (credentials.platform) {
    case 'google':
      const googleResult = await fetchGoogleReviews(credentials);
      return googleResult.reviews;

    case 'instagram':
      return await fetchInstagramComments(credentials);

    case 'facebook':
      return await fetchFacebookReviews(credentials);

    case 'tiktok':
      return await fetchTikTokComments(credentials);

    case 'trustpilot':
      // TODO: Implementare Trustpilot
      return [];

    default:
      throw new Error(`Piattaforma ${credentials.platform} non supportata`);
  }
}

/**
 * Pubblica risposta sulla piattaforma corretta
 */
async function publishResponseToPlatform(
  credentials: PlatformCredentials,
  review: Review,
  responseText: string
): Promise<boolean> {
  switch (credentials.platform) {
    case 'google':
      if (!review.platformReviewId) return false;
      return await publishGoogleReply(credentials, review.platformReviewId, responseText);

    case 'instagram':
      if (!review.platformReviewId) return false;
      return await replyToInstagramComment(credentials, review.platformReviewId, responseText);

    case 'tiktok':
      if (!review.platformReviewId || !review.rawData?.videoId) return false;
      return await replyToTikTokComment(
        credentials,
        review.rawData.videoId as string,
        review.platformReviewId,
        responseText
      );

    case 'facebook':
      // Facebook NON supporta risposta via API
      console.warn('Facebook non supporta risposta automatica');
      return false;

    case 'trustpilot':
      // TODO: Implementare Trustpilot
      return false;

    default:
      return false;
  }
}

/**
 * Pubblica manualmente una risposta approvata
 */
export async function publishApprovedResponse(
  reviewId: number
): Promise<{ success: boolean; error?: string }> {
  const { sql } = await import('@vercel/postgres');

  const reviewResult = await sql`
    SELECT r.*, b.response_mode
    FROM rm_reviews r
    JOIN rm_businesses b ON b.id = r.business_id
    WHERE r.id = ${reviewId}
  `;

  if (reviewResult.rows.length === 0) {
    return { success: false, error: 'Recensione non trovata' };
  }

  const review = reviewResult.rows[0];

  if (review.response_status !== 'approved') {
    return { success: false, error: 'Recensione non approvata' };
  }

  const credentials = await getPlatformCredentials(review.business_id, review.platform);

  if (!credentials || !credentials.isConnected) {
    return { success: false, error: 'Piattaforma non connessa' };
  }

  try {
    const responseText = review.final_response || review.ai_suggested_response;

    if (!responseText) {
      return { success: false, error: 'Nessuna risposta da pubblicare' };
    }

    const published = await publishResponseToPlatform(
      credentials,
      {
        id: review.id,
        businessId: review.business_id,
        platform: review.platform,
        platformReviewId: review.platform_review_id,
        rawData: review.raw_data
      } as Review,
      responseText
    );

    if (published) {
      await markAsPublished(reviewId);
      return { success: true };
    } else {
      return { success: false, error: 'Pubblicazione non riuscita' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Errore pubblicazione';
    await markAsFailed(reviewId, errorMessage);
    return { success: false, error: errorMessage };
  }
}
