/**
 * API Endpoint: Initialize RAG System
 *
 * POST /api/lapa-ai/init-rag
 *
 * Does EVERYTHING in one call:
 * 1. Initializes the embeddings table in pgvector
 * 2. Sets up Odoo automated actions (webhooks)
 * 3. Syncs all products from Odoo to embeddings
 *
 * Call this once to set up the entire RAG system.
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import {
  initProductEmbeddingsTable,
  syncProductEmbeddings,
  getEmbeddingsStats,
  ProductForEmbedding
} from '@/lib/lapa-agents/product-embedding-service';

export const maxDuration = 300; // 5 minutes for large catalogs

export async function POST(request: Request) {
  const startTime = Date.now();
  const results: any = {
    steps: [],
    success: false
  };

  try {
    console.log('[INIT-RAG] 🚀 Starting full RAG initialization...');

    // ========================================
    // STEP 1: Initialize embeddings table
    // ========================================
    console.log('[INIT-RAG] Step 1: Initializing embeddings table...');
    try {
      await initProductEmbeddingsTable();
      results.steps.push({ step: 1, name: 'init_table', success: true });
      console.log('[INIT-RAG] ✓ Table initialized');
    } catch (tableError: any) {
      results.steps.push({ step: 1, name: 'init_table', success: false, error: tableError.message });
      console.warn('[INIT-RAG] ⚠ Table init warning:', tableError.message);
      // Continue anyway - table might already exist
    }

    // ========================================
    // STEP 2: Connect to Odoo
    // ========================================
    console.log('[INIT-RAG] Step 2: Connecting to Odoo...');
    const odoo = await getOdooClient();
    if (!odoo) {
      results.steps.push({ step: 2, name: 'odoo_connect', success: false, error: 'Failed to connect' });
      return NextResponse.json(
        { ...results, error: 'Failed to connect to Odoo' },
        { status: 500 }
      );
    }
    results.steps.push({ step: 2, name: 'odoo_connect', success: true });
    console.log('[INIT-RAG] ✓ Connected to Odoo');

    // ========================================
    // STEP 3: Setup Odoo webhooks
    // ========================================
    console.log('[INIT-RAG] Step 3: Setting up Odoo webhooks...');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

      if (baseUrl) {
        const webhookUrl = `${baseUrl}/api/lapa-ai/update-product-embedding`;

        // Python code for Odoo automated action
        const pythonCode = `
# LAPA AI - Sync Product Embedding
import requests
import json

try:
    product = record
    action = 'update'

    payload = {
        'product_id': product.id,
        'product_name': product.name,
        'default_code': product.default_code or '',
        'categ_id': [product.categ_id.id, product.categ_id.name] if product.categ_id else None,
        'description_sale': product.description_sale or '',
        'action': action
    }

    try:
        requests.post('${webhookUrl}', json=payload, timeout=5)
    except:
        pass
except:
    pass
`;

        // Check if action exists
        const existingActions = await odoo.searchRead(
          'base.automation',
          [['name', '=', 'LAPA AI - Sync Product Embedding']],
          ['id'],
          1
        );

        if (existingActions.length > 0) {
          await odoo.write('base.automation', [existingActions[0].id], {
            code: pythonCode,
            active: true
          });
          results.steps.push({ step: 3, name: 'odoo_webhook', success: true, action: 'updated', id: existingActions[0].id });
        } else {
          const productModel = await odoo.searchRead(
            'ir.model',
            [['model', '=', 'product.product']],
            ['id'],
            1
          );

          if (productModel.length > 0) {
            const actionId = await odoo.create('base.automation', {
              name: 'LAPA AI - Sync Product Embedding',
              model_id: productModel[0].id,
              trigger: 'on_create_or_write',
              state: 'code',
              code: pythonCode,
              active: true
            });
            results.steps.push({ step: 3, name: 'odoo_webhook', success: true, action: 'created', id: actionId });
          }
        }
        console.log('[INIT-RAG] ✓ Odoo webhook configured');
      } else {
        results.steps.push({ step: 3, name: 'odoo_webhook', success: false, error: 'No base URL available' });
        console.warn('[INIT-RAG] ⚠ Could not setup webhook - no base URL');
      }
    } catch (webhookError: any) {
      results.steps.push({ step: 3, name: 'odoo_webhook', success: false, error: webhookError.message });
      console.warn('[INIT-RAG] ⚠ Webhook setup failed:', webhookError.message);
      // Continue anyway - sync is more important
    }

    // ========================================
    // STEP 4: Fetch all sellable products
    // ========================================
    console.log('[INIT-RAG] Step 4: Fetching products from Odoo...');
    const products = await odoo.searchRead(
      'product.product',
      [
        ['active', '=', true],
        ['sale_ok', '=', true]
      ],
      ['id', 'name', 'default_code', 'categ_id', 'description_sale'],
      5000
    );

    results.steps.push({ step: 4, name: 'fetch_products', success: true, count: products.length });
    console.log(`[INIT-RAG] ✓ Found ${products.length} sellable products`);

    if (products.length === 0) {
      results.success = true;
      results.message = 'No products to sync';
      return NextResponse.json(results);
    }

    // ========================================
    // STEP 5: Generate and save embeddings
    // ========================================
    console.log('[INIT-RAG] Step 5: Generating embeddings (this may take a few minutes)...');

    const productsForEmbedding: ProductForEmbedding[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      default_code: p.default_code || undefined,
      categ_id: p.categ_id || undefined,
      description_sale: p.description_sale || undefined
    }));

    const syncResult = await syncProductEmbeddings(productsForEmbedding, 50);

    results.steps.push({
      step: 5,
      name: 'sync_embeddings',
      success: true,
      synced: syncResult.synced,
      failed: syncResult.failed
    });

    console.log(`[INIT-RAG] ✓ Synced ${syncResult.synced} products, ${syncResult.failed} failed`);

    // ========================================
    // FINAL: Summary
    // ========================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = getEmbeddingsStats();

    results.success = true;
    results.message = `RAG system initialized successfully in ${duration}s`;
    results.summary = {
      productsFound: products.length,
      embeddingsSynced: syncResult.synced,
      embeddingsFailed: syncResult.failed,
      durationSeconds: parseFloat(duration),
      stats
    };

    console.log(`[INIT-RAG] 🎉 Complete! ${syncResult.synced} products indexed in ${duration}s`);

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('[INIT-RAG] ❌ Error:', error);
    results.error = error.message;
    return NextResponse.json(results, { status: 500 });
  }
}

export async function GET() {
  const stats = getEmbeddingsStats();

  return NextResponse.json({
    info: 'POST /api/lapa-ai/init-rag to initialize the entire RAG system',
    description: 'This endpoint will: 1) Create embeddings table, 2) Setup Odoo webhooks, 3) Sync all products',
    currentStats: stats,
    estimatedTime: 'Approximately 2-5 minutes depending on product count'
  });
}
