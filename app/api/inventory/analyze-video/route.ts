import { NextRequest, NextResponse } from 'next/server';
import { analyzeInventoryVideo, OdooProduct, InventoryAnalysisResult } from '@/lib/services/inventory-ai-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for multi-agent video processing

interface InventoryProductInput {
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
  products: InventoryProductInput[];
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

    console.log(`[INVENTORY-ANALYZE-VIDEO] Starting MULTI-AGENT analysis for location ${body.locationName} (ID: ${body.locationId})`);
    console.log(`[INVENTORY-ANALYZE-VIDEO] Products: ${body.products.length}, Video URL: ${body.videoUrl}`);

    // Convert inventory products to OdooProduct format for multi-agent service
    const expectedProducts: OdooProduct[] = body.products.map(p => ({
      productId: p.id,
      productName: p.name,
      expectedQuantity: p.quantity,
      uom: p.uom || 'PZ',
      barcode: p.barcode || undefined,
      lotNumber: p.lot_name || undefined,
      expiryDate: p.lot_expiration_date || undefined
    }));

    // Perform multi-agent video analysis
    const result: InventoryAnalysisResult = await analyzeInventoryVideo(
      body.videoUrl,
      expectedProducts,
      body.locationName
    );

    // Log extraction results for debugging
    console.log(`[INVENTORY-ANALYZE-VIDEO] === GEMINI EXTRACTION RESULTS ===`);
    console.log(`[INVENTORY-ANALYZE-VIDEO] Extracted ${result.extractedProducts.length} products:`);
    result.extractedProducts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.productName} - ${p.quantity} ${p.uom} (confidence: ${p.confidence})`);
    });
    console.log(`[INVENTORY-ANALYZE-VIDEO] Raw extraction response preview:`, result.rawExtractionResponse?.substring(0, 500));

    if (!result.success) {
      console.error('[INVENTORY-ANALYZE-VIDEO] Analysis failed:', result.summary);
      return NextResponse.json({
        success: false,
        error: result.summary,
        warnings: result.warnings,
        errors: result.errors,
        // Include raw data for debugging
        debug: {
          extractedProducts: result.extractedProducts,
          rawExtractionResponse: result.rawExtractionResponse
        }
      }, { status: 500 });
    }

    console.log(`[INVENTORY-ANALYZE-VIDEO] Analysis complete: ${result.totalMatchedProducts}/${result.totalExpectedProducts} matched`);
    console.log(`[INVENTORY-ANALYZE-VIDEO] Overall confidence: ${result.matchingConfidence}`);

    // Transform matches to frontend-compatible format
    const transformedMatches = result.matches.map(match => {
      const originalProduct = body.products.find(p => p.id === match.odooProductId);

      return {
        productId: match.odooProductId,
        productName: match.odooProductName,
        seenInVideo: match.matched,
        confidence: match.matchConfidence,
        observations: match.matchReason,
        expectedQuantity: match.expectedQuantity,
        actualQuantity: match.actualQuantity || 0,
        unit: match.expectedUom,
        // Additional data from original product
        productCode: originalProduct?.code,
        barcode: originalProduct?.barcode,
        lotId: originalProduct?.lot_id,
        lotName: match.lotMatch ? originalProduct?.lot_name : undefined,
        lotExpirationDate: match.expiryMatch ? originalProduct?.lot_expiration_date : undefined,
        // Extra info from matching
        quantityDifference: match.quantityDifference,
        warnings: match.warnings
      };
    });

    return NextResponse.json({
      success: true,
      analysis: {
        success: result.success,
        analysisDate: result.analysisDate,
        videoDurationSeconds: result.videoDurationSeconds,
        locationId: body.locationId,
        locationName: result.locationName,

        // Core data
        matches: transformedMatches,
        additionalProductsSeen: result.extractedProducts
          .filter(ep => !result.matches.some(m =>
            m.extractedProductName?.toLowerCase() === ep.productName.toLowerCase()
          ))
          .map(ep => ep.productName),

        // Stats
        totalExpectedProducts: result.totalExpectedProducts,
        matchedProducts: result.totalMatchedProducts,
        unmatchedProducts: result.totalUnmatchedProducts,
        overallConfidence: result.matchingConfidence,

        // Summary and warnings
        summary: result.summary,
        warnings: result.warnings,

        // Debug data (for troubleshooting)
        debug: {
          extractedProducts: result.extractedProducts,
          normalizedProducts: result.normalizedProducts,
          normalizationStats: result.normalizationStats,
          extractionConfidence: result.extractionConfidence
        }
      }
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
