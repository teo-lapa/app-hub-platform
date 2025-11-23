/**
 * TikTok Integration
 * Gestisce la sincronizzazione commenti e risposte su TikTok Business
 */

import { PlatformCredentials, CreateReviewInput } from '../types';

// Tipi TikTok API
interface TikTokComment {
  id: string;
  text: string;
  create_time: number;
  user: {
    open_id: string;
    display_name: string;
    avatar_url?: string;
  };
  like_count: number;
  reply_count: number;
}

interface TikTokVideo {
  id: string;
  title?: string;
  description?: string;
  create_time: number;
  share_url: string;
  like_count: number;
  comment_count: number;
  view_count: number;
}

/**
 * Fetch commenti dai video TikTok
 * Richiede TikTok Business Account e API access
 */
export async function fetchTikTokComments(
  credentials: PlatformCredentials,
  sinceDate?: Date
): Promise<CreateReviewInput[]> {
  if (!credentials.accessToken) {
    throw new Error('Token TikTok mancante');
  }

  const reviews: CreateReviewInput[] = [];

  // 1. Recupera lista video
  const videosResponse = await fetch(
    'https://open.tiktokapis.com/v2/video/list/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_count: 20,
        fields: ['id', 'title', 'description', 'create_time', 'share_url', 'like_count', 'comment_count', 'view_count']
      })
    }
  );

  if (!videosResponse.ok) {
    const error = await videosResponse.text();
    console.error('TikTok API error:', error);

    if (videosResponse.status === 401) {
      throw new Error('Token TikTok scaduto - necessario refresh');
    }
    throw new Error(`Errore TikTok API: ${videosResponse.status}`);
  }

  const videosData = await videosResponse.json();
  const videos: TikTokVideo[] = videosData.data?.videos || [];

  // 2. Per ogni video, recupera i commenti
  for (const video of videos) {
    if (video.comment_count === 0) continue;

    const commentsResponse = await fetch(
      'https://open.tiktokapis.com/v2/comment/list/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          video_id: video.id,
          max_count: 50,
          fields: ['id', 'text', 'create_time', 'user', 'like_count', 'reply_count']
        })
      }
    );

    if (!commentsResponse.ok) continue;

    const commentsData = await commentsResponse.json();
    const comments: TikTokComment[] = commentsData.data?.comments || [];

    for (const comment of comments) {
      const commentDate = new Date(comment.create_time * 1000);

      // Filtra per data se specificato
      if (sinceDate && commentDate < sinceDate) continue;

      reviews.push({
        businessId: credentials.businessId,
        platform: 'tiktok',
        platformReviewId: comment.id,
        platformUrl: video.share_url,
        reviewerName: comment.user.display_name,
        reviewerPhotoUrl: comment.user.avatar_url,
        rating: undefined, // TikTok non ha rating stelle
        content: comment.text,
        language: detectLanguageSimple(comment.text),
        reviewDate: commentDate,
        rawData: {
          videoId: video.id,
          videoTitle: video.title,
          likeCount: comment.like_count,
          replyCount: comment.reply_count,
          comment
        }
      });
    }

    // Rate limiting - aspetta tra le richieste
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return reviews;
}

/**
 * Rispondi a un commento TikTok
 */
export async function replyToTikTokComment(
  credentials: PlatformCredentials,
  videoId: string,
  commentId: string,
  replyText: string
): Promise<boolean> {
  if (!credentials.accessToken) {
    throw new Error('Token TikTok mancante');
  }

  const response = await fetch(
    'https://open.tiktokapis.com/v2/comment/reply/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_id: videoId,
        comment_id: commentId,
        text: replyText
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Errore risposta TikTok:', error);
    throw new Error(`Errore pubblicazione: ${response.status}`);
  }

  return true;
}

/**
 * Ottieni info account TikTok Business
 */
export async function getTikTokAccountInfo(
  accessToken: string
): Promise<{
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  videoCount: number;
}> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/',
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Errore recupero info account TikTok');
  }

  const data = await response.json();
  const user = data.data?.user;

  return {
    openId: user?.open_id || '',
    displayName: user?.display_name || '',
    avatarUrl: user?.avatar_url || '',
    followerCount: user?.follower_count || 0,
    videoCount: user?.video_count || 0
  };
}

/**
 * URL OAuth TikTok
 */
export function getTikTokOAuthUrl(
  clientKey: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_key: clientKey,
    redirect_uri: redirectUri,
    state,
    scope: 'user.info.basic,video.list,comment.list,comment.list.manage',
    response_type: 'code'
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

/**
 * Scambia code per access token TikTok
 */
export async function exchangeTikTokCode(
  code: string,
  clientKey: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
}> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Errore scambio code TikTok: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    openId: data.open_id
  };
}

/**
 * Refresh token TikTok
 */
export async function refreshTikTokToken(
  refreshToken: string,
  clientKey: string,
  clientSecret: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error('Errore refresh token TikTok');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000)
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
