/**
 * OAuth Callback - Google My Business
 * Gestisce il callback OAuth da Google e salva le credenziali
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeGoogleCode,
  getGoogleAccounts,
  getGoogleLocations
} from '@/lib/review-manager/platforms/google';
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
        `/review-manager/settings?error=${encodeURIComponent(`OAuth Google fallito: ${error}`)}`
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Credenziali Google OAuth non configurate nell\'environment');
    }

    const tokens = await exchangeGoogleCode(code, clientId, clientSecret, redirectUri);

    // Ottieni accounts e locations
    const accounts = await getGoogleAccounts(tokens.accessToken);

    if (accounts.length === 0) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Nessun account Google My Business trovato')}`
      );
    }

    // Usa primo account (in produzione, mostra selector)
    const account = accounts[0];
    const locations = await getGoogleLocations(tokens.accessToken, account.id);

    if (locations.length === 0) {
      return NextResponse.redirect(
        `/review-manager/settings?error=${encodeURIComponent('Nessuna location trovata per questo account')}`
      );
    }

    // Usa prima location (in produzione, mostra selector)
    const location = locations[0];

    // Salva credenziali nel database (verranno cifrate automaticamente)
    await connectPlatform({
      businessId: parseInt(businessId),
      platform: 'google',
      platformAccountId: account.id,
      platformAccountName: account.name,
      googleLocationId: location.id,
      googlePlaceId: location.id, // In Google API v4 coincidono
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt
    });

    // Redirect a settings con success
    return NextResponse.redirect(
      `/review-manager/${businessId}/settings?success=${encodeURIComponent('Google My Business connesso con successo!')}`
    );
  } catch (error) {
    console.error('Errore OAuth Google callback:', error);
    return NextResponse.redirect(
      `/review-manager/settings?error=${encodeURIComponent(error instanceof Error ? error.message : 'Errore sconosciuto')}`
    );
  }
}
