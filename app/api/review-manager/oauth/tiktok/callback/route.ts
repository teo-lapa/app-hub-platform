/**
 * OAuth Callback - TikTok
 * Gestisce il callback OAuth da TikTok e salva le credenziali
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeTikTokCode,
  getTikTokAccountInfo
} from '@/lib/review-manager/platforms/tiktok';
import { connectPlatform } from '@/lib/review-manager/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Errore OAuth
    if (error) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent(`OAuth TikTok fallito: ${error}`)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Codice autorizzazione mancante')}`
      );
    }

    // Parse state per estrarre businessId
    const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
    const businessId = stateData.businessId;

    if (!businessId) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Business ID mancante nello state')}`
      );
    }

    // Scambia code per tokens
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;

    if (!clientKey || !clientSecret || !redirectUri) {
      throw new Error('Credenziali TikTok OAuth non configurate nell\'environment');
    }

    const tokens = await exchangeTikTokCode(code, clientKey, clientSecret, redirectUri);

    // Ottieni info account TikTok
    const accountInfo = await getTikTokAccountInfo(tokens.accessToken);

    // Salva credenziali nel database
    await connectPlatform({
      businessId: parseInt(businessId),
      platform: 'tiktok',
      platformAccountId: tokens.openId,
      platformAccountName: accountInfo.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt
    });

    // Redirect a settings con success
    return NextResponse.redirect(
      `/review-manager/${businessId}/settings?success=${encodeURIComponent(`TikTok (@${accountInfo.displayName}) connesso con successo!`)}`
    );
  } catch (error) {
    console.error('Errore OAuth TikTok callback:', error);
    return NextResponse.redirect(
      `/review-manager/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'Errore sconosciuto')}`
    );
  }
}
