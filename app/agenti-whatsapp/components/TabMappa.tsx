'use client';

import { useEffect, useState } from 'react';
import { Smartphone, MessageSquare, Cpu, Wrench, Database, Send, FileText, FolderOpen } from 'lucide-react';
import type { WhatsAppAgentConfig } from '@/lib/agents/whatsapp-agents';

interface Skill { name: string; description?: string }

function Node({ icon: Icon, title, subtitle, color }: any) {
  return (
    <div className="relative rounded-xl border-2 p-3 bg-black/30 backdrop-blur-sm min-w-[140px]" style={{ borderColor: color }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}22` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="text-xs font-bold text-white">{title}</div>
      </div>
      {subtitle && <div className="text-[10px] text-white/60 break-words">{subtitle}</div>}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-white/30 px-1">
      <svg width="28" height="16" viewBox="0 0 28 16"><path d="M0 8 L22 8 M16 2 L22 8 L16 14" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
      {label && <span className="text-[9px] text-white/40 font-mono mt-0.5">{label}</span>}
    </div>
  );
}

function ArrowDown() {
  return (
    <div className="flex justify-center text-white/30 py-1">
      <svg width="16" height="24" viewBox="0 0 16 24"><path d="M8 0 L8 18 M2 12 L8 18 L14 12" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
    </div>
  );
}

export function TabMappa({ slug, agent }: { slug: string; agent: WhatsAppAgentConfig }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memorySize, setMemorySize] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/agenti-whatsapp/${slug}/skills`).then(r => r.json()).then(d => setSkills(d.skills || [])).catch(() => {});
    fetch(`/api/agenti-whatsapp/${slug}/memory`).then(r => r.json()).then(d => setMemorySize((d.memory || '').length)).catch(() => {});
  }, [slug]);

  const platformsLabel = agent.platforms.join(' + ');
  const modelColor = agent.model.includes('opus') ? '#a855f7' : agent.model.includes('sonnet') ? '#3b82f6' : '#64748b';

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h3 className="text-lg font-bold text-white mb-1">Flusso operativo {agent.name}</h3>
        <p className="text-xs text-white/50">Come arriva un messaggio e cosa succede</p>
      </div>

      {/* Top: Ingresso */}
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <Node icon={MessageSquare} title="Messaggio" subtitle={platformsLabel} color="#22c55e" />
        <Arrow label="webhook" />
        <Node icon={Smartphone} title="Bot ricevente" subtitle={`${agent.pc.ip} · ${agent.pc.os}`} color="#06b6d4" />
      </div>

      <ArrowDown />

      {/* Middle: Claude engine */}
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <Node icon={Cpu} title={`Claude ${agent.model}`} subtitle={`max ${agent.maxTurns.default} turni${agent.maxTurns.heavy ? ` · heavy ${agent.maxTurns.heavy}` : ''}`} color={modelColor} />
      </div>

      <ArrowDown />

      {/* Skills + Memoria side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border-2 p-4 bg-black/30" style={{ borderColor: '#f59e0b' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: '#f59e0b22' }}>
              <Wrench className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-white">Skills ({skills.length})</div>
          </div>
          {skills.length === 0 && <p className="text-xs text-white/40">Nessuno skill trovato o API non disponibile.</p>}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {skills.map(s => (
              <span key={s.name} className="text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200" title={s.description || s.name}>
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 p-4 bg-black/30" style={{ borderColor: '#8b5cf6' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ background: '#8b5cf622' }}>
              <Database className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-sm font-bold text-white">Memoria</div>
          </div>
          <div className="text-xs text-white/60 space-y-1">
            <div>📄 Contenuto: <span className="font-mono text-white/80">{memorySize != null ? `${(memorySize / 1024).toFixed(1)} KB` : '—'}</span></div>
            <div className="truncate" title={agent.paths.memory}>📁 {agent.paths.memory}</div>
          </div>
        </div>
      </div>

      <ArrowDown />

      {/* Output */}
      <div className="flex items-center gap-3 justify-center flex-wrap">
        <Node icon={Send} title="Risposta" subtitle={platformsLabel} color="#ec4899" />
      </div>

      {/* Informazioni chiave */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Dettagli tecnici</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-white/40 w-24 shrink-0">Proprietario</span>
            <span className="text-white">{agent.owner.name} ({agent.owner.number})</span>
          </div>
          {agent.whatsapp && <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">WhatsApp</span><span className="text-white">{agent.whatsapp}</span></div>}
          {agent.telegram && <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">Telegram</span><span className="text-white">{agent.telegram.bot}</span></div>}
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">PC</span><span className="text-white">{agent.pc.ip} · {agent.pc.os}</span></div>
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">SSH alias</span><span className="text-white font-mono">ssh {agent.pc.ssh}</span></div>
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">Modello AI</span><span className="text-white">{agent.model}</span></div>
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">Max turni</span><span className="text-white">{agent.maxTurns.default}{agent.maxTurns.heavy ? ` / heavy ${agent.maxTurns.heavy}` : ''}</span></div>
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">WSL</span><span className="text-white">{agent.useWSL ? 'Sì' : 'No (nativo Windows)'}</span></div>
          <div className="flex items-start gap-2"><span className="text-white/40 w-24 shrink-0">API monitoring</span><span className="text-white">{agent.apiAvailable === false ? '❌ Non esposta (Telegram-only)' : '✓ Attiva'}</span></div>
        </div>
      </div>

      {/* File system */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-white/60" /> File chiave
        </h4>
        <div className="space-y-1 text-xs font-mono">
          {([
            { k: 'Bot', v: agent.paths.bot, i: <Smartphone className="w-3 h-3" /> },
            { k: 'Agent', v: agent.paths.agent, i: <Cpu className="w-3 h-3" /> },
            { k: 'Skills', v: agent.paths.skills, i: <Wrench className="w-3 h-3" /> },
            { k: 'Memory', v: agent.paths.memory, i: <Database className="w-3 h-3" /> },
            { k: 'CLAUDE.md', v: agent.paths.claude, i: <FileText className="w-3 h-3" /> },
            { k: 'SOUL.md', v: agent.paths.soul, i: <FileText className="w-3 h-3" /> },
            { k: 'Log', v: agent.paths.log, i: <FileText className="w-3 h-3" /> },
          ]).map(r => (
            <div key={r.k} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0">
              <span className="text-white/30 mt-0.5">{r.i}</span>
              <span className="text-white/50 w-20 shrink-0">{r.k}</span>
              <span className="text-white/90 break-all">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
