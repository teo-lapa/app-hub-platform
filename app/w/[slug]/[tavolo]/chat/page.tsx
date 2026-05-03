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
  '🥃 Una grappa per chiudere',
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
  const [recording, setRecording] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; mimeType: string; base64: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  // Web Speech API setup (browser native, no costo)
  const startRecording = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        alert('Il dettato vocale non è supportato su questo browser. Usa Chrome o Safari.');
        return;
      }
      const rec = new SR();
      rec.lang = 'it-IT';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let txt = '';
        for (let i = 0; i < event.results.length; i++) txt += event.results[i][0].transcript;
        setInput(txt);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        // 'no-speech' è il classico falso allarme: l'utente sta pensando.
        // 'aborted' è quando chiamiamo stop noi. Ignoriamoli.
        if (e?.error === 'no-speech' || e?.error === 'aborted') return;
        console.warn('[chat] speech recognition error:', e?.error);
        setRecording(false);
      };
      rec.onend = () => {
        // Quando il browser termina automaticamente (timeout silenzio),
        // se l'utente NON ha premuto stop, riavviamo per non interrompere il dettato.
        if (recognitionRef.current === rec) {
          try {
            rec.start();
          } catch {
            // già partito o non riavviabile → segna stop
            recognitionRef.current = null;
            setRecording(false);
          }
        } else {
          setRecording(false);
        }
      };
      rec.start();
      recognitionRef.current = rec;
      setRecording(true);
    } catch (e) {
      console.error('[chat] speech recognition error', e);
      setRecording(false);
    }
  };
  const stopRecording = () => {
    // Azzero il ref PRIMA di stop() così onend non auto-riavvia
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop();
    } catch {}
    setRecording(false);
  };

  const onPickImage = async (file: File) => {
    if (!file) return;
    // Limita a 5 MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Foto troppo grande (max 5MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      setPendingImage({ dataUrl, mimeType: file.type || 'image/jpeg', base64 });
    };
    reader.readAsDataURL(file);
  };

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
    const hasImage = !!pendingImage;
    if ((!trimmed && !hasImage) || busy) return;
    if (recording) stopRecording();
    setInput('');
    const imageToSend = pendingImage;
    setPendingImage(null);

    const userContent = trimmed || (hasImage ? '📷 (foto del piatto)' : '');
    const userMsg: ChatMessage = { role: 'user', content: userContent };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);

    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/wine/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: params.slug,
          tableCode: params.tavolo,
          language: 'it',
          messages: apiMessages,
          image: imageToSend ? { base64: imageToSend.base64, mimeType: imageToSend.mimeType } : undefined,
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
    const img = imageMap.get(w.wineId) || '';
    const qs = new URLSearchParams({
      wineId: w.wineId,
      wine: w.name,
      sub: w.producer,
      price: String(w.price_bottle_chf),
      glass: String(w.price_glass_chf),
      accent: TIER_COLORS[w.tier],
      image: img,
    });
    router.push(`/w/${params.slug}/${params.tavolo}/confirm?${qs.toString()}`);
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

      {/* INPUT BAR — sticky bottom, safe-area aware */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        style={{
          padding: '10px 12px calc(14px + env(safe-area-inset-bottom, 0px))',
          background: tenant.cream,
          borderTop: `1px solid ${line}`,
          position: 'sticky',
          bottom: 0,
        }}
      >
        {/* Foto preview pill */}
        {pendingImage && (
          <div
            style={{
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px 6px 6px',
              background: '#fbf8f1',
              border: `1px solid ${line}`,
              borderRadius: 12,
              maxWidth: 'fit-content',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.dataUrl}
              alt="anteprima foto piatto"
              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
            />
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: 12.5, fontStyle: 'italic', color: sub }}>
              foto del piatto pronta
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="Rimuovi foto"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: 4, color: sub, display: 'flex',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 6,
            padding: '8px 8px 8px 14px',
            background: '#fbf8f1',
            border: `1px solid ${recording ? tenant.accent : line}`,
            borderRadius: 22,
            transition: 'border-color 120ms ease',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder={busy ? 'Sto pensando…' : recording ? 'Ti ascolto…' : 'Scrivi o detta al sommelier'}
            aria-label="Messaggio per il sommelier"
            disabled={busy}
            rows={1}
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none', outline: 'none',
              resize: 'none', overflow: 'auto',
              fontFamily: 'Inter, sans-serif', fontSize: 15, color: ink,
              lineHeight: 1.4,
              padding: '8px 4px',
              maxHeight: 140,
            }}
          />

          {/* hidden file input per camera */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickImage(f);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
          {/* Camera */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            aria-label="Scatta foto del piatto"
            title="Foto del piatto"
            style={iconBtnActive(busy)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
          {/* Mic */}
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            aria-label={recording ? 'Ferma registrazione' : 'Detta vocale'}
            title="Detta vocale"
            style={{
              ...iconBtnActive(busy),
              background: recording ? tenant.accent : 'transparent',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={recording ? '#fbf8f1' : ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          {/* Send */}
          <button
            type="submit"
            disabled={busy || (!input.trim() && !pendingImage)}
            aria-label="Invia"
            style={{
              flexShrink: 0,
              width: 40, height: 40, borderRadius: '50%',
              background: busy || (!input.trim() && !pendingImage) ? sub : tenant.accent,
              border: 'none',
              cursor: busy || (!input.trim() && !pendingImage) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbf8f1" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}

function iconBtnActive(busy: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    background: 'transparent',
    border: 'none',
    cursor: busy ? 'not-allowed' : 'pointer',
    width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
    borderRadius: '50%',
    opacity: busy ? 0.4 : 1,
  };
}

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
