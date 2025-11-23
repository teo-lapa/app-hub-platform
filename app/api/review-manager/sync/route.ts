/**
 * API: Review Manager - Sync
 * POST /api/review-manager/sync - Sincronizza recensioni
 * GET /api/review-manager/sync - Stato ultimo sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllPlatforms, syncPlatform, publishApprovedResponse } from '@/lib/review-manager/sync-service';
import { getAllBusinesses } from '@/lib/review-manager/db-service';
import { Platform } from '@/lib/review-manager/types';

// POST - Esegui sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessId, platform, action, reviewId } = body;

    // Azione: pubblica risposta approvata
    if (action === 'publish' && reviewId) {
      const result = await publishApprovedResponse(reviewId);
      return NextResponse.json({
        success: result.success,
        error: result.error,
        message: result.success ? 'Risposta pubblicata' : result.error
      });
    }

    // Sync singolo business + singola piattaforma
    if (businessId && platform) {
      const result = await syncPlatform(businessId, platform as Platform);
      return NextResponse.json({
        success: result.success,
        data: result,
        message: result.success
          ? `Sync ${platform} completato: ${result.reviewsNew} nuove recensioni`
          : `Errore sync ${platform}: ${result.error}`
      });
    }

    // Sync singolo business, tutte le piattaforme
    if (businessId) {
      const result = await syncAllPlatforms(businessId);
      return NextResponse.json({
        success: true,
        data: result,
        message: `Sync completato: ${result.totalNew} nuove recensioni, ${result.totalPublished} risposte pubblicate`
      });
    }

    // Sync TUTTI i business (per cron job)
    const businesses = await getAllBusinesses();
    const results = [];

    for (const business of businesses) {
      try {
        const result = await syncAllPlatforms(business.id);
        results.push(result);
      } catch (error) {
        results.push({
          businessId: business.id,
          businessName: business.name,
          error: error instanceof Error ? error.message : 'Errore'
        });
      }
    }

    const totalNew = results.reduce((sum, r) => sum + ('totalNew' in r ? r.totalNew : 0), 0);
    const totalPublished = results.reduce((sum, r) => sum + ('totalPublished' in r ? r.totalPublished : 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        businesses: results.length,
        totalNew,
        totalPublished,
        results
      },
      message: `Sync globale completato: ${results.length} business, ${totalNew} nuove recensioni`
    });

  } catch (error) {
    console.error('Errore sync:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante la sincronizzazione' },
      { status: 500 }
    );
  }
}

// GET - Stato sync (per dashboard)
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

    // Recupera ultimi sync logs
    const { sql } = await import('@vercel/postgres');

    const logs = await sql`
      SELECT * FROM rm_sync_logs
      WHERE business_id = ${parseInt(businessId)}
      ORDER BY started_at DESC
      LIMIT 10
    `;

    return NextResponse.json({
      success: true,
      data: logs.rows
    });

  } catch (error) {
    console.error('Errore GET sync:', error);
    return NextResponse.json(
      { success: false, error: 'Errore recupero stato sync' },
      { status: 500 }
    );
  }
}
