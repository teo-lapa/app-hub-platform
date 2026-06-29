'use client';
import { useEffect, useState, useCallback } from 'react';
import { Calendar, X, FileText, Package, ChevronRight, Plus, Minus, Trash2, Search, Pencil, Lock } from 'lucide-react';
import { Card, Badge, Spinner, Empty, fmtCHF, fmtNum, fmtDate } from '../_components/ui';

interface OrdineList {
  id: number; name: string; cliente: string; clienteId: number;
  deliveryDate: string | null; dateOrder: string | null;
  total: number; untaxed: number; state: string; stateLabel: string;
}
interface Riga {
  id: number; productId: number; code: string; name: string; qtyOrdered: number; qtyDelivered: number;
  priceUnit: number; discount: number; subtotal: number; total: number;
  cost: number; floor: number; listino: number; margineUnit: number; margineRiga: number;
}
interface OrdineDettaglio {
  id: number; name: string; cliente: string; clienteId: number; deliveryAddress: string;
  deliveryDate: string | null; dateOrder: string | null;
  total: number; untaxed: number; state: string; editable: boolean; cancellable: boolean; stateLabel: string;
  note: string; margineVenditore: number; righe: Riga[];
}
interface CatProd {
  id: number; name: string; code: string; uom: string; base: number; floor: number | null; cost: number; qtyAvailable: number;
  image: string | null;
}
// target del modal riga: lineId presente = modifica, assente = aggiunta nuovo prodotto
interface EditTarget {
  lineId?: number; productId: number; name: string; code: string; uom?: string;
  floor: number; base: number; qty: number; price: number;
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
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const [editLine, setEditLine] = useState<EditTarget | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

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

  // refetch silenzioso (mantiene il popup aperto dopo una modifica)
  const refresh = async (id: number) => {
    const r = await fetch(`/api/silvano/ordine/${id}`);
    const d = await r.json();
    if (d.success) setSel(d.ordine);
  };

  const openRiga = (r: Riga) => {
    if (!sel?.editable) return;
    setEditLine({
      lineId: r.id, productId: r.productId, name: r.name, code: r.code,
      floor: r.floor, base: r.listino || r.priceUnit, qty: r.qtyOrdered, price: r.priceUnit,
    });
  };

  const saveLine = async (qty: number, price: number) => {
    if (!sel || !editLine) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/silvano/ordine/${sel.id}`, {
        method: editLine.lineId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editLine.lineId
            ? { lineId: editLine.lineId, qty, price }
            : { product_id: editLine.productId, qty, price }
        ),
      });
      const d = await res.json();
      if (!d.success) { flash(d.error || 'Errore'); return; }
      if (d.clamped) flash('Prezzo riportato al minimo');
      setEditLine(null);
      await refresh(sel.id);
      load();
    } finally { setBusy(false); }
  };

  const requestLock = async (lineId: number, productId: number, productName: string, price: number) => {
    if (!sel) return;
    const reason = window.prompt('Motivo del blocco prezzo (facoltativo):', '');
    if (reason === null) return; // annullato
    setBusy(true);
    try {
      const res = await fetch('/api/silvano/blocco-prezzo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: sel.id, lineId, productId, productName, clientName: sel.cliente, price, reason }),
      });
      const d = await res.json();
      if (!d.success) { flash(d.error || 'Errore'); return; }
      flash('Richiesta blocco prezzo inviata a Laura');
      setEditLine(null);
    } finally { setBusy(false); }
  };

  const removeRiga = async (r: Riga) => {
    if (!sel) return;
    if (!confirm(`Togliere "${r.name}" dall'ordine?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/silvano/ordine/${sel.id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineId: r.id }),
      });
      const d = await res.json();
      if (!d.success) { flash(d.error || 'Errore'); return; }
      await refresh(sel.id);
      load();
    } finally { setBusy(false); }
  };

  const pickProduct = (p: CatProd) => {
    setAddOpen(false);
    setEditLine({
      productId: p.id, name: p.name, code: p.code, uom: p.uom,
      floor: p.floor ?? p.cost, base: p.base, qty: 1, price: p.base,
    });
  };

  const annullaOrdine = async () => {
    if (!sel) return;
    const isPrev = sel.state === 'draft' || sel.state === 'sent';
    if (!confirm(`${isPrev ? 'Annullare il preventivo' : "Annullare l'ordine"} ${sel.name}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/silvano/ordine/${sel.id}/annulla`, { method: 'POST' });
      const d = await res.json();
      if (!d.success) { flash(d.error || 'Errore'); return; }
      flash('Annullato');
      setSel(null);
      load();
    } finally { setBusy(false); }
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
                  {sel.cancellable && (
                    <button onClick={annullaOrdine} disabled={busy}
                      className="flex items-center gap-2 rounded-xl bg-red-500/20 px-4 py-2.5 font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50">
                      <X size={18} /> {sel.state === 'draft' || sel.state === 'sent' ? 'Annulla preventivo' : 'Annulla ordine'}
                    </button>
                  )}
                </div>

                {sel.note && <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{sel.note}</div>}

                {sel.editable ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-300/80">Tocca una riga per modificare prezzo o quantità.</span>
                    <button onClick={() => setAddOpen(true)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30">
                      <Plus size={16} /> Aggiungi prodotto
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-500">Ordine {sel.stateLabel.toLowerCase()}: sola lettura.</div>
                )}

                <div className="mt-3 overflow-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">Prodotto</th>
                        <th className="px-3 py-2 text-right">Ordinato</th>
                        <th className="px-3 py-2 text-right">Consegnato</th>
                        <th className="px-3 py-2 text-right">Prezzo</th>
                        <th className="px-3 py-2 text-right">Totale</th>
                        <th className="px-3 py-2 text-right">Margine</th>
                        {sel.editable && <th className="px-3 py-2"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sel.righe.map((r) => {
                        const diff = Math.abs(r.qtyDelivered - r.qtyOrdered) > 0.001;
                        return (
                          <tr key={r.id}
                            className={`border-t border-white/5 ${sel.editable ? 'cursor-pointer hover:bg-white/5' : ''}`}
                            onClick={() => openRiga(r)}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 text-white">
                                {sel.editable && <Pencil size={12} className="shrink-0 text-emerald-300/70" />}
                                {r.name}
                              </div>
                              {r.code && <div className="text-[11px] text-slate-500">{r.code}</div>}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-300">{fmtNum(r.qtyOrdered)}</td>
                            <td className={`px-3 py-2 text-right ${diff ? 'font-semibold text-amber-300' : 'text-slate-300'}`}>{fmtNum(r.qtyDelivered)}</td>
                            <td className="px-3 py-2 text-right text-slate-300">{fmtCHF(r.priceUnit)}</td>
                            <td className="px-3 py-2 text-right font-medium text-white">{fmtCHF(r.total)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-300">{fmtCHF(r.margineRiga)}</td>
                            {sel.editable && (
                              <td className="px-2 py-2 text-right">
                                <button onClick={(e) => { e.stopPropagation(); removeRiga(r); }}
                                  className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!sel.righe.length && (
                        <tr><td colSpan={sel.editable ? 7 : 6} className="px-3 py-6 text-center text-slate-500"><Package size={20} className="mx-auto mb-1" />Nessuna riga</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editLine && (
        <LineModal target={editLine} busy={busy} onClose={() => setEditLine(null)} onSave={saveLine}
          onLockRequest={editLine.lineId ? (price) => requestLock(editLine.lineId!, editLine.productId, editLine.name, price) : undefined} />
      )}

      {addOpen && sel && (
        <AddProductModal clientId={sel.clienteId} onClose={() => setAddOpen(false)} onPick={pickProduct} />
      )}

      {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white shadow-xl">{toast}</div>}
    </div>
  );
}

/* ============ Modal riga (qty + prezzo + margine live) ============ */
function LineModal({ target, busy, onClose, onSave, onLockRequest }: {
  target: EditTarget; busy: boolean; onClose: () => void; onSave: (qty: number, price: number) => void;
  onLockRequest?: (price: number) => void;
}) {
  const [qty, setQty] = useState(target.qty || 1);
  const [price, setPrice] = useState(target.price || target.base || 0);
  const floor = target.floor;
  const margine = (price - floor) * qty;
  const below = price < floor - 0.001;
  const sliderMax = Math.max((target.base || floor) * 1.5, floor + 1);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-white">{target.name}</div>
            {target.code && <div className="text-xs text-slate-500">{target.code}</div>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Listino</div><div className="font-semibold text-white">{fmtCHF(target.base)}</div></div>
          <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Minimo</div><div className="font-semibold text-amber-300">{fmtCHF(floor)}</div></div>
          <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Quantità</div><div className="font-semibold text-white">{fmtNum(qty)}</div></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">Prezzo di vendita{target.uom ? ` / ${target.uom}` : ''}</span>
            <input type="number" step="0.01" value={price}
              onChange={(e) => setPrice(Math.max(floor, parseFloat(e.target.value) || 0))}
              className="w-28 rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1.5 text-right text-white" />
          </div>
          <input type="range" min={floor} max={sliderMax} step="0.05" value={Math.min(price, sliderMax)}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            className="mt-2 w-full accent-emerald-500" />
          <div className="flex justify-between text-[11px] text-slate-500"><span>min {fmtCHF(floor)}</span><span>listino {fmtCHF(target.base)}</span></div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3">
          <span className="text-sm text-slate-300">Il tuo margine</span>
          <span className={`text-lg font-bold ${below ? 'text-red-400' : 'text-emerald-300'}`}>{fmtCHF(margine)}</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded-lg bg-white/10 p-2"><Minus size={16} /></button>
            <span className="w-10 text-center font-medium">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="rounded-lg bg-white/10 p-2"><Plus size={16} /></button>
            {target.uom && <span className="ml-1 text-sm text-slate-400">{target.uom}</span>}
          </div>
          <button onClick={() => onSave(qty, price)} disabled={busy || below}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50">
            {busy ? 'Salvo…' : (target.lineId ? 'Salva modifica' : 'Aggiungi all\'ordine')}
          </button>
        </div>

        {onLockRequest && (
          <button onClick={() => onLockRequest(price)} disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">
            <Lock size={16} /> Richiesta blocco prezzo a Laura
          </button>
        )}
      </div>
    </div>
  );
}

/* ============ Modal ricerca prodotto da aggiungere ============ */
function AddProductModal({ clientId, onClose, onPick }: {
  clientId: number; onClose: () => void; onPick: (p: CatProd) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatProd[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('clientId', String(clientId));
      const r = await fetch(`/api/silvano/catalog?${params}`);
      const d = await r.json();
      if (d.success) setItems(d.items);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, clientId]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-white">Aggiungi prodotto</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto o codice…"
            className="w-full rounded-xl border border-white/10 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
        </div>
        <div className="mt-3 flex-1 overflow-auto rounded-xl border border-white/5">
          {loading ? <div className="p-4"><Spinner /></div> : !items.length ? (
            <div className="px-3 py-4 text-sm text-slate-500">Nessun prodotto</div>
          ) : items.map((p) => (
            <button key={p.id} onClick={() => onPick(p)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white p-0.5">
                {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                  : <div className="flex h-full items-center justify-center text-slate-400"><Package size={18} /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-white">{p.name}</div>
                {p.code && <div className="text-[11px] text-slate-500">{p.code}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold text-emerald-300">{fmtCHF(p.base)}</div>
                <div className="text-[10px] text-slate-500">{Math.round(p.qtyAvailable)} disp.</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
