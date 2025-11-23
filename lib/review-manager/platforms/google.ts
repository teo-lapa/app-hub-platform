/**
 * Google My Business Integration
 * Gestisce la sincronizzazione recensioni e pubblicazione risposte su Google
 */

import { PlatformCredentials, CreateReviewInput } from '../types';

// Tipi Google API
interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

interface GoogleReviewsResponse {
  reviews: GoogleReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
}

// Mapping stelle Google -> numero
const STAR_RATING_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
};

/**
 * Fetch recensioni da Google My Business API
 */
export async function fetchGoogleReviews(
  credentials: PlatformCredentials,
  pageToken?: string
): Promise<{ reviews: CreateReviewInput[]; nextPageToken?: string; total: number }> {
  if (!credentials.accessToken || !credentials.googleLocationId) {
    throw new Error('Credenziali Google incomplete: serve accessToken e googleLocationId');
  }

  const url = new URL(
    `https://mybusiness.googleapis.com/v4/accounts/${credentials.platformAccountId}/locations/${credentials.googleLocationId}/reviews`
  );

  if (pageToken) {
    url.searchParams.set('pageToken', pageToken);
  }
  url.searchParams.set('pageSize', '50');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Google API error:', error);

    if (response.status === 401) {
      throw new Error('Token Google scaduto - necessario refresh');
    }
    throw new Error(`Errore Google API: ${response.status}`);
  }

  const data: GoogleReviewsResponse = await response.json();

  const reviews: CreateReviewInput[] = (data.reviews || []).map(review => ({
    businessId: credentials.businessId,
    platform: 'google',
    platformReviewId: review.reviewId,
    platformUrl: `https://search.google.com/local/reviews?placeid=${credentials.googlePlaceId}`,
    reviewerName: review.reviewer.isAnonymous ? 'Anonimo' : review.reviewer.displayName,
    reviewerPhotoUrl: review.reviewer.profilePhotoUrl,
    reviewerIsLocalGuide: false, // Non disponibile in questa API
    rating: STAR_RATING_MAP[review.starRating] || 3,
    content: review.comment || '',
    language: detectLanguageSimple(review.comment || ''),
    reviewDate: new Date(review.createTime),
    rawData: review as unknown as Record<string, unknown>
  }));

  return {
    reviews,
    nextPageToken: data.nextPageToken,
    total: data.totalReviewCount
  };
}

/**
 * Pubblica risposta su Google
 */
export async function publishGoogleReply(
  credentials: PlatformCredentials,
  reviewId: string,
  replyText: string
): Promise<boolean> {
  if (!credentials.accessToken || !credentials.googleLocationId) {
    throw new Error('Credenziali Google incomplete');
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${credentials.platformAccountId}/locations/${credentials.googleLocationId}/reviews/${reviewId}/reply`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      comment: replyText
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Errore pubblicazione Google:', error);
    throw new Error(`Errore pubblicazione: ${response.status}`);
  }

  return true;
}

/**
 * Elimina risposta da Google
 */
export async function deleteGoogleReply(
  credentials: PlatformCredentials,
  reviewId: string
): Promise<boolean> {
  if (!credentials.accessToken || !credentials.googleLocationId) {
    throw new Error('Credenziali Google incomplete');
  }

  const url = `https://mybusiness.googleapis.com/v4/accounts/${credentials.platformAccountId}/locations/${credentials.googleLocationId}/reviews/${reviewId}/reply`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`
    }
  });

  return response.ok;
}

/**
 * Refresh access token Google
 */
export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error('Errore refresh token Google');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

/**
 * Ottieni URL per OAuth Google
 */
export function getGoogleOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Scambia code per tokens
 */
export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Errore scambio code: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
  };
}

/**
 * Ottieni lista locations per un account Google My Business
 */
export async function getGoogleLocations(
  accessToken: string,
  accountId: string
): Promise<Array<{ id: string; name: string; address: string }>> {
  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Errore recupero locations');
  }

  const data = await response.json();

  return (data.locations || []).map((loc: Record<string, unknown>) => ({
    id: (loc.name as string)?.split('/').pop() || '',
    name: (loc.locationName as string) || '',
    address: formatGoogleAddress(loc.address as Record<string, string>)
  }));
}

/**
 * Ottieni lista accounts Google My Business
 */
export async function getGoogleAccounts(
  accessToken: string
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch('https://mybusiness.googleapis.com/v4/accounts', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Errore recupero accounts');
  }

  const data = await response.json();

  return (data.accounts || []).map((acc: Record<string, string>) => ({
    id: acc.name?.split('/').pop() || '',
    name: acc.accountName || ''
  }));
}

// Helper: rileva lingua semplice
function detectLanguageSimple(text: string): string {
  if (!text) return 'it';

  // Parole comuni per lingua
  const patterns: Record<string, RegExp[]> = {
    it: [/\b(ottimo|buono|bello|grazie|molto|sempre|anche|questo|quello)\b/i],
    en: [/\b(good|great|nice|thanks|very|always|also|this|that|the)\b/i],
    de: [/\b(gut|sehr|danke|immer|auch|diese|jene|der|die|das)\b/i],
    fr: [/\b(bon|bien|merci|très|toujours|aussi|cette|cette|le|la)\b/i]
  };

  for (const [lang, regexes] of Object.entries(patterns)) {
    if (regexes.some(r => r.test(text))) {
      return lang;
    }
  }

  return 'it'; // Default italiano
}

// Helper: formatta indirizzo Google
function formatGoogleAddress(address: Record<string, string> | undefined): string {
  if (!address) return '';

  const parts = [
    address.addressLines?.[0],
    address.locality,
    address.postalCode,
    address.regionCode
  ].filter(Boolean);

  return parts.join(', ');
}
