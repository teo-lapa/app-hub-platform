'use client';

import { useEffect, useState } from 'react';
import { Package, FileText, Truck } from 'lucide-react';

interface Order {
  id: number;
  name: string;
  date?: string;
  total?: number;
  state?: string;
  stateLabel?: string;
  productsCount?: number;
  invoiceStatus?: string;
  deliveryStatus?: string;
  salesperson?: string;
}

const chf = (n?: number) =>
  n == null ? '—' : 'CHF ' + n.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(s?: string) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('it-CH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stateColor(state?: string) {
  if (state === 'sale' || state === 'done') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400';
  if (state === 'draft' || state === 'sent') return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400';
  if (state === 'cancel') return 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400';
  return 'bg-zinc-100 text-zinc-600 dark:bg-white/10';
}

export default function OrdiniView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/portale-clienti/orders');
        const d = await r.json();
        if (alive) setOrders(Array.isArray(d.orders) ? d.orders : []);
      } catch {
        if (alive) setErr('Impossibile caricare gli ordini in questo momento.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-8">
        <h1 className="text-2xl font-semibold">I miei ordini</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/5" />
              ))}
            </div>
          ) : err ? (
            <p className="text-zinc-500">{err}</p>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Package className="mb-3 h-10 w-10" />
              <p>Nessun ordine trovato.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#222236] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{o.name}</span>
                        {o.stateLabel && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stateColor(o.state)}`}>{o.stateLabel}</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-zinc-500">{fmtDate(o.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{chf(o.total)}</div>
                      {o.productsCount != null && <div className="text-xs text-zinc-400">{o.productsCount} prodotti</div>}
                    </div>
                  </div>
                  {(o.deliveryStatus || o.invoiceStatus) && (
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                      {o.deliveryStatus && <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" /> {o.deliveryStatus}</span>}
                      {o.invoiceStatus && <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {o.invoiceStatus}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
