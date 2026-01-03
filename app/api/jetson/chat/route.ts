import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Jetson configuration
const JETSON_URL = process.env.JETSON_TUNNEL_URL || process.env.JETSON_OCR_URL || 'https://jetson.lapa.ch';
const JETSON_SECRET = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

/**
 * POST /api/jetson/chat
 * Proxy per chiamate chat al Jetson (evita problemi CORS)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${JETSON_URL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': JETSON_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('❌ Jetson chat proxy error:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore connessione Jetson',
    }, { status: 500 });
  }
}
