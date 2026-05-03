'use client';

import { useState, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MOCK_TENANT } from '../../../_data';

type Category = {
  id: string;
  label: string;
  hint: string; // dishesInput inviato all'API
  icon: string;
};

const CATEGORIES: Category[] = [
  { id: 'carne', label: 'Carne', hint: 'piatto di carne (rossa o bianca)', icon: '🥩' },
  { id: 'pesce', label: 'Pesce', hint: 'piatto di pesce o crudi di mare', icon: '🐟' },
  { id: 'pasta', label: 'Pasta o risotto', hint: 'primo piatto: pasta o risotto', icon: '🍝' },
  { id: 'pizza', label: 'Pizza', hint: 'pizza', icon: '🍕' },
  { id: 'vegetariano', label: 'Vegetariano', hint: 'piatto vegetariano o di verdure', icon: '🥗' },
  { id: 'antipasto', label: 'Antipasto / Salumi', hint: 'antipasto, salumi e formaggi, taglieri', icon: '🧀' },
  { id: 'dessert', label: 'Dessert', hint: 'dessert o fine pasto', icon: '🍰' },
];

export default function DishesPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const tenant = MOCK_TENANT; // TODO: collegare a DB
  const userName: string | null = null;

  const [val, setVal] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';

  const submit = async (dishesInput: string, busyKey: string) => {
    const text = dishesInput.trim();
    if (!text) return;
    setError(null);
    setBusy(busyKey);
    try {
      const res = await fetch('/api/wine/sommelier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: params.slug,
          tableCode: params.tavolo,
          dishesInput: text,
          language: 'it',
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Stash payload in sessionStorage so /wines can render real Claude output
      sessionStorage.setItem(
        `lapa-wine-suggestion-${params.slug}-${params.tavolo}`,
        JSON.stringify({ ...data, dishesInput: text }),
      );
      const sid = encodeURIComponent(data.suggestionId || text);
      startTransition(() => {
        router.push(`/w/${params.slug}/${params.tavolo}/wines?sid=${sid}`);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore imprevisto';
      console.error('[dishes] sommelier error:', msg);
      setError('Il sommelier è momentaneamente irraggiungibile. Riprova.');
      setBusy(null);
    }
  };

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
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            aria-hidden="true"
            style={{
              width: 22, height: 22, border: `1px solid ${ink}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces, serif', fontStyle: tenant.monoStyle, fontSize: 13, color: ink,
            }}
          >
            {tenant.monogram}
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: sub }}>
            {tenant.eyebrow}
          </span>
        </div>
        <span style={{ fontSize: 11, color: sub }}>IT</span>
      </div>

      {/* Heading */}
      <div style={{ padding: '20px 28px 0' }}>
        <div className="eyebrow-wine" style={{ color: sub }}>
          {userName ? `Buonasera ${userName}` : 'Buonasera'} · TAVOLO {params.tavolo}
        </div>
        <h1
          style={{
            marginTop: 14, font: 'var(--text-display-serif)', fontSize: 36, lineHeight: 1.06,
            letterSpacing: '-0.018em', color: ink, fontStyle: 'italic', fontWeight: 300,
          }}
        >
          Cosa stai
          <br />
          mangiando?
        </h1>
        <p style={{ margin: '14px 0 0', fontFamily: 'Inter, sans-serif', fontSize: 13.5, lineHeight: 1.5, color: sub }}>
          Scegli una categoria, oppure scrivimi pure.
        </p>
      </div>

      {/* Categorie — 7 grid 2 colonne */}
      <div style={{ padding: '24px 24px 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {CATEGORIES.map((c) => {
            const isBusy = busy === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => submit(c.hint, c.id)}
                disabled={busy !== null}
                style={{
                  textAlign: 'left',
                  padding: '16px 14px',
                  background: isBusy ? tenant.accent : '#fbf8f1',
                  color: isBusy ? '#fbf8f1' : ink,
                  border: `1px solid ${isBusy ? tenant.accent : line}`,
                  cursor: busy !== null ? 'wait' : 'pointer',
                  opacity: busy !== null && !isBusy ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 120ms ease',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{c.icon}</span>
                <span
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontSize: 15.5,
                    fontStyle: 'italic',
                    fontWeight: 400,
                    lineHeight: 1.15,
                  }}
                >
                  {isBusy ? 'Sto pensando…' : c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Free text — opzionale */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(val, '__free__');
        }}
        style={{ padding: '24px 28px 0' }}
      >
        <div className="eyebrow-wine" style={{ color: sub, marginBottom: 10 }}>
          oppure scrivimi tu
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px',
            background: '#fbf8f1', border: `1px solid ${line}`,
          }}
        >
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="es. Tagliatelle al ragù e poi una bistecca…"
            aria-label="Descrivi cosa stai mangiando"
            disabled={busy !== null}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'Fraunces, serif', fontSize: 14,
              fontStyle: val ? 'normal' : 'italic',
              color: val ? ink : sub, fontWeight: 300,
            }}
          />
          {/* TODO: voice → Web Speech / Whisper */}
          <button type="button" aria-label="Registra messaggio vocale" style={iconBtn} disabled>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fbe4d8', border: '1px solid #d49a7a', color: '#8a3a1a', fontFamily: 'Inter, sans-serif', fontSize: 12.5 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy !== null || !val.trim()}
          style={{
            marginTop: 18, width: '100%', height: 50,
            background: tenant.accent, color: '#fbf8f1', border: 'none',
            cursor: busy !== null || !val.trim() ? 'not-allowed' : 'pointer',
            opacity: !val.trim() ? 0.45 : 1,
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.18em', textTransform: 'uppercase',
          }}
        >
          {busy === '__free__' ? 'Sto pensando…' : pending ? 'Un attimo…' : 'Suggerisci'}
        </button>
      </form>

      <div style={{ height: 32 }} />
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
