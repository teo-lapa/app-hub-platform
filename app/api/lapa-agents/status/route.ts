/**
 * LAPA AI AGENTS - Status API
 *
 * Endpoint per monitorare lo stato degli agenti LAPA AI
 */

import { NextResponse } from 'next/server';

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error' | 'offline';
  enabled: boolean;
  stats: {
    requestsToday: number;
    requestsTotal: number;
    avgResponseTime: number;
    successRate: number;
    lastActive: string;
  };
}

interface DashboardStats {
  totalRequests: number;
  activeConversations: number;
  resolvedToday: number;
  escalatedToday: number;
  avgResponseTime: number;
  customerSatisfaction: number;
}

// Stato in memoria (in produzione: database)
let agentStats: Record<string, AgentStatus> = {
  orchestrator: {
    id: 'orchestrator',
    name: 'Orchestratore',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 156,
      requestsTotal: 4523,
      avgResponseTime: 0.8,
      successRate: 98.5,
      lastActive: new Date().toISOString()
    }
  },
  orders: {
    id: 'orders',
    name: 'Agente Ordini',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 45,
      requestsTotal: 1234,
      avgResponseTime: 1.2,
      successRate: 96.8,
      lastActive: new Date().toISOString()
    }
  },
  invoices: {
    id: 'invoices',
    name: 'Agente Fatture',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 32,
      requestsTotal: 892,
      avgResponseTime: 0.9,
      successRate: 99.1,
      lastActive: new Date().toISOString()
    }
  },
  shipping: {
    id: 'shipping',
    name: 'Agente Spedizioni',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 28,
      requestsTotal: 756,
      avgResponseTime: 1.1,
      successRate: 97.3,
      lastActive: new Date().toISOString()
    }
  },
  products: {
    id: 'products',
    name: 'Agente Prodotti',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 67,
      requestsTotal: 2341,
      avgResponseTime: 0.7,
      successRate: 99.5,
      lastActive: new Date().toISOString()
    }
  },
  helpdesk: {
    id: 'helpdesk',
    name: 'Agente Helpdesk',
    status: 'active',
    enabled: true,
    stats: {
      requestsToday: 12,
      requestsTotal: 456,
      avgResponseTime: 1.5,
      successRate: 94.2,
      lastActive: new Date().toISOString()
    }
  }
};

export async function GET() {
  try {
    const agents = Object.values(agentStats);

    // Calcola statistiche globali
    const stats: DashboardStats = {
      totalRequests: agents.reduce((sum, a) => sum + a.stats.requestsToday, 0),
      activeConversations: Math.floor(Math.random() * 10) + 5, // Simulato
      resolvedToday: Math.floor(agents.reduce((sum, a) => sum + a.stats.requestsToday, 0) * 0.85),
      escalatedToday: Math.floor(Math.random() * 5) + 1,
      avgResponseTime: parseFloat((agents.reduce((sum, a) => sum + a.stats.avgResponseTime, 0) / agents.length).toFixed(1)),
      customerSatisfaction: 4.7
    };

    return NextResponse.json({
      agents,
      stats,
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

// POST: Aggiorna stato agente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, enabled, status } = body;

    if (!agentId || !agentStats[agentId]) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Aggiorna stato
    if (typeof enabled === 'boolean') {
      agentStats[agentId].enabled = enabled;
      agentStats[agentId].status = enabled ? 'active' : 'paused';
    }

    if (status) {
      agentStats[agentId].status = status;
    }

    return NextResponse.json({
      success: true,
      agent: agentStats[agentId],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Update agent error:', error);

    return NextResponse.json(
      {
        error: 'Failed to update agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
