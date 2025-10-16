/**
 * API: Smart Ordering AI - Predict
 * POST /api/smart-ordering-ai/predict
 *
 * Genera predizioni AI per prodotti
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiPredictionEngine } from '@/lib/smart-ordering/ai-prediction-engine';

export const maxDuration = 300; // 5 minuti per AI processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body as { productIds: number[] | 'all' };

    console.log('🤖 API /smart-ordering-ai/predict');

    // Valida input
    if (!productIds) {
      return NextResponse.json(
        { error: 'productIds richiesto' },
        { status: 400 }
      );
    }

    let predictions;

    if (productIds === 'all') {
      // Scan tutti i prodotti (limitato a 50)
      console.log('   Mode: SCAN ALL (max 50 prodotti)');

      const { searchReadOdoo } = await import('@/lib/odoo/odoo-helper');

      const products = await searchReadOdoo(
        'product.product',
        [
          ['qty_available', '>', 0],
          ['type', '=', 'product']
        ],
        ['id'],
        50
      );

      const ids = products.map((p: any) => p.id);
      predictions = await aiPredictionEngine.predictProducts(ids);

    } else if (Array.isArray(productIds)) {
      console.log(`   Mode: SPECIFIC (${productIds.length} prodotti)`);
      predictions = await aiPredictionEngine.predictProducts(productIds);

    } else {
      return NextResponse.json(
        { error: 'productIds deve essere array o "all"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      predictions,
      count: predictions.length,
      emergency: predictions.filter(p => p.urgencyLevel === 'EMERGENCY').length,
      critical: predictions.filter(p => p.urgencyLevel === 'CRITICAL').length,
      high: predictions.filter(p => p.urgencyLevel === 'HIGH').length,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Errore API predict:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}

// GET per singolo prodotto
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId richiesto' },
        { status: 400 }
      );
    }

    console.log(`🤖 API /smart-ordering-ai/predict?productId=${productId}`);

    const prediction = await aiPredictionEngine.predictProduct(parseInt(productId));

    return NextResponse.json({
      success: true,
      prediction
    });

  } catch (error: any) {
    console.error('❌ Errore API predict:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}
