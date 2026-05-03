'use client';

// TODO: collegare a Prisma client-lapa-wine (riordino + comande live)
import { useState } from 'react';
import { Sparkles, Plus, Minus, Truck, Check } from 'lucide-react';
import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

interface ReorderItem {
  name: string;
  maker: string;
  qty: number;
  price: number;
  image?: string;
}

const REORDER: ReorderItem[] = [
  { name: 'Romeo', maker: 'Mura Mura · Barbera/Nebbiolo', qty: 6, price: 28, image: '/wines/mura-mura-romeo.png' },
  { name: 'Anima Amarone', maker: "L'Anima di Vergani · Valpolicella", qty: 4, price: 64, image: '/wines/lanima-di-vergani-anima-amarone.png' },
  { name: 'Anima Prosecco Extra Dry', maker: "L'Anima di Vergani · Prosecco DOC", qty: 6, price: 22, image: '/wines/lanima-di-vergani-anima-prosecco-extra-dry.png' },
  { name: 'Tra Noi Nebbiolo Barolo', maker: 'Berta · Grappa Invecchiata', qty: 3, price: 78, image: '/wines/berta-tra-noi-nebbiolo-barolo.png' },
];

interface Comanda {
  table: string;
  time: string;
  wine: string;
  maker: string;
  price: number;
  customer: string;
  image?: string;
}

const COMANDE: Comanda[] = [
  { table: 'Tavolo 7', time: '20:24', wine: 'Romeo, Mura Mura', maker: 'Bottiglia · carta', price: 56, customer: 'Paolo M. · 4ª visita', image: '/wines/mura-mura-romeo.png' },
  { table: 'Tavolo 3', time: '20:18', wine: 'Anima Prosecco Extra Dry', maker: 'Calice · carta', price: 12, customer: 'Walk-in', image: '/wines/lanima-di-vergani-anima-prosecco-extra-dry.png' },
];

export default function OrdiniPage() {
  const [qty, setQty] = useState<number[]>(REORDER.map((i) => i.qty));
  const total = REORDER.reduce((s, it, i) => s + qty[i] * it.price, 0);

  return (
    <>
      <Header subtitle="Riordino + comande" title="Ordini" back="/lapa-wine" />

      <div style={{ paddingBottom: 220 }}>
        {/* Sezione "Da riordinare" */}
        <div style={{ padding: '14px 16px 4px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fg-3, #6b5f52)',
              fontWeight: 600,
            }}
          >
            <Sparkles size={11} /> Suggerito da LAPA
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 20,
              fontWeight: 500,
              margin: '4px 0 0',
            }}
          >
            Da riordinare — martedì
          </h2>
        </div>

        <div
          style={{
            margin: '12px 14px',
            padding: 12,
            background: 'var(--lapa-red-50, #fdf2f2)',
            border: '1px solid var(--lapa-red-200, #f7c8c8)',
            borderRadius: 8,
            fontFamily: 'Fraunces, Georgia, serif',
            fontStyle: 'italic',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--lapa-red-800, #7a1414)',
          }}
        >
          Tre etichette sotto soglia, due bestseller della scorsa settimana, una grappa che gira nel weekend. Pareggiamo
          il minimo Vergani.
        </div>

        {REORDER.map((it, i) => (
          <div
            key={it.name}
            style={{
              padding: '14px 16px',
              background: '#fff',
              borderBottom: '1px solid var(--border-subtle, #ece8e1)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 56,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt={it.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 32, height: 44, background: '#efe6d6', borderRadius: 3, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 3, transform: 'translateX(-50%)', width: 7, height: 11, background: '#1c1815' }} />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
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
                {it.maker}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  color: 'var(--fg-2, #4a4038)',
                }}
              >
                CHF {it.price}/btl
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid var(--border, #e5e2dd)',
                borderRadius: 8,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <button
                onClick={() => setQty((q) => q.map((v, j) => (j === i ? Math.max(0, v - 1) : v)))}
                style={stepBtn}
                aria-label="Diminuisci"
              >
                <Minus size={14} color="var(--fg-2, #4a4038)" />
              </button>
              <div
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}
              >
                {qty[i]}
              </div>
              <button
                onClick={() => setQty((q) => q.map((v, j) => (j === i ? v + 1 : v)))}
                style={stepBtn}
                aria-label="Aumenta"
              >
                <Plus size={14} color="var(--fg-2, #4a4038)" />
              </button>
            </div>
          </div>
        ))}

        {/* Sezione "Comande in arrivo" */}
        <div style={{ padding: '24px 16px 4px' }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fg-3, #6b5f52)',
              fontWeight: 600,
            }}
          >
            Live
          </div>
          <h2
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 20,
              fontWeight: 500,
              margin: '4px 0 0',
            }}
          >
            Comande in arrivo dai tavoli
          </h2>
        </div>

        {COMANDE.map((c, i) => (
          <div
            key={i}
            style={{
              margin: '12px 14px',
              padding: 14,
              background: '#fff',
              border: '1px solid var(--border, #e5e2dd)',
              borderLeft: '3px solid var(--lapa-red-600, #b81e1e)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-3, #6b5f52)',
                  fontWeight: 600,
                }}
              >
                {c.table} · {c.time}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>CHF {c.price}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              {c.image && (
                <div style={{ width: 36, height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.image} alt={c.wine} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 500 }}>
                  {c.wine}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3, #6b5f52)', marginTop: 2 }}>{c.maker}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3, #6b5f52)', marginTop: 6 }}>{c.customer}</div>
          </div>
        ))}
      </div>

      {/* Bottom summary fisso */}
      <div
        style={{
          position: 'fixed',
          bottom: 60,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          background: '#fff',
          borderTop: '1px solid var(--border, #e5e2dd)',
          padding: '14px 18px',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fg-3, #6b5f52)',
                fontWeight: 600,
              }}
            >
              Totale ordine
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                CHF {total.toLocaleString('de-CH')}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#027a48',
                }}
              >
                <Check size={12} /> sopra minimo
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--fg-3, #6b5f52)',
            }}
          >
            <Truck size={12} /> Domani 11:00
          </div>
        </div>
        <button
          style={{
            marginTop: 10,
            width: '100%',
            height: 48,
            background: 'var(--lapa-red-600, #b81e1e)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Conferma ordine LAPA
        </button>
      </div>

      <BottomNav />
    </>
  );
}

const stepBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
