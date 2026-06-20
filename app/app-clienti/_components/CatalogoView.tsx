'use client';

import { useEffect, useState } from 'react';
import { Search, Package } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  code?: string;
  price?: number;
  originalPrice?: number;
  hasCustomPrice?: boolean;
  image?: string;
  unit?: string;
  category?: { name?: string } | string;
  available?: boolean;
  quantity?: number;
}

function imgSrc(img?: string) {
  if (!img) return '/logos/logo-default.png';
  if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/')) return img;
  if (img.length > 100) return `data:image/jpeg;base64,${img}`;
  return img;
}
const chf = (n?: number) =>
  n == null ? '' : 'CHF ' + n.toLocaleString('it-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function catName(c?: { name?: string } | string) {
  if (!c) return '';
  return typeof c === 'string' ? c : c.name || '';
}

export default function CatalogoView() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr('');
      try {
        const r = await fetch(`/api/portale-clienti/products?limit=48${q ? `&q=${encodeURIComponent(q)}` : ''}`);
        const d = await r.json();
        if (alive) setItems(Array.isArray(d.products) ? d.products : []);
      } catch {
        if (alive) setErr('Impossibile caricare il catalogo in questo momento.');
      } finally {
        if (alive) setLoading(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="flex h-full flex-col">
      {/* Header + ricerca */}
      <div className="border-b border-black/5 dark:border-white/5 px-4 py-4 md:px-8">
        <h1 className="mb-3 text-2xl font-semibold">Catalogo</h1>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca un prodotto…"
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#222236] py-2.5 pl-10 pr-3 outline-none focus:border-[#dc2626]/50"
          />
        </div>
      </div>

      {/* Griglia */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-black/5 dark:border-white/5 p-3">
                <div className="mb-3 aspect-square rounded-xl bg-black/5 dark:bg-white/5" />
                <div className="mb-2 h-3 w-3/4 rounded bg-black/5 dark:bg-white/5" />
                <div className="h-3 w-1/3 rounded bg-black/5 dark:bg-white/5" />
              </div>
            ))}
          </div>
        ) : err ? (
          <p className="text-zinc-500">{err}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Package className="mb-3 h-10 w-10" />
            <p>Nessun prodotto trovato.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#222236] transition hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-zinc-50 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc(p.image)}
                    alt={p.name}
                    className="h-full w-full object-contain p-2 transition group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logos/logo-default.png'; }}
                  />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  {catName(p.category) && (
                    <span className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">{catName(p.category)}</span>
                  )}
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                  <div className="mt-auto pt-2">
                    {p.price != null && (
                      <div className="font-semibold text-[#dc2626]">
                        {chf(p.price)} {p.unit && <span className="text-xs font-normal text-zinc-400">/ {p.unit}</span>}
                      </div>
                    )}
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${p.available ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-zinc-100 text-zinc-500 dark:bg-white/10'}`}>
                      {p.available ? 'Disponibile' : 'Non disponibile'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
