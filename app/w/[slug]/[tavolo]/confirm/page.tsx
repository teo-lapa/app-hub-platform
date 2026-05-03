'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { MOCK_TENANT, TIER_WINES } from '../../../_data';

export default function ConfirmPage() {
  const params = useParams<{ slug: string; tavolo: string }>();
  const sp = useSearchParams();
  const tenant = MOCK_TENANT; // TODO: collegare a DB / API

  const wineName = sp.get('wine') || TIER_WINES[1].name;
  const sub = sp.get('sub') || TIER_WINES[1].sub;
  const price = sp.get('price') || String(TIER_WINES[1].bottle);
  const accent = sp.get('accent') || TIER_WINES[1].accent;

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setPhase(1), 2000);
    return () => clearTimeout(id);
  }, []);

  const ink = '#1c1815';
  const subColor = '#6b5f52';
  const line = '#d6cdb8';

  return (
    <main
      className="wine-surface"
      style={{ background: tenant.cream, minHeight: '100vh', position: 'relative' }}
    >
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
              color: subColor,
            }}
          >
            {tenant.eyebrow}
          </span>
        </div>
        <span style={{ fontSize: 11, color: subColor }}>IT</span>
      </div>

      <div style={{ padding: '40px 28px 0', textAlign: 'center' }}>
        {/* animated bottle + check */}
        <BottleCheck accent={accent} />

        <div className="eyebrow-wine" style={{ color: subColor, marginTop: 22 }}>
          Comanda inviata
        </div>

        <h2
          style={{
            marginTop: 14,
            font: 'var(--text-display-serif)',
            fontSize: 32,
            fontStyle: 'italic',
            fontWeight: 300,
            letterSpacing: '-0.015em',
            color: ink,
            lineHeight: 1.05,
          }}
        >
          {wineName}
        </h2>
        <div
          style={{
            marginTop: 6,
            fontFamily: 'Inter, sans-serif',
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: subColor,
          }}
        >
          {sub} · CHF {price}
        </div>

        {/* Status timeline */}
        <div
          style={{
            marginTop: 36,
            padding: '18px 18px',
            background: '#fbf8f1',
            border: `1px solid ${line}`,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingBottom: 14,
              borderBottom: `1px solid ${line}`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6f6b3c' }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  color: subColor,
                  textTransform: 'uppercase',
                }}
              >
                fase 1
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: 'Fraunces, serif',
                  fontSize: 16,
                  fontStyle: 'italic',
                  color: ink,
                }}
              >
                Aperto
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingTop: 14,
              opacity: phase >= 1 ? 1 : 0.45,
              transition: 'opacity 600ms',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: phase >= 1 ? accent : line }} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '0.18em',
                  color: subColor,
                  textTransform: 'uppercase',
                }}
              >
                fase 2
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: 'Fraunces, serif',
                  fontSize: 16,
                  fontStyle: 'italic',
                  color: ink,
                }}
              >
                In arrivo
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: 28, right: 28, textAlign: 'center' }}>
        <Link
          href={`/w/${params.slug}/${params.tavolo}/dishes`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 46,
            background: 'transparent',
            border: `1px solid ${ink}`,
            color: ink,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          + Aggiungi un altro calice
        </Link>
        <div
          style={{
            marginTop: 14,
            fontFamily: 'Fraunces, serif',
            fontSize: 12,
            fontStyle: 'italic',
            color: subColor,
            fontWeight: 300,
          }}
        >
          Buona cena.
        </div>
      </div>
    </main>
  );
}

function BottleCheck({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @keyframes bottle-rise { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes check-pop { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
        .bc-bottle { animation: bottle-rise 600ms ease-out both }
        .bc-check { animation: check-pop 500ms 600ms ease-out both; transform-origin: center }
      `}</style>
      <svg width="120" height="140" viewBox="0 0 120 140" aria-hidden="true">
        <g className="bc-bottle">
          <rect x="48" y="6" width="24" height="22" fill="#1c1815" />
          <path d="M 44 28 L 44 52 Q 36 62 34 78 L 34 124 Q 34 130 40 130 L 80 130 Q 86 130 86 124 L 86 78 Q 84 62 76 52 L 76 28 Z" fill={accent} opacity="0.92" />
          <rect x="40" y="78" width="40" height="34" fill="#fbf8f1" />
          <line x1="46" y1="86" x2="74" y2="86" stroke={accent} strokeWidth="0.6" />
        </g>
        <g className="bc-check" transform="translate(60 60)">
          <circle r="22" fill="#fbf8f1" stroke={accent} strokeWidth="1.2" />
          <path d="m -8 0 5 5 11 -11" fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}
