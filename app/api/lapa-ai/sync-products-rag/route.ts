/**
 * API Endpoint: Sync Odoo Products to RAG Embeddings
 *
 * POST /api/lapa-ai/sync-products-rag
 *
 * Syncs all sellable products from Odoo to the vector database
 * for semantic product search.
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import {
  initProductEmbeddingsTable,
  syncProductEmbeddings,
  loadEmbeddingsToCache,
  getEmbeddingsStats,
  ProductForEmbedding
} from '@/lib/lapa-agents/product-embedding-service';

export const maxDuration = 300; // 5 minutes for large catalogs

export async function POST(request: Request) {
  try {
    // Optional: verify admin access
    const { searchParams } = new URL(request.url);
    const forceSync = searchParams.get('force') === 'true';

    console.log('[SYNC-RAG] Starting product embeddings sync...');

    // 1. Initialize table if needed
    await initProductEmbeddingsTable();

    // 2. Check current stats
    const stats = getEmbeddingsStats();
    if (stats.cacheSize > 0 && !forceSync) {
      console.log('[SYNC-RAG] Embeddings already loaded, skipping sync');
      return NextResponse.json({
        success: true,
        message: 'Embeddings already loaded',
        stats,
        skipped: true
      });
    }

    // 3. Get Odoo client
    const odoo = await getOdooClient();
    if (!odoo) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Odoo' },
        { status: 500 }
      );
    }

    // 4. Fetch all sellable products from Odoo
    console.log('[SYNC-RAG] Fetching products from Odoo...');

    const products = await odoo.searchRead(
      'product.product',
      [
        ['active', '=', true],
        ['sale_ok', '=', true]
      ],
      ['id', 'name', 'default_code', 'categ_id', 'description_sale'],
      5000 // Max products
    );

    console.log(`[SYNC-RAG] Found ${products.length} sellable products`);

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found to sync',
        synced: 0
      });
    }

    // 5. Sync products to embeddings store
    const productsForEmbedding: ProductForEmbedding[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      default_code: p.default_code || undefined,
      categ_id: p.categ_id || undefined,
      description_sale: p.description_sale || undefined
    }));

    const result = await syncProductEmbeddings(productsForEmbedding, 50);

    console.log(`[SYNC-RAG] Sync complete: ${result.synced} synced, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Synced ${result.synced} products to RAG`,
      synced: result.synced,
      failed: result.failed,
      total: products.length,
      stats: getEmbeddingsStats()
    });
  } catch (error: any) {
    console.error('[SYNC-RAG] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Load existing embeddings from database to cache
    const loaded = await loadEmbeddingsToCache();
    const stats = getEmbeddingsStats();

    return NextResponse.json({
      success: true,
      message: `Loaded ${loaded} embeddings to cache`,
      stats
    });
  } catch (error: any) {
    console.error('[SYNC-RAG] Error loading cache:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
