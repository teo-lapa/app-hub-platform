'use client';

// TODO: collegare a Prisma client-lapa-wine (inventory wines)
import { useState } from 'react';
import { QrCode, Search, Plus } from 'lucide-react';
import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

type Tone = 'red' | 'white' | 'rose' | 'bubbles' | 'grappa';
interface Wine {
  name: string;
  maker: string;
  qty: number;
  min: number;
  tone: Tone;
  image?: string;
  low?: boolean;
  bestseller?: boolean;
  openedToday?: boolean;
}

const STOCK: Wine[] = [
  { name: 'Romeo', maker: 'Mura Mura · Piemonte DOC', qty: 4, min: 6, tone: 'red', image: '/wines/mura-mura-romeo.png', low: true, bestseller: true, openedToday: true },
  { name: "Anima Amarone", maker: "L'Anima di Vergani · Valpolicella", qty: 2, min: 4, tone: 'red', image: '/wines/lanima-di-vergani-anima-amarone.png', low: true },
  { name: 'Anima Toscana', maker: "L'Anima di Vergani · Toscana IGT", qty: 8, min: 6, tone: 'red', image: '/wines/lanima-di-vergani-anima-toscana.png' },
  { name: 'Anima Prosecco Extra Dry', maker: "L'Anima di Vergani · Prosecco DOC", qty: 12, min: 8, tone: 'bubbles', image: '/wines/lanima-di-vergani-anima-prosecco-extra-dry.png', bestseller: true, openedToday: true },
  { name: 'Anima Prosecco Rosé Brut', maker: "L'Anima di Vergani · Prosecco DOC Rosé", qty: 5, min: 4, tone: 'rose', image: '/wines/lanima-di-vergani-anima-prosecco-rose-brut.png' },
  { name: 'Cuvée Prestige Edizione 47', maker: "Ca' del Bosco · Franciacorta DOCG", qty: 6, min: 4, tone: 'bubbles', image: '/wines/ca-del-bosco-cuvee-prestige-edizione-47-extra-brut.png', openedToday: true },
  { name: 'Soave Tessari', maker: 'Tessari Gianni · Soave DOC', qty: 9, min: 6, tone: 'white', image: '/wines/tessari-gianni-soave-tessari.png' },
  { name: 'Tra Noi Nebbiolo Barolo', maker: 'Berta · Grappa Invecchiata', qty: 3, min: 4, tone: 'grappa', image: '/wines/berta-tra-noi-nebbiolo-barolo.png', low: true },
];

const FILTERS = ['Tutti', 'Sotto soglia', 'Aperti oggi', 'Bestseller'] as const;
type Filter = (typeof FILTERS)[number];

export default function CantinaPage() {
  const [active, setActive] = useState<Filter>('Tutti');

  const filtered = STOCK.filter((w) => {
    if (active === 'Sotto soglia') return w.low;
    if (active === 'Aperti oggi') return w.openedToday;
    if (active === 'Bestseller') return w.bestseller;
    return true;
  });

  const lowCount = STOCK.filter((w) => w.low).length;

  return (
    <>
      <Header subtitle="Inventory" title="Cantina" back="/lapa-wine" showBeta={false} />

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 14px',
          overflowX: 'auto',
          background: '#fff',
          borderBottom: '1px solid var(--border-subtle, #ece8e1)',
        }}
      >
        {FILTERS.map((f) => {
          const on = f === active;
          return (
            <button
              key={f}
              onClick={() => setActive(f)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid ' + (on ? 'var(--fg-1, #1c1815)' : 'var(--border, #e5e2dd)'),
                background: on ? 'var(--fg-1, #1c1815)' : 'transparent',
                color: on ? '#fff' : 'var(--fg-2, #4a4038)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {f}
              {f === 'Sotto soglia' && lowCount > 0 && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>{lowCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={{ paddingBottom: 100 }}>
        {filtered.map((w, i) => (
          <div
            key={w.name + i}
            style={{
              padding: '12px 14px',
              background: '#fff',
              borderBottom: '1px solid var(--border-subtle, #ece8e1)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <BottleCard tone={w.tone} image={w.image} alt={w.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {w.name}
                </div>
                {w.low && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#92590f',
                    }}
                  >
                    Sotto soglia
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--fg-3, #6b5f52)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {w.maker}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  color: w.low ? '#92590f' : 'var(--fg-2, #4a4038)',
                }}
              >
                <span>{w.qty} btl</span>
                <span style={{ color: 'var(--fg-4, #9a8f82)', marginLeft: 6 }}>/ min {w.min}</span>
              </div>
            </div>
            <button
              style={{
                width: 36,
                height: 36,
                border: '1px solid var(--border, #e5e2dd)',
                background: '#fff',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Scansiona"
            >
              <QrCode size={16} color="var(--fg-2, #4a4038)" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-3, #6b5f52)', fontSize: 13 }}>
            Nessun vino in questa categoria.
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        style={{
          position: 'fixed',
          right: 'calc(50% - 240px + 18px)',
          bottom: 88,
          height: 48,
          padding: '0 18px',
          background: 'var(--lapa-red-700, #951616)',
          color: '#fff',
          border: 'none',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          zIndex: 40,
        }}
      >
        <Plus size={16} color="#fff" />
        Inventario sera
      </button>

      <BottomNav />
    </>
  );
}

function BottleCard({ tone, image, alt }: { tone: Tone; image?: string; alt?: string }) {
  if (image) {
    return (
      <div
        style={{
          width: 36, height: 54, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={alt || 'bottiglia'}
          loading="lazy"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }
  const tones: Record<Tone, string> = {
    red: '#efe6d6',
    white: '#f0ead8',
    rose: '#f3e0d8',
    bubbles: '#ece8d2',
    grappa: '#e8e0d0',
  };
  return (
    <div
      style={{
        width: 32,
        height: 42,
        background: tones[tone],
        borderRadius: 3,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 3,
          transform: 'translateX(-50%)',
          width: 7,
          height: 11,
          background: '#1c1815',
        }}
      />
    </div>
  );
}
