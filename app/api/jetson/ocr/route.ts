/**
 * API Route: Jetson OCR Proxy
 * Forwards PDF upload to Jetson OCR Server via Cloudflare Tunnel
 */

import { NextRequest, NextResponse } from 'next/server';

const JETSON_OCR_URL = process.env.JETSON_OCR_URL || 'https://pencil-intl-adipex-knowledgestorm.trycloudflare.com';
const JETSON_WEBHOOK_SECRET = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for OCR processing

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`📄 Forwarding PDF to Jetson: ${file.name} (${file.size} bytes)`);

    // Forward to Jetson OCR Server
    const jetsonFormData = new FormData();
    jetsonFormData.append('file', file);

    const response = await fetch(`${JETSON_OCR_URL}/api/v1/ocr/analyze`, {
      method: 'POST',
      headers: {
        'X-Webhook-Secret': JETSON_WEBHOOK_SECRET,
      },
      body: jetsonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jetson OCR error:', response.status, errorText);
      return NextResponse.json(
        { error: `Jetson OCR failed: ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    console.log(`✅ OCR completed: ${result.result?.typeName} (${result.result?.confidence}% confidence)`);

    return NextResponse.json({
      success: true,
      ...result,
      jetsonUrl: JETSON_OCR_URL, // Include for debugging
    });

  } catch (error: any) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process document',
        message: error.message,
        jetsonUrl: JETSON_OCR_URL
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const response = await fetch(`${JETSON_OCR_URL}/api/v1/health`, {
      headers: {
        'X-Webhook-Secret': JETSON_WEBHOOK_SECRET,
      },
    });

    const health = await response.json();

    return NextResponse.json({
      jetson: health,
      tunnel: {
        url: JETSON_OCR_URL,
        status: response.ok ? 'online' : 'offline',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json({
      jetson: { status: 'offline' },
      tunnel: {
        url: JETSON_OCR_URL,
        status: 'offline',
        error: error.message,
      },
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
