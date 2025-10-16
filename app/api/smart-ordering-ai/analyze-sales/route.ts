/**
 * API: Smart Ordering AI - Analyze Sales
 * GET /api/smart-ordering-ai/analyze-sales
 *
 * Analizza storico vendite prodotto
 */

import { NextRequest, NextResponse } from 'next/server';
import { salesAnalyzer } from '@/lib/smart-ordering/sales-analyzer';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productIdParam = searchParams.get('productId');
    const productIdsParam = searchParams.get('productIds');
    const mode = searchParams.get('mode') || 'single';
    const monthsHistory = parseInt(searchParams.get('months') || '3');

    console.log(`📊 API /smart-ordering-ai/analyze-sales?mode=${mode}`);

    if (mode === 'all') {
      const analyses = await salesAnalyzer.analyzeAllProducts(monthsHistory);

      return NextResponse.json({
        success: true,
        products: analyses,
        count: analyses.length
      });
    }

    if (mode === 'batch' && productIdsParam) {
      const productIds = productIdsParam.split(',').map(id => parseInt(id));
      const analyses = await salesAnalyzer.analyzeProducts(productIds, monthsHistory);

      return NextResponse.json({
        success: true,
        products: analyses,
        count: analyses.length
      });
    }

    if (!productIdParam) {
      return NextResponse.json(
        { error: 'productId richiesto per mode=single' },
        { status: 400 }
      );
    }

    const productId = parseInt(productIdParam);
    const analysis = await salesAnalyzer.analyzeProduct(productId, monthsHistory);

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error: any) {
    console.error('❌ Errore API analyze-sales:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}
