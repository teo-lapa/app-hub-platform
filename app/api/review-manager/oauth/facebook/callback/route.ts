/**
 * OAuth Callback - Facebook/Instagram
 * Gestisce il callback OAuth da Facebook e salva le credenziali per Instagram
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeInstagramCode,
  getInstagramAccountInfo,
  getPageAccessToken
} from '@/lib/review-manager/platforms/instagram';
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
        `/review-manager/settings?error=${encodeURIComponent(`OAuth Facebook fallito: ${error}`)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Codice autorizzazione mancante')}`
      );
    }

    // Parse state per estrarre businessId e platform (instagram o facebook)
    const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
    const businessId = stateData.businessId;
    const platform = stateData.platform || 'instagram'; // default Instagram

    if (!businessId) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Business ID mancante nello state')}`
      );
    }

    // Scambia code per tokens
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Credenziali Facebook OAuth non configurate nell\'environment');
    }

    const tokens = await exchangeInstagramCode(code, clientId, clientSecret, redirectUri);

    // Ottieni lista pagine Facebook dell'utente
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokens.accessToken}`
    );

    if (!pagesResponse.ok) {
      throw new Error('Errore recupero pagine Facebook');
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Nessuna pagina Facebook trovata')}`
      );
    }

    // Usa prima pagina (in produzione, mostra selector)
    const page = pages[0];

    // Ottieni Page Access Token
    const pageAccessToken = await getPageAccessToken(tokens.accessToken, page.id);

    if (platform === 'instagram') {
      // Per Instagram, ottieni account Instagram Business
      const igAccount = await getInstagramAccountInfo(pageAccessToken, page.id);

      // Salva credenziali Instagram
      await connectPlatform({
        businessId: parseInt(businessId),
        platform: 'instagram',
        platformAccountId: page.id,
        platformAccountName: page.name,
        platformPageId: igAccount.id, // Instagram Business Account ID
        accessToken: pageAccessToken,
        tokenExpiresAt: tokens.expiresAt
      });

      return NextResponse.redirect(
        `/review-manager/${businessId}/settings?success=${encodeURIComponent(`Instagram (@${igAccount.username}) connesso con successo!`)}`
      );
    } else {
      // Salva credenziali Facebook
      await connectPlatform({
        businessId: parseInt(businessId),
        platform: 'facebook',
        platformAccountId: page.id,
        platformAccountName: page.name,
        platformPageId: page.id,
        accessToken: pageAccessToken,
        tokenExpiresAt: tokens.expiresAt
      });

      return NextResponse.redirect(
        `/review-manager/${businessId}/settings?success=${encodeURIComponent(`Facebook (${page.name}) connesso con successo!`)}`
      );
    }
  } catch (error) {
    console.error('Errore OAuth Facebook callback:', error);
    return NextResponse.redirect(
      `/review-manager/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'Errore sconosciuto')}`
    );
  }
}
