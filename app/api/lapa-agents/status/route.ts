/**
 * LAPA AI AGENTS - Status API
 *
 * Endpoint per monitorare lo stato degli agenti LAPA AI
 * Statistiche reali basate sui log delle richieste
 */

import { NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';
import { agentStats } from '@/lib/lapa-agents/stats';

interface AgentStatus {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'error' | 'offline';
  enabled: boolean;
  description: string;
  capabilities: string[];
  stats: {
    requestsToday: number;
    requestsTotal: number;
    avgResponseTime: number;
    successRate: number;
    lastActive: string;
  };
}

// Definizione agenti
const agentDefinitions: Array<Omit<AgentStatus, 'stats'>> = [
  {
    id: 'orchestrator',
    name: 'Orchestratore',
    status: 'active',
    enabled: true,
    description: 'Smista le richieste agli agenti specializzati',
    capabilities: ['route requests', 'analyze intent', 'manage context']
  },
  {
    id: 'order',
    name: 'Agente Ordini',
    status: 'active',
    enabled: true,
    description: 'Gestisce ordini, storico, creazione e modifiche',
    capabilities: ['read orders', 'create orders b2b', 'modify orders', 'cancel orders']
  },
  {
    id: 'invoice',
    name: 'Agente Fatture',
    status: 'active',
    enabled: true,
    description: 'Gestisce fatture, pagamenti e saldo aperto',
    capabilities: ['read invoices', 'check balance', 'payment links', 'due dates']
  },
  {
    id: 'shipping',
    name: 'Agente Spedizioni',
    status: 'active',
    enabled: true,
    description: 'Tracking spedizioni, ETA e info autista',
    capabilities: ['track shipments', 'delivery eta', 'driver info', 'delivery history']
  },
  {
    id: 'product',
    name: 'Agente Prodotti',
    status: 'active',
    enabled: true,
    description: 'Ricerca prodotti, prezzi e disponibilità',
    capabilities: ['search products', 'check availability', 'get prices', 'similar products']
  },
  {
    id: 'helpdesk',
    name: 'Agente Helpdesk',
    status: 'active',
    enabled: true,
    description: 'Supporto generico e escalation a operatore',
    capabilities: ['create tickets', 'escalation', 'general support', 'faq']
  }
];

export async function GET() {
  try {
    // Costruisci status agenti con statistiche reali da Vercel KV
    const agents: AgentStatus[] = await Promise.all(
      agentDefinitions.map(async (def) => ({
        ...def,
        stats: await agentStats.getAgentStatsAsync(def.id)
      }))
    );

    // Statistiche globali da Vercel KV
    const stats = await agentStats.getGlobalStatsAsync();

    // Info sistema
    const systemInfo = {
      aiModel: 'claude-sonnet-4-20250514',
      aiProvider: 'Anthropic',
      odooConnected: false,
      lastHealthCheck: new Date().toISOString()
    };

    // Test connessione Odoo
    try {
      const odoo = await getOdooClient();
      if (odoo) {
        systemInfo.odooConnected = true;
      }
    } catch {
      systemInfo.odooConnected = false;
    }

    return NextResponse.json({
      agents,
      stats,
      system: systemInfo,
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

    const agentIndex = agentDefinitions.findIndex(a => a.id === agentId);
    if (agentIndex === -1) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Aggiorna stato
    if (typeof enabled === 'boolean') {
      agentDefinitions[agentIndex].enabled = enabled;
      agentDefinitions[agentIndex].status = enabled ? 'active' : 'paused';
    }

    if (status) {
      agentDefinitions[agentIndex].status = status;
    }

    return NextResponse.json({
      success: true,
      agent: {
        ...agentDefinitions[agentIndex],
        stats: await agentStats.getAgentStatsAsync(agentId)
      },
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
