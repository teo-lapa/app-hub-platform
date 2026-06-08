'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Minus, Trash2, X, ShoppingCart, History, Check, Package } from 'lucide-react';
import { Card, Badge, Spinner, Empty, fmtCHF } from './_components/ui';

interface Cliente { id: number; name: string; city?: string }
interface Prod {
  id: number; name: string; code: string; description?: string; uom: string; image: string | null;
  qtyAvailable: number; incomingQty: number; listPrice: number; cost: number;
  base: number; floor: number | null; quota: number | null; anomaly: boolean;
}

// badge pieni, colore profondo, ben leggibili sopra la foto bianca
const pill = 'inline-block rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-md';
interface CartItem { id: number; name: string; code: string; qty: number; price: number; floor: number; base: number; }

export default function CatalogoPage() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clientiQ, setClientiQ] = useState('');
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(true);

  const [q, setQ] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [boughtOnly, setBoughtOnly] = useState(false);
  const [boughtIds, setBoughtIds] = useState<Set<number>>(new Set());
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<Prod | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderId: number; orderName: string; margine: number } | null>(null);
  const [toast, setToast] = useState('');

  // --- clienti search ---
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await fetch(`/api/silvano/clienti?q=${encodeURIComponent(clientiQ)}`);
      const d = await r.json();
      if (d.success) setClienti(d.clienti);
    }, 250);
    return () => clearTimeout(t);
  }, [clientiQ]);

  // --- catalogo ---
  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (onlyAvail) params.set('onlyAvailable', '1');
    if (cliente) params.set('clientId', String(cliente.id));
    const r = await fetch(`/api/silvano/catalog?${params}`);
    const d = await r.json();
    if (d.success) setProds(d.items);
    setLoading(false);
  }, [q, onlyAvail, cliente]);

  useEffect(() => {
    const t = setTimeout(loadCatalog, 250);
    return () => clearTimeout(t);
  }, [loadCatalog]);

  // --- prodotti già comprati ---
  const loadBought = useCallback(async (c: Cliente) => {
    const r = await fetch(`/api/silvano/prodotti-cliente/${c.id}`);
    const d = await r.json();
    if (d.success) setBoughtIds(new Set(d.prodotti.map((p: any) => p.id)));
  }, []);

  const pickCliente = (c: Cliente) => {
    if (cart.length && c.id !== cliente?.id && !confirm('Cambiare cliente svuota il carrello. Continuare?')) return;
    setCliente(c); setShowClientPicker(false); setCart([]); setDone(null);
    setBoughtOnly(false); setBoughtIds(new Set());
    loadBought(c);
  };

  const visibleProds = useMemo(
    () => (boughtOnly ? prods.filter((p) => boughtIds.has(p.id)) : prods),
    [prods, boughtOnly, boughtIds]
  );

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartMargine = cart.reduce((s, i) => s + (i.price - i.floor) * i.qty, 0);

  const addToCart = (p: Prod, qty: number, price: number) => {
    const floor = p.floor ?? p.cost;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + qty, price } : i));
      return [...prev, { id: p.id, name: p.name, code: p.code, qty, price, floor, base: p.base }];
    });
    setModal(null);
    setToast(`${p.name} aggiunto`);
    setTimeout(() => setToast(''), 1800);
  };

  const submit = async () => {
    if (!cliente || !cart.length) return;
    setSubmitting(true);
    const r = await fetch('/api/silvano/crea-ordine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: cliente.id, deliveryDate, note,
        lines: cart.map((i) => ({ product_id: i.id, qty: i.qty, price: i.price, name: i.name })),
      }),
    });
    const d = await r.json();
    setSubmitting(false);
    if (d.success) { setDone({ orderId: d.orderId, orderName: d.orderName, margine: d.margineVenditore }); setCart([]); }
    else { setToast(d.error || 'Errore creazione preventivo'); setTimeout(() => setToast(''), 3000); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      {/* ===== Colonna principale ===== */}
      <div className="space-y-4">
        {/* Cliente */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Cliente</div>
              <div className="text-lg font-semibold text-white">{cliente ? cliente.name : 'Nessun cliente selezionato'}</div>
            </div>
            <button onClick={() => setShowClientPicker((v) => !v)}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30">
              {cliente ? 'Cambia' : 'Seleziona cliente'}
            </button>
          </div>
          {showClientPicker && (
            <div className="mt-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input autoFocus value={clientiQ} onChange={(e) => setClientiQ(e.target.value)}
                  placeholder="Cerca cliente…"
                  className="w-full rounded-xl border border-white/10 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div className="mt-2 max-h-60 overflow-auto rounded-xl border border-white/5">
                {clienti.map((c) => (
                  <button key={c.id} onClick={() => pickCliente(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5">
                    <span>{c.name}</span>
                    {c.city && <span className="text-xs text-slate-500">{c.city}</span>}
                  </button>
                ))}
                {!clienti.length && <div className="px-3 py-3 text-sm text-slate-500">Nessun cliente</div>}
              </div>
            </div>
          )}
        </Card>

        {/* Filtri */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca prodotto o codice…"
              className="w-full rounded-xl border border-white/10 bg-slate-800/60 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400" />
          </div>
          <button onClick={() => setOnlyAvail((v) => !v)}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ${onlyAvail ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
            Solo disponibili
          </button>
          {cliente && (
            <button onClick={() => setBoughtOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ${boughtOnly ? 'bg-blue-500/20 text-blue-200' : 'bg-white/5 text-slate-300'}`}>
              <History size={15} /> Già comprati
            </button>
          )}
        </div>

        {/* Griglia */}
        {loading ? <Spinner /> : !visibleProds.length ? <Empty>Nessun prodotto</Empty> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleProds.map((p) => (
              <button key={p.id} onClick={() => setModal(p)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left transition hover:border-emerald-400/50 hover:bg-white/10">
                <div className="relative aspect-square bg-white p-2">
                  {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                    : <div className="flex h-full items-center justify-center text-slate-600"><Package size={40} /></div>}
                  <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                    {p.qtyAvailable > 0
                      ? <span className={`${pill} bg-emerald-600`}>{Math.round(p.qtyAvailable)} disp.</span>
                      : <span className={`${pill} bg-red-600`}>esaurito</span>}
                    {p.incomingQty > 0 && <span className={`${pill} bg-amber-500`}>in arrivo {Math.round(p.incomingQty)}</span>}
                  </div>
                  {boughtIds.has(p.id) && <div className="absolute right-1.5 top-1.5"><span className={`${pill} bg-blue-600`}>★ già comprato</span></div>}
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <div className="line-clamp-2 text-sm font-medium text-white">{p.name}</div>
                  {p.code && <div className="text-[11px] text-slate-500">{p.code}</div>}
                  <div className="mt-auto pt-2">
                    <div className="text-base font-bold text-emerald-300">{fmtCHF(p.base)}</div>
                    {cliente && p.quota != null && !p.anomaly && (
                      <div className="text-[11px] text-slate-400">margine fino a {fmtCHF(p.quota)}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Carrello ===== */}
      <div className="lg:sticky lg:top-20 h-fit">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-white">
            <ShoppingCart size={18} /> <span className="font-semibold">Preventivo</span>
            {cart.length > 0 && <Badge color="green">{cart.length}</Badge>}
          </div>

          {done ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"><Check size={26} /></div>
              <div className="font-semibold text-white">Preventivo {done.orderName} creato</div>
              <div className="text-sm text-slate-400">Margine stimato: <b className="text-emerald-300">{fmtCHF(done.margine)}</b></div>
              <Link href={`/silvano/ordini`} className="block rounded-xl bg-emerald-500/20 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/30">Vai agli ordini</Link>
              <button onClick={() => setDone(null)} className="text-xs text-slate-400 hover:text-white">Nuovo preventivo</button>
            </div>
          ) : !cart.length ? (
            <Empty>{cliente ? 'Aggiungi prodotti dal catalogo' : 'Seleziona un cliente per iniziare'}</Empty>
          ) : (
            <>
              <div className="max-h-[40vh] space-y-2 overflow-auto">
                {cart.map((i) => (
                  <div key={i.id} className="rounded-xl bg-white/5 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium text-white">{i.name}</div>
                      <button onClick={() => setCart((c) => c.filter((x) => x.id !== i.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setCart((c) => c.map((x) => x.id === i.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} className="rounded-lg bg-white/10 p-1"><Minus size={13} /></button>
                        <span className="w-8 text-center text-sm">{i.qty}</span>
                        <button onClick={() => setCart((c) => c.map((x) => x.id === i.id ? { ...x, qty: x.qty + 1 } : x))} className="rounded-lg bg-white/10 p-1"><Plus size={13} /></button>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-300">{fmtCHF(i.price * i.qty)}</div>
                        <div className="text-[10px] text-slate-500">margine {fmtCHF((i.price - i.floor) * i.qty)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <label className="block text-xs text-slate-400">Data consegna
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1.5 text-sm text-white" />
                </label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (opzionale)…" rows={2}
                  className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1.5 text-sm" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Totale</span><span className="font-bold text-white">{fmtCHF(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Tuo margine</span><span className="font-bold text-emerald-300">{fmtCHF(cartMargine)}</span>
                </div>
                <button onClick={submit} disabled={submitting}
                  className="w-full rounded-xl bg-emerald-500 py-2.5 font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50">
                  {submitting ? 'Creazione…' : 'Crea preventivo'}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ===== Modal prodotto ===== */}
      {modal && <ProductModal p={modal} hasClient={!!cliente} onClose={() => setModal(null)} onAdd={addToCart}
        onSelectClient={() => { setModal(null); setShowClientPicker(true); }} />}

      {/* ===== Toast ===== */}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white shadow-xl">{toast}</div>}
    </div>
  );
}

/* ====================== Modal prodotto (info + margine live) ====================== */
function ProductModal({ p, hasClient, onClose, onAdd, onSelectClient }: {
  p: Prod; hasClient: boolean; onClose: () => void;
  onAdd: (p: Prod, qty: number, price: number) => void; onSelectClient: () => void;
}) {
  const floor = p.floor ?? p.cost;
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(p.base || 0);

  const margine = (price - floor) * qty;
  const below = price < floor - 0.001;
  const sliderMax = Math.max(p.base * 1.5, floor + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white p-1.5">
              {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-slate-400"><Package size={28} /></div>}
            </div>
            <div>
              <div className="font-semibold text-white">{p.name}</div>
              {p.code && <div className="text-xs text-slate-500">{p.code}</div>}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.qtyAvailable > 0 ? <span className={`${pill} bg-emerald-600`}>{Math.round(p.qtyAvailable)} disp.</span> : <span className={`${pill} bg-red-600`}>esaurito</span>}
                {p.incomingQty > 0 && <span className={`${pill} bg-amber-500`}>in arrivo {Math.round(p.incomingQty)}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {p.description && (
          <div className="mt-3 max-h-32 overflow-auto whitespace-pre-line rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{p.description}</div>
        )}

        {!hasClient ? (
          <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-4 text-center">
            <div className="text-sm text-slate-300">Seleziona un cliente per vedere <b className="text-white">prezzo e margine</b> e aggiungere al preventivo.</div>
            <button onClick={onSelectClient} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-400">Seleziona cliente</button>
          </div>
        ) : (
          <>
            {p.anomaly && <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">⚠️ Listino sotto o pari al costo: margine non disponibile, prezzo minimo = costo.</div>}

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Listino</div><div className="font-semibold text-white">{fmtCHF(p.base)}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Minimo</div><div className="font-semibold text-amber-300">{fmtCHF(floor)}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Margine pieno</div><div className="font-semibold text-emerald-300">{fmtCHF(p.quota ?? 0)}</div></div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Prezzo di vendita</span>
                <input type="number" step="0.01" value={price}
                  onChange={(e) => setPrice(Math.max(floor, parseFloat(e.target.value) || 0))}
                  className="w-28 rounded-lg border border-white/10 bg-slate-800/60 px-2 py-1.5 text-right text-white" />
              </div>
              <input type="range" min={floor} max={sliderMax} step="0.05" value={Math.min(price, sliderMax)}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="mt-2 w-full accent-emerald-500" />
              <div className="flex justify-between text-[11px] text-slate-500"><span>min {fmtCHF(floor)}</span><span>listino {fmtCHF(p.base)}</span></div>
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
              </div>
              <button onClick={() => onAdd(p, qty, price)} disabled={below}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50">
                <Plus size={18} /> Aggiungi al carrello
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
