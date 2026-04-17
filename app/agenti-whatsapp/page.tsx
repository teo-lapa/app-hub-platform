'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Home, RefreshCw, AlertTriangle, Activity, Bell } from 'lucide-react';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';
import { AgentCard } from './components/AgentCard';

type FilterMode = 'all' | 'errors' | 'offline';

interface AgentStatus {
  online: boolean;
  sshReachable: boolean;
  lastLog: string | null;
  pid: string | null;
}

export default function AgentiWhatsAppPage() {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus | null>>({});
  const [statsMap, setStatsMap] = useState<Record<string, { errors24h: number; total24h: number } | null>>({});
  const [restartingAgent, setRestartingAgent] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

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

    // fetch stats in parallel (cheap aggregate for top banner + filter)
    const statsResults = await Promise.allSettled(
      entries.map(async slug => {
        const r = await fetch(`/api/agenti-whatsapp/${slug}/stats`);
        if (!r.ok) return { slug, s: null };
        const d = await r.json();
        return { slug, s: d.error ? null : { errors24h: d.errors24h || 0, total24h: d.total24h || 0 } };
      })
    );
    const newStats: Record<string, any> = {};
    for (const r of statsResults) if (r.status === 'fulfilled') newStats[r.value.slug] = r.value.s;
    setStatsMap(newStats);
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

  const monitorable = Object.entries(WHATSAPP_AGENTS).filter(([, a]) => a.apiAvailable !== false);
  const onlineCount = monitorable.filter(([slug]) => statuses[slug]?.online).length;
  const monitorableCount = monitorable.length;
  const totalCount = Object.keys(WHATSAPP_AGENTS).length;
  const offlineCount = monitorableCount - onlineCount;
  const totalErrors = Object.values(statsMap).reduce((acc, s) => acc + (s?.errors24h || 0), 0);
  const totalMsg = Object.values(statsMap).reduce((acc, s) => acc + (s?.total24h || 0), 0);
  const agentsWithErrors = Object.entries(statsMap).filter(([, s]) => (s?.errors24h || 0) > 0).map(([k]) => k);
  const globalHealth = monitorableCount === 0 ? 0 : Math.round((onlineCount / monitorableCount) * 100 - Math.min(totalErrors * 2, 30));
  const globalColor = globalHealth >= 80 ? 'text-green-400' : globalHealth >= 50 ? 'text-yellow-400' : 'text-red-400';

  const visible = Object.entries(WHATSAPP_AGENTS).filter(([slug, a]) => {
    if (filter === 'all') return true;
    if (filter === 'errors') return agentsWithErrors.includes(slug);
    if (filter === 'offline') return a.apiAvailable !== false && !statuses[slug]?.online;
    return true;
  });

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
              <h1 className="text-2xl font-bold text-white">Agenti AI LAPA</h1>
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

        {/* Banner salute globale */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-white/50 uppercase tracking-wide mb-1">
              <Activity className="w-3.5 h-3.5" /> Salute globale
            </div>
            <div className={`text-3xl font-bold ${globalColor}`}>{globalHealth}<span className="text-sm text-white/40">/100</span></div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Online</div>
            <div className="text-3xl font-bold text-white">
              <span className="text-green-400">{onlineCount}</span>
              <span className="text-white/40 text-xl">/{monitorableCount}</span>
            </div>
            {totalCount !== monitorableCount && (
              <div className="text-[10px] text-white/40 mt-0.5">+{totalCount - monitorableCount} solo-Telegram</div>
            )}
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Msg 24h</div>
            <div className="text-3xl font-bold text-white">{totalMsg}</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-white/50 uppercase tracking-wide mb-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Errori 24h
            </div>
            <div className={`text-3xl font-bold ${totalErrors > 0 ? 'text-red-400' : 'text-white'}`}>{totalErrors}</div>
          </div>
        </div>

        {/* Filtri */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {([
            { id: 'all' as const, label: `Tutti (${totalCount})` },
            { id: 'errors' as const, label: `Con errori (${agentsWithErrors.length})` },
            { id: 'offline' as const, label: `Offline (${offlineCount})` },
          ]).map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.id ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
          <Link
            href="/agenti-whatsapp/alerts"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors"
          >
            <Bell className="w-4 h-4" /> Centro alert
          </Link>
        </div>

        {/* Agent grid */}
        {visible.length === 0 ? (
          <div className="rounded-xl bg-white/5 border border-white/10 p-10 text-center">
            <div className="text-5xl mb-3">
              {filter === 'offline' ? '✅' : filter === 'errors' ? '🎉' : '🤖'}
            </div>
            <div className="text-lg font-semibold text-white mb-1">
              {filter === 'offline' && 'Tutti gli agenti sono online'}
              {filter === 'errors' && 'Nessun errore nelle ultime 24h'}
              {filter === 'all' && 'Nessun agente configurato'}
            </div>
            <div className="text-sm text-white/50">
              {filter === 'offline' && 'Nessun agente offline in questo momento.'}
              {filter === 'errors' && 'Tutti gli agenti stanno lavorando senza errori.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
            {visible.map(([slug, agent]) => (
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
        )}
      </div>
    </div>
  );
}
