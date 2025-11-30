/**
 * OAuth Callback - Trustpilot
 * Gestisce il callback OAuth da Trustpilot e salva le credenziali
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeTrustpilotCode,
  getTrustpilotBusinessInfo
} from '@/lib/review-manager/platforms/trustpilot';
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
        `/review-manager/settings?error=${encodeURIComponent(`OAuth Trustpilot fallito: ${error}`)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Codice autorizzazione mancante')}`
      );
    }

    // Parse state per estrarre businessId e businessUnitId
    const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
    const businessId = stateData.businessId;
    const businessUnitId = stateData.businessUnitId; // Deve essere fornito dall'utente

    if (!businessId || !businessUnitId) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Business ID o Business Unit ID mancante')}`
      );
    }

    // Scambia code per tokens
    const clientId = process.env.TRUSTPILOT_API_KEY;
    const clientSecret = process.env.TRUSTPILOT_API_SECRET;
    const redirectUri = process.env.TRUSTPILOT_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Credenziali Trustpilot OAuth non configurate nell\'environment');
    }

    const tokens = await exchangeTrustpilotCode(code, clientId, clientSecret, redirectUri);

    // Ottieni info Business Unit
    const businessInfo = await getTrustpilotBusinessInfo(clientId, businessUnitId);

    // Salva credenziali nel database
    await connectPlatform({
      businessId: parseInt(businessId),
      platform: 'trustpilot',
      platformAccountId: businessUnitId,
      platformAccountName: businessInfo.displayName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      apiKey: clientId // Salva anche API key per lettura recensioni
    });

    // Redirect a settings con success
    return NextResponse.redirect(
      `/review-manager/${businessId}/settings?success=${encodeURIComponent(`Trustpilot (${businessInfo.displayName}) connesso con successo!`)}`
    );
  } catch (error) {
    console.error('Errore OAuth Trustpilot callback:', error);
    return NextResponse.redirect(
      `/review-manager/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'Errore sconosciuto')}`
    );
  }
}
