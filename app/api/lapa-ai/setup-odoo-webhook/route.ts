/**
 * API Endpoint: Setup Odoo Webhook for Product Embeddings
 *
 * POST /api/lapa-ai/setup-odoo-webhook
 *
 * Creates an Automated Action in Odoo that automatically calls
 * the update-product-embedding endpoint when products are created/modified/deleted.
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(request: Request) {
  try {
    console.log('[SETUP-WEBHOOK] Setting up Odoo automated action...');

    const odoo = await getOdooClient();
    if (!odoo) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Odoo' },
        { status: 500 }
      );
    }

    // Get the webhook URL from environment or request
    const { searchParams } = new URL(request.url);
    let webhookUrl = searchParams.get('webhook_url');

    if (!webhookUrl) {
      // Try to determine from VERCEL_URL or NEXT_PUBLIC_APP_URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                      'http://localhost:3000';
      webhookUrl = `${baseUrl}/api/lapa-ai/update-product-embedding`;
    }

    console.log('[SETUP-WEBHOOK] Webhook URL:', webhookUrl);

    // Python code that will be executed by Odoo on product changes
    const pythonCode = `
# Automated Action: Sync Product Embedding to LAPA AI RAG
import requests
import json

try:
    product = record
    action = 'create' if record._context.get('create_mode') else 'update'

    # Check if product is being deleted (unlink)
    if record._context.get('unlink_mode'):
        action = 'delete'

    payload = {
        'product_id': product.id,
        'product_name': product.name,
        'default_code': product.default_code or '',
        'categ_id': [product.categ_id.id, product.categ_id.name] if product.categ_id else None,
        'description_sale': product.description_sale or '',
        'action': action
    }

    # Call the webhook (fire and forget, don't block Odoo)
    try:
        requests.post(
            '${webhookUrl}',
            json=payload,
            timeout=5,
            headers={'Content-Type': 'application/json'}
        )
    except:
        pass  # Don't fail the product save if webhook fails

except Exception as e:
    # Log but don't fail
    pass
`;

    // Check if automated action already exists
    const existingActions = await odoo.searchRead(
      'base.automation',
      [['name', '=', 'LAPA AI - Sync Product Embedding']],
      ['id'],
      1
    );

    let actionId: number;

    if (existingActions.length > 0) {
      // Update existing action
      actionId = existingActions[0].id;
      await odoo.write('base.automation', [actionId], {
        code: pythonCode,
        active: true
      });
      console.log('[SETUP-WEBHOOK] Updated existing automated action:', actionId);
    } else {
      // Get product.product model ID
      const productModel = await odoo.searchRead(
        'ir.model',
        [['model', '=', 'product.product']],
        ['id'],
        1
      );

      if (productModel.length === 0) {
        return NextResponse.json(
          { success: false, error: 'product.product model not found in Odoo' },
          { status: 500 }
        );
      }

      // Create new automated action for CREATE and WRITE
      actionId = await odoo.create('base.automation', {
        name: 'LAPA AI - Sync Product Embedding',
        model_id: productModel[0].id,
        trigger: 'on_create_or_write',  // Trigger on both create and write
        state: 'code',
        code: pythonCode,
        active: true
      });
      console.log('[SETUP-WEBHOOK] Created new automated action:', actionId);
    }

    // Also create a delete action (separate because different trigger)
    const existingDeleteActions = await odoo.searchRead(
      'base.automation',
      [['name', '=', 'LAPA AI - Delete Product Embedding']],
      ['id'],
      1
    );

    const deletePythonCode = `
# Automated Action: Delete Product Embedding from LAPA AI RAG
import requests
import json

try:
    product = record

    payload = {
        'product_id': product.id,
        'action': 'delete'
    }

    try:
        requests.post(
            '${webhookUrl}',
            json=payload,
            timeout=5,
            headers={'Content-Type': 'application/json'}
        )
    except:
        pass

except Exception as e:
    pass
`;

    if (existingDeleteActions.length > 0) {
      await odoo.write('base.automation', [existingDeleteActions[0].id], {
        code: deletePythonCode,
        active: true
      });
    } else {
      const productModel = await odoo.searchRead(
        'ir.model',
        [['model', '=', 'product.product']],
        ['id'],
        1
      );

      if (productModel.length > 0) {
        await odoo.create('base.automation', {
          name: 'LAPA AI - Delete Product Embedding',
          model_id: productModel[0].id,
          trigger: 'on_unlink',
          state: 'code',
          code: deletePythonCode,
          active: true
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Odoo webhook configured successfully',
      webhookUrl,
      actionId
    });

  } catch (error: any) {
    console.error('[SETUP-WEBHOOK] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'POST to this endpoint to setup Odoo automated actions for product embedding sync',
    params: {
      webhook_url: 'Optional - URL to call (defaults to current app URL)'
    }
  });
}
