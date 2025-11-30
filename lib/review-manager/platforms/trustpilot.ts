/**
 * Trustpilot Integration
 * Gestisce la sincronizzazione recensioni e risposte su Trustpilot Business
 */

import { PlatformCredentials, CreateReviewInput } from '../types';

// Tipi Trustpilot API
interface TrustpilotReview {
  id: string;
  consumer: {
    displayName: string;
    displayLocation?: string;
  };
  stars: number;
  title?: string;
  text: string;
  language: string;
  createdAt: string;
  referenceId?: string;
  companyReply?: {
    text: string;
    createdAt: string;
  };
  isVerified: boolean;
}

interface TrustpilotReviewsResponse {
  reviews: TrustpilotReview[];
  links: {
    next?: string;
  };
}

/**
 * Fetch recensioni da Trustpilot
 * Usa Business Unit Reviews API
 */
export async function fetchTrustpilotReviews(
  credentials: PlatformCredentials,
  sinceDate?: Date,
  maxPages: number = 5
): Promise<CreateReviewInput[]> {
  if (!credentials.apiKey || !credentials.platformAccountId) {
    throw new Error('Credenziali Trustpilot incomplete: serve apiKey e platformAccountId (Business Unit ID)');
  }

  const reviews: CreateReviewInput[] = [];
  let currentPage = 0;
  let nextPageUrl: string | null = `https://api.trustpilot.com/v1/business-units/${credentials.platformAccountId}/reviews?perPage=100`;

  // Paginazione
  while (nextPageUrl && currentPage < maxPages) {
    try {
      const response = await fetch(nextPageUrl, {
        headers: {
          'apikey': credentials.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Trustpilot API error:', error);

        if (response.status === 401) {
          throw new Error('API key Trustpilot non valida');
        }
        throw new Error(`Errore Trustpilot API: ${response.status}`);
      }

      const data: TrustpilotReviewsResponse = await response.json();

      for (const review of data.reviews || []) {
        const reviewDate = new Date(review.createdAt);

        // Filtra per data se specificato
        if (sinceDate && reviewDate < sinceDate) continue;

        reviews.push({
          businessId: credentials.businessId,
          platform: 'trustpilot',
          platformReviewId: review.id,
          platformUrl: `https://www.trustpilot.com/reviews/${review.id}`,
          reviewerName: review.consumer.displayName,
          rating: review.stars,
          title: review.title,
          content: review.text,
          language: review.language,
          reviewDate,
          rawData: {
            referenceId: review.referenceId,
            isVerified: review.isVerified,
            location: review.consumer.displayLocation,
            hasReply: !!review.companyReply,
            review
          }
        });
      }

      // Prossima pagina
      nextPageUrl = data.links?.next || null;
      currentPage++;

      // Rate limiting - Trustpilot ha limiti stretti
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Errore fetch Trustpilot page ${currentPage}:`, error);
      break;
    }
  }

  return reviews;
}

/**
 * Rispondi a una recensione Trustpilot
 * Richiede OAuth 2.0 access token (non API key)
 */
export async function replyToTrustpilotReview(
  credentials: PlatformCredentials,
  reviewId: string,
  replyText: string
): Promise<boolean> {
  if (!credentials.accessToken || !credentials.platformAccountId) {
    throw new Error('Access token Trustpilot o Business Unit ID mancante');
  }

  const url = `https://api.trustpilot.com/v1/business-units/${credentials.platformAccountId}/reviews/${reviewId}/reply`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: replyText
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Errore risposta Trustpilot:', error);

    if (response.status === 401) {
      throw new Error('Access token Trustpilot scaduto');
    }
    throw new Error(`Errore pubblicazione: ${response.status}`);
  }

  return true;
}

/**
 * Aggiorna una risposta esistente
 */
export async function updateTrustpilotReply(
  credentials: PlatformCredentials,
  reviewId: string,
  replyText: string
): Promise<boolean> {
  if (!credentials.accessToken || !credentials.platformAccountId) {
    throw new Error('Access token Trustpilot mancante');
  }

  const url = `https://api.trustpilot.com/v1/business-units/${credentials.platformAccountId}/reviews/${reviewId}/reply`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: replyText
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Errore aggiornamento risposta Trustpilot:', error);
    throw new Error(`Errore aggiornamento: ${response.status}`);
  }

  return true;
}

/**
 * Elimina una risposta
 */
export async function deleteTrustpilotReply(
  credentials: PlatformCredentials,
  reviewId: string
): Promise<boolean> {
  if (!credentials.accessToken || !credentials.platformAccountId) {
    throw new Error('Access token Trustpilot mancante');
  }

  const url = `https://api.trustpilot.com/v1/business-units/${credentials.platformAccountId}/reviews/${reviewId}/reply`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    }
  });

  return response.ok;
}

/**
 * Ottieni info Business Unit Trustpilot
 */
export async function getTrustpilotBusinessInfo(
  apiKey: string,
  businessUnitId: string
): Promise<{
  id: string;
  displayName: string;
  trustScore: number;
  stars: number;
  numberOfReviews: number;
}> {
  const response = await fetch(
    `https://api.trustpilot.com/v1/business-units/${businessUnitId}`,
    {
      headers: {
        'apikey': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error('Errore recupero info Business Unit');
  }

  const data = await response.json();

  return {
    id: data.id,
    displayName: data.displayName,
    trustScore: data.score?.trustScore || 0,
    stars: data.score?.stars || 0,
    numberOfReviews: data.numberOfReviews?.total || 0
  };
}

/**
 * Cerca Business Unit per dominio/nome
 */
export async function searchTrustpilotBusinessUnits(
  apiKey: string,
  query: string
): Promise<Array<{ id: string; displayName: string; domain: string }>> {
  const response = await fetch(
    `https://api.trustpilot.com/v1/business-units/search?name=${encodeURIComponent(query)}`,
    {
      headers: {
        'apikey': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error('Errore ricerca Business Units');
  }

  const data = await response.json();

  return (data.businessUnits || []).map((bu: Record<string, unknown>) => ({
    id: bu.id as string,
    displayName: bu.displayName as string,
    domain: (bu.websiteUrl as string)?.replace(/^https?:\/\//, '').split('/')[0] || ''
  }));
}

/**
 * URL OAuth Trustpilot
 */
export function getTrustpilotOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'review_invitation review_moderation',
    state
  });

  return `https://authenticate.trustpilot.com/?${params.toString()}`;
}

/**
 * Scambia code per access token Trustpilot
 */
export async function exchangeTrustpilotCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Errore scambio code Trustpilot: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

/**
 * Refresh token Trustpilot
 */
export async function refreshTrustpilotToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    throw new Error('Errore refresh token Trustpilot');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Trustpilot potrebbe non rinnovare refresh token
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

/**
 * Ottieni statistiche recensioni (trend, distribuzione stelle)
 */
export async function getTrustpilotReviewStats(
  apiKey: string,
  businessUnitId: string
): Promise<{
  total: number;
  stars1: number;
  stars2: number;
  stars3: number;
  stars4: number;
  stars5: number;
  averageStars: number;
  trustScore: number;
}> {
  const response = await fetch(
    `https://api.trustpilot.com/v1/business-units/${businessUnitId}`,
    {
      headers: {
        'apikey': apiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error('Errore recupero stats');
  }

  const data = await response.json();

  return {
    total: data.numberOfReviews?.total || 0,
    stars1: data.numberOfReviews?.oneStar || 0,
    stars2: data.numberOfReviews?.twoStars || 0,
    stars3: data.numberOfReviews?.threeStars || 0,
    stars4: data.numberOfReviews?.fourStars || 0,
    stars5: data.numberOfReviews?.fiveStars || 0,
    averageStars: data.score?.stars || 0,
    trustScore: data.score?.trustScore || 0
  };
}
