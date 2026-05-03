'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, AlertOctagon, AlertCircle } from 'lucide-react';

interface Err {
  ts: string;
  level: 'error' | 'warn' | 'fatal';
  message: string;
}

function LevelIcon({ l }: { l: Err['level'] }) {
  if (l === 'fatal') return <AlertOctagon className="w-4 h-4 text-red-500" />;
  if (l === 'error') return <AlertTriangle className="w-4 h-4 text-orange-400" />;
  return <AlertCircle className="w-4 h-4 text-yellow-400" />;
}

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('it-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TabErrori({ slug }: { slug: string }) {
  const [errors, setErrors] = useState<Err[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyLast24h, setOnlyLast24h] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/agenti-whatsapp/${slug}/errors?lines=2000`)
      .then(r => r.json())
      .then(d => setErrors(d.errors || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [slug]);

  const now = Date.now();
  const filtered = onlyLast24h
    ? errors.filter(e => now - new Date(e.ts).getTime() < 86400000)
    : errors;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOnlyLast24h(!onlyLast24h)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${onlyLast24h ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'}`}
        >
          {onlyLast24h ? 'Solo ultime 24h' : 'Tutti'}
        </button>
        <span className="text-sm text-white/50">{filtered.length} {filtered.length === 1 ? 'errore' : 'errori'}</span>
        <button onClick={load} className="ml-auto p-2 rounded-lg bg-white/5 hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !errors.length && <p className="text-white/40 text-sm">Caricamento…</p>}
      {!loading && !filtered.length && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-6 text-center">
          <p className="text-green-400 font-medium">✓ Nessun errore</p>
          <p className="text-xs text-white/40 mt-1">Tutto ok in questo periodo.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((e, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start gap-3">
            <LevelIcon l={e.level} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  e.level === 'fatal' ? 'bg-red-500/20 text-red-400' :
                  e.level === 'error' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>{e.level}</span>
                <span className="text-xs text-white/40 font-mono">{formatTs(e.ts)}</span>
              </div>
              <div className="text-sm text-white/80 break-words font-mono">{e.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
