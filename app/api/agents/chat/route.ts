/**
 * 💬 AGENT CHAT API
 * Endpoint per comunicare con l'orchestratore
 */

import { NextRequest, NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/agents/core/orchestrator';

// Global orchestrator instance (singleton)
let orchestrator: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`\n📨 Received chat message: "${message.substring(0, 100)}..."`);

    // Get orchestrator
    const orch = getOrchestrator();

    // Process request
    const startTime = Date.now();
    const result = await orch.processUserRequest(message);
    const duration = Date.now() - startTime;

    console.log(`✅ Request processed in ${duration}ms`);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      changes: result.changes,
      artifacts: result.artifacts,
      logs: result.logs,
      metrics: result.metrics,
      metadata: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Chat API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: Get chat history or status
export async function GET() {
  try {
    const orch = getOrchestrator();
    const stats = orch.getStats();

    return NextResponse.json({
      status: 'online',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get status error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
