'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Bucket { hour: string; in: number; out: number }
interface StatsData {
  health: number;
  online: boolean;
  total24h: number;
  in24h: number;
  out24h: number;
  last1h: number;
  errors24h: number;
  lastMsgTs: string | null;
  lastMsgMinutesAgo: number | null;
  buckets: Bucket[];
}

function healthColor(h: number) {
  if (h >= 80) return '#22c55e';
  if (h >= 50) return '#eab308';
  if (h > 0) return '#f97316';
  return '#ef4444';
}

export function TabStatistiche({ slug }: { slug: string }) {
  const [d, setD] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/agenti-whatsapp/${slug}/stats`)
      .then(r => r.json())
      .then(data => !data.error && setD(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [slug]);

  if (!d) return <p className="text-white/40 text-sm">{loading ? 'Caricamento…' : 'Nessun dato'}</p>;

  const maxBucket = Math.max(1, ...d.buckets.map(b => b.in + b.out));
  const hours24 = Array.from({ length: 24 }, (_, i) => {
    const dt = new Date(Date.now() - (23 - i) * 3600000);
    const key = dt.toISOString().slice(0, 13);
    const b = d.buckets.find(x => x.hour === key);
    return { key, label: dt.getHours().toString().padStart(2, '0'), in: b?.in || 0, out: b?.out || 0 };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Statistiche ultime 24h</h3>
        <button onClick={load} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
          <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Health</div>
          <div className="text-3xl font-bold" style={{ color: healthColor(d.health) }}>{d.health}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Msg totali 24h</div>
          <div className="text-3xl font-bold text-white">{d.total24h}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Ultima ora</div>
          <div className="text-3xl font-bold text-white">{d.last1h}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Errori 24h</div>
          <div className={`text-3xl font-bold ${d.errors24h > 0 ? 'text-red-400' : 'text-white'}`}>{d.errors24h}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Ricevuti</div>
          <div className="text-2xl font-bold text-blue-300">{d.in24h}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase mb-1">Inviati</div>
          <div className="text-2xl font-bold text-green-300">{d.out24h}</div>
        </div>
      </div>

      {/* Grafico ore */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="text-xs text-white/50 uppercase mb-3">Messaggi per ora (ultime 24h)</div>
        <div className="flex items-end gap-1 h-32">
          {hours24.map((h, i) => {
            const tot = h.in + h.out;
            const pct = (tot / maxBucket) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${h.label}:00 — ${tot} msg`}>
                <div className="w-full flex flex-col justify-end h-24">
                  <div className="w-full bg-green-500/60 rounded-t" style={{ height: `${(h.out / maxBucket) * 100}%`, minHeight: h.out > 0 ? 2 : 0 }} />
                  <div className="w-full bg-blue-500/60" style={{ height: `${(h.in / maxBucket) * 100}%`, minHeight: h.in > 0 ? 2 : 0 }} />
                </div>
                <div className="text-[9px] text-white/40 font-mono">{h.label}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500/60" /><span className="text-white/60">Ricevuti</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500/60" /><span className="text-white/60">Inviati</span></div>
        </div>
      </div>

      <div className="text-xs text-white/40">
        Ultimo msg: {d.lastMsgTs ? new Date(d.lastMsgTs).toLocaleString('it-CH') : '—'}
        {d.lastMsgMinutesAgo != null && ` (${d.lastMsgMinutesAgo} min fa)`}
      </div>
    </div>
  );
}
