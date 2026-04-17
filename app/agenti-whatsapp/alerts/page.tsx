'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertOctagon, AlertTriangle, AlertCircle } from 'lucide-react';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';

interface Err { ts: string; level: 'error' | 'warn' | 'fatal'; message: string }
interface Row extends Err { slug: string; emoji: string; name: string }

function LevelIcon({ l }: { l: Err['level'] }) {
  if (l === 'fatal') return <AlertOctagon className="w-4 h-4 text-red-500" />;
  if (l === 'error') return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <AlertCircle className="w-4 h-4 text-yellow-400" />;
}

export default function AlertsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const agents = Object.entries(WHATSAPP_AGENTS);
    const results = await Promise.allSettled(
      agents.map(async ([slug, a]) => {
        const r = await fetch(`/api/agenti-whatsapp/${slug}/errors?lines=2000`);
        if (!r.ok) return [];
        const d = await r.json();
        return (d.errors || []).map((e: Err) => ({ ...e, slug, emoji: a.emoji, name: a.name }));
      })
    );
    const all: Row[] = [];
    for (const r of results) if (r.status === 'fulfilled') all.push(...r.value);
    const now = Date.now();
    const last24 = all.filter(e => now - new Date(e.ts).getTime() < 86400000);
    last24.sort((a, b) => b.ts.localeCompare(a.ts));
    setRows(last24);
    setLoading(false);
  };

  useEffect(() => { load(); const i = setInterval(load, 60000); return () => clearInterval(i); }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/infra-monitor" className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Centro alert</h1>
            <p className="text-sm text-white/50">Errori ultime 24h · tutti gli agenti</p>
          </div>
          <button onClick={load} className="ml-auto p-2 rounded-lg bg-white/5 hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!loading && !rows.length && (
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-8 text-center">
            <p className="text-green-400 text-lg font-semibold">✓ Tutto ok</p>
            <p className="text-sm text-white/50 mt-2">Nessun errore nelle ultime 24h.</p>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((e, i) => (
            <Link
              key={i}
              href={`/agenti-whatsapp/${e.slug}?tab=errori`}
              className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <LevelIcon l={e.level} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg">{e.emoji}</span>
                    <span className="font-semibold text-white">{e.name}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      e.level === 'fatal' ? 'bg-red-500/20 text-red-400' :
                      e.level === 'error' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>{e.level}</span>
                    <span className="text-xs text-white/40 font-mono">{new Date(e.ts).toLocaleString('it-CH')}</span>
                  </div>
                  <div className="text-sm text-white/80 font-mono break-words">{e.message}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
