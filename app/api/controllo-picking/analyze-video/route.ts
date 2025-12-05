import { NextRequest, NextResponse } from 'next/server';
import { analyzeControlVideo, ExpectedProduct, VideoAnalysisResult } from '@/lib/services/gemini-video-analysis';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for video processing

interface AnalyzeVideoRequest {
  videoUrl: string;
  zoneName: string;
  products: ExpectedProduct[];
}

/**
 * POST /api/controllo-picking/analyze-video
 *
 * Analyzes a control video using Gemini AI to verify products match expected list.
 *
 * Request body:
 * - videoUrl: URL of the video to analyze (Vercel Blob URL)
 * - zoneName: Name of the zone (Secco, Frigo, etc.)
 * - products: Array of expected products with name, quantity, unit
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

    const body: AnalyzeVideoRequest = await request.json();

    if (!body.videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'URL video richiesto'
      }, { status: 400 });
    }

    if (!body.products || body.products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Lista prodotti richiesta'
      }, { status: 400 });
    }

    console.log(`[ANALYZE-VIDEO] Starting analysis for zone ${body.zoneName}, ${body.products.length} products`);
    console.log(`[ANALYZE-VIDEO] Video URL: ${body.videoUrl}`);

    // Perform video analysis
    const result = await analyzeControlVideo(
      body.videoUrl,
      body.products,
      body.zoneName || 'Non specificata'
    );

    if (!result.success) {
      console.error('[ANALYZE-VIDEO] Analysis failed:', result.summary);
      return NextResponse.json({
        success: false,
        error: result.summary,
        warnings: result.warnings
      }, { status: 500 });
    }

    console.log(`[ANALYZE-VIDEO] Analysis complete: ${result.matchedProducts}/${result.totalExpectedProducts} matched`);

    return NextResponse.json({
      success: true,
      analysis: result
    });

  } catch (error) {
    console.error('[ANALYZE-VIDEO] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'analisi del video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
