'use client';

import type { WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

export function TabTelegram({ agent }: { agent: WhatsAppAgentConfig }) {
  if (!agent.telegram) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-4">📱</p>
        <p className="text-white/60 text-sm">Bot Telegram non ancora configurato per {agent.name}</p>
        <p className="text-white/40 text-xs mt-2">Contatta l'admin per attivare il bot Telegram</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg p-4">
        <p className="text-xs text-white/40 mb-1">Bot Telegram</p>
        <p className="text-sm text-white font-medium">{agent.telegram.bot}</p>
      </div>
      <div className="bg-white/5 rounded-lg p-4">
        <p className="text-xs text-white/40 mb-1">Stato</p>
        <span className="text-sm text-yellow-400">Da verificare</span>
      </div>
      <a
        href={`https://t.me/${agent.telegram.bot.replace('@', '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors"
      >
        Apri in Telegram →
      </a>
    </div>
  );
}
