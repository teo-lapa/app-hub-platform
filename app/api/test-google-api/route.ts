import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint per verificare Google Maps API Key
 * GET /api/test-google-api
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY non configurata',
      env: process.env.NODE_ENV
    }, { status: 500 });
  }

  // Test semplice: geocoding di un indirizzo
  const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${apiKey}`;

  try {
    const response = await fetch(testUrl);
    const data = await response.json();

    return NextResponse.json({
      success: data.status === 'OK',
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      apiKeyFirstChars: apiKey.substring(0, 10) + '...',
      apiKeyHasNewline: apiKey.includes('\n'),
      apiKeyHasWhitespace: /\s/.test(apiKey),
      googleApiStatus: data.status,
      googleApiError: data.error_message,
      testResult: data.status === 'OK' ? 'API Key is working!' : 'API Key has issues',
      env: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
      env: process.env.NODE_ENV
    }, { status: 500 });
  }
}
