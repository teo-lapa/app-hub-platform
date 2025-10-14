/**
 * 🔍 AGENT DISCOVERY API
 * Endpoint per forzare re-discovery delle app
 */

import { NextResponse } from 'next/server';
import { Orchestrator } from '@/lib/agents/core/orchestrator';

let orchestrator: Orchestrator | null = null;

function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator();
  }
  return orchestrator;
}

export async function POST() {
  try {
    console.log('🔍 Starting app re-discovery...');

    const orch = getOrchestrator();

    // Ensure orchestrator is initialized
    await orch.initialize();

    // Force re-discovery
    await orch.rediscoverApps();

    // Get updated stats
    const stats = orch.getStats();
    const agents = orch.getActiveAgents();

    return NextResponse.json({
      success: true,
      message: `Re-discovery completed. Found ${agents.length} apps.`,
      agents: agents.map(agent => ({
        name: agent.name,
        appName: agent.appContext?.appName,
        category: agent.appContext?.category,
        capabilities: agent.capabilities.length
      })),
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Discovery error:', error);

    return NextResponse.json(
      {
        error: 'Failed to discover apps',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET: Get currently discovered apps
export async function GET() {
  try {
    const orch = getOrchestrator();
    const agents = orch.getActiveAgents();

    return NextResponse.json({
      apps: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        appName: agent.appContext?.appName,
        category: agent.appContext?.category,
        description: agent.appContext?.description,
        capabilities: agent.capabilities.map(c => c.name),
        structure: agent.appContext?.structure,
        dependencies: agent.appContext?.dependencies,
        metadata: agent.appContext?.metadata
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Get apps error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get apps',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
