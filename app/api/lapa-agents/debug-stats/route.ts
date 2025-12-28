/**
 * DEBUG: Visualizza contenuto Vercel KV per statistiche agenti
 */

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const today = getTodayKey();

    // Leggi tutti i dati dal KV
    const requestsKey = `lapa_stats:requests:${today}`;
    const escalationsKey = `lapa_stats:escalations:${today}`;
    const sessionsKey = `lapa_stats:sessions`;

    const [requests, escalations, sessionsCount] = await Promise.all([
      kv.get<any[]>(requestsKey),
      kv.get<number>(escalationsKey),
      kv.scard(sessionsKey)
    ]);

    // Leggi totali per ogni agente
    const agentIds = ['orchestrator', 'orders', 'invoices', 'shipping', 'products', 'helpdesk', 'invoice', 'invoice_filter', 'invoice_detail'];
    const agentTotals: Record<string, any> = {};

    for (const agentId of agentIds) {
      const totalsKey = `lapa_stats:totals:${agentId}`;
      const totals = await kv.get<any>(totalsKey);
      if (totals) {
        agentTotals[agentId] = totals;
      }
    }

    // Analizza richieste di oggi per agente
    const requestsByAgent: Record<string, number> = {};
    if (requests && Array.isArray(requests)) {
      for (const req of requests) {
        const agentId = req.agentId || 'unknown';
        requestsByAgent[agentId] = (requestsByAgent[agentId] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      summary: {
        totalRequestsToday: requests?.length || 0,
        totalEscalationsToday: escalations || 0,
        totalSessions: sessionsCount || 0,
        requestsByAgent
      },
      agentTotals,
      rawRequests: requests?.slice(-20) || [], // Ultimi 20 per non sovraccaricare
      keys: {
        requests: requestsKey,
        escalations: escalationsKey,
        sessions: sessionsKey
      }
    });

  } catch (error) {
    console.error('❌ Debug stats error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      kvConfigured: !!process.env.KV_REST_API_URL
    }, { status: 500 });
  }
}
