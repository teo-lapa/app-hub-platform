'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setErr('');
      try {
        const r = await fetch(`/api/portale-clienti/products?limit=60${q ? `&q=${encodeURIComponent(q)}` : ''}`);
        const d = await r.json();
        if (alive) setItems(Array.isArray(d.products) ? d.products : []);
      } catch {
        if (alive) setErr('Impossibile caricare il catalogo in questo momento.');
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const suggestions = q.trim() && focused ? items.slice(0, 7) : [];

  return (
    <div className="flex h-full flex-col">
      {/* Header + ricerca con tendina */}
      <div className="border-b border-black/5 dark:border-white/5 px-4 py-3 md:px-6">
        <h1 className="mb-2 text-xl font-semibold">Catalogo</h1>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }}
            onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 150); }}
            placeholder="Cerca un prodotto…"
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#222236] py-2 pl-10 pr-3 text-sm outline-none focus:border-[#dc2626]/50"
          />
          {/* Tendina suggerimenti (foto + nome + prezzo) */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#222236] py-1 shadow-xl">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={(e) => { e.preventDefault(); setQ(p.name); setFocused(false); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc(p.image)} alt="" className="h-9 w-9 shrink-0 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).src = '/logos/logo-default.png'; }} />
                  <span className="flex-1 truncate text-sm">{p.name}</span>
                  {p.price != null && <span className="shrink-0 text-sm font-semibold text-[#dc2626]">{chf(p.price)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Griglia compatta */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-black/5 dark:border-white/5 p-2">
                <div className="mb-2 aspect-square rounded-lg bg-black/5 dark:bg-white/5" />
                <div className="mb-1.5 h-2.5 w-3/4 rounded bg-black/5 dark:bg-white/5" />
                <div className="h-2.5 w-1/3 rounded bg-black/5 dark:bg-white/5" />
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
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#222236] transition hover:shadow-md"
                title={p.name}
              >
                <div className="aspect-square overflow-hidden bg-zinc-50 dark:bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc(p.image)}
                    alt={p.name}
                    className="h-full w-full object-contain p-1.5 transition group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/logos/logo-default.png'; }}
                  />
                </div>
                <div className="flex flex-1 flex-col p-2">
                  <p className="line-clamp-2 text-[12px] font-medium leading-snug">{p.name}</p>
                  <div className="mt-auto pt-1.5">
                    {p.price != null && (
                      <div className="text-[13px] font-semibold text-[#dc2626]">
                        {chf(p.price)} {p.unit && <span className="text-[10px] font-normal text-zinc-400">/ {p.unit}</span>}
                      </div>
                    )}
                    <span className={`mt-1 inline-block h-1.5 w-1.5 rounded-full ${p.available ? 'bg-green-500' : 'bg-zinc-300'}`} title={p.available ? 'Disponibile' : 'Non disponibile'} />
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
