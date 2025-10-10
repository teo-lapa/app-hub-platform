/**
 * API Route: Cache Risultati Analisi
 * GET /api/ordini-fornitori/cache - Recupera ultima analisi
 * DELETE /api/ordini-fornitori/cache - Cancella cache
 */

import { NextResponse } from 'next/server';

// In-memory cache (in produzione usare Redis/Vercel KV)
let cachedAnalysis: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 ora

export async function GET(request: Request) {
  const now = Date.now();

  if (cachedAnalysis && (now - cacheTimestamp) < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      cached: true,
      cacheAge: Math.floor((now - cacheTimestamp) / 1000),
      data: cachedAnalysis
    });
  }

  return NextResponse.json({
    success: false,
    cached: false,
    message: 'Nessuna analisi in cache o cache scaduta'
  }, { status: 404 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    cachedAnalysis = body;
    cacheTimestamp = Date.now();

    return NextResponse.json({
      success: true,
      message: 'Cache aggiornata'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  cachedAnalysis = null;
  cacheTimestamp = 0;

  return NextResponse.json({
    success: true,
    message: 'Cache cancellata'
  });
}
