'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Home, RefreshCw } from 'lucide-react';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';
import { AgentCard } from './components/AgentCard';

interface AgentStatus {
  online: boolean;
  sshReachable: boolean;
  lastLog: string | null;
  pid: string | null;
}

export default function AgentiWhatsAppPage() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus | null>>({});
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatuses = useCallback(async () => {
    const entries = Object.keys(WHATSAPP_AGENTS);
    const results = await Promise.allSettled(
      entries.map(async (slug) => {
        const res = await fetch(`/api/agenti-whatsapp/${slug}/status`);
        if (!res.ok) return { slug, status: null };
        const data = await res.json();
        return { slug, status: data as AgentStatus };
      })
    );

    const newStatuses: Record<string, AgentStatus | null> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        newStatuses[r.value.slug] = r.value.status;
      }
    }
    setStatuses(newStatuses);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    fetchStatuses();
    const interval = setInterval(fetchStatuses, 30000);
    return () => clearInterval(interval);
  }, [fetchStatuses]);

  const handleRestart = async (slug: string) => {
    setRestartingAgent(slug);
    try {
      await fetch(`/api/agenti-whatsapp/${slug}/restart`, { method: 'POST' });
      // Wait a bit then refresh status
      setTimeout(() => {
        fetchStatuses();
        setRestartingAgent(null);
      }, 3000);
    } catch {
      setRestartingAgent(null);
    }
  };

  const onlineCount = Object.values(statuses).filter(s => s?.online).length;
  const totalCount = Object.keys(WHATSAPP_AGENTS).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <Home className="w-5 h-5 text-white/60" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Agenti WhatsApp LAPA</h1>
              <p className="text-sm text-white/50">Pannello di controllo centrale</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/40">
              {lastRefresh ? `Ultimo aggiornamento: ${lastRefresh.toLocaleTimeString('it-CH')}` : 'Caricamento...'}
            </span>
            <button
              onClick={fetchStatuses}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Aggiorna"
            >
              <RefreshCw className="w-4 h-4 text-white/60" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 mb-8 text-sm">
          <div className="px-4 py-2 rounded-lg bg-white/5 text-white/70">
            <span className="text-green-400 font-bold">{onlineCount}</span>/{totalCount} online
          </div>
        </div>

        {/* Agent grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {Object.entries(WHATSAPP_AGENTS).map(([slug, agent]) => (
            <AgentCard
              key={slug}
              slug={slug}
              agent={agent}
              status={statuses[slug] ?? null}
              onRestart={handleRestart}
              restarting={restartingAgent === slug}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
