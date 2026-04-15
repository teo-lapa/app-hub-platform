'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RefreshCw, MessageSquare, AlertTriangle, Clock } from 'lucide-react';
import { AgentStatusBadge } from './AgentStatusBadge';
import type { WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

interface AgentStatus {
  online: boolean;
  sshReachable: boolean;
  lastLog: string | null;
  pid: string | null;
}

interface AgentCardProps {
  slug: string;
  agent: WhatsAppAgentConfig;
  status: AgentStatus | null;
  onRestart: (slug: string) => void;
  restarting: boolean;
}

interface QuickStats {
  health: number;
  total24h: number;
  errors24h: number;
  last1h: number;
  lastMsgMinutesAgo: number | null;
}

function healthColor(h: number) {
  if (h >= 80) return '#22c55e';
  if (h >= 50) return '#eab308';
  if (h > 0) return '#f97316';
  return '#ef4444';
}

function formatAgo(min: number | null) {
  if (min == null) return '—';
  if (min < 1) return 'ora';
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export function AgentCard({ slug, agent, status, onRestart, restarting }: AgentCardProps) {
  const isOnline = status?.online ?? false;
  const sshReachable = status?.sshReachable ?? false;
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    let cancel = false;
    const load = () => {
      fetch(`/api/agenti-whatsapp/${slug}/stats`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancel && d && !d.error) setStats(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { cancel = true; clearInterval(iv); };
  }, [slug]);

  const h = stats?.health ?? (isOnline ? 50 : 0);

  return (
    <div
      className="relative rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm hover:border-white/20 transition-all"
      style={{ borderTopColor: agent.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.emoji}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{agent.name}</h3>
            <p className="text-xs text-white/50">{agent.role}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {status ? <AgentStatusBadge online={isOnline} sshReachable={sshReachable} /> : <span className="text-xs text-white/30">…</span>}
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${h}%`, background: healthColor(h) }} />
            </div>
            <span className="text-[10px] font-mono text-white/60 w-7 text-right">{h}</span>
          </div>
        </div>
      </div>

      {/* 3 metriche live */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 uppercase tracking-wide">
            <MessageSquare className="w-3 h-3" /> 24h
          </div>
          <div className="text-lg font-bold text-white">{stats?.total24h ?? '—'}</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 uppercase tracking-wide">
            <AlertTriangle className="w-3 h-3" /> err
          </div>
          <div className={`text-lg font-bold ${(stats?.errors24h ?? 0) > 0 ? 'text-red-400' : 'text-white'}`}>
            {stats?.errors24h ?? '—'}
          </div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 uppercase tracking-wide">
            <Clock className="w-3 h-3" /> ultimo
          </div>
          <div className="text-sm font-semibold text-white">{formatAgo(stats?.lastMsgMinutesAgo ?? null)}</div>
        </div>
      </div>

      <div className="space-y-1 text-xs text-white/55 mb-3">
        <p>👤 {agent.owner.name}{agent.whatsapp ? ` · 📱 ${agent.whatsapp}` : ''}</p>
        {agent.telegram && <p>✈️ {agent.telegram.bot}</p>}
        <p>💻 {agent.pc.ip} ({agent.pc.os})</p>
        <div className="flex gap-1.5 pt-1">
          {agent.platforms.map(p => (
            <span key={p} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              p === 'whatsapp' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {p === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/agenti-whatsapp/${slug}`}
          className="flex-1 text-center py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
        >
          Apri
        </Link>
        <button
          onClick={() => onRestart(slug)}
          disabled={restarting}
          className="py-2 px-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-sm font-medium transition-colors disabled:opacity-50"
          title="Restart bot"
        >
          <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
