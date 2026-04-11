'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
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

export function AgentCard({ slug, agent, status, onRestart, restarting }: AgentCardProps) {
  const isOnline = status?.online ?? false;
  const sshReachable = status?.sshReachable ?? false;

  return (
    <div
      className="relative rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-white/20 transition-all"
      style={{ borderTopColor: agent.color, borderTopWidth: 3 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.emoji}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{agent.name}</h3>
            <p className="text-xs text-white/50">{agent.role}</p>
          </div>
        </div>
        {status ? (
          <AgentStatusBadge online={isOnline} sshReachable={sshReachable} />
        ) : (
          <span className="text-xs text-white/30">Loading...</span>
        )}
      </div>

      <div className="space-y-2 text-sm text-white/60 mb-4">
        <p>👤 {agent.owner.name}</p>
        {agent.whatsapp && <p>📱 {agent.whatsapp}</p>}
        {agent.telegram && <p>✈️ {agent.telegram.bot}</p>}
        <p>💻 {agent.pc.ip} ({agent.pc.os})</p>
        <div className="flex gap-1.5 mt-1">
          {agent.platforms.map(p => (
            <span key={p} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              p === 'whatsapp' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {p === 'whatsapp' ? 'WhatsApp' : 'Telegram'}
            </span>
          ))}
        </div>
        {status && (
          <p className="truncate text-xs text-white/40" title={status.lastLog || ''}>
            📝 {isOnline ? 'Connesso.' : (sshReachable ? 'Bot fermo' : 'PC non raggiungibile')}
            {status.lastLog && ` — ${status.lastLog}`}
          </p>
        )}
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
