'use client';
import { useEffect, useState, useCallback } from 'react';
import { Calendar, X, FileText, Package, ChevronRight } from 'lucide-react';
import { Card, Badge, Spinner, Empty, fmtCHF, fmtNum, fmtDate } from '../_components/ui';

interface OrdineList {
  id: number; name: string; cliente: string; clienteId: number;
  deliveryDate: string | null; dateOrder: string | null;
  total: number; untaxed: number; state: string; stateLabel: string;
}
interface Riga {
  id: number; code: string; name: string; qtyOrdered: number; qtyDelivered: number;
  priceUnit: number; discount: number; subtotal: number; total: number;
  cost: number; floor: number; listino: number; margineUnit: number; margineRiga: number;
}
interface OrdineDettaglio {
  id: number; name: string; cliente: string; deliveryAddress: string;
  deliveryDate: string | null; dateOrder: string | null;
  total: number; untaxed: number; state: string; stateLabel: string;
  note: string; margineVenditore: number; righe: Riga[];
}

const stateColor = (label: string) => {
  const l = (label || '').toLowerCase();
  if (l.includes('conferm') || l.includes('complet')) return 'green';
  if (l.includes('bozza inviat') || l.includes('inviat')) return 'blue';
  if (l.includes('bozza')) return 'slate';
  return 'amber';
};

const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => { const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); };

export default function OrdiniPage() {
  const [date, setDate] = useState(tomorrow);
  const [ordini, setOrdini] = useState<OrdineList[]>([]);
  const [totale, setTotale] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [sel, setSel] = useState<OrdineDettaglio | null>(null);
  const [loadingDett, setLoadingDett] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/silvano/ordini?date=${date}`);
    const d = await r.json();
    if (d.success) { setOrdini(d.ordini); setTotale(d.totale); setCount(d.count); }
    else { setOrdini([]); setTotale(0); setCount(0); }
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const openOrdine = async (id: number) => {
    setLoadingDett(true); setSel(null);
    const r = await fetch(`/api/silvano/ordine/${id}`);
    const d = await r.json();
    if (d.success) setSel(d.ordine);
    setLoadingDett(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setDate(today())}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${date === today() ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
            Oggi
          </button>
          <button onClick={() => setDate(tomorrow())}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${date === tomorrow() ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
            Domani
          </button>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-800/60 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-400" />
          </div>
          <div className="ml-auto flex items-center gap-4 text-right">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Ordini</div>
              <div className="text-lg font-semibold text-white">{count}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Totale</div>
              <div className="text-lg font-bold text-emerald-300">{fmtCHF(totale)}</div>
            </div>
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : !ordini.length ? <Empty>Nessun ordine per {fmtDate(date)}</Empty> : (
        <div className="space-y-2">
          {ordini.map((o) => (
            <button key={o.id} onClick={() => openOrdine(o.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-emerald-400/50 hover:bg-white/10">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{o.name}</span>
                  <Badge color={stateColor(o.stateLabel)}>{o.stateLabel}</Badge>
                </div>
                <div className="truncate text-sm text-slate-300">{o.cliente}</div>
                <div className="text-xs text-slate-500">Consegna {fmtDate(o.deliveryDate)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-emerald-300">{fmtCHF(o.total)}</div>
              </div>
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          ))}
        </div>
      )}

      {(sel || loadingDett) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSel(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {loadingDett || !sel ? <Spinner /> : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white">{sel.name}</span>
                      <Badge color={stateColor(sel.stateLabel)}>{sel.stateLabel}</Badge>
                    </div>
                    <div className="text-sm text-slate-300">{sel.cliente}</div>
                    <div className="text-xs text-slate-500">Consegna {fmtDate(sel.deliveryDate)} · Ordine {fmtDate(sel.dateOrder)}</div>
                    {sel.deliveryAddress && <div className="mt-1 text-xs text-slate-500">{sel.deliveryAddress}</div>}
                  </div>
                  <button onClick={() => setSel(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center justify-between gap-6 rounded-xl bg-emerald-500/10 px-5 py-3">
                    <span className="text-sm text-slate-300">Margine venditore</span>
                    <span className="text-2xl font-bold text-emerald-300">{fmtCHF(sel.margineVenditore)}</span>
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <div className="text-xs text-slate-400">Totale</div>
                    <div className="font-semibold text-white">{fmtCHF(sel.total)}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <div className="text-xs text-slate-400">Imponibile</div>
                    <div className="font-semibold text-white">{fmtCHF(sel.untaxed)}</div>
                  </div>
                  <a href={`/api/silvano/ordine/${sel.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-900 hover:bg-emerald-400">
                    <FileText size={18} /> Scarica PDF
                  </a>
                </div>

                {sel.note && <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{sel.note}</div>}

                <div className="mt-4 overflow-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Prodotto</th>
                        <th className="px-3 py-2 text-right">Ordinato</th>
                        <th className="px-3 py-2 text-right">Consegnato</th>
                        <th className="px-3 py-2 text-right">Prezzo</th>
                        <th className="px-3 py-2 text-right">Totale</th>
                        <th className="px-3 py-2 text-right">Margine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sel.righe.map((r) => {
                        const diff = Math.abs(r.qtyDelivered - r.qtyOrdered) > 0.001;
                        return (
                          <tr key={r.id} className="border-t border-white/5">
                            <td className="px-3 py-2">
                              <div className="text-white">{r.name}</div>
                              {r.code && <div className="text-[11px] text-slate-500">{r.code}</div>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-300">{fmtNum(r.qtyOrdered)}</td>
                            <td className={`px-3 py-2 text-right ${diff ? 'font-semibold text-amber-300' : 'text-slate-300'}`}>{fmtNum(r.qtyDelivered)}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{fmtCHF(r.priceUnit)}</td>
                            <td className="px-3 py-2 text-right font-medium text-white">{fmtCHF(r.total)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-300">{fmtCHF(r.margineRiga)}</td>
                          </tr>
                        );
                      })}
                      {!sel.righe.length && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500"><Package size={20} className="mx-auto mb-1" />Nessuna riga</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
