/**
 * Cron Job: Review Manager Auto-Sync
 * Esegue ogni 15 minuti per sincronizzare recensioni
 *
 * Configurazione vercel.json:
 * crons: [{ path: "/api/cron/review-sync", schedule: "0/15 * * * *" }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllPlatforms } from '@/lib/review-manager/sync-service';
import { getAllBusinesses } from '@/lib/review-manager/db-service';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minuti max

// Verifica che la richiesta venga da Vercel Cron
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  // In sviluppo, accetta sempre
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Verifica CRON_SECRET se configurato
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Verifica header Vercel
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  // Verifica autorizzazione
  if (!isValidCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log('[CRON] Inizio sync recensioni automatico');

    // Recupera tutti i business attivi
    const businesses = await getAllBusinesses();

    if (businesses.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun business da sincronizzare',
        duration: Date.now() - startTime
      });
    }

    const results = [];
    let totalNew = 0;
    let totalPublished = 0;
    let errors = 0;

    // Sincronizza ogni business
    for (const business of businesses) {
      try {
        console.log(`[CRON] Sync business: ${business.name} (ID: ${business.id})`);

        const result = await syncAllPlatforms(business.id);

        results.push({
          businessId: business.id,
          businessName: business.name,
          success: true,
          totalNew: result.totalNew,
          totalPublished: result.totalPublished,
          platforms: result.results.map(r => ({
            platform: r.platform,
            success: r.success,
            new: r.reviewsNew,
            published: r.responsesPublished
          }))
        });

        totalNew += result.totalNew;
        totalPublished += result.totalPublished;

        // Pausa tra business per evitare rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[CRON] Errore sync ${business.name}:`, error);
        errors++;

        results.push({
          businessId: business.id,
          businessName: business.name,
          success: false,
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        });
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CRON] Sync completato in ${duration}ms: ${totalNew} nuove, ${totalPublished} pubblicate, ${errors} errori`);

    return NextResponse.json({
      success: true,
      data: {
        businessesProcessed: businesses.length,
        totalNew,
        totalPublished,
        errors,
        duration,
        results
      },
      message: `Sync completato: ${totalNew} nuove recensioni, ${totalPublished} risposte pubblicate`
    });

  } catch (error) {
    console.error('[CRON] Errore critico:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Errore critico',
        duration: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

// POST per trigger manuale
export async function POST(request: NextRequest) {
  return GET(request);
}
