'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Minus, Trash2, X, ShoppingCart, History, Check, Package, Eye, EyeOff, Info } from 'lucide-react';
import { Card, Badge, Spinner, Empty, fmtCHF, fmtDate } from './_components/ui';

interface Cliente { id: number; name: string; city?: string }
interface Prod {
  id: number; name: string; code: string; description?: string; uom: string; image: string | null;
  qtyAvailable: number; incomingQty: number; listPrice: number; cost: number;
  base: number; floor: number | null; quota: number | null; anomaly: boolean;
  reparto?: string | null;
}

// badge pieni, colore profondo, ben leggibili sopra la foto bianca
const pill = 'inline-block rounded-md px-2 py-0.5 text-[11px] font-bold text-white shadow-md';
// icona del reparto principale sulla card
const REPARTO_ICON: Record<string, { e: string; l: string }> = {
  frigo: { e: '🧊', l: 'Frigo' },
  congelatore: { e: '❄️', l: 'Congelatore' },
  secco: { e: '📦', l: 'Secco' },
  nonfood: { e: '🧴', l: 'Non Food' },
};
const PAGE_SIZE = 48;
// stile per il contenuto HTML (descrizione + specifiche) dal sito
const PROSE = 'max-w-none text-sm leading-relaxed text-slate-200 [&_a]:text-emerald-300 [&_h1]:mt-3 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-emerald-300 [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_table]:w-full [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_ul]:space-y-1';
// lista pagine con ellissi (1 … 4 5 6 … 71)
function pageList(cur: number, totalP: number): (number | string)[] {
  const out: (number | string)[] = [];
  for (let n = 1; n <= totalP; n++) {
    if (n === 1 || n === totalP || (n >= cur - 1 && n <= cur + 1)) out.push(n);
    else if (out[out.length - 1] !== '...') out.push('...');
  }
  return out;
}
interface CartItem { id: number; name: string; code: string; qty: number; price: number; floor: number; base: number; uom: string; }

export default function CatalogoPage() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [clientiQ, setClientiQ] = useState('');
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);

  const [q, setQ] = useState('');
  const [onlyAvail, setOnlyAvail] = useState(true);
  const [categ, setCateg] = useState('');
  const [categorie, setCategorie] = useState<{ id: number; name: string }[]>([]);
  const [boughtOnly, setBoughtOnly] = useState(false);
  const [boughtIds, setBoughtIds] = useState<Set<number>>(new Set());
  const [prods, setProds] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [modal, setModal] = useState<Prod | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const t = new Date(); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10);
  });
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderId: number; orderName: string; margine: number } | null>(null);
  const [toast, setToast] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [hidePrices, setHidePrices] = useState(false);

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
    if (categ) params.set('categ', categ);
    if (cliente) params.set('clientId', String(cliente.id));
    params.set('page', String(page));
    const r = await fetch(`/api/silvano/catalog?${params}`);
    const d = await r.json();
    if (d.success) { setProds(d.items); setTotal(d.total || 0); }
    setLoading(false);
  }, [q, onlyAvail, categ, cliente, page]);

  useEffect(() => {
    const t = setTimeout(loadCatalog, 250);
    return () => clearTimeout(t);
  }, [loadCatalog]);

  // i filtri tornano a pagina 1
  useEffect(() => { setPage(1); }, [q, onlyAvail, categ, cliente]);

  // categorie (reparti) per la tendina
  useEffect(() => {
    fetch('/api/silvano/categorie').then((r) => r.json()).then((d) => { if (d.success) setCategorie(d.categorie); }).catch(() => {});
  }, []);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goPage = (n: number) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartMargine = cart.reduce((s, i) => s + (i.price - i.floor) * i.qty, 0);

  const addToCart = (p: Prod, qty: number, price: number) => {
    const floor = p.floor ?? p.cost;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + qty, price } : i));
      return [...prev, { id: p.id, name: p.name, code: p.code, qty, price, floor, base: p.base, uom: p.uom }];
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
          <select value={categ} onChange={(e) => setCateg(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-400">
            <option value="">Tutti i reparti</option>
            {categorie.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setOnlyAvail((v) => !v)}
            className={`rounded-xl px-3 py-2.5 text-sm font-medium ${onlyAvail ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
            Solo disponibili
          </button>
          <button onClick={() => setHidePrices((v) => !v)}
            title={hidePrices ? 'Mostra i prezzi' : 'Nascondi i prezzi (davanti al cliente)'}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ${hidePrices ? 'bg-amber-500/20 text-amber-200' : 'bg-white/5 text-slate-300'}`}>
            {hidePrices ? <EyeOff size={15} /> : <Eye size={15} />} Prezzi
          </button>
          {cliente && (
            <button onClick={() => setBoughtOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium ${boughtOnly ? 'bg-blue-500/20 text-blue-200' : 'bg-white/5 text-slate-300'}`}>
              <History size={15} /> Già comprati
            </button>
          )}
          <button onClick={() => setCartOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-emerald-400">
            <ShoppingCart size={16} /> Preventivo
            {cart.length > 0 && <span className="rounded-full bg-slate-900/25 px-2 py-0.5 text-xs">{cart.length}</span>}
          </button>
        </div>

        {/* Griglia */}
        {loading ? <Spinner /> : !visibleProds.length ? <Empty>Nessun prodotto</Empty> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
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
                  <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
                    {p.reparto && REPARTO_ICON[p.reparto] && (
                      <span title={REPARTO_ICON[p.reparto].l} className="rounded-md bg-black/55 px-1.5 py-0.5 text-[13px] leading-none shadow-md">{REPARTO_ICON[p.reparto].e}</span>
                    )}
                    {boughtIds.has(p.id) && <span className={`${pill} bg-blue-600`}>★ già comprato</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-2.5">
                  <div className="line-clamp-2 text-sm font-medium text-white">{p.name}</div>
                  {p.code && <div className="text-[11px] text-slate-500">{p.code}</div>}
                  <div className="mt-auto pt-2">
                    {hidePrices ? (
                      <div className="text-base font-bold text-slate-600">•••{p.uom && <span className="ml-1 text-xs font-normal text-slate-500">/ {p.uom}</span>}</div>
                    ) : (
                      <div className="text-base font-bold text-emerald-300">{fmtCHF(p.base)}{p.uom && <span className="ml-1 text-xs font-normal text-slate-400">/ {p.uom}</span>}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Paginazione */}
        {!boughtOnly && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
            <button disabled={page <= 1} onClick={() => goPage(page - 1)}
              className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-40">‹</button>
            {pageList(page, totalPages).map((n, i) => n === '...'
              ? <span key={`e${i}`} className="px-2 text-slate-500">…</span>
              : <button key={n} onClick={() => goPage(n as number)}
                  className={`min-w-[38px] rounded-lg px-3 py-2 text-sm font-medium ${n === page ? 'bg-emerald-500 text-slate-900' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{n}</button>)}
            <button disabled={page >= totalPages} onClick={() => goPage(page + 1)}
              className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-40">›</button>
            <span className="ml-2 text-xs text-slate-500">{total} prodotti</span>
          </div>
        )}

      {/* ===== Carrello (drawer) ===== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <div className="flex h-full w-full max-w-md flex-col overflow-auto border-l border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} /> <span className="font-semibold">Preventivo</span>
              {cart.length > 0 && <Badge color="green">{cart.length}</Badge>}
            </div>
            <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
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
                        {i.uom && <span className="ml-1 text-[11px] text-slate-400">{i.uom}</span>}
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
          </div>
        </div>
      )}

      {/* ===== Modal prodotto ===== */}
      {modal && <ProductModal p={modal} hasClient={!!cliente} clientId={cliente?.id ?? null} onClose={() => setModal(null)} onAdd={addToCart}
        onSelectClient={() => { setModal(null); setShowClientPicker(true); }} />}

      {/* ===== Toast ===== */}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm text-white shadow-xl">{toast}</div>}
    </div>
  );
}

/* ====================== Modal prodotto (info + margine live) ====================== */
function ProductModal({ p, hasClient, clientId, onClose, onAdd, onSelectClient }: {
  p: Prod; hasClient: boolean; clientId: number | null; onClose: () => void;
  onAdd: (p: Prod, qty: number, price: number) => void; onSelectClient: () => void;
}) {
  const floor = p.floor ?? p.cost;
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(p.base || 0);
  const [lastBuy, setLastBuy] = useState<string | null | undefined>(undefined); // undefined = caricamento
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    fetch(`/api/silvano/ultimo-acquisto?clientId=${clientId}&productId=${p.id}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setLastBuy(d.success ? d.lastDate : null); })
      .catch(() => { if (alive) setLastBuy(null); });
    return () => { alive = false; };
  }, [clientId, p.id]);

  const margine = (price - floor) * qty;
  const below = price < floor - 0.001;
  const sliderMax = Math.max(p.base * 1.5, floor + 1);

  return (
    <>
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
              <button onClick={() => setInfoOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/20">
                <Info size={13} /> Dettagli e specifiche
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {!hasClient ? (
          <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-4 text-center">
            <div className="text-sm text-slate-300">Seleziona un cliente per vedere <b className="text-white">prezzo e margine</b> e aggiungere al preventivo.</div>
            <button onClick={onSelectClient} className="mt-3 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-900 hover:bg-emerald-400">Seleziona cliente</button>
          </div>
        ) : (
          <>
            {p.anomaly && <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">⚠️ Listino sotto o pari al costo: margine non disponibile, prezzo minimo = costo.</div>}

            <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
              <span className="text-slate-400">Ultimo ordine di questo cliente</span>
              <span className="font-medium text-white">
                {lastBuy === undefined ? '…' : lastBuy ? fmtDate(lastBuy) : 'Mai ordinato'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Listino</div><div className="font-semibold text-white">{fmtCHF(p.base)}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Minimo</div><div className="font-semibold text-amber-300">{fmtCHF(floor)}</div></div>
              <div className="rounded-xl bg-white/5 p-2"><div className="text-slate-400">Margine pieno</div><div className="font-semibold text-emerald-300">{fmtCHF(p.quota ?? 0)}</div></div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">Prezzo di vendita{p.uom ? ` / ${p.uom}` : ''}</span>
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
                {p.uom && <span className="ml-1 text-sm text-slate-400">{p.uom}</span>}
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
    {infoOpen && <InfoModal productId={p.id} name={p.name} onClose={() => setInfoOpen(false)} />}
    </>
  );
}

/* ====================== Modal dettagli/specifiche prodotto (da sito) ====================== */
function InfoModal({ productId, name, onClose }: { productId: number; name: string; onClose: () => void }) {
  const [info, setInfo] = useState<any | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetch(`/api/silvano/prodotto-info/${productId}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setInfo(d.success ? d.info : null); })
      .catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [productId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
          <div className="font-semibold text-white">{name}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="overflow-auto p-5">
          {info === undefined ? <Spinner /> : !info ? <Empty>Nessun dettaglio</Empty> : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {info.code && <Spec l="Codice" v={info.code} />}
                {info.barcode && <Spec l="Barcode" v={info.barcode} />}
                {info.weight ? <Spec l="Peso" v={`${info.weight} kg`} /> : null}
                {info.origin && <Spec l="Origine" v={info.origin} />}
              </div>
              {info.html && <div className={PROSE} dangerouslySetInnerHTML={{ __html: info.html }} />}
              {info.specs && <div className={`mt-4 border-t border-white/10 pt-4 ${PROSE}`} dangerouslySetInnerHTML={{ __html: info.specs }} />}
              {!info.html && !info.specs && <Empty>Nessuna descrizione disponibile sul sito</Empty>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Spec({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-1.5">
      <div className="text-slate-400">{l}</div>
      <div className="font-medium text-white">{v}</div>
    </div>
  );
}
