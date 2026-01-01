/**
 * Cron Job: Sync Products to RAG
 *
 * Runs every 15 minutes to sync any new/modified products to the RAG embeddings.
 * This is needed because Odoo doesn't allow outgoing HTTP calls from server actions.
 *
 * Schedule: */15 * * * * (every 15 minutes)
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import {
  syncProductEmbeddings,
  getEmbeddingsStats,
  ProductForEmbedding
} from '@/lib/lapa-agents/product-embedding-service';

export const maxDuration = 300; // 5 minutes

// Vercel cron authentication
export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow in development or if CRON_SECRET is not set
    if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();

  try {
    console.log('[CRON-RAG] Starting product sync...');

    const odoo = await getOdooClient();
    if (!odoo) {
      console.error('[CRON-RAG] Failed to connect to Odoo');
      return NextResponse.json({ success: false, error: 'Odoo connection failed' }, { status: 500 });
    }

    // Get current stats
    const statsBefore = getEmbeddingsStats();
    console.log(`[CRON-RAG] Current embeddings: ${statsBefore.cacheSize}`);

    // Get products modified in the last 30 minutes (overlap for safety)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const isoDate = thirtyMinutesAgo.toISOString().replace('T', ' ').substring(0, 19);

    // Fetch recently modified products
    const recentProducts = await odoo.searchRead(
      'product.product',
      [
        ['active', '=', true],
        ['sale_ok', '=', true],
        ['write_date', '>=', isoDate]
      ],
      ['id', 'name', 'default_code', 'categ_id', 'description_sale'],
      500 // Max 500 per sync
    );

    console.log(`[CRON-RAG] Found ${recentProducts.length} recently modified products`);

    if (recentProducts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products to sync',
        synced: 0,
        duration: ((Date.now() - startTime) / 1000).toFixed(1)
      });
    }

    // Sync to embeddings
    const productsForEmbedding: ProductForEmbedding[] = recentProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      default_code: p.default_code || undefined,
      categ_id: p.categ_id || undefined,
      description_sale: p.description_sale || undefined
    }));

    const syncResult = await syncProductEmbeddings(productsForEmbedding, 20);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const statsAfter = getEmbeddingsStats();

    console.log(`[CRON-RAG] Synced ${syncResult.synced} products in ${duration}s`);

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResult.synced} products`,
      synced: syncResult.synced,
      failed: syncResult.failed,
      totalEmbeddings: statsAfter.cacheSize,
      duration
    });

  } catch (error: any) {
    console.error('[CRON-RAG] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
