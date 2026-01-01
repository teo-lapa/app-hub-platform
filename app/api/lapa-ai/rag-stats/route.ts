/**
 * API Endpoint: RAG Statistics
 *
 * GET /api/lapa-ai/rag-stats
 *
 * Returns statistics about the RAG (product embeddings) system:
 * - Total products in database
 * - Last sync time
 * - Embedding coverage
 * - System health
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search');

    // If search query provided, search for products
    if (searchQuery) {
      const searchResult = await sql`
        SELECT product_id, product_name
        FROM product_embeddings
        WHERE LOWER(product_name) LIKE ${`%${searchQuery.toLowerCase()}%`}
        ORDER BY product_name
        LIMIT 50
      `;

      return NextResponse.json({
        success: true,
        search: {
          query: searchQuery,
          found: searchResult.rows.length,
          products: searchResult.rows.map(r => ({
            id: r.product_id,
            name: r.product_name
          }))
        },
        timestamp: new Date().toISOString()
      });
    }
    // Get total embeddings count
    const countResult = await sql`
      SELECT COUNT(*) as total FROM product_embeddings
    `;
    const totalEmbeddings = parseInt(countResult.rows[0]?.total || '0');

    // Get last update time
    const lastUpdateResult = await sql`
      SELECT MAX(updated_at) as last_update FROM product_embeddings
    `;
    const lastUpdate = lastUpdateResult.rows[0]?.last_update;

    // Get oldest embedding (first sync)
    const firstSyncResult = await sql`
      SELECT MIN(created_at) as first_sync FROM product_embeddings
    `;
    const firstSync = firstSyncResult.rows[0]?.first_sync;

    // Get recent updates (last 24 hours)
    const recentUpdatesResult = await sql`
      SELECT COUNT(*) as count
      FROM product_embeddings
      WHERE updated_at > NOW() - INTERVAL '24 hours'
    `;
    const recentUpdates = parseInt(recentUpdatesResult.rows[0]?.count || '0');

    // Get updates by hour for the last 24 hours (for chart)
    const hourlyUpdatesResult = await sql`
      SELECT
        DATE_TRUNC('hour', updated_at) as hour,
        COUNT(*) as count
      FROM product_embeddings
      WHERE updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', updated_at)
      ORDER BY hour DESC
      LIMIT 24
    `;

    // Get top 5 recently updated products
    const recentProductsResult = await sql`
      SELECT product_id, product_name, updated_at
      FROM product_embeddings
      ORDER BY updated_at DESC
      LIMIT 5
    `;

    // Check table health (verify pgvector index exists)
    let indexHealth = 'unknown';
    try {
      const indexResult = await sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'product_embeddings'
        AND indexname LIKE '%embedding%'
      `;
      indexHealth = indexResult.rows.length > 0 ? 'healthy' : 'missing_index';
    } catch (e) {
      indexHealth = 'error';
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalEmbeddings,
        lastUpdate,
        firstSync,
        recentUpdates24h: recentUpdates,
        indexHealth,
        hourlyUpdates: hourlyUpdatesResult.rows.map(r => ({
          hour: r.hour,
          count: parseInt(r.count)
        })),
        recentProducts: recentProductsResult.rows.map(r => ({
          productId: r.product_id,
          productName: r.product_name,
          updatedAt: r.updated_at
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[RAG-STATS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stats: {
          totalEmbeddings: 0,
          lastUpdate: null,
          firstSync: null,
          recentUpdates24h: 0,
          indexHealth: 'error',
          hourlyUpdates: [],
          recentProducts: []
        }
      },
      { status: 500 }
    );
  }
}
