/**
 * API: Smart Ordering AI - Analyze Supplier
 * GET /api/smart-ordering-ai/analyze-supplier
 *
 * Analizza lead time fornitore
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadTimeAnalyzer } from '@/lib/smart-ordering/lead-time-analyzer';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierIdParam = searchParams.get('supplierId');
    const mode = searchParams.get('mode') || 'single';
    const monthsHistory = parseInt(searchParams.get('months') || '6');

    console.log(`📊 API /smart-ordering-ai/analyze-supplier?mode=${mode}`);

    if (mode === 'all') {
      const analyses = await leadTimeAnalyzer.analyzeAllSuppliers(monthsHistory);

      return NextResponse.json({
        success: true,
        suppliers: analyses.map(analysis => ({
          ...analysis,
          recommended: leadTimeAnalyzer.getRecommendedLeadTime(analysis)
        })),
        count: analyses.length
      });
    }

    if (!supplierIdParam) {
      return NextResponse.json(
        { error: 'supplierId richiesto per mode=single' },
        { status: 400 }
      );
    }

    const supplierId = parseInt(supplierIdParam);
    const analysis = await leadTimeAnalyzer.analyzeSupplier(supplierId, monthsHistory);
    const recommended = leadTimeAnalyzer.getRecommendedLeadTime(analysis);

    return NextResponse.json({
      success: true,
      analysis,
      recommended
    });

  } catch (error: any) {
    console.error('❌ Errore API analyze-supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    );
  }
}
