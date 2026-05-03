'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MOCK_TENANT } from '../../../_data';

type WineRow = {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  wineType: string;
  fascia: 'easy' | 'equilibrato' | 'importante';
  glass: number;
  bottle: number;
  story: string;
  notes: string[];
  pairings: string[];
  temp: number;
  decant: number;
  imageUrl: string | null;
};

type RawWine = {
  vergani_sku: string;
  name: string;
  producer: string;
  region: string;
  vintage?: string;
  wine_type: string;
  fascia: string;
  price_carta_suggested_chf: number;
  story_short: string;
  tasting_notes: string[];
  food_pairings: string[];
  service_temp_c?: number;
  decantation_minutes?: number;
  image_url?: string | null;
};

const TIER_COLORS = { easy: '#a85565', equilibrato: '#5a1a1f', importante: '#3a0e12' } as const;

const CATEGORY_FILTERS: { id: string; label: string; types: string[] }[] = [
  { id: 'all', label: 'Tutti', types: [] },
  { id: 'spumante', label: 'Bollicine', types: ['spumante'] },
  { id: 'bianco', label: 'Bianchi', types: ['bianco'] },
  { id: 'rosso', label: 'Rossi', types: ['rosso', 'rosé'] },
  { id: 'dolce', label: 'Dolci', types: ['dolce', 'passito'] },
  { id: 'grappa', label: 'Grappe', types: ['grappa', 'distillato'] },
];

export default function WinesPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const tenant = MOCK_TENANT;

  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';

  const [allWines, setAllWines] = useState<WineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [storyWine, setStoryWine] = useState<WineRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wine/catalog?slug=${encodeURIComponent(params.slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = (await res.json()) as { wines: RawWine[] };
        if (cancelled) return;
        const rows: WineRow[] = (raw.wines || []).map((w) => {
          const bottle = Math.round(w.price_carta_suggested_chf);
          const glass = Math.max(7, Math.round(bottle / 5));
          return {
            wineId: w.vergani_sku,
            name: w.name,
            producer: w.producer,
            region: w.region,
            vintage: w.vintage || '',
            wineType: w.wine_type,
            fascia: (w.fascia as WineRow['fascia']) || 'equilibrato',
            glass,
            bottle,
            story: w.story_short,
            notes: w.tasting_notes || [],
            pairings: w.food_pairings || [],
            temp: w.service_temp_c || 16,
            decant: w.decantation_minutes || 0,
            imageUrl: w.image_url || null,
          };
        });
        setAllWines(rows);
      } catch (e) {
        console.error('[wines] catalog load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [params.slug]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allWines;
    const cat = CATEGORY_FILTERS.find((c) => c.id === filter);
    if (!cat) return allWines;
    return allWines.filter((w) => cat.types.some((t) => w.wineType.toLowerCase().includes(t)));
  }, [allWines, filter]);

  const grouped = useMemo(() => {
    const order = ['spumante', 'bianco', 'rosé', 'rosso', 'dolce', 'passito', 'grappa', 'distillato'];
    const groups = new Map<string, WineRow[]>();
    for (const w of filtered) {
      const key = order.find((o) => w.wineType.toLowerCase().includes(o)) || 'altro';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(w);
    }
    return Array.from(groups.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [filtered]);

  const take = (w: WineRow) => {
    const qs = new URLSearchParams({
      wineId: w.wineId,
      wine: w.name,
      sub: w.producer,
      price: String(w.bottle),
      glass: String(w.glass),
      accent: TIER_COLORS[w.fascia],
      image: w.imageUrl || '',
    });
    router.push(`/w/${params.slug}/${params.tavolo}/confirm?${qs.toString()}`);
  };

  return (
    <main
      className="wine-surface"
      style={{ background: tenant.cream, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 22px 10px', borderBottom: `1px solid ${line}`,
          background: tenant.cream, position: 'sticky', top: 0, zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Torna al sommelier"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: sub, fontFamily: 'Fraunces, serif', fontSize: 13, fontStyle: 'italic',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 5l-7 7 7 7" />
          </svg>
          Sommelier
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontStyle: 'italic', color: ink }}>Carta vini</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: sub, marginTop: 2 }}>
            {tenant.name}
          </div>
        </div>
        <div style={{ width: 40 }} />
      </header>

      <div style={{ padding: '14px 14px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {CATEGORY_FILTERS.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              style={{
                flexShrink: 0, padding: '8px 14px',
                background: active ? tenant.accent : '#fbf8f1',
                color: active ? '#fbf8f1' : ink,
                border: `1px solid ${active ? tenant.accent : line}`,
                fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '12px 18px 32px', flex: 1 }}>
        {loading && (
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontStyle: 'italic', color: sub, textAlign: 'center', marginTop: 40 }}>
            Carico la carta…
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontStyle: 'italic', color: sub, textAlign: 'center', marginTop: 40 }}>
            Nessun vino in questa categoria.
          </p>
        )}
        {grouped.map(([category, list]) => (
          <section key={category} style={{ marginTop: 20 }}>
            <h2 className="eyebrow-wine" style={{ color: tenant.accent, marginBottom: 10 }}>
              {prettyCategory(category)} · {list.length}
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' }}>
              {list.map((w, i) => (
                <li key={w.wineId}>
                  <button
                    type="button"
                    onClick={() => setStoryWine(w)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 0',
                      background: 'transparent', border: 'none',
                      borderTop: i === 0 ? `1px solid ${line}` : 'none',
                      borderBottom: `1px solid ${line}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    {/* Thumbnail bottiglia */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 48,
                        height: 72,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: w.imageUrl ? 'transparent' : '#fbf8f1',
                      }}
                    >
                      {w.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.imageUrl}
                          alt={w.name}
                          loading="lazy"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 14, height: 56, background: TIER_COLORS[w.fascia], opacity: 0.6,
                            borderRadius: '3px 3px 1px 1px',
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontStyle: 'italic', color: ink, fontWeight: 400, lineHeight: 1.2 }}>
                        {w.name}{w.vintage && ` · ${w.vintage}`}
                      </div>
                      <div style={{ marginTop: 3, fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: sub }}>
                        {w.producer} · {w.region}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, color: ink }}>
                        <span style={{ fontSize: 9 }}>CHF </span>
                        <span className="tnum">{w.bottle}</span>
                      </div>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
                        bottiglia
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {storyWine && <StorySheet wine={storyWine} onClose={() => setStoryWine(null)} onTake={take} />}
    </main>
  );
}

function prettyCategory(c: string): string {
  switch (c) {
    case 'spumante': return 'Bollicine';
    case 'bianco': return 'Bianchi';
    case 'rosé': return 'Rosati';
    case 'rosso': return 'Rossi';
    case 'dolce': return 'Dolci';
    case 'passito': return 'Passiti';
    case 'grappa': return 'Grappe';
    case 'distillato': return 'Distillati';
    default: return 'Altro';
  }
}

function StorySheet({ wine, onClose, onTake }: { wine: WineRow; onClose: () => void; onTake: (w: WineRow) => void }) {
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';
  const accent = TIER_COLORS[wine.fascia];

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Storia di ${wine.name}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,24,21,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 50 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#f6f1e8', width: '100%', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: '12px 0 0' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 14px' }}>
          <div style={{ width: 38, height: 3, background: line, borderRadius: 2 }} />
        </div>

        {wine.imageUrl && (
          <div style={{ padding: '0 28px 4px', display: 'flex', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wine.imageUrl}
              alt={wine.name}
              style={{ maxHeight: 280, maxWidth: '100%', objectFit: 'contain' }}
            />
          </div>
        )}
        <div style={{ padding: '0 28px 4px', textAlign: 'center' }}>
          <div className="eyebrow-wine" style={{ color: accent }}>{wine.producer}</div>
          <h2 style={{ marginTop: 4, font: 'var(--text-h1-serif)', fontSize: 26, fontStyle: 'italic', fontWeight: 400, color: ink }}>
            {wine.name}
          </h2>
          <div style={{ marginTop: 4, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: sub }}>
            {wine.region}{wine.vintage && ` · ${wine.vintage}`}
          </div>
        </div>

        <div style={{ padding: '20px 28px 0', display: 'flex', gap: 24, justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: ink }}>
              <span style={{ fontSize: 11 }}>CHF </span>
              <span className="tnum">{wine.glass}</span>
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
              al bicchiere
            </div>
          </div>
          <div style={{ width: 1, background: line }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: ink }}>
              <span style={{ fontSize: 11 }}>CHF </span>
              <span className="tnum">{wine.bottle}</span>
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
              bottiglia
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 28px 0' }}>
          <div className="eyebrow-wine" style={{ color: accent, marginBottom: 8 }}>Storia</div>
          <p style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 14, lineHeight: 1.55, color: ink, fontWeight: 300 }}>
            {wine.story}
          </p>
        </div>

        {wine.notes.length > 0 && (
          <div style={{ padding: '18px 28px 0' }}>
            <div className="eyebrow-wine" style={{ color: sub, marginBottom: 10 }}>Note</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {wine.notes.map((n) => (
                <span
                  key={n}
                  style={{
                    padding: '6px 12px', border: `1px solid ${line}`,
                    fontFamily: 'Fraunces, serif', fontSize: 12, fontStyle: 'italic',
                    color: ink, fontWeight: 300,
                  }}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {wine.pairings.length > 0 && (
          <div style={{ padding: '18px 28px 0' }}>
            <div className="eyebrow-wine" style={{ color: sub, marginBottom: 10 }}>Si abbina con</div>
            <p style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 13, fontStyle: 'italic', color: ink, fontWeight: 300, lineHeight: 1.5 }}>
              {wine.pairings.join(' · ')}
            </p>
          </div>
        )}

        <div style={{ padding: '18px 28px 0' }}>
          <div className="eyebrow-wine" style={{ color: sub, marginBottom: 10 }}>Servizio</div>
          <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: sub }}>
            Temperatura {wine.temp}°C{wine.decant > 0 && ` · decantazione ${wine.decant} min`}
          </p>
        </div>

        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button" onClick={() => onTake(wine)}
            style={{
              width: '100%', height: 48, background: accent, color: '#fbf8f1',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
            }}
          >
            Lo prendo
          </button>
          <button
            type="button" onClick={onClose}
            style={{
              width: '100%', height: 36, background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'Fraunces, serif', fontSize: 12, fontStyle: 'italic', color: sub, fontWeight: 300,
            }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
