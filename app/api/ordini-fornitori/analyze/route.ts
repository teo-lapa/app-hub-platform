/**
 * API Route: Esecuzione Agente Autonomo Ordini Fornitori
 * POST /api/ordini-fornitori/analyze
 *
 * Esegue analisi AI completa e ritorna risultati
 */

import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/ai/autonomous-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti max

export async function POST(request: Request) {
  console.log('🚀 API /api/ordini-fornitori/analyze chiamata');

  try {
    // Esegui agente
    const result = await runAgent();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Analisi fallita',
        details: result.errors
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ Errore API analyze:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore sconosciuto'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return NextResponse.json({
    message: 'Usa POST per eseguire analisi',
    endpoint: '/api/ordini-fornitori/analyze',
    method: 'POST'
  });
}
