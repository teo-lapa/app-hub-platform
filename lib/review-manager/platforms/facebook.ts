/**
 * Facebook Integration (Graph API)
 * Gestisce la sincronizzazione recensioni Facebook
 * NOTA: Facebook NON permette di rispondere alle recensioni via API
 */

import { PlatformCredentials, CreateReviewInput } from '../types';

// Tipi Facebook API
interface FacebookRating {
  created_time: string;
  has_rating: boolean;
  has_review: boolean;
  rating?: number;
  recommendation_type?: 'positive' | 'negative';
  review_text?: string;
  reviewer: {
    id: string;
    name: string;
  };
  open_graph_story?: {
    id: string;
  };
}

/**
 * Fetch recensioni da Facebook Page
 * NOTA: Richiede permesso pages_read_user_content
 */
export async function fetchFacebookReviews(
  credentials: PlatformCredentials,
  sinceDate?: Date
): Promise<CreateReviewInput[]> {
  if (!credentials.accessToken || !credentials.platformPageId) {
    throw new Error('Credenziali Facebook incomplete: serve accessToken e platformPageId');
  }

  const reviews: CreateReviewInput[] = [];

  // Recupera le recensioni/ratings della pagina
  let url = `https://graph.facebook.com/v18.0/${credentials.platformPageId}/ratings?fields=created_time,has_rating,has_review,rating,recommendation_type,review_text,reviewer,open_graph_story&access_token=${credentials.accessToken}&limit=50`;

  if (sinceDate) {
    url += `&since=${Math.floor(sinceDate.getTime() / 1000)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    console.error('Facebook API error:', error);

    if (response.status === 401) {
      throw new Error('Token Facebook scaduto - necessario refresh');
    }
    throw new Error(`Errore Facebook API: ${response.status}`);
  }

  const data = await response.json();

  for (const rating of data.data || []) {
    // Solo recensioni con testo
    if (!rating.has_review && !rating.review_text) continue;

    // Converti recommendation_type in rating numerico se non c'è rating
    let numericRating = rating.rating;
    if (!numericRating && rating.recommendation_type) {
      numericRating = rating.recommendation_type === 'positive' ? 5 : 2;
    }

    reviews.push({
      businessId: credentials.businessId,
      platform: 'facebook',
      platformReviewId: rating.open_graph_story?.id || `fb-${rating.reviewer?.id}-${rating.created_time}`,
      platformUrl: `https://facebook.com/${credentials.platformPageId}/reviews`,
      reviewerName: rating.reviewer?.name || 'Utente Facebook',
      reviewerProfileUrl: rating.reviewer?.id ? `https://facebook.com/${rating.reviewer.id}` : undefined,
      rating: numericRating,
      content: rating.review_text || (rating.recommendation_type === 'positive' ? 'Consigliato' : 'Non consigliato'),
      language: detectLanguageSimple(rating.review_text || ''),
      reviewDate: new Date(rating.created_time),
      rawData: rating as unknown as Record<string, unknown>
    });
  }

  return reviews;
}

/**
 * Facebook NON supporta risposta alle recensioni via API!
 * Questa funzione restituisce sempre false e logga un warning
 */
export async function replyToFacebookReview(
  _credentials: PlatformCredentials,
  _reviewId: string,
  _replyText: string
): Promise<boolean> {
  console.warn('Facebook non supporta risposta alle recensioni via API. La risposta deve essere fatta manualmente.');

  // Potremmo in futuro implementare un workaround usando i commenti
  // sull'open_graph_story, ma non è garantito che funzioni

  return false;
}

/**
 * Ottieni info pagina Facebook
 */
export async function getFacebookPageInfo(
  accessToken: string,
  pageId: string
): Promise<{
  id: string;
  name: string;
  category: string;
  fanCount: number;
  overallStarRating: number;
  ratingCount: number;
}> {
  const url = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name,category,fan_count,overall_star_rating,rating_count&access_token=${accessToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Errore recupero info pagina Facebook');
  }

  const data = await response.json();

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    fanCount: data.fan_count || 0,
    overallStarRating: data.overall_star_rating || 0,
    ratingCount: data.rating_count || 0
  };
}

/**
 * Ottieni lista pagine gestite dall'utente
 */
export async function getFacebookPages(
  accessToken: string
): Promise<Array<{
  id: string;
  name: string;
  category: string;
  accessToken: string;
}>> {
  const url = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,category,access_token&access_token=${accessToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Errore recupero pagine Facebook');
  }

  const data = await response.json();

  return (data.data || []).map((page: Record<string, unknown>) => ({
    id: page.id as string,
    name: page.name as string,
    category: page.category as string,
    accessToken: page.access_token as string
  }));
}

/**
 * URL OAuth Facebook (condiviso con Instagram)
 */
export function getFacebookOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'pages_show_list,pages_read_engagement,pages_read_user_content',
    response_type: 'code'
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Scambia code per token (condiviso con Instagram)
 */
export async function exchangeFacebookCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Errore scambio code: ${error}`);
  }

  const data = await response.json();

  // Estendi a long-lived token
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${data.access_token}`
  );

  const longLivedData = await longLivedResponse.json();

  return {
    accessToken: longLivedData.access_token || data.access_token,
    expiresAt: new Date(Date.now() + (longLivedData.expires_in || 3600) * 1000)
  };
}

// Helper
function detectLanguageSimple(text: string): string {
  if (!text) return 'it';

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

  return 'it';
}
