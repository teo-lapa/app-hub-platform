'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MOCK_TENANT } from '../../../_data';

// ── Types che combaciano col contratto API /api/wine/sommelier ───────────
type WineProposal = {
  wineId: string;
  name: string;
  producer: string;
  region: string;
  vintage: string;
  tier: 'easy' | 'equilibrato' | 'importante';
  price_glass_chf: number;
  price_bottle_chf: number;
  reason: string;
};

type Intent = 'greet' | 'clarify' | 'propose' | 'explain' | 'confirm';

type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; proposedWines?: WineProposal[]; intent?: Intent };

const TIER_LABELS: Record<WineProposal['tier'], string> = {
  easy: 'Easy',
  equilibrato: 'Equilibrato',
  importante: 'Importante',
};
const TIER_COLORS: Record<WineProposal['tier'], string> = {
  easy: '#a85565',
  equilibrato: '#5a1a1f',
  importante: '#3a0e12',
};

// Quick replies — comparsi solo all'inizio della conversazione
const QUICK_REPLIES = [
  '🥩 Carne',
  '🐟 Pesce',
  '🍝 Pasta o risotto',
  '🍕 Pizza',
  '🥗 Vegetariano',
  '🧀 Salumi e formaggi',
  '🍰 Dessert',
  '🍷 Solo un calice',
];

const STORAGE_KEY_BASE = 'lapa-wine-chat';

export default function ChatPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const tenant = MOCK_TENANT; // TODO: getTenant da DB
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';

  const storageKey = `${STORAGE_KEY_BASE}-${params.slug}-${params.tavolo}`;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [imageMap, setImageMap] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Prefetch wineId → image_url mapping (così le mini-card hanno la thumbnail)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wine/catalog?slug=${encodeURIComponent(params.slug)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { wines: { vergani_sku: string; image_url: string | null }[] };
        if (cancelled) return;
        const m = new Map<string, string>();
        for (const w of data.wines) {
          if (w.image_url) m.set(w.vergani_sku, w.image_url);
        }
        setImageMap(m);
      } catch (e) {
        console.warn('[chat] image map prefetch failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [params.slug]);

  // Hydrate from sessionStorage + greet first time
  useEffect(() => {
    let initial: ChatMessage[] = [];
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) initial = JSON.parse(raw) as ChatMessage[];
    } catch {}
    if (initial.length === 0) {
      initial = [
        {
          role: 'assistant',
          content: `Buonasera, sono il sommelier di ${tenant.name}. Cosa stai mangiando stasera? Te lo abbino al vino giusto.`,
          intent: 'greet',
        },
      ];
    }
    setMessages(initial);
    setHydrated(true);
  }, [storageKey, tenant.name]);

  // Persist + auto-scroll
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, hydrated, storageKey]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);

    try {
      // Convert chat history to API format (only role+content)
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/wine/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: params.slug,
          tableCode: params.tavolo,
          language: 'it',
          messages: apiMessages,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        reply: string;
        proposedWines?: WineProposal[];
        intent?: Intent;
      };
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply,
          proposedWines: data.proposedWines,
          intent: data.intent,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore imprevisto';
      console.error('[chat] sommelier error:', msg);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Mi spiace, sono momentaneamente offline (${msg}). Riprova tra un secondo.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const takeWine = (w: WineProposal) => {
    router.push(
      `/w/${params.slug}/${params.tavolo}/confirm?wine=${encodeURIComponent(w.name)}&price=${w.price_bottle_chf}&sub=${encodeURIComponent(w.producer)}&accent=${encodeURIComponent(TIER_COLORS[w.tier])}`,
    );
  };

  const showQuickReplies = hydrated && messages.length === 1 && messages[0].role === 'assistant';

  return (
    <main
      className="wine-surface"
      style={{
        background: tenant.cream,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HEADER fisso */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px 12px',
          borderBottom: `1px solid ${line}`,
          background: tenant.cream,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden="true"
            style={{
              width: 26, height: 26, border: `1px solid ${ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif', fontStyle: tenant.monoStyle, fontSize: 14, color: ink,
            }}
          >
            {tenant.monogram}
          </div>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 14, fontStyle: 'italic', color: ink, lineHeight: 1.1 }}>
              Sommelier
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: sub, marginTop: 2 }}>
              {tenant.name} · Tavolo {params.tavolo}
            </div>
          </div>
        </div>
        <Link
          href={`/w/${params.slug}/${params.tavolo}/wines`}
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: 13,
            fontStyle: 'italic',
            color: tenant.accent,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Carta vini
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </header>

      {/* MESSAGES — scroll area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 18px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                background: m.role === 'user' ? tenant.accent : '#fbf8f1',
                color: m.role === 'user' ? '#fbf8f1' : ink,
                border: m.role === 'user' ? 'none' : `1px solid ${line}`,
                padding: '11px 14px',
                fontFamily: 'Fraunces, serif',
                fontSize: 14.5,
                lineHeight: 1.45,
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>

            {/* Wine cards inline (solo per messaggi sommelier con proposte) */}
            {m.role === 'assistant' && m.proposedWines && m.proposedWines.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.proposedWines.map((w) => (
                  <WineCardInline
                    key={w.wineId}
                    wine={w}
                    imageUrl={imageMap.get(w.wineId) || null}
                    onTake={() => takeWine(w)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: sub, fontFamily: 'Fraunces, serif', fontSize: 13, fontStyle: 'italic' }}>
            <Dots />
            sto pensando…
          </div>
        )}
      </div>

      {/* QUICK REPLIES — solo all'inizio */}
      {showQuickReplies && (
        <div
          style={{
            padding: '8px 14px 0',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={busy}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                background: '#fbf8f1',
                border: `1px solid ${line}`,
                fontFamily: 'Fraunces, serif',
                fontSize: 13,
                fontStyle: 'italic',
                color: ink,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{
          padding: '12px 14px 18px',
          background: tenant.cream,
          borderTop: `1px solid ${line}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px 8px 14px',
            background: '#fbf8f1',
            border: `1px solid ${line}`,
            borderRadius: 24,
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? 'Sto pensando…' : 'Scrivi al sommelier…'}
            aria-label="Messaggio per il sommelier"
            disabled={busy}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'Inter, sans-serif', fontSize: 14, color: ink,
            }}
          />
          {/* TODO: vocale → Web Speech API / Whisper */}
          <button type="button" aria-label="Registra audio" disabled style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          {/* TODO: foto piatto → vision */}
          <button type="button" aria-label="Scatta foto del piatto" disabled style={iconBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Invia"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: busy || !input.trim() ? sub : tenant.accent,
              border: 'none',
              cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbf8f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'not-allowed', opacity: 0.4,
  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};

function WineCardInline({ wine, imageUrl, onTake }: { wine: WineProposal; imageUrl: string | null; onTake: () => void }) {
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const accent = TIER_COLORS[wine.tier];
  return (
    <article
      style={{
        background: '#fbf8f1',
        border: `1px solid ${accent}`,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {imageUrl && (
          <div style={{ flexShrink: 0, width: 56, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={wine.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: accent }}>
            {TIER_LABELS[wine.tier]}
          </div>
          <div style={{ marginTop: 4, fontFamily: 'Fraunces, serif', fontSize: 18, fontStyle: 'italic', color: ink, fontWeight: 400, lineHeight: 1.15 }}>
            {wine.name}
          </div>
          <div style={{ marginTop: 2, fontFamily: 'Inter, sans-serif', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: sub }}>
            {wine.producer} · {wine.region}{wine.vintage && wine.vintage !== 'NV' ? ` · ${wine.vintage}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: ink }}>
            <span style={{ fontSize: 9 }}>CHF </span>
            <span className="tnum">{wine.price_bottle_chf}</span>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: sub, marginTop: 1 }}>
            bottiglia
          </div>
          {wine.price_glass_chf > 0 && (
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: sub, marginTop: 4 }}>
              calice CHF {wine.price_glass_chf}
            </div>
          )}
        </div>
      </div>
      {wine.reason && (
        <p style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 12.5, fontStyle: 'italic', color: sub, fontWeight: 300, lineHeight: 1.4 }}>
          {wine.reason}
        </p>
      )}
      <button
        type="button"
        onClick={onTake}
        style={{
          marginTop: 4,
          padding: '10px 0',
          background: accent,
          color: '#fbf8f1',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        Lo prendo
      </button>
    </article>
  );
}

function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%', background: '#9a8c78',
            animation: `lapadot 1.2s ${i * 0.2}s infinite ease-in-out`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes lapadot {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </span>
  );
}
