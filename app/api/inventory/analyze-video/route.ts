import { NextRequest, NextResponse } from 'next/server';
import { analyzeControlVideo, ExpectedProduct, VideoAnalysisResult } from '@/lib/services/gemini-video-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for video processing

interface InventoryProduct {
  id: number;
  name: string;
  code: string;
  barcode: string;
  quantity: number;
  uom: string;
  lot_id: number | null;
  lot_name: string | null;
  lot_expiration_date: string | null;
}

interface AnalyzeInventoryVideoRequest {
  videoUrl: string;
  locationId: number;
  locationName: string;
  products: InventoryProduct[];
}

/**
 * POST /api/inventory/analyze-video
 *
 * Analyzes an inventory video using Gemini AI to verify products in stock location.
 *
 * Request body:
 * - videoUrl: URL of the video to analyze (Vercel Blob URL)
 * - locationId: ID of the inventory location
 * - locationName: Name of the location
 * - products: Array of expected products with id, name, code, barcode, quantity, uom, lot info
 *
 * Returns VideoAnalysisResult with matches and confidence scores.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const body: AnalyzeInventoryVideoRequest = await request.json();

    // Validation
    if (!body.videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'URL video richiesto'
      }, { status: 400 });
    }

    if (!body.locationId) {
      return NextResponse.json({
        success: false,
        error: 'ID location richiesto'
      }, { status: 400 });
    }

    if (!body.locationName) {
      return NextResponse.json({
        success: false,
        error: 'Nome location richiesto'
      }, { status: 400 });
    }

    if (!body.products || body.products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista prodotti richiesta'
      }, { status: 400 });
    }

    console.log(`[INVENTORY-ANALYZE-VIDEO] Starting analysis for location ${body.locationName} (ID: ${body.locationId})`);
    console.log(`[INVENTORY-ANALYZE-VIDEO] Products: ${body.products.length}, Video URL: ${body.videoUrl}`);

    // Convert inventory products to expected format for video analysis
    const expectedProducts: ExpectedProduct[] = body.products.map(p => ({
      productId: p.id,
      productName: p.name,
      quantity: p.quantity,
      unit: p.uom || 'PZ',
      customers: [] // Not applicable for inventory
    }));

    // Perform video analysis using existing service
    const result = await analyzeControlVideo(
      body.videoUrl,
      expectedProducts,
      body.locationName
    );

    if (!result.success) {
      console.error('[INVENTORY-ANALYZE-VIDEO] Analysis failed:', result.summary);
      return NextResponse.json({
        success: false,
        error: result.summary,
        warnings: result.warnings
      }, { status: 500 });
    }

    console.log(`[INVENTORY-ANALYZE-VIDEO] Analysis complete: ${result.matchedProducts}/${result.totalExpectedProducts} matched`);
    console.log(`[INVENTORY-ANALYZE-VIDEO] Overall confidence: ${result.overallConfidence}`);

    // Enhance results with inventory-specific data
    const enhancedMatches = result.matches.map(match => {
      const originalProduct = body.products.find(p =>
        p.name.toLowerCase() === match.productName.toLowerCase() ||
        p.name.toLowerCase().includes(match.productName.toLowerCase()) ||
        match.productName.toLowerCase().includes(p.name.toLowerCase())
      );

      return {
        ...match,
        productId: originalProduct?.id,
        productCode: originalProduct?.code,
        barcode: originalProduct?.barcode,
        lotId: originalProduct?.lot_id,
        lotName: originalProduct?.lot_name,
        lotExpirationDate: originalProduct?.lot_expiration_date
      };
    });

    const enhancedResult = {
      ...result,
      locationId: body.locationId,
      locationName: body.locationName,
      matches: enhancedMatches
    };

    return NextResponse.json({
      success: true,
      analysis: enhancedResult
    });

  } catch (error) {
    console.error('[INVENTORY-ANALYZE-VIDEO] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'analisi del video inventario',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
