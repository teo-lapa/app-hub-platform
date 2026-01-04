/**
 * 📊 AGENT STATUS API
 * Endpoint per monitorare lo stato degli agenti
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

export async function GET() {
  try {
    const orch = getOrchestrator();

    // Get all agents
    const agents = orch.getActiveAgents();

    // Get stats
    const stats = orch.getStats();

    // Get state
    const state = orch.getState();

    return NextResponse.json({
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        appName: agent.appContext?.appName,
        category: agent.appContext?.category,
        capabilities: agent.capabilities.map(c => c.name),
        stats: {
          tasksCompleted: agent.stats.tasksCompleted,
          tasksInProgress: agent.stats.tasksInProgress,
          tasksFailed: agent.stats.tasksFailed,
          successRate: agent.stats.successRate,
          averageCompletionTime: agent.stats.averageCompletionTime,
          lastActive: agent.stats.lastActive
        }
      })),
      stats: {
        totalAgents: stats.totalAgents,
        activeTasks: stats.activeTasks,
        completedTasks: stats.completedTasks,
        queuedTasks: stats.queuedTasks,
        activeCoordinations: stats.activeCoordinations
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Status API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to get agent status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST: Initialize or reinitialize orchestrator
export async function POST() {
  try {
    const orch = getOrchestrator();

    console.log('🔄 Initializing orchestrator...');
    await orch.initialize();

    const stats = orch.getStats();

    return NextResponse.json({
      success: true,
      message: 'Orchestrator initialized successfully',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Initialize error:', error);

    return NextResponse.json(
      {
        error: 'Failed to initialize orchestrator',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
