/**
 * API Endpoint: Update Single Product Embedding
 *
 * POST /api/lapa-ai/update-product-embedding
 *
 * Called by Odoo webhook when a product is created/updated.
 * Updates the embedding for a single product.
 *
 * Body:
 * - product_id: number (required)
 * - product_name?: string (optional, will fetch from Odoo if not provided)
 * - action?: 'create' | 'update' | 'delete'
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import {
  generateProductEmbedding,
  saveProductEmbedding,
  ProductForEmbedding
} from '@/lib/lapa-agents/product-embedding-service';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support both manual calls (product_id) and Odoo webhook format (_id)
    const product_id = body.product_id || body._id;
    // Support both manual calls (product_name) and Odoo webhook format (name)
    const product_name = body.product_name || body.name;
    const action = body.action || 'update';

    console.log('[UPDATE-EMBEDDING] Received payload:', JSON.stringify(body).substring(0, 200));

    if (!product_id) {
      return NextResponse.json(
        { success: false, error: 'product_id or _id is required' },
        { status: 400 }
      );
    }

    console.log(`[UPDATE-EMBEDDING] ${action} product ${product_id}`);

    // Handle delete action
    if (action === 'delete') {
      try {
        await sql`DELETE FROM product_embeddings WHERE product_id = ${product_id}`;
        console.log(`[UPDATE-EMBEDDING] Deleted embedding for product ${product_id}`);
        return NextResponse.json({
          success: true,
          message: `Embedding deleted for product ${product_id}`
        });
      } catch (error: any) {
        console.error('[UPDATE-EMBEDDING] Delete failed:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // For create/update, we need product details
    let productData: ProductForEmbedding;

    if (product_name) {
      // Use provided data
      productData = {
        id: product_id,
        name: product_name,
        default_code: body.default_code,
        categ_id: body.categ_id,
        description_sale: body.description_sale
      };
    } else {
      // Fetch from Odoo
      const odoo = await getOdooClient();
      if (!odoo) {
        return NextResponse.json(
          { success: false, error: 'Failed to connect to Odoo' },
          { status: 500 }
        );
      }

      const products = await odoo.searchRead(
        'product.product',
        [['id', '=', product_id]],
        ['id', 'name', 'default_code', 'categ_id', 'description_sale', 'active', 'sale_ok'],
        1
      );

      if (products.length === 0) {
        return NextResponse.json(
          { success: false, error: `Product ${product_id} not found in Odoo` },
          { status: 404 }
        );
      }

      const product = products[0];

      // Skip if product is not active or not sellable
      if (!product.active || !product.sale_ok) {
        // Delete embedding if exists (product was deactivated)
        try {
          await sql`DELETE FROM product_embeddings WHERE product_id = ${product_id}`;
        } catch (e) {
          // Ignore delete errors
        }
        return NextResponse.json({
          success: true,
          message: `Product ${product_id} is not active/sellable, embedding removed`
        });
      }

      productData = {
        id: product.id,
        name: product.name,
        default_code: product.default_code || undefined,
        categ_id: product.categ_id || undefined,
        description_sale: product.description_sale || undefined
      };
    }

    // Generate and save embedding
    console.log(`[UPDATE-EMBEDDING] Generating embedding for "${productData.name}"`);
    const embedding = await generateProductEmbedding(productData);
    await saveProductEmbedding(productData.id, productData.name, embedding);

    console.log(`[UPDATE-EMBEDDING] Successfully updated embedding for product ${product_id}`);

    return NextResponse.json({
      success: true,
      message: `Embedding ${action}d for product ${product_id}`,
      product_name: productData.name
    });
  } catch (error: any) {
    console.error('[UPDATE-EMBEDDING] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  if (!productId) {
    return NextResponse.json({
      success: false,
      error: 'product_id query param required',
      usage: 'GET /api/lapa-ai/update-product-embedding?product_id=123'
    });
  }

  // Redirect to POST handler
  return POST(
    new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ product_id: parseInt(productId), action: 'update' }),
      headers: { 'Content-Type': 'application/json' }
    })
  );
}
