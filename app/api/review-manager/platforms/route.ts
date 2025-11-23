/**
 * API: Review Manager - Platforms
 * GET /api/review-manager/platforms - Lista piattaforme connesse per un business
 * POST /api/review-manager/platforms - Connetti una piattaforma
 * DELETE /api/review-manager/platforms - Disconnetti una piattaforma
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessPlatforms,
  connectPlatform,
  disconnectPlatform
} from '@/lib/review-manager/db-service';
import { Platform, ConnectPlatformInput } from '@/lib/review-manager/types';

// GET - Lista piattaforme connesse
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId richiesto' },
        { status: 400 }
      );
    }

    const platforms = await getBusinessPlatforms(parseInt(businessId));

    // Aggiungi info su piattaforme non connesse
    const allPlatforms: Platform[] = ['google', 'instagram', 'tiktok', 'facebook', 'trustpilot'];
    const connectedPlatforms = platforms.map(p => p.platform);

    const platformsStatus = allPlatforms.map(platform => {
      const connected = platforms.find(p => p.platform === platform);
      return {
        platform,
        isConnected: !!connected,
        credentials: connected || null,
        label: getPlatformLabel(platform),
        icon: getPlatformIcon(platform)
      };
    });

    return NextResponse.json({
      success: true,
      data: platformsStatus
    });
  } catch (error) {
    console.error('Errore GET platforms:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nel recupero delle piattaforme' },
      { status: 500 }
    );
  }
}

// POST - Connetti piattaforma
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validazione
    if (!body.businessId || !body.platform) {
      return NextResponse.json(
        { success: false, error: 'businessId e platform sono obbligatori' },
        { status: 400 }
      );
    }

    const validPlatforms: Platform[] = ['google', 'instagram', 'tiktok', 'facebook', 'trustpilot'];
    if (!validPlatforms.includes(body.platform)) {
      return NextResponse.json(
        { success: false, error: 'Piattaforma non valida' },
        { status: 400 }
      );
    }

    const input: ConnectPlatformInput = {
      businessId: body.businessId,
      platform: body.platform,
      platformAccountId: body.platformAccountId,
      platformAccountName: body.platformAccountName,
      platformPageId: body.platformPageId,
      googlePlaceId: body.googlePlaceId,
      googleLocationId: body.googleLocationId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : undefined,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret
    };

    const credentials = await connectPlatform(input);

    return NextResponse.json({
      success: true,
      data: credentials,
      message: `${getPlatformLabel(body.platform)} connesso con successo`
    });
  } catch (error) {
    console.error('Errore POST platform:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nella connessione della piattaforma' },
      { status: 500 }
    );
  }
}

// DELETE - Disconnetti piattaforma
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const platform = searchParams.get('platform') as Platform;

    if (!businessId || !platform) {
      return NextResponse.json(
        { success: false, error: 'businessId e platform richiesti' },
        { status: 400 }
      );
    }

    const disconnected = await disconnectPlatform(parseInt(businessId), platform);

    if (!disconnected) {
      return NextResponse.json(
        { success: false, error: 'Piattaforma non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${getPlatformLabel(platform)} disconnesso`
    });
  } catch (error) {
    console.error('Errore DELETE platform:', error);
    return NextResponse.json(
      { success: false, error: 'Errore nella disconnessione della piattaforma' },
      { status: 500 }
    );
  }
}

// Helper functions
function getPlatformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    google: 'Google My Business',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    facebook: 'Facebook',
    trustpilot: 'Trustpilot'
  };
  return labels[platform] || platform;
}

function getPlatformIcon(platform: Platform): string {
  const icons: Record<Platform, string> = {
    google: 'google',
    instagram: 'instagram',
    tiktok: 'tiktok',
    facebook: 'facebook',
    trustpilot: 'star'
  };
  return icons[platform] || 'globe';
}
