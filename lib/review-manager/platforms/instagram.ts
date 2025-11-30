/**
 * Instagram Integration (Meta Graph API)
 * Gestisce la sincronizzazione commenti e pubblicazione risposte su Instagram
 */

import { PlatformCredentials, CreateReviewInput } from '../types';

// Tipi Instagram API
interface InstagramComment {
  id: string;
  text: string;
  timestamp: string;
  username: string;
  like_count?: number;
  replies?: {
    data: InstagramComment[];
  };
}

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  permalink: string;
  timestamp: string;
  comments?: {
    data: InstagramComment[];
  };
}

/**
 * Fetch commenti da Instagram con paginazione
 */
export async function fetchInstagramComments(
  credentials: PlatformCredentials,
  sinceDate?: Date,
  maxMediaPages: number = 3
): Promise<CreateReviewInput[]> {
  if (!credentials.accessToken || !credentials.platformPageId) {
    throw new Error('Credenziali Instagram incomplete: serve accessToken e platformPageId (Instagram Business Account ID)');
  }

  const reviews: CreateReviewInput[] = [];
  let currentPage = 0;
  let nextPageUrl: string | null = `https://graph.facebook.com/v18.0/${credentials.platformPageId}/media?fields=id,caption,media_type,permalink,timestamp,comments{id,text,timestamp,username,like_count}&access_token=${credentials.accessToken}&limit=25`;

  // Paginazione dei media
  while (nextPageUrl && currentPage < maxMediaPages) {
    try {
      const mediaResponse: Response = await fetch(nextPageUrl);

      if (!mediaResponse.ok) {
        const error = await mediaResponse.text();
        console.error('Instagram API error:', error);

        if (mediaResponse.status === 401) {
          throw new Error('Token Instagram scaduto - necessario refresh');
        }
        throw new Error(`Errore Instagram API: ${mediaResponse.status}`);
      }

      const mediaData: any = await mediaResponse.json();

      // Estrai commenti da ogni media
      for (const media of mediaData.data || []) {
        const comments = media.comments?.data || [];

        for (const comment of comments) {
          // Filtra per data se specificato
          if (sinceDate && new Date(comment.timestamp) < sinceDate) {
            continue;
          }

          reviews.push({
            businessId: credentials.businessId,
            platform: 'instagram',
            platformReviewId: comment.id,
            platformUrl: media.permalink,
            reviewerName: comment.username,
            rating: undefined, // Instagram non ha rating stelle
            content: comment.text,
            language: detectLanguageSimple(comment.text),
            reviewDate: new Date(comment.timestamp),
            rawData: {
              mediaId: media.id,
              mediaType: media.media_type,
              likeCount: comment.like_count,
              comment
            }
          });
        }
      }

      // Prossima pagina
      nextPageUrl = mediaData.paging?.next || null;
      currentPage++;
    } catch (error) {
      console.error(`Errore fetch Instagram page ${currentPage}:`, error);
      // Continua con i dati già raccolti
      break;
    }
  }

  return reviews;
}

/**
 * Rispondi a un commento Instagram
 */
export async function replyToInstagramComment(
  credentials: PlatformCredentials,
  commentId: string,
  replyText: string
): Promise<boolean> {
  if (!credentials.accessToken) {
    throw new Error('Token Instagram mancante');
  }

  const url = `https://graph.facebook.com/v18.0/${commentId}/replies`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: replyText,
      access_token: credentials.accessToken
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Errore risposta Instagram:', error);
    throw new Error(`Errore pubblicazione: ${response.status}`);
  }

  return true;
}

/**
 * Ottieni info account Instagram Business
 */
export async function getInstagramAccountInfo(
  accessToken: string,
  pageId: string
): Promise<{ id: string; username: string; name: string; followersCount: number }> {
  // Prima ottieni l'Instagram Business Account ID dalla Page
  const pageUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`;

  const pageResponse = await fetch(pageUrl);
  if (!pageResponse.ok) {
    throw new Error('Errore recupero Instagram Business Account');
  }

  const pageData = await pageResponse.json();
  const igAccountId = pageData.instagram_business_account?.id;

  if (!igAccountId) {
    throw new Error('Nessun account Instagram Business collegato a questa pagina');
  }

  // Ora recupera info account Instagram
  const igUrl = `https://graph.facebook.com/v18.0/${igAccountId}?fields=id,username,name,followers_count&access_token=${accessToken}`;

  const igResponse = await fetch(igUrl);
  if (!igResponse.ok) {
    throw new Error('Errore recupero info Instagram');
  }

  const igData = await igResponse.json();

  return {
    id: igData.id,
    username: igData.username,
    name: igData.name || igData.username,
    followersCount: igData.followers_count || 0
  };
}

/**
 * Webhook per nuovi commenti Instagram (da configurare su Meta Developer)
 * Questa funzione processa il payload del webhook
 */
export function processInstagramWebhook(payload: Record<string, unknown>): {
  type: 'comment' | 'mention' | 'unknown';
  data: Record<string, unknown>;
} | null {
  const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
  if (!entry) return null;

  const changes = entry.changes as Array<Record<string, unknown>>;
  if (!changes || changes.length === 0) return null;

  const change = changes[0];
  const field = change.field as string;
  const value = change.value as Record<string, unknown>;

  if (field === 'comments') {
    const fromUser = value.from as Record<string, unknown> | undefined;
    return {
      type: 'comment',
      data: {
        mediaId: value.media_id,
        commentId: value.id,
        text: value.text,
        username: fromUser?.username
      }
    };
  }

  if (field === 'mentions') {
    return {
      type: 'mention',
      data: {
        mediaId: value.media_id,
        commentId: value.comment_id
      }
    };
  }

  return { type: 'unknown', data: value };
}

/**
 * Ottieni URL OAuth per Instagram/Facebook
 */
export function getInstagramOAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'instagram_basic,instagram_manage_comments,pages_show_list,pages_read_engagement',
    response_type: 'code'
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Scambia code per access token
 */
export async function exchangeInstagramCode(
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

  // Converti in long-lived token
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${data.access_token}`
  );

  const longLivedData = await longLivedResponse.json();

  return {
    accessToken: longLivedData.access_token || data.access_token,
    expiresAt: new Date(Date.now() + (longLivedData.expires_in || 3600) * 1000)
  };
}

/**
 * Ottieni Page Access Token per gestire commenti
 */
export async function getPageAccessToken(
  userAccessToken: string,
  pageId: string
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=access_token&access_token=${userAccessToken}`
  );

  if (!response.ok) {
    throw new Error('Errore recupero Page Access Token');
  }

  const data = await response.json();
  return data.access_token;
}

// Helper: rileva lingua semplice
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
