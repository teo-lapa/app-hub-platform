'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Users, ShoppingBag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, Spinner, Empty, fmtCHF, fmtNum, fmtDate } from '../_components/ui';

interface TopCliente { id: number; name: string; revenue: number; orders: number; guadagno: number }
interface Kpi {
  fatturato: number; fatturatoPrev: number; trendPct: number | null;
  ordini: number; clientiAttivi: number; provvigioni: number; ticketMedio: number;
}
interface DashData {
  seller: { name: string };
  periodo: { from: string; to: string };
  kpi: Kpi;
  topClienti: TopCliente[];
  andamento: { ym: string; revenue: number }[];
}

type Preset = 'mese' | 'meseScorso' | 'ultimi3mesi' | 'daGennaio' | 'anno';

const iso = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(p: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === 'mese') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (p === 'meseScorso') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (p === 'daGennaio') return { from: iso(new Date(y, 0, 1)), to: iso(now) };
  if (p === 'anno') return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
  if (p === 'ultimi3mesi') return { from: iso(new Date(y, m - 3, now.getDate())), to: iso(now) };
  const to = new Date(now); const from = new Date(now); from.setDate(from.getDate() - 29);
  return { from: iso(from), to: iso(to) };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'mese', label: 'Questo mese' },
  { key: 'meseScorso', label: 'Mese scorso' },
  { key: 'ultimi3mesi', label: 'Ultimi 3 mesi' },
  { key: 'daGennaio', label: 'Da gennaio' },
  { key: 'anno', label: 'Anno' },
];

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>('daGennaio');
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeFor(preset);
    const r = await fetch(`/api/silvano/dashboard?from=${from}&to=${to}`);
    const d = await r.json();
    if (d.success) setData({ seller: d.seller, periodo: d.periodo, kpi: d.kpi, topClienti: d.topClienti, andamento: d.andamento || [] });
    else setData(null);
    setLoading(false);
  }, [preset]);

  useEffect(() => { load(); }, [load]);

  const topClienti = data?.topClienti ?? [];
  const hasData = !!data && (data.kpi.fatturato > 0 || topClienti.length > 0);

  const chartData = useMemo(
    () => topClienti.map((c) => ({ name: c.name, revenue: c.revenue })),
    [topClienti]
  );

  const andamentoData = useMemo(
    () => (data?.andamento ?? []).map((a) => {
      const [yy, mm] = a.ym.split('-');
      return { name: `${MESI[Number(mm) - 1]} ${yy.slice(2)}`, revenue: a.revenue };
    }),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="text-sm text-slate-400">
            {data?.seller?.name ? `Venditore ${data.seller.name}` : 'Area venditore'}
            {data?.periodo && <> · {fmtDate(data.periodo.from)} – {fmtDate(data.periodo.to)}</>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Conta tutti gli ordini dei clienti assegnati, anche quelli fatti dal cliente da solo o da un altro venditore.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${preset === p.key ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : !hasData ? <Empty>Nessun dato nel periodo selezionato</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Card className="col-span-2 p-4 lg:col-span-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <Receipt size={14} /> Fatturato
              </div>
              <div className="mt-1 text-2xl font-bold text-white">{fmtCHF(data!.kpi.fatturato)}</div>
              {data!.kpi.trendPct != null && (
                <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${data!.kpi.trendPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {data!.kpi.trendPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {fmtNum(Math.abs(data!.kpi.trendPct))}% <span className="text-slate-500">vs periodo prec.</span>
                </div>
              )}
            </Card>

            <Card className="col-span-2 border-emerald-400/30 bg-emerald-500/10 p-4 lg:col-span-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-300">
                <Wallet size={14} /> Provvigioni maturate
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{fmtCHF(data!.kpi.provvigioni)}</div>
              <div className="mt-1 text-xs text-emerald-200/70">il tuo guadagno</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <ShoppingBag size={14} /> Ordini
              </div>
              <div className="mt-1 text-2xl font-bold text-white">{fmtNum(data!.kpi.ordini)}</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <Users size={14} /> Clienti attivi
              </div>
              <div className="mt-1 text-2xl font-bold text-white">{fmtNum(data!.kpi.clientiAttivi)}</div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <Receipt size={14} /> Ticket medio
              </div>
              <div className="mt-1 text-2xl font-bold text-white">{fmtCHF(data!.kpi.ticketMedio)}</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-4 text-sm font-semibold text-white">Andamento mensile</div>
            {!andamentoData.length ? <Empty>Nessun dato nel periodo</Empty> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={andamentoData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} height={40} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtNum(v)} width={70} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f1f5f9' }}
                    formatter={(v: any) => [fmtCHF(Number(v)), 'Fatturato']}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {andamentoData.map((_, i) => <Cell key={i} fill="#3b82f6" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-4 text-sm font-semibold text-white">Top clienti per fatturato</div>
            {!chartData.length ? <Empty>Nessun cliente nel periodo</Empty> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => fmtNum(v)} width={70} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#f1f5f9' }}
                    formatter={(v: any) => [fmtCHF(Number(v)), 'Fatturato']}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill="#10b981" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 text-sm font-semibold text-white">Top clienti</div>
            {!topClienti.length ? <Empty>Nessun cliente nel periodo</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 px-3 text-right font-medium">Ordini</th>
                      <th className="py-2 px-3 text-right font-medium">Fatturato</th>
                      <th className="py-2 pl-3 text-right font-medium">Tuo guadagno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topClienti.map((c) => (
                      <tr key={c.id} className="border-t border-white/10">
                        <td className="py-2.5 pr-3 text-white">{c.name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">{fmtNum(c.orders)}</td>
                        <td className="py-2.5 px-3 text-right text-white">{fmtCHF(c.revenue)}</td>
                        <td className="py-2.5 pl-3 text-right font-semibold text-emerald-300">{fmtCHF(c.guadagno)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
