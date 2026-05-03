'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MOCK_TENANT, TIER_WINES, TIER_LABELS, type TierWine } from '../../../_data';

// ── Types from sommelier API ───────────────────────────────────────────────
type ApiTier = 'easy' | 'equilibrato' | 'importante';
type ApiWine = {
  tier: ApiTier;
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  price_glass_chf: number;
  price_bottle_chf: number;
  reason: string;
  story_short: string;
  tasting_notes: string[];
  service_temp_c: number;
  confidence: number;
};
type ApiPayload = {
  suggestionId: string;
  wines: ApiWine[];
  dishesInput?: string;
};

// Display wine = unione tra mock TierWine e ApiWine
type DisplayWine = {
  source: 'api' | 'mock';
  apiWineId?: string;
  tierIndex: 0 | 1 | 2;
  name: string;
  sub: string;
  grape: string;
  region: string;
  year: string;
  glass: number;
  bottle: number;
  accent: string;
  notes: string[];
  temp: number;
  decant: boolean;
  storyShort: string;
  reason?: string;
};

const TIER_ACCENTS: Record<ApiTier, string> = {
  easy: '#a85565',
  equilibrato: '#5a1a1f',
  importante: '#3a0e12',
};

function tierToIndex(t: ApiTier): 0 | 1 | 2 {
  return t === 'easy' ? 0 : t === 'equilibrato' ? 1 : 2;
}

function apiToDisplay(w: ApiWine): DisplayWine {
  return {
    source: 'api',
    apiWineId: w.wineId,
    tierIndex: tierToIndex(w.tier),
    name: w.name,
    sub: w.producer,
    grape: '—', // l'API non passa i vitigni esplicitamente nella response, va bene così
    region: `${w.region} · ${w.vintage}`,
    year: w.vintage,
    glass: w.price_glass_chf,
    bottle: w.price_bottle_chf,
    accent: TIER_ACCENTS[w.tier],
    notes: w.tasting_notes,
    temp: w.service_temp_c,
    decant: false,
    storyShort: w.story_short,
    reason: w.reason,
  };
}

function mockToDisplay(w: TierWine): DisplayWine {
  return {
    source: 'mock',
    tierIndex: w.tier,
    name: w.name,
    sub: w.sub,
    grape: w.grape,
    region: w.region,
    year: w.year,
    glass: w.glass,
    bottle: w.bottle,
    accent: w.accent,
    notes: w.notes,
    temp: w.temp,
    decant: w.decant,
    storyShort: w.storyShort,
  };
}

export default function WinesPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const sp = useSearchParams();
  const sid = sp.get('sid') || '';

  const tenant = MOCK_TENANT;
  const [wines, setWines] = useState<DisplayWine[]>(() => TIER_WINES.map(mockToDisplay));
  const [dishesInput, setDishesInput] = useState<string>('il tuo piatto');
  const [picked, setPicked] = useState(1);
  const [storyWine, setStoryWine] = useState<DisplayWine | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from sessionStorage (set by /dishes after Claude API call)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`lapa-wine-suggestion-${params.slug}-${params.tavolo}`);
      if (raw) {
        const payload = JSON.parse(raw) as ApiPayload;
        if (payload.wines?.length) {
          // Sort by tier order: easy → equilibrato → importante
          const order: Record<ApiTier, number> = { easy: 0, equilibrato: 1, importante: 2 };
          const sorted = [...payload.wines].sort((a, b) => order[a.tier] - order[b.tier]);
          setWines(sorted.map(apiToDisplay));
          if (payload.dishesInput) setDishesInput(payload.dishesInput);
        }
      }
    } catch (e) {
      console.warn('[wines] hydrate failed:', e);
    } finally {
      setHydrated(true);
    }
  }, [params.slug, params.tavolo]);

  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';

  const take = (w: DisplayWine) => {
    router.push(
      `/w/${params.slug}/${params.tavolo}/confirm?wine=${encodeURIComponent(w.name)}&price=${w.bottle}&sub=${encodeURIComponent(w.sub)}&accent=${encodeURIComponent(w.accent)}`,
    );
  };

  return (
    <main className="wine-surface" style={{ background: tenant.cream, minHeight: '100vh', position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 10px' }}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Indietro"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: sub,
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 5l-7 7 7 7" />
          </svg>
        </button>
        <span style={{ fontSize: 11, color: sub }}>IT</span>
      </div>

      {/* Title */}
      <div style={{ padding: '14px 28px 0' }}>
        <div className="eyebrow-wine" style={{ color: sub }}>per {dishesInput.toLowerCase()}</div>
        <h1
          style={{
            marginTop: 10, font: 'var(--text-display-serif)', fontSize: 30, lineHeight: 1.05,
            letterSpacing: '-0.015em', color: ink, fontStyle: 'italic', fontWeight: 300,
            whiteSpace: 'pre-line', margin: '10px 0 0',
          }}
        >
          {`Tre vini\nper il tuo piatto`}
        </h1>
        <p style={{ margin: '12px 0 0', fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: sub }}>
          {hydrated && wines[0]?.source === 'mock'
            ? 'Mostro proposte di esempio (sommelier offline).'
            : 'Scegli la fascia che preferisci.'}
        </p>
      </div>

      {/* 3 wine cards */}
      <div style={{ padding: '20px 0 0' }}>
        <div
          style={{
            display: 'flex', gap: 12, overflowX: 'auto',
            padding: '0 20px 4px', scrollSnapType: 'x mandatory',
          }}
        >
          {wines.map((w, i) => {
            const isPicked = picked === i;
            const label = TIER_LABELS[w.tierIndex];
            return (
              <article
                key={`${w.name}-${i}`}
                onClick={() => setPicked(i)}
                style={{
                  flex: '0 0 200px', scrollSnapAlign: 'center',
                  background: '#fbf8f1', border: `1px solid ${isPicked ? w.accent : line}`,
                  padding: '14px 14px 16px', cursor: 'pointer', position: 'relative',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.22em', textTransform: 'uppercase', color: w.accent,
                  }}
                >
                  {label}
                </div>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                  <BottleSvg width={86} accent={w.accent} title={w.name} subtitle={w.sub} meta={`${w.year} · ${w.region.split(' ')[0]}`} />
                </div>

                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontStyle: 'italic', color: ink, fontWeight: 400, lineHeight: 1.1 }}>
                    {w.name}
                  </div>
                  <div style={{ marginTop: 3, fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: sub }}>
                    {w.sub}
                  </div>
                  {w.reason && (
                    <div style={{ marginTop: 8, fontFamily: 'Fraunces, serif', fontSize: 11, fontStyle: 'italic', color: sub, fontWeight: 300, lineHeight: 1.35 }}>
                      “{w.reason}”
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: ink }}>
                      <span style={{ fontSize: 11 }}>CHF </span>
                      <span className="tnum">{w.glass}</span>
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
                      al bicchiere
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: ink }}>
                      <span style={{ fontSize: 11 }}>CHF </span>
                      <span className="tnum">{w.bottle}</span>
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
                      bottiglia
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setStoryWine(w); }}
                  style={{
                    marginTop: 12, width: '100%', textAlign: 'center', padding: '8px 0',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.18em',
                    textTransform: 'uppercase', color: sub, borderTop: `1px dashed ${line}`,
                  }}
                >
                  ↗ La storia
                </button>
              </article>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA + alt chat */}
      <div style={{ padding: '24px 28px 32px', marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          style={{
            display: 'block', margin: '0 auto 14px', background: 'transparent', border: 'none',
            cursor: 'pointer', fontFamily: 'Fraunces, serif', fontSize: 12.5, fontStyle: 'italic',
            color: sub, fontWeight: 300, textAlign: 'center',
          }}
        >
          O scrivimi cosa preferisci, ti propongo altro
        </button>
        <button
          type="button"
          onClick={() => take(wines[picked])}
          style={{
            width: '100%', height: 52, background: wines[picked].accent, color: '#fbf8f1',
            border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 13,
            fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}
        >
          Lo prendo · {wines[picked].name}
        </button>
      </div>

      {/* Story bottom sheet */}
      {storyWine && <StorySheet wine={storyWine} onClose={() => setStoryWine(null)} onTake={take} />}

      {/* Free chat sheet */}
      {chatOpen && (
        <ChatSheet
          tenant={tenant}
          slug={params.slug}
          tavolo={params.tavolo}
          onClose={() => setChatOpen(false)}
          onTake={take}
        />
      )}
    </main>
  );
}

function BottleSvg({ width, accent, title, subtitle, meta }: { width: number; accent: string; title: string; subtitle: string; meta: string }) {
  const h = width * (480 / 180);
  return (
    <svg viewBox="0 0 180 480" width={width} height={h} aria-hidden="true" style={{ display: 'block' }}>
      <ellipse cx="90" cy="476" rx="58" ry="5" fill="#000" opacity="0.15" />
      <path
        d="M 70 10 L 70 110 Q 50 130 45 175 Q 40 210 40 245 L 40 455 Q 40 470 55 470 L 125 470 Q 140 470 140 455 L 140 245 Q 140 210 135 175 Q 130 130 110 110 L 110 10 Z"
        fill={accent}
        opacity="0.92"
      />
      <rect x="68" y="6" width="44" height="92" fill="#1c1815" />
      <rect x="36" y="240" width="108" height="160" fill="#fbf8f1" />
      <line x1="46" y1="262" x2="134" y2="262" stroke={accent} strokeWidth="0.8" />
      <text x="90" y="285" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="11" fontWeight="500" letterSpacing="0.18em" fill="#1c1815">
        {subtitle.toUpperCase()}
      </text>
      <text x="90" y="330" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="22" fontStyle="italic" fontWeight="400" fill="#1c1815">
        {title}
      </text>
      <line x1="70" y1="350" x2="110" y2="350" stroke={accent} strokeWidth="0.6" />
      <text x="90" y="378" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8" letterSpacing="0.18em" fill="#1c1815" opacity="0.7">
        {meta.toUpperCase()}
      </text>
    </svg>
  );
}

function StorySheet({ wine, onClose, onTake }: { wine: DisplayWine; onClose: () => void; onTake: (w: DisplayWine) => void }) {
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';
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

        <div style={{ padding: '0 28px', textAlign: 'center' }}>
          <BottleSvg width={120} accent={wine.accent} title={wine.name} subtitle={wine.sub} meta={`${wine.year} · ${wine.region.split(' ')[0]}`} />
        </div>

        <div style={{ padding: '14px 28px 0', textAlign: 'center' }}>
          <div className="eyebrow-wine" style={{ color: sub }}>{wine.sub}</div>
          <h2 style={{ marginTop: 4, font: 'var(--text-h1-serif)', fontSize: 28, fontStyle: 'italic', fontWeight: 400, color: ink }}>
            {wine.name}
          </h2>
          <div style={{ marginTop: 4, fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: sub }}>
            {wine.region}
          </div>
        </div>

        {wine.reason && (
          <div style={{ padding: '20px 28px 0' }}>
            <div className="eyebrow-wine" style={{ color: wine.accent, marginBottom: 8 }}>Perché questo</div>
            <p style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 14, lineHeight: 1.55, color: ink, fontWeight: 300, fontStyle: 'italic' }}>
              {wine.reason}
            </p>
          </div>
        )}

        <div style={{ padding: '20px 28px 0' }}>
          <div className="eyebrow-wine" style={{ color: wine.accent, marginBottom: 8 }}>Storia</div>
          <p style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 14, lineHeight: 1.55, color: ink, fontWeight: 300 }}>
            {wine.storyShort}
          </p>
        </div>

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

        <div style={{ padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button" onClick={() => onTake(wine)}
            style={{
              width: '100%', height: 48, background: wine.accent, color: '#fbf8f1',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
            }}
          >
            Lo scelgo
          </button>
          <button
            type="button" onClick={onClose}
            style={{
              width: '100%', height: 36, background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'Fraunces, serif', fontSize: 12, fontStyle: 'italic', color: sub, fontWeight: 300,
            }}
          >
            Torna alle tre proposte
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Free chat collegata all'API ──────────────────────────────────────────
type ChatMessage =
  | { role: 'sommelier'; text: string; wines?: DisplayWine[] }
  | { role: 'user'; text: string };

function ChatSheet({
  tenant,
  slug,
  tavolo,
  onClose,
  onTake,
}: {
  tenant: typeof MOCK_TENANT;
  slug: string;
  tavolo: string;
  onClose: () => void;
  onTake: (w: DisplayWine) => void;
}) {
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';
  const [val, setVal] = useState('');
  const [msgs, setMsgs] = useState<ChatMessage[]>([
    { role: 'sommelier', text: 'Dimmi pure. Vuoi qualcosa di più fresco? Una bollicina? O un vino di una zona precisa?' },
  ]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = val.trim();
    if (!text || busy) return;
    setVal('');
    setMsgs((m) => [...m, { role: 'user', text }]);
    setBusy(true);
    try {
      // Costruisco il contesto: storia chat + nuova richiesta
      const history = msgs
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Sommelier'}: ${m.text}`)
        .join('\n');
      const prompt = `${history}\nCliente: ${text}\n\nProponi 3 vini aggiornati in base a questa nuova richiesta.`;
      const res = await fetch('/api/wine/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: slug,
          tableCode: tavolo,
          dishesInput: prompt,
          language: 'it',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiPayload;
      const order: Record<ApiTier, number> = { easy: 0, equilibrato: 1, importante: 2 };
      const sorted = [...(data.wines || [])].sort((a, b) => order[a.tier] - order[b.tier]).map(apiToDisplay);
      const middleReason = sorted[1]?.reason || sorted[0]?.reason || 'Ho aggiornato le proposte qui sotto.';
      setMsgs((m) => [...m, { role: 'sommelier', text: middleReason, wines: sorted }]);
    } catch (e) {
      console.error('[chat] error', e);
      setMsgs((m) => [...m, { role: 'sommelier', text: 'Scusa, sono momentaneamente fuori linea. Riprova tra un secondo.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Chat con il sommelier"
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,24,21,0.4)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: tenant.cream, width: '100%', height: '88vh',
          borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: `1px solid ${line}` }}>
          <button type="button" onClick={onClose} aria-label="Chiudi chat"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: sub, fontSize: 13 }}>
            Chiudi
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: 15, color: ink }}>Sommelier</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontSize: 9.5, color: sub, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: busy ? '#a85565' : '#6f6b3c' }} />
              {busy ? 'Sto pensando…' : 'In linea'}
            </div>
          </div>
          <div style={{ width: 48 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msgs.map((m, idx) => (
            <div key={idx} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div
                style={{
                  background: m.role === 'user' ? tenant.accent : '#fbf8f1',
                  color: m.role === 'user' ? '#fbf8f1' : ink,
                  border: m.role === 'user' ? 'none' : `1px solid ${line}`,
                  padding: '10px 14px',
                  fontFamily: 'Fraunces, serif',
                  fontSize: 14.5, lineHeight: 1.4,
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                }}
              >
                {m.text}
              </div>
              {/* Wine cards inline (solo per messaggi sommelier che includono proposte) */}
              {m.role === 'sommelier' && m.wines && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {m.wines.map((w) => (
                    <button
                      key={w.name + w.year}
                      type="button"
                      onClick={() => onTake(w)}
                      style={{
                        textAlign: 'left', padding: '10px 12px', background: '#fbf8f1',
                        border: `1px solid ${w.accent}`, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: w.accent }}>
                          {TIER_LABELS[w.tierIndex]}
                        </div>
                        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, fontStyle: 'italic', color: ink, fontWeight: 400 }}>
                          {w.name}
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: sub }}>
                          {w.sub}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, color: ink }}>
                          <span style={{ fontSize: 9 }}>CHF </span>
                          <span className="tnum">{w.bottle}</span>
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub }}>
                          bottiglia
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 18px 24px', borderTop: `1px solid ${line}`, background: '#fbf8f1' }}>
          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: tenant.cream, border: `1px solid ${line}`, borderRadius: 22,
            }}
          >
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={busy ? 'Sto pensando…' : 'Scrivi qui…'}
              aria-label="Messaggio per il sommelier"
              disabled={busy}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontFamily: 'Inter, sans-serif', fontSize: 13, color: ink,
              }}
            />
            <button
              type="submit" aria-label="Invia" disabled={busy || !val.trim()}
              style={{
                background: busy || !val.trim() ? sub : tenant.accent,
                border: 'none', cursor: busy || !val.trim() ? 'not-allowed' : 'pointer',
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbf8f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
