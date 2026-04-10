'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';
import { TabStato } from '../components/TabStato';
import { TabSkills } from '../components/TabSkills';
import { TabMemoria } from '../components/TabMemoria';
import { TabLog } from '../components/TabLog';
import { TabSettaggi } from '../components/TabSettaggi';
import { TabTelegram } from '../components/TabTelegram';
import { TabFollowup } from '../components/TabFollowup';

const TABS = [
  { id: 'stato', label: 'Stato' },
  { id: 'skills', label: 'Skills' },
  { id: 'memoria', label: 'Memoria' },
  { id: 'log', label: 'Log' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'settaggi', label: 'Settaggi' },
  { id: 'telegram', label: 'Telegram' },
] as const;

type TabId = typeof TABS[number]['id'];

export default function AgentDetailPage() {
  const { nome } = useParams<{ nome: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('stato');

  const agent = WHATSAPP_AGENTS[nome];
  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">❓</p>
          <p className="text-white/60">Agente &quot;{nome}&quot; non trovato</p>
          <Link href="/agenti-whatsapp" className="text-blue-400 text-sm mt-4 inline-block hover:underline">
            ← Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/agenti-whatsapp" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <span className="text-4xl">{agent.emoji}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <p className="text-sm text-white/50">{agent.role} — {agent.owner.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-white/10 pb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white border-b-2'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
              style={activeTab === tab.id ? { borderBottomColor: agent.color } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[400px]">
          {activeTab === 'stato' && <TabStato slug={nome} />}
          {activeTab === 'skills' && <TabSkills slug={nome} />}
          {activeTab === 'memoria' && <TabMemoria slug={nome} />}
          {activeTab === 'log' && <TabLog slug={nome} />}
          {activeTab === 'followup' && <TabFollowup slug={nome} />}
          {activeTab === 'settaggi' && <TabSettaggi slug={nome} agent={agent} />}
          {activeTab === 'telegram' && <TabTelegram agent={agent} />}
        </div>
      </div>
    </div>
  );
}
