'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, Users, ShoppingBag, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, Spinner, Empty, fmtCHF, fmtNum, fmtDate } from '../_components/ui';

interface TopCliente { id: number; name: string; revenue: number; orders: number; guadagno: number; daIncassare: number; riscuotibile: number }
interface Kpi {
  fatturato: number; fatturatoPrev: number; trendPct: number | null;
  ordini: number; clientiAttivi: number; provvigioni: number; ticketMedio: number;
}
interface Riscossione { maturato: number; riscuotibile: number; attesa: number; riscosso: number; daPrendere: number }
interface ContoMese { ym: string; fatturato: number; guadagno: number }
interface ContoFattura { id: number; name: string; date: string | null; total: number; residual: number; paymentState: string }
interface ContoCliente {
  cliente: { id: number; name: string };
  mesi: ContoMese[];
  fatture: ContoFattura[];
  totali: { fatturato: number; guadagno: number; riscuotibile: number; attesa: number; daIncassare: number };
}
interface DashData {
  seller: { name: string };
  periodo: { from: string; to: string };
  kpi: Kpi;
  riscossione?: Riscossione;
  clienti: TopCliente[];
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

function meseLabel(ym: string): string {
  const [y, mm] = ym.split('-');
  return `${MESI[Number(mm) - 1]} ${y.slice(2)}`;
}

function Stat({ l, v, accent }: { l: string; v: string; accent?: 'emerald' | 'amber' }) {
  const color = accent === 'emerald' ? 'text-emerald-300' : accent === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-[11px] text-slate-400">{l}</div>
      <div className={`mt-0.5 font-semibold ${color}`}>{v}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>('daGennaio');
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cQuery, setCQuery] = useState('');
  const [cPage, setCPage] = useState(0);
  const [selCliente, setSelCliente] = useState<TopCliente | null>(null);
  const [dett, setDett] = useState<ContoCliente | null>(null);
  const [loadingDett, setLoadingDett] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { from, to } = rangeFor(preset);
    const r = await fetch(`/api/silvano/dashboard?from=${from}&to=${to}`);
    const d = await r.json();
    if (d.success) setData({ seller: d.seller, periodo: d.periodo, kpi: d.kpi, riscossione: d.riscossione, clienti: d.clienti, andamento: d.andamento || [] });
    else setData(null);
    setLoading(false);
  }, [preset]);

  useEffect(() => { load(); }, [load]);

  const clienti = data?.clienti ?? [];
  const hasData = !!data && (data.kpi.fatturato > 0 || clienti.length > 0);

  const chartData = useMemo(
    () => clienti.slice(0, 10).map((c) => ({ name: c.name, revenue: c.revenue })),
    [clienti]
  );

  const andamentoData = useMemo(
    () => (data?.andamento ?? []).map((a) => {
      const [yy, mm] = a.ym.split('-');
      return { name: `${MESI[Number(mm) - 1]} ${yy.slice(2)}`, revenue: a.revenue };
    }),
    [data]
  );

  const PAGE_SIZE = 20;
  const clientiFiltrati = useMemo(() => {
    const q = cQuery.trim().toLowerCase();
    return q ? clienti.filter((c) => c.name.toLowerCase().includes(q)) : clienti;
  }, [clienti, cQuery]);
  const totalPages = Math.max(1, Math.ceil(clientiFiltrati.length / PAGE_SIZE));
  const pageSafe = Math.min(cPage, totalPages - 1);
  const clientiPagina = clientiFiltrati.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);
  useEffect(() => { setCPage(0); }, [preset, cQuery]);

  const openCliente = useCallback(async (c: TopCliente) => {
    setSelCliente(c); setDett(null); setLoadingDett(true);
    const { from, to } = rangeFor(preset);
    const r = await fetch(`/api/silvano/cliente-conto/${c.id}?from=${from}&to=${to}`);
    const d = await r.json();
    if (d.success) setDett(d);
    setLoadingDett(false);
  }, [preset]);

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
          {data?.riscossione && (
            <Card className="border-emerald-400/20 bg-emerald-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Wallet size={16} className="text-emerald-300" /> Conto provvigioni — quanto devi riscuotere
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400"><Receipt size={13} /> Maturato totale</div>
                  <div className="mt-1 text-xl font-bold text-white">{fmtCHF(data.riscossione.maturato)}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-emerald-300"><TrendingUp size={13} /> Riscuotibile (pagato)</div>
                  <div className="mt-1 text-xl font-bold text-emerald-300">{fmtCHF(data.riscossione.riscuotibile)}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-amber-300"><TrendingDown size={13} /> In attesa (non pagato)</div>
                  <div className="mt-1 text-xl font-bold text-amber-300">{fmtCHF(data.riscossione.attesa)}</div>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400"><Wallet size={13} /> Già preso</div>
                  <div className="mt-1 text-xl font-bold text-white">{fmtCHF(data.riscossione.riscosso)}</div>
                </div>
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-emerald-200"><Wallet size={13} /> Ancora da prendere</div>
                  <div className="mt-1 text-xl font-bold text-emerald-200">{fmtCHF(data.riscossione.daPrendere)}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Riscuotibile = il tuo 20% sul margine delle fatture già pagate dai clienti. In attesa = margine su fatture non ancora pagate (non riscuotibile finché il cliente non paga).
              </div>
            </Card>
          )}

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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-white">Clienti <span className="text-slate-500">({clientiFiltrati.length})</span></div>
              <input value={cQuery} onChange={(e) => setCQuery(e.target.value)} placeholder="Cerca cliente…"
                className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-sm text-white placeholder-slate-400 outline-none focus:border-emerald-400" />
            </div>
            {!clientiFiltrati.length ? <Empty>Nessun cliente</Empty> : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-3 font-medium">Cliente</th>
                        <th className="py-2 px-3 text-right font-medium">Ordini</th>
                        <th className="py-2 px-3 text-right font-medium">Fatturato</th>
                        <th className="py-2 px-3 text-right font-medium">Tuo guadagno</th>
                        <th className="py-2 pl-3 text-right font-medium">Da incassare</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientiPagina.map((c) => (
                        <tr key={c.id} onClick={() => openCliente(c)} className="cursor-pointer border-t border-white/10 hover:bg-white/5">
                          <td className="py-2.5 pr-3 text-white">{c.name}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{fmtNum(c.orders)}</td>
                          <td className="py-2.5 px-3 text-right text-white">{fmtCHF(c.revenue)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-300">{fmtCHF(c.guadagno)}</td>
                          <td className={`py-2.5 pl-3 text-right font-medium ${c.daIncassare > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{fmtCHF(c.daIncassare)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-sm">
                    <button disabled={pageSafe <= 0} onClick={() => setCPage((p) => Math.max(0, p - 1))}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40">‹ Prec</button>
                    <span className="text-slate-400">Pagina {pageSafe + 1} di {totalPages}</span>
                    <button disabled={pageSafe >= totalPages - 1} onClick={() => setCPage((p) => Math.min(totalPages - 1, p + 1))}
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40">Succ ›</button>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}

      {selCliente && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4" onClick={() => setSelCliente(null)}>
          <div className="my-6 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-lg font-semibold text-white">{selCliente.name}</div>
              <button onClick={() => setSelCliente(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            {loadingDett || !dett ? <div className="py-10"><Spinner /></div> : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <Stat l="Fatturato" v={fmtCHF(dett.totali.fatturato)} />
                  <Stat l="Tuo guadagno" v={fmtCHF(dett.totali.guadagno)} accent="emerald" />
                  <Stat l="Riscuotibile (pagato)" v={fmtCHF(dett.totali.riscuotibile)} accent="emerald" />
                  <Stat l="Da incassare" v={fmtCHF(dett.totali.daIncassare)} accent="amber" />
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm font-semibold text-white">Guadagno per mese</div>
                  {!dett.mesi.length ? <Empty>Nessun dato</Empty> : (
                    <div className="space-y-1">
                      {dett.mesi.map((m) => (
                        <div key={m.ym} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm">
                          <span className="text-slate-300">{meseLabel(m.ym)}</span>
                          <span className="flex gap-4">
                            <span className="text-slate-400">{fmtCHF(m.fatturato)}</span>
                            <span className="w-24 text-right font-semibold text-emerald-300">{fmtCHF(m.guadagno)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm font-semibold text-white">Fatture <span className="text-slate-500">({dett.fatture.length})</span></div>
                  {!dett.fatture.length ? <Empty>Nessuna fattura nel periodo</Empty> : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-1.5 pr-2 font-medium">Numero</th>
                            <th className="py-1.5 pr-2 font-medium">Data</th>
                            <th className="py-1.5 pr-2 text-right font-medium">Totale</th>
                            <th className="py-1.5 pr-2 text-right font-medium">Residuo</th>
                            <th className="py-1.5 font-medium">Stato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dett.fatture.map((f) => (
                            <tr key={f.id} className="border-t border-white/5">
                              <td className="py-1.5 pr-2 text-white">{f.name}</td>
                              <td className="py-1.5 pr-2 text-slate-400">{fmtDate(f.date)}</td>
                              <td className="py-1.5 pr-2 text-right text-white">{fmtCHF(f.total)}</td>
                              <td className={`py-1.5 pr-2 text-right ${f.residual > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{fmtCHF(f.residual)}</td>
                              <td className="py-1.5">
                                {f.paymentState === 'paid'
                                  ? <span className="text-emerald-300">Pagata</span>
                                  : f.paymentState === 'partial'
                                    ? <span className="text-amber-300">Parziale</span>
                                    : <span className="text-red-300">Da pagare</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
