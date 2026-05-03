'use client';

import { useState, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MOCK_TENANT } from '../../../_data';

export default function DishesPage() {
  const router = useRouter();
  const params = useParams<{ slug: string; tavolo: string }>();
  const tenant = MOCK_TENANT; // TODO: collegare a DB / API
  const userName: string | null = null; // TODO: prendere da auth/cookie

  const [val, setVal] = useState('');
  const [pending, startTransition] = useTransition();
  const ink = '#1c1815';
  const sub = '#6b5f52';
  const line = '#d6cdb8';

  const submit = async (dish: string) => {
    const text = dish.trim();
    if (!text) return;
    // TODO: collegare a /api/wine/sommelier
    // const res = await fetch('/api/wine/sommelier', { method: 'POST', body: JSON.stringify({ slug: params.slug, tavolo: params.tavolo, dish: text }) });
    // const { sid } = await res.json();
    const sid = encodeURIComponent(text);
    startTransition(() => {
      router.push(`/w/${params.slug}/${params.tavolo}/wines?sid=${sid}`);
    });
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px 10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            aria-hidden="true"
            style={{
              width: 22,
              height: 22,
              border: `1px solid ${ink}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Fraunces, serif',
              fontStyle: tenant.monoStyle,
              fontSize: 13,
              color: ink,
            }}
          >
            {tenant.monogram}
          </div>
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: sub,
            }}
          >
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
            marginTop: 14,
            font: 'var(--text-display-serif)',
            fontSize: 36,
            lineHeight: 1.06,
            letterSpacing: '-0.018em',
            color: ink,
            fontStyle: 'italic',
            fontWeight: 300,
          }}
        >
          Cosa stai
          <br />
          mangiando
          <br />
          stasera?
        </h1>
        <p
          style={{
            margin: '14px 0 0',
            fontFamily: 'Inter, sans-serif',
            fontSize: 13.5,
            lineHeight: 1.5,
            color: sub,
          }}
        >
          Te lo abbino al vino giusto.
        </p>
      </div>

      {/* Input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(val);
        }}
        style={{ padding: '24px 28px 0' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 14px',
            background: '#fbf8f1',
            border: `1px solid ${line}`,
          }}
        >
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Cosa state mangiando?"
            aria-label="Descrivi il piatto"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'Fraunces, serif',
              fontSize: 14,
              fontStyle: val ? 'normal' : 'italic',
              color: val ? ink : sub,
              fontWeight: 300,
            }}
          />
          {/* TODO: collegare voice → Web Speech / Whisper */}
          <button
            type="button"
            aria-label="Registra messaggio vocale"
            style={iconBtn}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          <div style={{ width: 1, height: 18, background: line }} />
          {/* TODO: collegare camera → upload + vision OCR */}
          <button
            type="button"
            aria-label="Scatta foto del piatto"
            style={iconBtn}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </button>
        </div>

        {/* Suggerimenti dal menu */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.18em',
              color: sub,
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Suggerimenti dal menu di stasera
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tenant.menu.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => submit(m)}
                style={{
                  textAlign: 'left',
                  padding: '14px 0',
                  background: 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderTop: i === 0 ? `1px solid ${line}` : 'none',
                  borderBottom: `1px solid ${line}`,
                  fontFamily: 'Fraunces, serif',
                  fontSize: 16,
                  fontStyle: 'italic',
                  color: ink,
                  fontWeight: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <span>{m}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          type="submit"
          disabled={pending || !val.trim()}
          style={{
            marginTop: 28,
            width: '100%',
            height: 52,
            background: tenant.accent,
            color: '#fbf8f1',
            border: 'none',
            cursor: pending || !val.trim() ? 'not-allowed' : 'pointer',
            opacity: !val.trim() ? 0.45 : 1,
            fontFamily: 'Inter, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {pending ? 'Un attimo…' : 'Suggerisci'}
        </button>
      </form>

      <div style={{ height: 32 }} />
    </main>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
};
