'use client';

// TODO: collegare a Prisma client-lapa-wine (restaurant menu, AI extraction job)
import { useState } from 'react';
import { Camera, FileText, PenLine, Check, ChevronRight } from 'lucide-react';
import Header from '../_components/Header';
import BottomNav from '../_components/BottomNav';

const MOCK_MENU: Record<string, string[]> = {
  Antipasti: ['Vitello tonnato', 'Tartare di manzo', 'Carpaccio di polpo'],
  Primi: [
    'Tagliatelle al ragù di cinghiale',
    'Risotto al Barolo',
    'Tortellini in brodo',
    'Pici cacio e pepe',
  ],
  Secondi: ['Brasato al Barolo', 'Cotoletta alla milanese', 'Ossobuco con risotto giallo'],
  Dolci: ['Tiramisù della casa', 'Panna cotta ai frutti rossi'],
};

export default function CaricaMenuPage() {
  const cats = Object.keys(MOCK_MENU);
  const [selectedCat, setSelectedCat] = useState<string>(cats[1] ?? cats[0]);
  const totalDishes = Object.values(MOCK_MENU).flat().length;

  return (
    <>
      <Header subtitle="Menu del ristorante" title="Carica il tuo menu" back="/lapa-wine" />

      <div style={{ padding: '14px 16px 100px' }}>
        {/* 3 input options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { icon: Camera, t: 'Scatta foto', s: 'pagine menu' },
            { icon: FileText, t: 'Carica PDF', s: 'file' },
            { icon: PenLine, t: 'Manuale', s: 'da zero' },
          ].map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.t}
                style={{
                  padding: '14px 8px',
                  background: 'var(--neutral-50, #f4f6f8)',
                  border: '1px solid var(--border, #e5e2dd)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon size={20} color="var(--lapa-red-700, #951616)" strokeWidth={1.5} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{o.t}</span>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--fg-3, #6b5f52)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {o.s}
                </span>
              </button>
            );
          })}
        </div>

        {/* AI extraction status */}
        <div
          style={{
            marginTop: 18,
            padding: '12px 14px',
            background: '#fdf7e8',
            border: '1px solid #e6d8a8',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#fbf8f1',
              border: '1px solid #d9cdb8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Fraunces, Georgia, serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: '#7a6320',
              fontWeight: 600,
            }}
          >
            AI
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#5a4a18' }}>
              {totalDishes} piatti estratti dal tuo menu
            </div>
            <div style={{ fontSize: 11, color: '#7a6320', marginTop: 1 }}>
              Verifica nomi e categorie. Modifica con un tap.
            </div>
          </div>
          <Check size={16} color="#7a6320" />
        </div>

        {/* Category tabs */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            gap: 0,
            overflowX: 'auto',
            borderBottom: '1px solid var(--border, #e5e2dd)',
          }}
        >
          {cats.map((c) => {
            const on = c === selectedCat;
            return (
              <button
                key={c}
                onClick={() => setSelectedCat(c)}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  cursor: 'pointer',
                  border: 'none',
                  borderBottom: on
                    ? '2px solid var(--lapa-red-700, #951616)'
                    : '2px solid transparent',
                  fontSize: 12,
                  fontWeight: on ? 700 : 500,
                  color: on ? 'var(--fg-1, #1c1815)' : 'var(--fg-3, #6b5f52)',
                  letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}
              >
                {c} <span style={{ fontWeight: 400, color: 'var(--fg-4, #9a8f82)' }}>· {MOCK_MENU[c].length}</span>
              </button>
            );
          })}
        </div>

        {/* Dish list */}
        <div>
          {MOCK_MENU[selectedCat].map((d, i) => (
            <div
              key={d}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid var(--border, #e5e2dd)',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: 'var(--neutral-100, #e9ecef)',
                  border: '1px solid var(--border, #e5e2dd)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 9.5,
                  color: 'var(--fg-3, #6b5f52)',
                  borderRadius: 3,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontSize: 14,
                    fontStyle: 'italic',
                  }}
                >
                  {d}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: 'var(--fg-4, #9a8f82)',
                    marginTop: 2,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedCat} · da AI
                </div>
              </div>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--fg-3, #6b5f52)',
                  padding: 4,
                }}
                aria-label="Modifica"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky publish CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 60,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid var(--border, #e5e2dd)',
          zIndex: 40,
        }}
      >
        <button
          style={{
            width: '100%',
            height: 44,
            background: 'var(--lapa-red-700, #951616)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            borderRadius: 6,
          }}
        >
          Pubblica menu · Aggiorna app cliente
        </button>
      </div>

      <BottomNav />
    </>
  );
}
