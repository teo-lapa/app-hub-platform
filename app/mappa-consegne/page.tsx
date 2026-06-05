'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Delivery } from './MapView';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-gray-400">Caricamento mappa…</div>
  ),
});

const PALETTE = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function MappaConsegnePage() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);
  const [giri, setGiri] = useState<string[]>([]);
  const [missing, setMissing] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selDrivers, setSelDrivers] = useState<Set<number>>(new Set());
  const [selGiro, setSelGiro] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/mappa-consegne?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setDeliveries(data.deliveries);
      setDrivers(data.drivers);
      setGiri(data.giri);
      setMissing(data.missing);
      setSelDrivers(new Set());
      setSelGiro('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorByDriver = useMemo(() => {
    const map: Record<number, string> = {};
    drivers.forEach((d, i) => (map[d.id] = PALETTE[i % PALETTE.length]));
    return map;
  }, [drivers]);

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      if (selDrivers.size > 0 && !selDrivers.has(d.driverId)) return false;
      if (selGiro && d.giro !== selGiro) return false;
      return true;
    });
  }, [deliveries, selDrivers, selGiro]);

  const toggleDriver = (id: number) => {
    setSelDrivers((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const setRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header filtri */}
      <div className="bg-white border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold text-gray-900">🗺️ Mappa Consegne Autisti</h1>
          <div className="text-sm text-gray-600">
            {filtered.length} consegne
            {missing > 0 && <span className="text-amber-600"> · {missing} senza GPS</span>}
          </div>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500">Dal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Al</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
          <button onClick={load} disabled={loading}
            className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? '…' : 'Carica'}
          </button>
          <div className="flex gap-1">
            <button onClick={() => setRange(today(), today())} className="text-xs border rounded px-2 py-1 bg-white text-gray-700 hover:bg-gray-100">Oggi</button>
            <button onClick={() => setRange(daysAgo(1), daysAgo(1))} className="text-xs border rounded px-2 py-1 bg-white text-gray-700 hover:bg-gray-100">Ieri</button>
            <button onClick={() => setRange(daysAgo(6), today())} className="text-xs border rounded px-2 py-1 bg-white text-gray-700 hover:bg-gray-100">7 giorni</button>
            <button onClick={() => setRange(daysAgo(29), today())} className="text-xs border rounded px-2 py-1 bg-white text-gray-700 hover:bg-gray-100">30 giorni</button>
          </div>

          {giri.length > 0 && (
            <select value={selGiro} onChange={(e) => setSelGiro(e.target.value)}
              className="border rounded px-2 py-1 text-sm ml-auto bg-white text-gray-700">
              <option value="">Tutti i giri</option>
              {giri.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>

        {/* Filtro autisti = legenda colori */}
        {drivers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {drivers.map((d) => {
              const active = selDrivers.size === 0 || selDrivers.has(d.id);
              return (
                <button key={d.id} onClick={() => toggleDriver(d.id)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border bg-white text-gray-700 transition ${active ? 'bg-gray-100' : 'opacity-40'}`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: colorByDriver[d.id] }} />
                  {d.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mappa */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-red-100 text-red-700 px-4 py-2 rounded text-sm">
            {error}
          </div>
        )}
        <MapView deliveries={filtered} colorByDriver={colorByDriver} />
      </div>
    </div>
  );
}
