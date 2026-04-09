'use client';

import { useState, useEffect } from 'react';
import type { WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

interface ConfigData {
  agent: {
    name: string;
    model: string;
    maxTurns: { default: number; heavy?: number };
    whatsapp: string;
    owner: { name: string; number: string };
    pc: { ip: string; ssh: string; os: string };
  };
  claude: string | null;
  soul: string | null;
}

export function TabSettaggi({ slug, agent }: { slug: string; agent: WhatsAppAgentConfig }) {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [activeDoc, setActiveDoc] = useState<'claude' | 'soul' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agenti-whatsapp/${slug}/config`)
      .then(r => r.json())
      .then(d => { setConfig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-white/40">Caricamento settaggi...</p>;

  return (
    <div className="space-y-6">
      {/* Config summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <ConfigItem label="Modello" value={agent.model} />
        <ConfigItem label="Max Turns" value={`${agent.maxTurns.default}${agent.maxTurns.heavy ? ` / ${agent.maxTurns.heavy}` : ''}`} />
        <ConfigItem label="WhatsApp" value={agent.whatsapp} />
        <ConfigItem label="Proprietario" value={agent.owner.name} />
        <ConfigItem label="PC" value={`${agent.pc.ip} (${agent.pc.os})`} />
        <ConfigItem label="SSH" value={agent.pc.ssh} />
      </div>

      {/* CLAUDE.md / SOUL.md */}
      <div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveDoc(activeDoc === 'claude' ? null : 'claude')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDoc === 'claude' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            CLAUDE.md
          </button>
          <button
            onClick={() => setActiveDoc(activeDoc === 'soul' ? null : 'soul')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDoc === 'soul' ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            SOUL.md
          </button>
        </div>
        {activeDoc && (
          <div className="bg-white/5 rounded-lg p-4 max-h-[400px] overflow-y-auto">
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">
              {config?.[activeDoc] || 'File non trovato'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}
